# AthanorIDE

<p align="center">
  <img src="docs/assets/logo.jpg" alt="AthanorIDE logo" width="280" />
</p>

<p align="center"><strong>AI FIRST · VISUAL · ARCHITECT · BUILD</strong></p>

A local-first graphical workbench for designing sandboxed agents, connecting agent harnesses, and building or importing Model Context Protocol (MCP) servers. Configure endpoints, arguments, credentials by environment variable name, and execution limits through forms; connect blocks on a canvas; export editable code and deployment artifacts.

The application keeps the **project → palette → canvas → inspector → validate/preview → export** workflow. The current palette focuses on agents and MCP. Earlier architecture/compiler modules remain in the repository, but existing projects are not automatically migrated into the new workspace.

## Contents

- [What you can build](#what-you-can-build)
- [Install and start](#install-and-start)
- [Build your first agent](#build-your-first-agent)
- [MCP servers and imports](#mcp-servers-and-imports)
- [Custom blocks and templates](#custom-blocks-and-templates)
- [Canvas controls](#canvas-controls)
- [Export and run](#export-and-run)
- [Runtime boundaries and limitations](#runtime-boundaries-and-limitations)
- [Storage, backups, and credentials](#storage-backups-and-credentials)
- [Configuration and troubleshooting](#configuration-and-troubleshooting)
- [Development and repository layout](#development-and-repository-layout)
- [Documentation](#documentation)

## What you can build

| Building block | Purpose |
| --- | --- |
| Sandboxed Agent | A bounded model/tool loop with connected tools, approvals, and a sandbox policy |
| Guardrails | Phrase, tool, and result-length checks the exported agent enforces |
| Model Endpoint | A full Chat Completions-compatible endpoint and its exact model ID |
| API Tool / Custom API Block | An HTTP endpoint exposed as a tool with JSON Schema arguments |
| Harness adapters | Call deployed LangGraph, OpenAI Agents SDK, Google ADK, PydanticAI, CrewAI, OpenClaw Enterprise, OpenCode, OpenClaw, OpenHands, Goose, Open Interpreter, AURA, Pi, OMP, or Aider endpoints |
| Sandbox policies | Sandbox Policy, plus Rootless Podman, Docker, gVisor, Kata Containers, Firecracker, or OpenShell |
| MCP Server Builder | Publish connected tools, static text resources, and prompt templates |
| MCP Connection / MCP Package / Command | Connect selected tools from an HTTP or stdio MCP server |
| Text Input, JSON Input, Prompt Template, Output Viewer | Supply tasks, format input, and inspect results |

The harness and sandbox choices are curated alternatives, not a popularity ranking or a claim of industry consensus. Harness blocks call your deployed service; they do not generate native framework applications. OpenClaw Enterprise calls a deployed control-plane endpoint and does not generate OCC configuration. Firecracker requires a platform adapter before it can run. OpenShell runs through a selected gateway.

**Run preview is a design preview for agent/MCP blocks.** It does not call their model endpoints, invoke MCP tools, or launch their workers. Export the workflow to perform real execution. Retained legacy transform blocks have separate execution behavior; see the [API README](apps/api/README.md).

## Install and start

### Prerequisites

| Tool | When needed |
| --- | --- |
| Node.js 20+ and npm | Frontend, shared packages, and tool bootstrap; CI uses Node 22 |
| Python 3.12+ with pip available | API and tool bootstrap; CI uses Python 3.12 |
| Make, Bash, and tar | Repository setup scripts |
| pnpm and uv | JavaScript/Python dependency management; `make install` bootstraps project-pinned pnpm 9.15.0 and uv into `.tools/` |
| Podman or Docker | Running exported containers; Podman is also needed for `make podman-up` and retained transform sandboxes |
| Helm / `oc` / cluster access | Only when validating or deploying the corresponding cluster export |

You can design, validate, preview agent blocks, and download exports without a container engine. Dependency installation, image builds, registry search, and remote endpoint execution need network access as appropriate.

### MacBook Air setup (Apple Silicon or Intel)

The IDE runs locally in your browser; this installs the development services and does not create a signed `.app` or `.dmg` installer. Install [Homebrew](https://brew.sh) and Apple's Command Line Tools first. From Terminal, clone the repository, enter its directory, and run:

```bash
./scripts/install-macos.sh
make dev
```

The installer detects Apple Silicon (`arm64`) or Intel (`x86_64`). If Node.js 20+ or a native Python 3.12+ is missing, it offers to install those dependencies with Homebrew. An x86_64 Python on Apple Silicon, such as an Intel Anaconda install, is not used: current Command Line Tools cannot link those builds. If Make is missing, install Command Line Tools with `xcode-select --install` and run the installer again. It then runs the same `make install` used on Linux. Open [localhost:3000](http://localhost:3000); stop the services with Ctrl+C. The default development workflow does not require Podman. Use `make install-macos` as an equivalent entry point when Make is already available.

### Local development

From the repository root:

```bash
make install
make dev
```

`make install` installs workspace dependencies, creates the API virtual environment, and builds the shared TypeScript packages. `make dev` starts both the API and frontend. Stop it with Ctrl+C.

| Address | Purpose |
| --- | --- |
| [localhost:3000](http://localhost:3000) | Project library and starter examples |
| [localhost:3000/editor](http://localhost:3000/editor) | Open the active project or create one |
| [localhost:8000/api/v1/health](http://localhost:8000/api/v1/health) | API health response |
| [localhost:8000/docs](http://localhost:8000/docs) | Interactive API schemas and endpoints |

Use a consistent browser hostname: `localhost` and `127.0.0.1` have separate browser storage.

### Run the IDE in Podman

```bash
make podman-up
make podman-down
```

These commands build/start and stop the **IDE's web and API containers** on the default ports. The scripts call Podman directly; no Compose plugin is required. The optional [compose.yaml](compose.yaml) is a separate way to launch the stack with a Compose provider.

The stock API image has no nested Podman runtime or persistent vault volume. Use host development for retained transform sandbox execution and configure persistent storage before relying on a containerized vault. Exported agent images are built separately from downloaded archives.

### Deploy AthanorIDE itself to OpenShift

The manifests in [deploy/openshift-ide](deploy/openshift-ide/) run the web app, API, and OpenShift OAuth proxy together in one pod. This is separate from **Export → OpenShift**, which writes a workflow archive. From the repository root, after `oc login`:

```bash
make openshift-ide-deploy
```

That script checks for Quay or the OpenShift internal image registry before it builds. If neither is available, it stops and asks you to enable the internal registry. When one is available, it builds the web and API images, pushes them there, and applies the manifests. Details are in [the application deployment guide](deploy/openshift-ide/README.md).

`make openshift-ide-apply` only runs `oc apply -k deploy/openshift-ide`. Use it when the images and `athanoride-oauth` secret already exist.

On Linux, rootless Podman is the default local agent option. On macOS, start your Podman machine or Docker engine before running exports. On Windows, use a WSL2 Linux environment for the Bash/Make workflow. gVisor, Kata, and Firecracker need suitable Linux hosts and their own runtime setup. OpenShell needs its CLI and a selected gateway.

## Build your first agent

1. Open the home screen and choose **Sandboxed agent**. The other starters are **MCP server** and **Agent harness**; a blank project is also available.
2. Select **Text Input** and enter a task. Click **Apply** in the inspector after editing a block.
3. Configure **Model Endpoint** with its full URL, including the Chat Completions path, and the exact model ID. Enter an environment variable name such as `MODEL_API_KEY` if authentication is required. The provider must support the compatible tool-calling API for agent tools to work.
4. Configure an **API Tool** with its name, description, HTTP method, full endpoint, and argument schema. GET sends arguments as query parameters; POST, PUT, PATCH, and DELETE send JSON. Tool names must be unique within the agent's tools.
5. Select a sandbox. Its default network is `none`; choose `bridge` when the workflow needs model, tool, or MCP endpoints. Configure memory, CPU, and process limits.
6. Connect the blocks as shown below. Add optional tools/MCP connections as needed. Adjust agent instructions, maximum model turns, maximum tool calls, and timeout.
7. Click **Validate**, resolve errors, and use **Run preview** to inspect the design. Choose an export format, click **Export**, and run the downloaded project using its README.

```text
Text Input ──────── task ────┐
Model Endpoint ─── model ────┤
Sandbox policy ─ sandbox ────┼──► Sandboxed Agent ── result ──► Output Viewer
API Tool ───────── tools ────┤
MCP Connection ───── mcp ────┘
```

Connect an agent's result to another agent's task to chain agents. A Prompt Template replaces `{{input}}` with its connected text input. API schemas use JSON Schema 2020-12; schema references must stay local to `$defs`.

A harness starter uses a deployed HTTP service instead of a local model/tool loop. By default the adapter POSTs `{"input":"task text"}` and expects `{"output":"result text"}`. Configure the request and response field names in the inspector. The remote service owns its models, tools, approvals, state, retries, and isolation.

## MCP servers and imports

### Import an existing server

Open **Import MCP servers** in the palette. Search the official MCP Registry (default base URL: `https://registry.modelcontextprotocol.io`), change the base URL to another compatible registry, or paste/upload JSON from another source. Registry search uses the public v0.1 API, supports pagination, and runs in the browser, so the registry must allow browser CORS access.

| Source | Supported import |
| --- | --- |
| Official or compatible MCP Registry | Streamable HTTP remotes and pinned npm/PyPI stdio packages |
| `server.json` or a registry response | Supported remote/package entries from the manifest |
| `mcpServers` client configuration | Remote URLs or executable/argument-based stdio servers |
| A repository or another directory | Copy/upload its manifest or client configuration; repository cloning is not implemented |

The official registry is the discovery entry point for the MCP ecosystem associated with the Agentic AI Foundation. A listing is publisher metadata, not a security endorsement. Legacy SSE and OCI registry packages are not automatically converted.

After importing:

1. Review the source, version, endpoint or executable, and arguments. Import reads metadata only; it does not install or start the server.
2. For npm/PyPI packages, use an exact pin such as `@scope/server@1.2.3` or `server-package==1.2.3`. Confirm the executable supplied by a PyPI package. Custom executables need their dependencies added to the exported `Containerfile.agent`.
3. Enter **Allowed tool names** as comma-separated exact names. **An empty list exposes no tools.** Keep per-call approval enabled unless the workflow has an explicitly reviewed unattended policy.
4. Configure credential environment variable names and connect the server output to the agent's MCP input.
5. Validate, export, build the image, and run. Package installation occurs during image build; third-party install/build scripts can run at that stage.

Import discards credential values from supported URL, header, and environment fields. Review arbitrary command arguments and pasted content yourself; import is not a general-purpose secret sanitizer. Built-in HTTP authentication uses a bearer token referenced by environment name. Automatic OAuth login and custom authentication schemes require an adapter.

### Design an MCP server

Start with **MCP server**, or connect API Tools, MCP Resources, and MCP Prompts to **MCP Server Builder**, plus a sandbox. Resources return static text; prompts expose a required `task` argument and substitute `{{task}}` into the template.

Choose stdio for local MCP clients or Streamable HTTP for HTTP clients. The export uses the official Python MCP SDK v2 and includes `mcp-client.example.json`. HTTP publishing binds to host loopback locally. Cluster deployments require Streamable HTTP. A production authorization gateway and automatic OAuth provider are not generated.

Tools marked **Require approval** deny calls from the generated MCP server until a trusted host approval integration is added. The interactive approval prompt is available in the exported agent CLI, not in a standalone MCP server.

## Custom blocks and templates

Use **Custom API Block** to turn an endpoint into a capability without editing source. Define arguments with the field editor or its advanced JSON Schema editor. Custom blocks use the API Tool runtime contract.

Apply a block's configuration, then save it as a template in the inspector. Templates retain configuration and MCP import provenance, and get fresh node IDs when placed. The palette's **Import templates** and **Export templates** actions share a versioned JSON library; imports accept up to 200 templates and 2 MB of text.

Templates reuse existing block behavior. To introduce a new execution primitive, extend the catalog, validation, and runtime in source; see the [node authoring guide](packages/node-definitions/README.md). Exported Python is also editable for project-specific integrations.

## Canvas controls

| Action | Control / behavior |
| --- | --- |
| Add a block | Click its palette entry once to select it, then again to place it |
| Configure | Select a node, edit the inspector, and click **Apply** |
| Connect | Drag from an output handle to a compatible input; matching contracts or `ANY` are accepted |
| Reconnect | Drag an existing wire endpoint; an invalid drop keeps the old connection |
| Disconnect | Select a wire or node and use the inspector's **Disconnect** action |
| Delete | Delete/Backspace queues confirmation; confirming removes nodes and attached wires together |
| Cancel / deselect | Escape |
| Undo / redo | Ctrl/Cmd+Z; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y |
| Duplicate | Ctrl/Cmd+D for selected nodes |
| Multiple selection | Shift-select nodes |
| Frame the graph | Fit View in the canvas controls |

Duplicate connections are rejected. Node deletion and its attached wires form one undo step, so undo restores both. Dragging uses transient canvas positions and commits the graph on drop to avoid saving on every pointer movement. Saved viewports are restored; use Fit View if nodes appear offscreen.

## Export and run

Choose **Export as** in the editor toolbar, then **Export** to download a ZIP. Exports include editable runtime code and the graph. Exporting does not install dependencies, publish packages, push images, or deploy workloads.

| Export choice | Additional artifacts / intended use |
| --- | --- |
| Source code | Python runtime, container recipe, and Makefile |
| Helm Chart | `deploy/helm/<project-slug>/` with chart, values, workloads, and network policies |
| Podman container | `Containerfile` plus Makefile; selects Podman for plain Podman/Docker sandbox blocks |
| Docker container | `Dockerfile` plus Makefile; selects Docker for plain Podman/Docker sandbox blocks |
| OpenShift deployment | `deploy/openshift/workload.yaml` and deployment notes |
| npm package | `package.json`, CLI wrapper, and full Python runtime; no install hooks |
| Makefiles | Build, plan, run, and MCP serve targets alongside the source |

Every agent archive includes `agent-workflow.json`, `agent-deployment.json`, `workflow.py`, `container_entry.py`, `app/`, `requirements-agent.txt`, `Containerfile.agent`, `agent.env.example`, `mcp-client.example.json`, and runtime READMEs. Credential references become variable-name placeholders; the exporter does not fetch values from the vault or your environment.

### Local source, Podman, Docker, and Makefile exports

Extract the ZIP and run these commands **inside the exported directory**, not the IDE repository:

```bash
python3 workflow.py plan
make build
# Supply the credentials named in agent.env.example through your shell environment.
make run
```

`make run` uses the saved task inputs. Override text inputs with:

```bash
python3 workflow.py run --task "Summarize the available information"
```

The default image is `localhost/athanor-agent:latest`. To build and use another image name:

```bash
make build IMAGE=localhost/my-agent:v1
make run IMAGE=localhost/my-agent:v1
# For direct CLI calls instead of Make:
ATHANOR_IMAGE=localhost/my-agent:v1 python3 workflow.py run
```

The generated Makefile chooses an engine from the export/graph. `ENGINE=...` changes the build command only; the workflow's sandbox block still selects the runtime. Mixed Podman/Docker workflows require the image in both engine stores. There is no host-execution fallback when an engine, image, or specialized runtime is missing.

For an MCP server, find its node ID with `plan`, then run:

```bash
python3 workflow.py serve-mcp --node YOUR_MCP_SERVER_NODE_ID
# Equivalent generated Make target:
make serve NODE=YOUR_MCP_SERVER_NODE_ID
```

The host launcher requires Python 3.12+ and the selected engine. Runtime Python dependencies and pinned MCP packages are installed inside the image. `.env` files are not automatically loaded by the generated launcher; export the named variables or use your environment/secret manager. Starting the image with its default command only prints the plan.

### npm export

The npm target packages a CLI wrapper around Python. It still requires Python, the configured container engine, and a built image; it is not a JavaScript rewrite.

```bash
make build
node bin/cli.mjs plan
npm pack --dry-run
npm pack
```

Install the resulting tarball using your normal npm workflow. The executable name matches the generated `package.json` name and accepts `plan`, `run`, and `serve-mcp --node ID`. `ATHANOR_PYTHON` can select the Python executable. Publishing remains a separate action.

### Helm and OpenShift exports

Build `Containerfile.agent`, push the image to a registry reachable by the cluster, and update the generated image reference, preferably to an immutable digest. Create the credentials Secret named by the generated deployment, using the keys in `agent.env.example`. Helm exposes `image`, `credentialsSecret`, and `namePrefix` in `values.yaml`; use a distinct `namePrefix` for multiple releases in one namespace.

Run the Helm commands inside the extracted export, not in this repository. Replace `my-workflow` with the exported project slug. The chart is `deploy/helm/<project-slug>/`, with `Chart.yaml`, `values.yaml`, and `templates/workload.yaml`:

```bash
helm lint deploy/helm/my-workflow
helm template my-workflow deploy/helm/my-workflow
# After setting values.yaml and provisioning the image and credentials:
helm upgrade --install my-workflow deploy/helm/my-workflow
```

The OpenShift export writes `deploy/openshift/workload.yaml` and `deploy/openshift/README.md` in that archive. From `deploy/openshift` in the archive, after editing the image reference:

```bash
oc apply --dry-run=server -f workload.yaml
oc apply -f workload.yaml
```

Read the deployment README in the archive before applying. Agent/harness graphs run as one-shot Jobs with no automatic retries. Server-only graphs produce MCP Deployments and ClusterIP Services. In graphs containing agents and MCP builders, the Job runs the agent graph; it does not separately publish those servers.

Cluster exports use **one pod boundary for the entire workflow**, with deadlines for individual agent processes. All sandbox blocks must use the same type and configuration. Podman/Docker map to the cluster's OCI runtime; gVisor/Kata require installed `gvisor`/`kata` RuntimeClasses. Firecracker exports cannot run without an adapter. OpenShell exports cannot be applied as cluster manifests; run them through a selected OpenShell gateway. Process limits and `noexec` temporary mounts require node/runtime configuration. A NetworkPolicy-capable CNI is required; `bridge` permits all egress until you narrow the policy. No public ingress/Route is generated.

## Runtime boundaries and limitations

- **Local workers:** non-root, read-only filesystem, dropped capabilities, no privilege escalation, CPU/memory/process limits, bounded temporary storage, no host mounts, and cleanup after completion or timeout. gVisor uses Docker `runsc`; Kata uses Podman `kata-runtime`.
- **Network:** `none` disables worker networking. `bridge` enables outbound access; it is not an endpoint firewall. Set endpoint URLs reachable from the worker: container `localhost` is the worker itself, not your workstation.
- **Agent limits:** defaults are 10 model turns, 20 tool calls, and 120 seconds. Tool arguments are schema-checked before requests. Only connected/allowed tools are offered, HTTP redirects are disabled, responses are bounded, and side-effecting calls are not automatically retried.
- **Approvals:** tool approval defaults on. The local CLI asks per invocation; unattended runs deny approval. Add a trusted approval integration for unattended protected tools, or explicitly review and configure tools that may run without approval.
- **Compatibility:** model endpoints must implement the supported Chat Completions contract. Other provider protocols, custom auth, and framework SDK integrations require gateways or exported-code changes.
- **Telemetry:** events describe status/timings without including model prompts, response bodies, or credential values. A complete OTLP tracing integration is not generated.
- **Deployment scope:** these are editable application artifacts. Remote authentication, cluster policy, runtime installation, and service operations remain deployment responsibilities. Local and cluster exports have different isolation boundaries as described above.

## Storage, backups, and credentials

Projects autosave in browser localStorage. There is no backend project database to provision or reset. The agent workspace uses a new namespace; old architecture projects are left untouched and are not automatically loaded or migrated.

| Data | Location / backup method |
| --- | --- |
| Project index | `athanoride.agents.projects.index.v1` in browser localStorage |
| Individual graphs | `athanoride.agents.project.<id>.v1`; back up each with **Graph JSON** |
| Block template library | `athanor.block-templates.v1`; back up separately with **Export templates** |
| Local secrets vault | Encrypted API-side file under `~/.local/share/athanor/vault/`, configurable with `ATHANOR_DATA_DIR` |

Use **Import JSON** to restore a saved graph. Clearing site data, switching browser profiles, or changing the hostname/port can make a project library disappear from view. Save backups before clearing storage. Graph exports do not back up the full template library or vault.

Enter credential **names**, never values, in block credential fields. Graphs, templates, and exports contain their configured content, so do not paste secrets into task text, resources, command arguments, or other freeform fields. The retained Local vault panel is separate from the exported agent runtime; it does not automatically inject secrets into these exports.

## Configuration and troubleshooting

The API reads `ATHANOR_*` settings and a `.env` file relative to its working directory. `make dev` starts it from `apps/api`. The frontend reads `NEXT_PUBLIC_API_BASE_URL`, defaulting to `http://127.0.0.1:8000`.

| Setting | Default / purpose |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Browser-visible API URL; set before frontend dev/build |
| `ATHANOR_CORS_ORIGINS` | JSON array; allows `http://localhost:3000` and `http://127.0.0.1:3000` by default |
| `ATHANOR_DATA_DIR` | `~/.local/share/athanor`; API local data, including the vault |
| `ATHANOR_VAULT_IDLE_TTL_SECONDS` | `1800`; vault idle timeout |
| `ATHANOR_IMAGE` | Exported launcher image override, not the IDE API image |
| `ATHANOR_PYTHON` | npm-export Python executable override |

### Use different development ports

`make dev` uses ports 8000/3000. To use different ports, first run `make install`, then run the services separately in two terminals from the repository root. Add bootstrapped tools to each shell's path if necessary:

```bash
export PATH="$PWD/.tools:$PWD/.tools/py/bin:$PATH"
```

API terminal:

```bash
ATHANOR_CORS_ORIGINS='["http://localhost:3010","http://127.0.0.1:3010"]' \
  uv run --directory apps/api uvicorn athanor_api.main:app \
  --reload --host 127.0.0.1 --port 8010
```

Frontend terminal:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8010 \
  pnpm --filter @athanor/web exec next dev --hostname 127.0.0.1 --port 3010
```

Open `http://127.0.0.1:3010`. Setting only `NEXT_PUBLIC_API_BASE_URL` does not move the API listener. The `ATHANOR_API_PORT`/`ATHANOR_WEB_PORT` variables apply only to the Podman launcher mappings; the stock production frontend embeds its public API URL during build, so runtime environment changes alone do not configure an alternative API address. Use the default container ports or customize the image build and API CORS together.

### Common issues

| Symptom | Check / fix |
| --- | --- |
| Validate, preview, or export cannot reach the API | Check the health URL, API process, frontend API URL, and allowed CORS origin. Root `pnpm dev` does not start the API; use `make dev`. |
| Registry search fails | Confirm the registry base URL and browser CORS policy; paste/upload its manifest if browser access is unavailable. |
| Imported MCP server offers no tools | Set exact allowed tool names, check credentials, transport, executable, and pinned package version. Empty allowlists intentionally expose none. |
| Endpoint calls fail after export | Enable `bridge` where needed; use a worker-reachable hostname; inject named credentials; verify the model ID and full API path. |
| Exported image is missing | Run `make build` in the archive, using the same engine and image name as the workflow. The launcher does not pull missing images automatically. |
| Tool call is denied | Inspect `requiresApproval`; unattended runs and standalone MCP servers cannot satisfy the local CLI prompt. |
| A connection will not attach | Use output → input with compatible contracts; remove a duplicate or an existing wire on a single-input port. Reconnection can move an existing endpoint. |
| Deleting a node seems to do nothing | Confirm the pending deletion in the inspector. Undo restores the node and attached wires. |
| A configuration edit is missing | Click **Apply** before validating, saving a template, or exporting. |
| Palette is stale after source changes | Rebuild shared packages or restart through `make dev`; run `pnpm catalog:sync` after changing agent definitions. |
| Helm/OpenShift export is rejected | Resolve validation errors, use identical sandbox policies, and choose Streamable HTTP for standalone MCP deployments. |
| Frontend production build cannot download fonts | The layout uses `next/font/google`; the build needs access to its font downloads. |

## Development and repository layout

The frontend uses Next.js App Router, React, React Flow, Zustand, and shared TypeScript contracts. FastAPI validates graphs, previews supported nodes, and generates exports. Agent runtimes are emitted from Python templates and run separately from the IDE.

```text
apps/web/                       Project library, canvas, inspectors, MCP import, stores
apps/api/                       FastAPI validation, preview, export, retained compiler/vault
packages/contracts/             Graph JSON Schema, Zod schemas, TypeScript types
packages/node-definitions/      Block ports, forms, defaults, and documentation
packages/ui/                    Shared UI primitives
scripts/                        Setup, development, containers, catalog synchronization
deploy/openshift-ide/           Kustomize manifests for running this IDE on OpenShift
docs/                           Current agent guide and architecture/design history
examples/                       Earlier pipeline examples (not current agent starters)
```

Run these commands from the **IDE repository root**:

```bash
make install          # Install dependencies and build shared packages
make dev              # Start API and frontend
make lint             # JavaScript lint plus Python Ruff checks/format check
make typecheck        # TypeScript and mypy
make test             # Vitest and Pytest
make podman-up        # Build/start the IDE in Podman
make podman-down      # Stop the IDE containers
make openshift-ide-deploy # Build into Quay or the internal registry, then deploy
make openshift-ide-apply  # oc apply -k deploy/openshift-ide
```

For direct workspace commands, use the PATH setup above if pnpm/uv were bootstrapped locally:

```bash
pnpm catalog:sync     # Rebuild agent definitions and update the API JSON mirror
pnpm catalog:check    # Fail when the agent catalog mirror is stale
pnpm --filter @athanor/web test
uv run --directory apps/api pytest -q
pnpm --filter @athanor/web build
```

The agent catalog source is [packages/node-definitions/src/agent-studio/index.ts](packages/node-definitions/src/agent-studio/index.ts); its generated API mirror is [agent_catalog.json](apps/api/athanor_api/agent_catalog.json). Update definitions, sync the mirror, and extend validation/runtime support together. UI templates alone do not create new executable node types.

Tests cover graph validation, preview isolation, export artifacts, runtime limits and approval denial, MCP behavior, imports, templates, and canvas mutation integrity. CI runs install, lint, type checking, and tests. Running tests is not a substitute for testing your own provider, MCP package, or target cluster.

Core API routes are `GET /api/v1/health`, `GET /api/v1/node-definitions`, and `POST /api/v1/projects/{validate,execute,export}`. The export request accepts `exportFormat`: `code`, `helm`, `podman`, `docker`, `openshift`, `npm`, or `makefile`, and returns a file map, manifest, and base64 ZIP. Use the running [OpenAPI UI](http://localhost:8000/docs) for full request schemas.

## Documentation

| Reference | Scope |
| --- | --- |
| [Agent studio guide](docs/agent-studio.md) | Current agent/MCP behavior, runtime boundaries, and upstream design references |
| [Frontend README](apps/web/README.md) | Routes, UI components, stores, and frontend development |
| [API README](apps/api/README.md) | Endpoints, catalog synchronization, preview/export boundaries |
| [Node authoring guide](packages/node-definitions/README.md) | Adding block definitions and execution support |
| [Contracts README](packages/contracts/README.md) | Graph schema and shared contract types |
| [UI package README](packages/ui/README.md) | Shared UI package |
| [Architecture](docs/architecture.md), [security model](docs/security-model.md), [ADRs](docs/decisions/README.md) | Retained architecture, compiler/vault details, and design history; use the agent guide for current export behavior |
| [Earlier user guide](docs/user-guide.md), [earlier node catalog](docs/node-catalog.md), [development plan](docs/development-plan.md) | Historical architecture workflow and retained modules; not a complete description of the current palette |
