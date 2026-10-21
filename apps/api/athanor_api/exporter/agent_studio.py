"""Executable agent export artifacts; graph data is never interpolated into Python."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from athanor_api.exporter.agent_packaging import FORMATS, packaging_files, references
from athanor_api.exporter.sandbox_policy import (
    attached_policies,
    openshell_policy_yaml,
    policy_filename,
)

RUNTIME_ROOT = Path(__file__).resolve().parent.parent / "templates" / "export" / "agent"


def render_agent_files(
    graph: dict[str, Any], slug: str = "agent-workflow", export_format: str = "code"
) -> dict[str, str]:
    if export_format not in FORMATS:
        raise ValueError("Unsupported export format")
    graph = copy.deepcopy(graph)
    if export_format in {"docker", "podman"}:
        for node in graph["nodes"]:
            if node["type"] in {"sandbox.docker", "sandbox.podman"}:
                node["type"] = f"sandbox.{export_format}"
    files = {
        "container_entry.py": (RUNTIME_ROOT / "container_entry.py.txt").read_text(),
        "app/__init__.py": "",
        "workflow.py": (RUNTIME_ROOT / "workflow.py.txt").read_text(),
        "app/agent_worker.py": (RUNTIME_ROOT / "worker.py.txt").read_text(),
        "app/mcp_server.py": (RUNTIME_ROOT / "mcp_server.py.txt").read_text(),
        "app/customer_harness.py": (RUNTIME_ROOT / "customer_harness.py.txt").read_text(),
        "customer-harness.contract.json": json.dumps(
            {
                "version": "1.0",
                "method": "POST",
                "request": {"input": "string"},
                "response": {"output": "string"},
                "errors": {"error": "string"},
                "limits": {"requestBytes": 1048576, "timeoutSeconds": 120},
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        "agent-workflow.json": json.dumps(graph, indent=2, sort_keys=True) + "\n",
        "requirements-agent.txt": (
            "httpx>=0.28,<1\nhttpx2>=2.13,<3\njsonschema>=4.23,<5\nmcp>=2.2,<3\nuvicorn>=0.34,<1\n"
        ),
        "Containerfile.agent": (
            "FROM python:3.12-slim\nWORKDIR /workspace\n"
            "COPY requirements-agent.txt .\nRUN pip install --no-cache-dir -r "
            "requirements-agent.txt\n"
            "COPY app/agent_worker.py app/mcp_server.py app/customer_harness.py ./app/\n"
            "COPY agent-workflow.json workflow.py container_entry.py .\nUSER 65532:65532\n"
            "ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1\n"
            'CMD ["python", "workflow.py", "plan"]\n'
        ),
    }
    if any(
        node["type"] == "model.predictive" and node["configuration"].get("adapter") == "onnxruntime"
        for node in graph["nodes"]
    ):
        files["requirements-agent.txt"] += "onnxruntime>=1.20,<2\n"
    secret_names = references(graph)
    npm_packages = sorted(
        {
            n["configuration"]["packageSpec"]
            for n in graph["nodes"]
            if n["type"] == "mcp.stdio" and n["configuration"].get("packageRegistry") == "npm"
        }
    )
    pypi_packages = sorted(
        {
            n["configuration"]["packageSpec"]
            for n in graph["nodes"]
            if n["type"] == "mcp.stdio" and n["configuration"].get("packageRegistry") == "pypi"
        }
    )
    install = ""
    if npm_packages:
        install += "RUN apt-get update && apt-get install -y --no-install-recommends "
        "nodejs npm && rm -rf /var/lib/apt/lists/*\n"
        install += (
            "RUN " + json.dumps(["npm", "install", "--prefix", "/opt/mcp", *npm_packages]) + "\n"
        )
        install += "ENV PATH=/opt/mcp/node_modules/.bin:$PATH npm_config_cache=/tmp/npm\n"
    if pypi_packages:
        install += "RUN " + json.dumps(["pip", "install", "--no-cache-dir", *pypi_packages]) + "\n"
    files["Containerfile.agent"] = files["Containerfile.agent"].replace(
        "USER 65532:65532", install + "USER 65532:65532"
    )
    if export_format == "docker":
        files["Dockerfile"] = files["Containerfile.agent"]
    if export_format == "podman":
        files["Containerfile"] = files["Containerfile.agent"]
    files["agent.env.example"] = "# Variable names only; inject values at runtime.\n" + "".join(
        f"{name}=\n" for name in secret_names
    )
    files["agent-deployment.json"] = (
        json.dumps(
            {
                "sandboxes": [n for n in graph["nodes"] if n["type"].startswith("sandbox.")],
                "requirements": {
                    "podman": "Rootless Podman and prebuilt localhost/athanor-agent:latest image",
                    "docker": "Docker (rootless recommended) and prebuilt image",
                    "gvisor": "Docker plus installed runsc runtime and prebuilt image",
                    "kata": "Rootless Podman plus installed kata-runtime; host virtualization "
                    "support required",
                    "firecracker": "Blueprint only: implement a microVM adapter with isolated "
                    "networking, resource limits, deadline and teardown. Launcher "
                    "refuses execution.",
                    "openshell": "OpenShell CLI and a selected gateway. The launcher runs "
                    "openshell sandbox create --from the built image, with --cpu and "
                    "--memory. Secret values are not passed on the command line; attach "
                    "providers for names in agent.env.example. Network none relies on "
                    "OpenShell default-deny; bridge requires a gateway or "
                    "OPENSHELL_SANDBOX_POLICY that allows the needed egress. Process "
                    "limits stay with the OpenShell supervisor. Cluster export is rejected.",
                },
                "harnessIntegration": "POST configured endpoint with {inputKey: task}; read string "
                "response[outputKey]. Remote service owns its own isolation and "
                "behavior.",
            },
            indent=2,
            sort_keys=True,
        )
        + "\n"
    )
    servers = [n for n in graph["nodes"] if n["type"] == "mcp.server"]
    files["mcp-client.example.json"] = (
        json.dumps(
            {
                "mcpServers": {
                    n["id"]: (
                        {
                            "command": "python",
                            "args": [
                                "/absolute/path/to/export/workflow.py",
                                "serve-mcp",
                                "--node",
                                n["id"],
                            ],
                        }
                        if n["configuration"]["transport"] == "stdio"
                        else {"url": f"http://127.0.0.1:{n['configuration']['port']}/mcp/"}
                    )
                    for n in servers
                }
            },
            indent=2,
        )
        + "\n"
    )
    for sandbox in graph["nodes"]:
        if not sandbox["type"].startswith("sandbox.") or sandbox["type"] == "sandbox.policy":
            continue
        policies = attached_policies(graph, sandbox)
        if len(policies) > 1:
            raise ValueError("Connect one Sandbox Policy to each sandbox runtime.")
        if len(policies) == 1:
            files[policy_filename(sandbox["id"])] = openshell_policy_yaml(
                policies[0]["configuration"]
            )
    files["AGENT_README.md"] = """# Agent workflow

