# AthanorIDE

[Apache License 2.0](LICENSE) · SPDX: `Apache-2.0`

<p align="center">
  <img src="docs/assets/logo.jpg" alt="AthanorIDE logo" width="280" />
</p>

<p align="center"><strong>AI FIRST · VISUAL · ARCHITECT · BUILD</strong></p>

A local-first graphical workbench for designing sandboxed agents, connecting agent harnesses, and building or importing Model Context Protocol (MCP) servers. Configure endpoints, arguments, credentials by environment variable name, and execution limits through forms; connect blocks on a canvas; export editable code and deployment artifacts.

**New: three role views, one shared workflow.** Design task briefs, configure their implementations, and review security before exporting. Start with the [three-role user guide](docs/user-guide.md) or see the [change notes](CHANGELOG.md).

## Three-role workflow workspace

| View | What you can do |
| --- | --- |
| **Subject Matter Expert** | Draw, resize, color, and clone task boxes. Define each task's role, expected work, and constraints. Connect numbered stages, parallel tasks, and `AN` recovery routes. Export a build brief before implementation is complete. |
| **AI Engineer** | Implement each SME task inside a matching group using the existing palette and inspector. Assign components, bind string inputs/results, and share models, tools, and security resources across tasks. Inherit the current SME brief or explicitly override instructions. |
| **AgentOpSec Engineer** | Review highlighted guardrails, sandbox policies, authentication references, suspected embedded credentials, and instruction overrides. Preview and undo pruning of unused optional ports or disconnected group members, then validate for deployment. |

![SME workspace showing three role tabs, two parallel tasks, a stage-2 join, and an A1 recovery route](docs/assets/three-role-workspace.jpg)

*The **Parallel workflow + recovery** starter shows two stage-1 tasks, a stage-2 join, and a dedicated A1 recovery handler.*

See the [screenshot gallery](docs/screenshots.md) for all three role views, task boundaries, inherited instructions, and the pruning preview.

