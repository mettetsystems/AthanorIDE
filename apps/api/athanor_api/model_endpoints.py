"""Read-only OpenAI-compatible endpoint discovery, shared with the setup CLI.

Keep this module standard-library-only so setup needs no installed API dependencies.
Never probe by generating text: some servers load models on their first completion.
"""

from __future__ import annotations

import http.client
import json
import os
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Literal, TypedDict
from urllib.parse import urlsplit, urlunsplit

DEFAULT_PORTS = (8081, 8080, 8000, 5000, 5001, 1234, 11434, 1337, 9931)
MAX_RESPONSE_BYTES = 1024 * 1024


class EndpointInfo(TypedDict):
    base_url: str
    endpoint: str
    models: list[str]
    status: Literal["ready", "auth_required", "unavailable"]
    detail: str
    useToken: bool


def config_path() -> Path:
    return Path(os.environ.get("XDG_CONFIG_HOME", str(Path.home() / ".config"))).expanduser() / (
        "athanor/model-endpoint.json"
    )


def normalize_base_url(value: str) -> str:
    value = value.strip()
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("Endpoint URL cannot contain control characters.")
    parsed = urlsplit(value)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Use an HTTP(S) endpoint URL without credentials, query, or fragment.")
    if parsed.port is not None and not 1 <= parsed.port <= 65535:
        raise ValueError("Invalid endpoint port.")
    path = parsed.path.rstrip("/")
    for suffix in ("/chat/completions", "/models"):
        if path.endswith(suffix):
            path = path[: -len(suffix)]
            break
    if not path:
        path = "/v1"
    return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args: object, **kwargs: object) -> None:
        # In particular, never forward an explicitly supplied token to a new origin.
        return None


def probe_endpoint(value: str, *, token: str = "", timeout: float = 1.0) -> EndpointInfo | None:
    base = normalize_base_url(value)
    info: EndpointInfo = {
        "base_url": base,
        "endpoint": base + "/chat/completions",
        "models": [],
        "status": "unavailable",
        "detail": "The server did not advertise any available models.",
        "useToken": bool(token),
    }
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(base + "/models", headers=headers)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open(request, timeout=timeout) as response:
            payload = response.read(MAX_RESPONSE_BYTES + 1)
        if len(payload) > MAX_RESPONSE_BYTES:
            return None
        data = json.loads(payload)
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            info.update(
                {
                    "status": "auth_required",
                    "detail": "Possible model server; authentication required.",
                    "useToken": True,
                }
            )
            return info
        if exc.code == 503:
            info["detail"] = "Possible model server; unavailable or still loading."
            return info
        return None
    except (OSError, ValueError, http.client.HTTPException):
        return None
    if not isinstance(data, dict) or not isinstance(data.get("data"), list):
        return None
    for model in data["data"]:
        if not isinstance(model, dict) or not isinstance(model.get("id"), str):
            continue
        model_id = model["id"].strip()
        state = model.get("status")
        if isinstance(state, dict):
            state = state.get("value")
        # Routers may list cached models too. Do not offer a known unloaded model.
        if state is not None and state not in ("loaded", "ready"):
            continue
        if model_id and model_id not in info["models"]:
            info["models"].append(model_id)
    if info["models"]:
        info.update(
            {"status": "ready", "detail": "Model list available; inference has not been tested."}
        )
    return info


def local_listener_urls() -> list[str]:
    """Include nonstandard loopback/wildcard listeners on Linux, without a port scan."""
    urls: set[str] = set()
    for name, addresses, host in (
        ("tcp", {"0100007F", "00000000"}, "127.0.0.1"),
        ("tcp6", {"00000000000000000000000001000000", "0" * 32}, "[::1]"),
    ):
        try:
            lines = (Path("/proc/net") / name).read_text().splitlines()[1:]
        except OSError:
            continue
        for line in lines:
            fields = line.split()
            if len(fields) < 4 or fields[3] != "0A":
                continue
            address, port = fields[1].split(":")
            if address in addresses:
                urls.add(f"http://{host}:{int(port, 16)}/v1")
    return sorted(urls)


def discover_endpoints(extra_urls: list[str] | None = None) -> list[EndpointInfo]:
    candidates = list(extra_urls or [])
    saved_base = ""
    saved_token = False
    try:
        saved = json.loads(config_path().read_text())
        if isinstance(saved, dict) and isinstance(saved.get("base_url"), str):
            candidates.append(saved["base_url"])
            saved_base = normalize_base_url(saved["base_url"])
            saved_token = saved.get("useToken") is True
    except (OSError, ValueError):
        pass
    candidates.extend(f"http://127.0.0.1:{port}/v1" for port in DEFAULT_PORTS)
    candidates.extend(local_listener_urls())
    bases: list[str] = []
    for candidate in candidates:
        try:
            base = normalize_base_url(candidate)
        except ValueError:
            continue
        if base not in bases:
            bases.append(base)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = [result for result in pool.map(probe_endpoint, bases) if result is not None]
    for result in results:
        if result["base_url"] == saved_base and saved_token:
            result["useToken"] = True
    return results
