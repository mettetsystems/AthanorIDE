"""Discovery must remain read-only and must not confuse arbitrary HTTP apps with models."""

import io
import json
from unittest.mock import Mock, patch
from urllib.error import HTTPError

import pytest
from fastapi.testclient import TestClient

from athanor_api import model_endpoints as endpoints
from athanor_api.main import app


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("http://localhost:8080", "http://localhost:8080/v1"),
        ("http://localhost:8080/v1/", "http://localhost:8080/v1"),
        ("http://[::1]:9001/v1/chat/completions", "http://[::1]:9001/v1"),
        ("https://host/proxy/v1/models", "https://host/proxy/v1"),
    ],
)
def test_normalize_urls(url, expected):
    assert endpoints.normalize_base_url(url) == expected


@pytest.mark.parametrize(
    "url",
    [
        "file:///tmp/data",
        "http://u:secret@host",
        "https://host?key=secret",
        "http://host:99999",
        "http://host\n/path",
    ],
)
def test_reject_unsafe_urls(url):
    with pytest.raises(ValueError):
        endpoints.normalize_base_url(url)


def test_probe_gets_models_without_health_completion_or_redirect():
    opener = Mock()
    opener.open.return_value = io.BytesIO(
        json.dumps(
            {
                "data": [
                    {"id": "maya-model"},
                    {"id": "vllm-model"},
                    {"id": "llama-model"},
                    {"id": "maya-model"},
                    {"id": "cached", "status": {"value": "unloaded"}},
                    {"id": "loading", "status": {"value": "loading"}},
                    {"not_id": "ignored"},
                ]
            }
        ).encode()
    )
    with patch.object(endpoints.urllib.request, "build_opener", return_value=opener) as build:
        result = endpoints.probe_endpoint("https://host/proxy/v1", token="test-secret")
    assert result["models"] == ["maya-model", "vllm-model", "llama-model"]
    assert result["useToken"] is True
    request = opener.open.call_args.args[0]
    assert request.full_url == "https://host/proxy/v1/models"
    assert request.get_method() == "GET"
    assert request.data is None
    assert request.get_header("Authorization") == "Bearer test-secret"
    assert "test-secret" not in json.dumps(result)
    assert any(isinstance(handler, endpoints.NoRedirect) for handler in build.call_args.args)
    assert endpoints.NoRedirect().redirect_request() is None
    opener.open.assert_called_once()


@pytest.mark.parametrize(
    ("code", "status"),
    [
        (401, "auth_required"),
        (403, "auth_required"),
        (503, "unavailable"),
        (404, None),
        (302, None),
    ],
)
def test_http_errors_are_not_ready_servers(code, status):
    opener = Mock()
    opener.open.side_effect = HTTPError("http://host/v1/models", code, "error", {}, None)
    with patch.object(endpoints.urllib.request, "build_opener", return_value=opener):
        result = endpoints.probe_endpoint("http://host")
    assert (result["status"] if result else None) == status


@pytest.mark.parametrize(
    "payload",
    [
        b"not JSON",
        b"[]",
        b'{"status":"ok"}',
        b'{"data":{}}',
        b"x" * (endpoints.MAX_RESPONSE_BYTES + 1),
    ],
    ids=["invalid-json", "array", "health", "invalid-data", "oversized"],
)
def test_non_model_servers_and_oversized_responses_are_ignored(payload):
    opener = Mock()
    opener.open.return_value = io.BytesIO(payload)
    with patch.object(endpoints.urllib.request, "build_opener", return_value=opener):
        assert endpoints.probe_endpoint("http://host") is None


def test_empty_model_list_is_a_server_but_not_ready():
    opener = Mock()
    opener.open.return_value = io.BytesIO(b'{"data":[]}')
    with patch.object(endpoints.urllib.request, "build_opener", return_value=opener):
        assert endpoints.probe_endpoint("http://host")["status"] == "unavailable"