This folder includes the graph, editable Python runtime, and an isolated launcher.
The IDE's Run action is a static preview; exported code performs real API calls.

## Run an agent or harness

1. Review `agent-workflow.json`: set real endpoints/model IDs in the IDE and re-export.
   Host localhost is not container localhost. Use a reachable service hostname.
2. Select `bridge` on the sandbox to allow endpoint access. `none` deliberately blocks
   all networking. Bridge is not an egress allowlist; configure a firewall/proxy separately.
3. Set the environment variables named in `agent.env.example` in your shell.
   The launcher forwards only referenced names. It does not automatically read `.env` files.
4. Build with `podman build -f Containerfile.agent -t localhost/athanor-agent:latest .`
   (use Docker for Docker/gVisor; the image must exist in the selected engine).
5. `python workflow.py plan` prints the graph without network calls.
6. `python workflow.py run --task "Your task"` runs connected agents in graph order.
   Approve each protected tool call by typing `yes`. Noninteractive approval is denied.

Workers have read-only filesystems, non-root users, dropped capabilities, no host
mounts, memory/CPU/process limits, and enforced wall-clock deadlines with cleanup.
No automatic fallback to the host interpreter or another runtime is allowed.
Containers share the host kernel; gVisor/Kata require preinstalled runtime support.
Firecracker is a deployment blueprint requiring a platform adapter, not a working VM launcher.
A Sandbox Policy connected to a runtime overrides that runtime's network mode and
hardening flags. OpenShell also receives the generated `openshell-policy-*.yaml`.
OpenShell uses `openshell sandbox create` against the gateway you have selected.
Build the image first so that gateway can run `--from localhost/athanor-agent:latest`.
Attach OpenShell providers for credential names; the launcher never puts secret values
on the command line. Cluster manifests are not generated for OpenShell.

