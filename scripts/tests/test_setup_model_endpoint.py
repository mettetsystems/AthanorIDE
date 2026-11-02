"""Download integrity and service-file safety regressions; no GPU or network needed."""

import argparse
import hashlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "setup_model_endpoint",
    Path(__file__).parents[1] / "setup-model-endpoint.py",
)
setup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(setup)


class Response(io.BytesIO):
    def __init__(self, body, status=200, content_range=None):
        super().__init__(body)
        self.status = status
        self.headers = {"Content-Range": content_range}


class ModelSetupTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.model = Path(self.directory.name) / setup.MODEL_FILENAME
        self.weights = b"verified model weights"
        files = patch.object(
            setup,
            "MODEL_FILES",
            {
                setup.MODEL_FILENAME: (
                    len(self.weights),
                    hashlib.sha256(self.weights).hexdigest(),
                )
            },
        )
        files.start()
        self.addCleanup(files.stop)

    def test_valid_existing_model_never_downloads(self):
        self.model.write_bytes(self.weights)
        with patch.object(setup.urllib.request, "urlopen") as download:
            setup.ensure_model(self.model, no_download=True)
        download.assert_not_called()

    def test_cached_shard_symlink_is_verified_without_resolving_its_name(self):
        blob = self.model.parent / "blob-hash"
        blob.write_bytes(self.weights)
        self.model.symlink_to(blob)
        with patch.object(setup.urllib.request, "urlopen") as download:
            setup.ensure_model(self.model, no_download=True)
        download.assert_not_called()
        self.assertTrue(self.model.is_symlink())
        unit = setup.service_text(["/bin/llama", "serve"], self.model, "GPU-test", 8081)
        self.assertIn(setup.MODEL_FILENAME, unit)
        self.assertNotIn("blob-hash", unit)

    def test_invalid_existing_model_is_not_overwritten(self):
        self.model.write_bytes(b"different model")
        with (
            patch.object(setup.urllib.request, "urlopen") as download,
            self.assertRaisesRegex(RuntimeError, "left unchanged"),
        ):
            setup.ensure_model(self.model, no_download=False)
        download.assert_not_called()
        self.assertEqual(self.model.read_bytes(), b"different model")

    def test_missing_model_no_download_has_no_side_effects(self):
        with self.assertRaisesRegex(RuntimeError, "--no-download"):
            setup.ensure_model(self.model, no_download=True)
        self.assertEqual(list(self.model.parent.iterdir()), [])

    def test_resume_checks_range_and_promotes_only_verified_weights(self):
        partial = self.model.with_suffix(".gguf.part")
        partial.write_bytes(self.weights[:5])
        response = Response(
            self.weights[5:],
            206,
            f"bytes 5-{len(self.weights) - 1}/{len(self.weights)}",
        )
        with patch.object(
            setup.urllib.request, "urlopen", return_value=response
        ) as download:
            setup.ensure_model(self.model, no_download=False)
        self.assertEqual(download.call_args.args[0].get_header("Range"), "bytes=5-")
        self.assertEqual(self.model.read_bytes(), self.weights)
        self.assertFalse(partial.exists())

    def test_ignored_range_cannot_corrupt_partial_file(self):
        partial = self.model.with_suffix(".gguf.part")
        partial.write_bytes(self.weights[:5])
        with (
            patch.object(
                setup.urllib.request, "urlopen", return_value=Response(self.weights)
            ),
            self.assertRaisesRegex(RuntimeError, "did not honor resume"),
        ):
            setup.ensure_model(self.model, no_download=False)
        self.assertEqual(partial.read_bytes(), self.weights[:5])
        self.assertFalse(self.model.exists())

    def test_bad_download_is_not_installed(self):
        response = Response(b"x" * len(self.weights))
        with (
            patch.object(setup.urllib.request, "urlopen", return_value=response),
            self.assertRaisesRegex(RuntimeError, "Checksum mismatch"),
        ):
            setup.ensure_model(self.model, no_download=False)
        self.assertFalse(self.model.exists())

    def test_unit_arguments_preserve_spaces_and_disable_expansion(self):
        text = setup.service_text(
            ["/home/example/my runtime/llama", "serve"],
            Path('/models/100%/$CACHE/quoted"file.gguf'),
            "GPU-test",
            8081,
        )
        self.assertIn('ExecStart=:"/home/example/my runtime/llama" "serve"', text)
        self.assertIn('"/models/100%%/$CACHE/quoted\\"file.gguf"', text)
        self.assertIn('"--host" "127.0.0.1"', text)
        with self.assertRaises(ValueError):
            setup.unit_quote("model\nExecStart=/unexpected")

    def test_atomic_install_replaces_legacy_link_without_editing_target(self):
        target = self.model.parent / "legacy.service"
        target.write_text("legacy")
        unit = self.model.parent / "current.service"
        unit.symlink_to(target)
        self.assertTrue(setup.atomic_write(unit, "managed"))
        self.assertEqual(target.read_text(), "legacy")
        self.assertFalse(unit.is_symlink())
        self.assertFalse(setup.atomic_write(unit, "managed"))


class EndpointReuseTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "model-endpoint.json"
        self.args = argparse.Namespace(
            endpoint=None,
            model=None,
            api_key_env=None,
            port=8081,
            new_instance=False,
            dry_run=False,
        )
        self.candidate = {
            "base_url": "http://127.0.0.1:8000/v1",
            "endpoint": "http://127.0.0.1:8000/v1/chat/completions",
            "models": ["existing-model"],
            "status": "ready",
            "detail": "",
            "useToken": False,
        }
        for mocked in (
            patch.object(setup, "discover_endpoints", return_value=[self.candidate]),
            patch.object(setup, "config_path", return_value=self.path),
        ):
            mocked.start()
            self.addCleanup(mocked.stop)

    def test_accept_reuses_before_systemd_gpu_runtime_or_download(self):
        with (
            patch.object(setup.sys.stdin, "isatty", return_value=True),
            patch("builtins.input", return_value=""),
            patch.object(setup, "run") as run,
            patch.object(setup, "ensure_model") as download,
            patch.object(setup, "runtime_command") as runtime,
        ):
            setup.install(self.args)
        run.assert_not_called()
        download.assert_not_called()
        runtime.assert_not_called()
        config = json.loads(self.path.read_text())
        self.assertEqual(config["model"], "existing-model")
        self.assertFalse(config["managed"])
        self.assertNotIn("service", config)

    def test_decline_does_not_fall_through_to_launch(self):
        with (
            patch.object(setup.sys.stdin, "isatty", return_value=True),
            patch("builtins.input", return_value="n"),
            patch.object(setup, "run") as run,
            self.assertRaisesRegex(RuntimeError, "cancelled"),
        ):
            setup.install(self.args)
        run.assert_not_called()
        self.assertFalse(self.path.exists())

    def test_noninteractive_never_silently_launches_a_second_model(self):
        with (
            patch.object(setup.sys.stdin, "isatty", return_value=False),
            self.assertRaisesRegex(RuntimeError, "Existing endpoints found"),
        ):
            setup.install(self.args)

    def test_custom_authenticated_endpoint_preserves_model_and_never_saves_token(self):
        self.args.endpoint = "https://models.example/proxy/v1"
        self.args.api_key_env = "TEST_MODEL_TOKEN"
        self.args.model = "second"
        self.candidate["models"].append("second")
        self.candidate["useToken"] = True
        with (
            patch.dict(setup.os.environ, {"TEST_MODEL_TOKEN": "secret-value"}),
            patch.object(setup, "probe_endpoint", return_value=self.candidate) as probe,
        ):
            self.assertTrue(setup.reuse_endpoint(self.args))
        probe.assert_called_once_with(
            self.args.endpoint, token="secret-value", timeout=5
        )
        self.assertNotIn("secret-value", self.path.read_text())
        self.assertTrue(json.loads(self.path.read_text())["useToken"])
        self.assertEqual(json.loads(self.path.read_text())["model"], "second")

    def test_multiple_models_require_explicit_noninteractive_selection(self):
        self.args.endpoint = self.candidate["base_url"]
        self.candidate["models"].append("second")
        with (
            patch.object(setup, "probe_endpoint", return_value=self.candidate),
            patch.object(setup.sys.stdin, "isatty", return_value=False),
            self.assertRaisesRegex(RuntimeError, "Multiple models"),
        ):
            setup.reuse_endpoint(self.args)
        self.assertFalse(self.path.exists())

    def test_unreachable_explicit_endpoint_never_launches(self):
        self.args.endpoint = "http://127.0.0.1:9000"
        with (
            patch.object(setup, "probe_endpoint", return_value=None),
            self.assertRaisesRegex(RuntimeError, "supplied endpoint"),
        ):
            setup.install(self.args)

    def test_auth_required_or_loading_endpoint_prevents_launch(self):
        for status in ("auth_required", "unavailable"):
            with self.subTest(status=status):
                self.candidate.update(status=status, models=[])
                with (
                    patch.object(setup.sys.stdin, "isatty", return_value=True),
                    patch("builtins.input", return_value="y"),
                    self.assertRaisesRegex(RuntimeError, "No model started"),
                ):
                    setup.install(self.args)

    def test_dry_run_does_not_prompt_or_write(self):
        self.args.dry_run = True
        with patch("builtins.input") as prompt:
            self.assertTrue(setup.reuse_endpoint(self.args))
        prompt.assert_not_called()
        self.assertFalse(self.path.exists())

    def test_new_instance_is_explicit_opt_in(self):
        self.args.new_instance = True
        self.assertFalse(setup.reuse_endpoint(self.args))

    def test_endpoint_or_gpu_process_appearing_during_download_prevents_service_write(
        self,
    ):
        self.args.gpu = None
        self.args.allow_busy_gpu = False
        self.args.llama_bin = None
        self.args.model_dir = Path(self.directory.name)
        self.args.download = False
        for late_endpoint in (True, False):
            with (
                self.subTest(late_endpoint=late_endpoint),
                patch.dict(setup.os.environ, {"XDG_CONFIG_HOME": self.directory.name}),
                patch.object(setup.os, "geteuid", return_value=1000),
                patch.object(
                    setup,
                    "discover_endpoints",
                    side_effect=[[], [self.candidate] if late_endpoint else []],
                ),
                patch.object(setup, "choose_gpu", return_value=("GPU-test", "GPU")),
                patch.object(
                    setup,
                    "check_gpu_available",
                    side_effect=[None, RuntimeError("GPU became busy")],
                ) as check_gpu,
                patch.object(
                    setup, "runtime_command", return_value=["/bin/llama-server"]
                ),
                patch.object(setup, "run", return_value="") as run,
                patch.object(
                    setup.subprocess,
                    "run",
                    return_value=argparse.Namespace(returncode=3),
                ),
                patch.object(setup.socket, "create_connection", side_effect=OSError),
                patch.object(setup, "ensure_model"),
                patch.object(setup, "atomic_write") as write,
                self.assertRaisesRegex(
                    RuntimeError, "appeared during setup|GPU became busy"
                ),
            ):
                setup.install(self.args)
            write.assert_not_called()
            run.assert_called_once_with(
                ["systemctl", "--user", "show", "--property=Version"]
            )
            self.assertEqual(check_gpu.call_count, 1 if late_endpoint else 2)

    def test_gpu_selection_uses_free_memory(self):
        with patch.object(
            setup,
            "run",
            return_value="0, GPU-busy, 2000, Big GPU\n1, GPU-free, 12000, Small GPU",
        ) as run:
            self.assertEqual(setup.choose_gpu(None), ("GPU-free", "Small GPU"))
        self.assertIn("--query-gpu=index,uuid,memory.free,name", run.call_args.args[0])

    def test_busy_gpu_blocks_before_runtime_even_without_a_detected_endpoint(self):
        self.args.gpu = None
        self.args.allow_busy_gpu = False
        with (
            patch.object(setup, "discover_endpoints", return_value=[]),
            patch.object(setup.os, "geteuid", return_value=1000),
            patch.object(setup, "choose_gpu", return_value=("GPU-test", "GPU")),
            patch.object(
                setup, "run", side_effect=["", "GPU-test, 123, python, 24000"]
            ),
            patch.object(setup, "runtime_command") as runtime,
            self.assertRaisesRegex(RuntimeError, "already has compute processes"),
        ):
            setup.install(self.args)
        runtime.assert_not_called()

    def test_busy_override_still_checks_free_memory_and_ignores_other_gpus(self):
        with (
            patch.object(
                setup, "run", side_effect=["GPU-test, 123, python, 24000", "1024"]
            ),
            self.assertRaisesRegex(RuntimeError, "8192 MiB"),
        ):
            setup.check_gpu_available("GPU-test", allow_busy=True)
        with patch.object(
            setup, "run", side_effect=["GPU-other, 123, python, 24000", "10000"]
        ):
            setup.check_gpu_available("GPU-test", allow_busy=False)


if __name__ == "__main__":
    unittest.main()
