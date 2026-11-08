# AthanorIDE API (`apps/api`)

FastAPI control plane for graph validation, agent/MCP design previews, and editable runtime/deployment exports. The earlier transform compiler, execution handlers, Podman sandbox runner, and local secrets vault remain available.

The API does not persist the project library: projects and templates live in the browser. Read the [root README](../../README.md) for the current product workflow, setup, exports, and troubleshooting.

## Run locally

```bash
# from repository root
make install
export PATH="$PWD/.tools:$PWD/.tools/py/bin:$PATH"
uv run --directory apps/api uvicorn athanor_api.main:app --reload --host 127.0.0.1 --port 8000
```

Or use `make dev` to start API + web together.

| URL | Purpose |
| --- | --- |
| `GET /api/v1/health` | Liveness |
| `GET /api/v1/assistant/startup-endpoint` | Cached ready Maya endpoint from startup; loopback-only |
| `POST /api/v1/assistant/endpoints` | On-demand OpenAI-compatible endpoint discovery or explicit URL probe; loopback-only |
| `GET /api/v1/node-definitions` | Current agent and retained legacy catalog summaries |
| `POST /api/v1/projects/validate` | `design` or `deployment` validation profile (default deployment) |
| `POST /api/v1/projects/handoff` | Deterministic SME workflow/build-brief ZIP; no implementation required |
| `POST /api/v1/projects/execute` | Agent/MCP design preview; retained legacy payload handlers |
| `POST /api/v1/projects/export` | Validated export ZIP, manifest, and file map |
| `POST /api/v1/compiler/generate` | NL → TransformationSpec / code |
| `POST /api/v1/compiler/validate` | Validate generated transform |
| `/api/v1/vault/*` | Local vault status, initialization, locking, entry management, coverage, and explicit environment materialization |
| `/docs` | OpenAPI UI |

## Project Maya startup detection

The FastAPI lifespan probes `http://127.0.0.1:8080/v1/models` in a worker thread
before accepting requests, with a one-second request timeout. It sends no token,
does not follow redirects, and does not request a completion. Only a compatible
model list containing an available model is selected. Authentication errors,
loading/unavailable responses, empty lists, malformed responses, and connection
failures leave the startup selection empty and allow startup to continue.

`GET /api/v1/assistant/startup-endpoint` returns the cached selection:

```json
{
  "items": [{
    "base_url": "http://127.0.0.1:8080/v1",
    "endpoint": "http://127.0.0.1:8080/v1/chat/completions",
    "models": ["example-advertised-model-id"],
    "status": "ready",
    "detail": "Model list available; inference has not been tested.",
    "useToken": false
  }]
}
```

When Maya was not ready, the response is `{"items": []}`. This route uses the
same loopback access restriction as assistant discovery. Reading it does not
probe Maya again. Restart the API to refresh the startup result, or use
`POST /api/v1/assistant/endpoints` for on-demand discovery in assistant settings.
The API logs `Project Maya startup check: available` or
`Project Maya startup check: not ready; keeping configured endpoint`.

The web app consumes this result before displaying the editor, with a three-second
fetch timeout. A ready Maya endpoint takes precedence over saved assistant
preferences; an empty result or API failure preserves them. The selected model is
the previous model for that same endpoint if still advertised, otherwise the first
available model. This configures browser assistant preferences, not workflow model
blocks, exported runtimes, or legacy compiler settings. The startup result can
become stale if Maya stops or its model list changes.