## MCP server

Find the server ID with `python workflow.py plan`, then run:
`python workflow.py serve-mcp --node SERVER_ID`

`mcp-client.example.json` shows client configuration; replace the absolute export path.
Stdio is the default. Streamable HTTP is published on host loopback only. Remote
publishing requires an MCP-aware OAuth gateway with issuer/audience checks; automatic
OAuth login and a token issuer are not included. Never treat tool annotations as consent.
Tools requiring approval fail closed in server mode until a trusted host approval
integration is added. For explicitly approved read-only tools, turn approval off in
that tool's inspector. Agent CLI mode supports per-call human approval.

The MCP runtime pins the official SDK v2 line `mcp>=2.2,<3` for the
2026-07-28 protocol. Client/server lifecycle and version negotiation are SDK-managed.
Resources are static text; prompts substitute a required task argument.

## Harness adapters and extension

Endpoint adapters are included for LangGraph, OpenAI Agents SDK, Google ADK,
PydanticAI, CrewAI, OpenClaw Enterprise, OpenCode, OpenClaw, OpenHands, Goose,
Open Interpreter, AURA, Pi, OMP, and Aider. These are curated alternatives, not a
popularity ranking. OpenClaw Enterprise calls your deployed control-plane endpoint;
it does not deploy an OCC Agent or generate native OpenClaw configuration.
OpenClaw calls a deployed Gateway and does not install that gateway.
They send `{input: task}` and expect `{output: text}` by default; field names are
configurable. An existing deployed endpoint or a wrapper around the framework is
required. The selected framework's native SDK is not generated or installed.
Remote checkpointing, retries, approvals, telemetry, and isolation remain the
responsibility of that service; the local sandbox isolates its HTTP adapter only.

The built-in Sandboxed Agent needs only a Chat Completions-compatible endpoint and
connected API/MCP tools. It enforces turn/tool limits and argument schemas, stops on
errors, and never retries side-effecting requests automatically. Events omit prompts,
response bodies, and credentials; they are local JSON lines rather than an OTLP exporter.
Only directly connected capabilities are available. Tool names must be unique.

Customize `app/agent_worker.py`, `app/mcp_server.py`, or `workflow.py` in code. Build
the image again after changes. JSON data is loaded, never evaluated as Python.
Unsupported operations in an agent execution path fail explicitly. No fine-tuning, arbitrary
Python transforms, or implicit cross-environment execution is performed here.

Templates saved in the editor retain their base block behavior and travel with the
node in graph/code exports. Share reusable block libraries with Import/Export templates.
"""
    files["README.md"] = (
        f"# {graph['project']['name']}\n\nExport target: **{export_format}**. "
        "Start with [AGENT_README.md](AGENT_README.md).\n\n"
        + (
            f"Deployment instructions: [deploy/{export_format}/README.md]"
            f"(deploy/{export_format}/README.md).\n"
            if export_format in {"helm", "openshift"}
            else "Use `make build`, `make plan`, then `make run`. Docker/Podman "
            "exports select that engine for plain OCI sandboxes; specialized "
            "runtimes remain explicit.\n"
        )
    )
    files["AGENT_README.md"] += (
        "\n## Imported MCP packages\n\nPinned npm/PyPI packages are "
        "installed in the image during build. Review publisher and "
        "arguments first. Stdio servers start only inside the agent "
        "sandbox, with the listed environment variables. Confirm the "
        "executable supplied by each Python package. Custom commands need "
        "their dependencies added to Containerfile.agent. Registry "
        "metadata is provenance, not endorsement.\n"
    )
    files["CUSTOM_HARNESS.md"] = "\n".join(
        [
            "# Customer harness development",
            "",
            "The contract is in `customer-harness.contract.json`. Send `POST` JSON",
            '`{"input": "task text"}` and return `{"output": "result text"}`.',
            "The generated `app/customer_harness.py` is a runnable, dependency-free",
            "reference server; replace `run_task` with your orchestration adapter.",
            "",
            "Keep credentials in environment variables and set explicit request/model",
            "timeouts. Validate tool arguments and require approval for side effects.",
            "Framework SDKs are optional: add only the dependencies your harness needs",
            "to `requirements-agent.txt`, then rebuild the image. This adapter does not",
            "bypass the worker sandbox or grant access to the host filesystem.",
            "",
        ]
    )
    files.update(packaging_files(graph, slug, export_format))
    return files