| AI Engineer · grouped implementation | AgentOpSec Engineer · pruning preview |
| --- | --- |
| [![AI Engineer with a task group, connected components, and string input/result boundaries](docs/assets/ai-engineer-workspace.jpg)](docs/screenshots.md#ai-engineer) | [![AgentOpSec Engineer highlighting security controls and previewing unused optional ports](docs/assets/agentopsec-pruning.jpg)](docs/screenshots.md#pruning-preview) |

- **Staged execution and recovery:** exported workflows run stage peers concurrently (default limit: four), wait at stage barriers, and combine predecessor results deterministically. A successful recovery replaces a task that failed, timed out, or was rejected by a guardrail.
- **Design-to-build handoff:** download a deterministic ZIP with `workflow.json`, a readable `build-brief.md`, and an importable `project-scaffold.json` for an engineer or external building agent.
- **Reviewable deployment artifacts:** separate design/deployment validation, location-based credential findings, and server-side export validation. Code, container, Helm, OpenShift, npm, and Makefile exports include the workflow specification and `security-review.json`.
- **One local project across all views:** autosave, duplication, JSON import/export, undo/redo, remembered role selection, separate SME/engineering viewports, and keyboard-accessible tabs.

All tabs are available to everyone. **Run preview** displays planned stages and recovery routes without executing agents; real execution uses the exported runtime. The build brief is a handoff artifact for an external builder.

**Project format change:** graph schema **2.0.0** starts a fresh project library. The first upgrade removes older saved projects; older graph imports are rejected. New projects survive later loads. Templates, preferences, marketplace caches, and the local vault are preserved. See [storage and backups](#storage-backups-and-credentials).

## Contents

- [Three-role workflow workspace](#three-role-workflow-workspace)
- [Screenshot gallery](docs/screenshots.md)
- [Change notes](CHANGELOG.md)
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
- [License](#license)

## What you can build

| Building block | Purpose |
| --- | --- |
| Sandboxed Agent | A bounded model/tool loop with connected tools, approvals, and a sandbox policy |
| Guardrails | Phrase, tool, and result-length checks the exported agent enforces |
| Model Endpoint | A full Chat Completions-compatible endpoint and its exact model ID |
| API Tool / Custom API Block | An HTTP endpoint exposed as a tool with JSON Schema arguments |
| Harness adapters | Call deployed LangGraph, OpenAI Agents SDK, Google ADK, PydanticAI, CrewAI, or OpenClaw Enterprise endpoints |
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

The installer detects Apple Silicon (`arm64`) or Intel (`x86_64`). If Node.js 20+ or a native Python 3.12+ is missing, it offers to install those dependencies with Homebrew. An x86_64 Python on Apple Silicon, such as an Intel Anaconda install, is not used: current Command Line Tools cannot link those builds. If Make is missing, install Command Line Tools with `xcode-select --install` and run the installer again. It then runs the same `make install` used on Linux. Open [localhost:3000](http://localhost:3000). Stop the services with Ctrl+C, or run `make stop` when that terminal is gone. The default development workflow does not require Podman. Use `make install-macos` as an equivalent entry point when Make is already available.

### Local development

From the repository root:

```bash
make install
make dev
```

`make install` installs workspace dependencies, creates the API virtual environment, and builds the shared TypeScript packages. `make dev` starts both the API and frontend. Stop that terminal with Ctrl+C, or run `make stop` from the repository root. `make stop` stops this checkout's API and web processes on any port. It also stops an Athanor API or Next dev server listening on ports 8000 and 3000, including one started from another checkout. A different program on those ports is left running.

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

The deployment in [deploy/openshift-ide](deploy/openshift-ide/) runs AthanorIDE's web app, API, and OpenShift OAuth proxy sidecar together in a namespace-scoped pod. It is separate from **Export → OpenShift**, which generates manifests for a workflow designed in the IDE. See [the application deployment guide](deploy/openshift-ide/README.md) for image builds, OAuth secret creation, namespace setup, and Route access.

On Linux, rootless Podman is the default local agent option. On macOS, start your Podman machine or Docker engine before running exports. On Windows, use a WSL2 Linux environment for the Bash/Make workflow. gVisor, Kata, and Firecracker need suitable Linux hosts and their own runtime setup. OpenShell needs its CLI and a selected gateway.

## Build your first agent

1. Create a blank project to open **Subject Matter Expert**, or choose an agent/harness starter. **Parallel workflow + recovery** demonstrates two stage-1 tasks, a stage-2 join, and an A1 handler.
2. Add or draw a task. Fill in its role, expected tasks, and functional constraints. Connect Start to the task with stage 1. Set the workflow input in the overview.
3. **Export build brief** downloads a deterministic design ZIP for an external builder. It needs a valid SME design, not completed components.
4. In **AI Engineer**, place an agent or harness and its model, tools, and sandbox. Select each component and assign its **Task group**. Shared resources may remain outside groups.
5. Select the task group and choose its string input and result boundaries. Do not wire a separate component into the input boundary. Connect internal implementation components normally.
6. Agent instructions inherit the latest SME brief. Use **Override instructions** to replace them explicitly; overrides remain visible during security review.
7. In **AgentOpSec Engineer**, review highlighted controls and findings. Preview pruning before applying it; Undo and Restore optional ports are available. Validate, choose an export format, and export.

Configure real endpoints, model IDs, allowed tools, and credential environment-variable names before running exported code. Network access starts disabled in the agent starter; enable the intended sandbox network policy when required. **Run preview** only displays planned stages and recovery routes. See [docs/user-guide.md](docs/user-guide.md) for execution semantics and keyboard controls.

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

Every deployment archive includes `workflow.json`, `build-brief.md`, and a deterministic `security-review.json`. Agent archives also include `agent-workflow.json`, `agent-deployment.json`, `workflow.py`, `workflow_scheduler.py`, `container_entry.py`, `app/`, `requirements-agent.txt`, `Containerfile.agent`, `agent.env.example`, `mcp-client.example.json`, and runtime READMEs. Credential references become variable-name placeholders; the exporter does not fetch values from the vault or your environment.

### Local source, Podman, Docker, and Makefile exports

Extract the ZIP and run these commands **inside the exported directory**, not the IDE repository:

```bash
python3 workflow.py plan
make build
# Supply the credentials named in agent.env.example through your shell environment.
make run
```

`make run` uses the saved workflow input. Override it for all root tasks with:

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

For Helm, replace `my-workflow` with the exported project slug:

```bash
helm lint deploy/helm/my-workflow
helm template my-workflow deploy/helm/my-workflow
# After setting values.yaml and provisioning the image and credentials:
helm upgrade --install my-workflow deploy/helm/my-workflow
```

For OpenShift, edit the image reference in the workload file first:

```bash
oc apply --dry-run=server -f deploy/openshift/workload.yaml
oc apply -f deploy/openshift/workload.yaml
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

Projects autosave in IndexedDB, with a localStorage metadata index and a localStorage fallback for restricted browsers. There is no backend project database. The version-2 database upgrade resets the project object store; a one-time cleanup replaces old project indexes and project-body keys. New projects and unrelated stored data survive subsequent loads. Only schema 2.0.0 imports are supported.

| Data | Location / backup method |
| --- | --- |
| Project index | `athanoride.agents.projects.index.v2` in browser localStorage |
| Individual graphs | IndexedDB `athanoride-project-library` / `projects`; restricted-browser fallback `athanoride.agents.project.v2.<id>`; back up with **Graph JSON** |
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

### Set up the local Qwen2.5-7B-Instruct endpoint (Linux/NVIDIA)

With Python 3.10+, a working NVIDIA driver, a user systemd session, and a recent
CUDA-enabled `llama` or `llama-server` runtime installed, run:

```bash
make setup-model-endpoint
```

The [setup script](scripts/setup-model-endpoint.py) reuses the official cached
Qwen2.5-7B-Instruct Q4_K_M GGUF (two shards, 4.7 GB total), verifies both pinned
SHA-256 checksums, selects the NVIDIA
GPU with the most total VRAM, and enables `athanor-model.service` for your user
session. Its defaults match the tested RTX 5090 setup: loopback port 8081, a 32K
context, native tool calling, and up to 4,096 output tokens.

The script first checks `/run/media/<user>/model-repo/llm-models/Qwen2.5-7B-Instruct-GGUF`,
then the Hugging Face cache for revision `bb5d59e06d9551d752d08b292a50eb208b07ab1f`.
It uses the cached files in place, preserving shard names and symlinks. It does not
download weights unless you pass `--download`; `HF_HUB_CACHE`, `HF_HOME`, and
`XDG_CACHE_HOME` are respected. The default runtime search
checks `~/.llama-app/llama`, then `llama` and `llama-server` on `PATH`. Install a
CUDA runtime from the [official llama.cpp releases](https://github.com/ggml-org/llama.cpp/releases)
if needed. The script does not install drivers or runtimes and rejects a runtime
that cannot use CUDA.

```bash
# Preview prerequisites and the generated service without making changes.
python3 scripts/setup-model-endpoint.py --dry-run

# Override the local paths, GPU index (or UUID), and port; prevent downloads.
python3 scripts/setup-model-endpoint.py \
  --model-dir /path/to/Qwen2.5-7B-Instruct-GGUF --llama-bin /path/to/llama \
  --gpu 0 --port 8081 --no-download

# Check health, model discovery, chat, and a complete tool-call round trip.
python3 scripts/setup-model-endpoint.py --check-only

systemctl --user restart athanor-model
systemctl --user stop athanor-model
journalctl --user -u athanor-model -f
```

Optional downloads resume when rerun with `--download`. Existing files with a mismatched
checksum are preserved and rejected. Re-running setup keeps an unchanged healthy
service running. The model service is separate from `make dev` / `make stop`;
its runtime and model files must remain available. Connection details are saved
in `~/.config/athanor/model-endpoint.json` (or under `XDG_CONFIG_HOME`).

In **Assistant settings**, save `http://127.0.0.1:8081/v1/chat/completions` and model
ID `qwen2.5-7b-instruct`, turn **Use API token** off, and click **Save**. The model
endpoint has no API key and listens only on loopback. With the switch off, both
assistant actions skip the vault and omit the Authorization header. For an endpoint
that requires authentication, turn the switch on and save its token in the unlocked
**Local vault**. Turning it off preserves any previously stored token. Existing
settings default to token authentication until explicitly switched off.

The setup smoke check verifies chat and a basic function-call round trip.
**Build agent chain** plans each task separately using its brief, neighboring
tasks, and its predecessor's output contract. The default AI engineering prompt
is in `apps/api/athanor_api/assistant/prompts.py`. Each task gets a configured
model, sandbox, output guardrails, and an agent with specific instructions,
input/output contracts, failure handling, and acceptance checks. The compiler
owns typed wiring; incomplete plans are retried and one-node drafts are rejected.

The SME canvas includes an **End** node. Reachable final normal tasks connect
to it automatically; recovery handlers resume their original branch. Completion
waits for all normal branches, matching the exported scheduler.

Before planning each task, the builder supplies a fresh tool inventory containing
supported HTTP/MCP adapter schemas and existing project integrations. Selected
saved integrations reuse their endpoint, argument schema, and secret reference.
This lists configurations without contacting services or granting new tools.

The resulting workflow passes each task's result to the next task as its prompt
input, without hidden conversation history. Multiple predecessors arrive as a
JSON map keyed by task ID. Existing transitions, including parallel and recovery
paths, are preserved; a concept without transitions becomes a serial chain in
task order. Each agent returns a state containing status, result, evidence,
artifacts, and missing inputs for the next stage.

Select **Rebuild all tasks** to replace existing task components (including old
one-node drafts); Undo restores them. Rebuild after changing a task brief to
refresh its generated instructions. Review the saved **Engineering stage plans**
for acceptance checks and setup requirements. HTTP/MCP tools are connected only
when their endpoint and configuration are supplied; missing integrations are
listed for setup rather than fabricated. Building creates the graph and prompts;
**Run preview** does not execute model calls. Run the exported workflow to execute
the agents.

The script does not change browser preferences. Exported
containers need their own reachable endpoint address; container loopback does
not point to this host service.

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

Open `http://127.0.0.1:3010`. `make stop` stops those processes too. Setting only `NEXT_PUBLIC_API_BASE_URL` does not move the API listener. The `ATHANOR_API_PORT`/`ATHANOR_WEB_PORT` variables apply only to the Podman launcher mappings; the stock production frontend embeds its public API URL during build, so runtime environment changes alone do not configure an alternative API address. Use the default container ports or customize the image build and API CORS together.

### Common issues

| Symptom | Check / fix |
| --- | --- |
| Browser says “Load failed” or “Failed to fetch” | The API allows `localhost` and `127.0.0.1` on ports 3000 and 3100 by default. An `ATHANOR_CORS_ORIGINS` override replaces that list; include the exact frontend scheme, hostname, and port, then restart the API. |
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
docs/                           Current agent guide and architecture/design history
examples/                       Starter guide and retained transform walkthrough
```

Run these commands from the **IDE repository root**:

```bash
make install          # Install dependencies and build shared packages
make dev              # Start API and frontend
make stop             # Stop API and frontend processes from this checkout
make lint             # JavaScript lint plus Python Ruff checks/format check
make typecheck        # TypeScript and mypy
make test             # Vitest and Pytest
make podman-up        # Build/start the IDE in Podman
make podman-down      # Stop the IDE containers
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

Tests cover schema parity, one-time project reset, task briefs and bindings, instruction inheritance/overrides, pruning and undo, credential detection, deterministic handoff/export artifacts, concurrent stages, recovery, deadlines, and approval serialization. Existing agent/MCP, import, template, and canvas coverage remains. CI runs install, lint, type checking, and tests. Running tests is not a substitute for testing your own provider, MCP package, or target cluster.

Core API routes are `GET /api/v1/health`, `GET /api/v1/node-definitions`, and `POST /api/v1/projects/{validate,handoff,execute,export}`. Validation accepts `design` or `deployment` profiles (default: deployment); handoff requires a valid SME design without requiring completed components. The export request accepts `exportFormat`: `code`, `helm`, `podman`, `docker`, `openshift`, `npm`, or `makefile`, and returns a file map, manifest, and base64 ZIP. Use the running [OpenAPI UI](http://localhost:8000/docs) for full request schemas.

## Documentation

| Reference | Scope |
| --- | --- |
| [Three-role user guide](docs/user-guide.md) | SME design, grouped implementation, security review, pruning, and workflow execution |
| [Screenshot gallery](docs/screenshots.md) | All three role views, instruction inheritance, and pruning previews |
| [Change notes](CHANGELOG.md) | New features and the schema-2.0.0 project storage break |
| [Starter examples](examples/README.md) | Parallel tasks, join/recovery, sandboxed agents, harnesses, and MCP servers |
| [Agent studio guide](docs/agent-studio.md) | Current agent/MCP behavior, runtime boundaries, and upstream design references |
| [Frontend README](apps/web/README.md) | Routes, UI components, stores, and frontend development |
| [API README](apps/api/README.md) | Endpoints, catalog synchronization, preview/export boundaries |
| [Node authoring guide](packages/node-definitions/README.md) | Adding block definitions and execution support |
| [Contracts README](packages/contracts/README.md) | Graph schema and shared contract types |
| [UI package README](packages/ui/README.md) | Shared UI package |
| [Architecture](docs/architecture.md), [three-role ADR](docs/decisions/0012-three-role-workflow.md), [all ADRs](docs/decisions/README.md) | Project model, workflow execution contracts, and design decisions |
| [Security model](docs/security-model.md), [earlier node catalog](docs/node-catalog.md), [development plan](docs/development-plan.md) | Retained compiler/vault details and historical modules; use the user and agent guides for current role and export behavior |

## License

AthanorIDE is licensed under the **Apache License, Version 2.0** (`Apache-2.0`). See [LICENSE](LICENSE) for the full terms.

AthanorIDE is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. Third-party dependencies retain their respective licenses.