Loopback refers to the API process network namespace. If Maya runs on a container
host or another machine, configure its reachable address manually in assistant
settings. See the [assistant user guide](../../docs/user-guide.md#assistant-model-settings)
for authentication, late startup, and manual overrides.

## Agent validation, preview, and export

Graph schema 2.0.0 requires a workflow section. Deployment validates task membership, string boundaries, stage topology, dedicated recovery, instruction inheritance, optional-port omissions, and nested credential findings. Design validation checks briefs and transitions without requiring components. Agent validation checks endpoints, schemas, environment variable names, tool naming, required connections, sandbox policies, and supported configuration. The execute route previews agent/MCP blocks without calling models, HTTP tools, or MCP servers and without launching those workers. Retained transform handlers may use the Podman sandbox; preview guarantees for agent blocks do not replace the legacy execution rules below.

Agent graphs use `exporter/agent_studio.py` and `exporter/agent_packaging.py`, with Python sources in `templates/export/agent/`. The export request's `exportFormat` accepts:

| Value | Artifact |
| --- | --- |
| `code` | Editable Python workflow and container recipe |
| `podman` / `docker` | Container recipe, source, and Makefile for the chosen plain OCI engine |
| `helm` | Helm chart, workloads, services where needed, and network policies |
| `openshift` | OpenShift workload YAML and deployment notes |
| `npm` | npm-distributed Python CLI wrapper and source |
| `makefile` | Build, plan, run, and serve Make targets plus source |

The response includes `files`, `manifest` (paths, sizes, SHA-256), `archiveBase64`, and validation details. Downloading an export does not build, execute, publish, or deploy it. The archive's README describes its actual runtime requirements. Cluster exports share one pod boundary and reject differing sandbox policies; standalone MCP cluster workloads require Streamable HTTP.

Every deployment export includes `workflow.json`, `build-brief.md`, and deterministic `security-review.json`. Agent exports add `workflow_scheduler.py`, shared by local and cluster entrypoints for bounded concurrency, stage barriers, deterministic joins, recovery substitution, deadlines, and serialized approvals. The server validates the submitted graph again on export; detected embedded credentials block export and findings do not repeat their values.

The design-only handoff endpoint returns a deterministic ZIP containing `workflow.json`, `build-brief.md`, and an importable `project-scaffold.json`. It checks the SME design and credential findings without requiring completed components, and does not invoke an external builder. See the [three-role user guide](../../docs/user-guide.md) and [ADR 0012](../../docs/decisions/0012-three-role-workflow.md).

The API does not resolve credential references into agent exports or automatically inject the local vault into them. The generated launcher reads explicitly named runtime environment variables. MCP registry discovery/import happens in the frontend, not through an API-side package installer.

## Settings

`athanor_api/settings.py` uses environment variables prefixed with `ATHANOR_` and a `.env` file relative to the process working directory (`apps/api` under `make dev`). CORS defaults to localhost/127.0.0.1 on port 3000; set `ATHANOR_CORS_ORIGINS` to a JSON array when changing frontend origins.

`ATHANOR_DATA_DIR` defaults to `~/.local/share/athanor` and contains the encrypted local vault. `ATHANOR_VAULT_IDLE_TTL_SECONDS` defaults to 1800. Retained compiler/sandbox settings are separate from the policies stored in new agent blocks; `ATHANOR_SANDBOX_IMAGE` configures the legacy transform runner, while exported launchers use `ATHANOR_IMAGE`.

## Package layout

| Module | Role |
| --- | --- |
| `athanor_api/main.py` | FastAPI app & routes |
| `athanor_api/catalog.py` | Catalog loading and retained legacy entries |
| `athanor_api/agent_catalog.json` | Generated agent catalog mirror; sync from TypeScript |
| `athanor_api/validation/` | Static graph checks |
| `athanor_api/execution/` | Topological preview and retained execution handlers |
| `athanor_api/exporter/` | Agent source/packaging and retained IR/Jinja export paths |
| `athanor_api/compiler/` | Provider + AST allowlist + codegen |
| `athanor_api/sandbox/` | Rootless Podman runner |
| `athanor_api/templates/export/` | Exported project templates |
| `athanor_api/vault/` | Encrypted local secrets storage and explicit access routes |

## Retained transform execution rules

1. **Never** execute generated/compiled transform code on the API host interpreter.
2. Compiled transforms run only in the **Podman sandbox** (or fall back to the Phase-2 classifier).
3. **Secret Reference** values are never returned by execute or written into export artifacts.
4. **HTTP Request** is skipped during IDE execute by default (no host network).

## Tests

```bash
uv run --directory apps/api pytest -q
# or from root:
make test
```

After changing agent definitions, run `pnpm catalog:sync` from the repository root. `pnpm catalog:check` detects drift; do not hand-edit the generated JSON mirror. Tests cover validation, preview isolation, export packages, generated runtime behavior, MCP integration, compiler paths, and vault behavior.

## Related docs

- [Three-role user guide](../../docs/user-guide.md) — design/deployment validation, handoff, review, and scheduling
- [Agent studio guide](../../docs/agent-studio.md) — current agent/MCP behavior
- [Node authoring guide](../../packages/node-definitions/README.md)
- [Architecture](../../docs/architecture.md) — retained architecture
- [Security model](../../docs/security-model.md) — retained compiler/vault model; current agent boundaries are in the agent guide
- ADR 0002 (export), 0003 (compiler), 0007 (execution)