def test_discovery_includes_saved_custom_and_listening_ports_without_credentials(tmp_path):
    path = tmp_path / "model-endpoint.json"
    path.write_text(json.dumps({"base_url": "https://custom/proxy/v1", "useToken": True}))
    seen = []

    def probe(url):
        seen.append(url)
        return {
            "base_url": url,
            "endpoint": url + "/chat/completions",
            "models": ["model"],
            "status": "ready",
            "detail": "",
            "useToken": False,
        }

    with (
        patch.object(endpoints, "config_path", return_value=path),
        patch.object(endpoints, "local_listener_urls", return_value=["http://127.0.0.1:32123/v1"]),
        patch.object(endpoints, "probe_endpoint", side_effect=probe),
    ):
        result = endpoints.discover_endpoints(["http://127.0.0.1:8080/v1/"])
    assert len(seen) == len(set(seen))
    assert "http://127.0.0.1:32123/v1" in seen
    assert "https://custom/proxy/v1" in seen
    assert next(item for item in result if item["base_url"] == "https://custom/proxy/v1")[
        "useToken"
    ]


def test_linux_listeners_include_loopback_and_wildcard_only():
    table = (
        "header\n 0: 0100007F:7D01 00000000:0000 0A\n"
        " 1: 00000000:7D02 00000000:0000 0A\n"
        " 2: 0100007F:7D03 00000000:0000 01\n"
        " 3: 0101A8C0:7D04 00000000:0000 0A\n"
    )
    with patch.object(
        endpoints.Path,
        "read_text",
        side_effect=[table, "header\n 0: 00000000000000000000000001000000:7D05 0:0 0A\n"],
    ):
        assert endpoints.local_listener_urls() == [
            "http://127.0.0.1:32001/v1",
            "http://127.0.0.1:32002/v1",
            "http://[::1]:32005/v1",
        ]


def test_discovery_route_never_uses_vault_token_for_broad_scan():
    client = TestClient(app)
    with (
        patch("athanor_api.assistant.routes.discover_endpoints", return_value=[]) as discover,
        patch("athanor_api.assistant.routes.require_assistant_token") as token,
    ):
        assert client.post("/api/v1/assistant/endpoints", json={}).json() == {"items": []}
        assert (
            client.post("/api/v1/assistant/endpoints", json={"useToken": True}).status_code == 400
        )
    discover.assert_called_once_with()
    token.assert_not_called()


def test_discovery_route_authenticates_only_explicit_url():
    with (
        patch("athanor_api.assistant.routes.probe_endpoint", return_value=None) as probe,
        patch("athanor_api.assistant.routes.require_assistant_token", return_value="secret"),
    ):
        response = TestClient(app).post(
            "/api/v1/assistant/endpoints",
            json={
                "endpoint": "https://custom/v1",
                "useToken": True,
            },
        )
    assert response.json() == {"items": []}
    probe.assert_called_once_with("https://custom/v1", token="secret", timeout=3)


def test_discovery_route_rejects_nonlocal_clients():
    with patch("athanor_api.assistant.routes.discover_endpoints") as discover:
        response = TestClient(app, client=("192.0.2.1", 12345)).post(
            "/api/v1/assistant/endpoints", json={}
        )
    assert response.status_code == 403
    discover.assert_not_called()


@pytest.mark.parametrize("status", ["ready", "unavailable", "auth_required", None])
def test_startup_checks_maya_before_serving_and_only_selects_ready_models(status):
    maya = {
        "base_url": "http://127.0.0.1:8080/v1",
        "endpoint": "http://127.0.0.1:8080/v1/chat/completions",
        "models": ["maya-model"] if status == "ready" else [],
        "status": status,
        "detail": "",
        "useToken": False,
    } if status else None
    with patch("athanor_api.main.probe_endpoint", return_value=maya) as probe:
        with TestClient(app, client=("127.0.0.1", 50000)) as client:
            probe.assert_called_once_with("http://127.0.0.1:8080/v1", timeout=1.0)
            response = client.get("/api/v1/assistant/startup-endpoint")
            assert response.status_code == 200
            assert response.json() == {"items": [maya] if status == "ready" else []}
            assert client.get("/api/v1/health").status_code == 200
