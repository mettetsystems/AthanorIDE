# AthanorIDE user guide

See the [screenshot gallery](screenshots.md) for the three role views, task boundaries, instruction review, and pruning previews.

## Projects and role tabs

Projects autosave locally in IndexedDB, with a localStorage fallback where IndexedDB is unavailable. Schema **2.0.0** starts a fresh project library: the first upgrade removes older saved projects and project indexes. Later visits preserve new projects. Templates, preferences, marketplace data, and the encrypted local vault are unaffected. Older JSON imports are rejected with an unsupported-version message.

A blank project opens in **Subject Matter Expert**. Home-page role choices open the workspace in the selected role; subsequent role choices are remembered. The three tabs are available to everyone and edit the same project. SME and engineering canvases remember separate viewports. Use the tab arrow keys, Home, or End to switch roles. At narrow widths, the Inspector and Node library buttons open the corresponding panels.

## Subject Matter Expert

Use **Add task** or **Draw task**, then drag a rectangle on the canvas. Drag its colored header to move it and select it to expose resize handles. Edit **Role**, **Expected tasks**, and **Functional constraints** directly in the box; edits save when leaving the field. Select the task to rename it, choose a color, clone its brief, or delete it. Cloning creates a fresh task without connections, component assignments, or execution bindings. Deletion removes the task's transitions and unassigns its components. Both operations support Undo.

Connect the Start marker's right anchor to a task's left anchor. Connect task anchors to continue the workflow. Select a line to edit its number or convert it to a recovery path:

- Start connects to stage **1**. All normal incoming lines to a task must give it the same stage.
- A subsequent line must advance beyond its source's stage. Equal stage numbers run concurrently; the next stage waits for all current tasks to succeed or recover.
- A recovery line is **AN**, where N is the failed task's stage. Add a recovery description and a separate handler task with its own brief. A handler has one failed source and no outgoing or nested recovery routes.

The overview holds the workflow's string input and maximum parallel tasks (default 4, range 1–32). It lists planned stages and recovery routes. Search focuses tasks; Fit View frames the complete design. Ctrl/Cmd+D clones the selected brief; Delete/Backspace removes the selection; Ctrl/Cmd+Z and Shift+Z undo/redo; Escape cancels drawing or selection.

**Validate** checks the design without requiring implementation components. **Export build brief** calls `POST /api/v1/projects/handoff` and downloads a deterministic ZIP containing `workflow.json`, readable `build-brief.md`, and an importable schema-2.0.0 `project-scaffold.json`. Give it to an external building agent or an engineer. Credential findings must be resolved before handoff.

The right column has **Details** and **Assistant**. After every task has a role and expected tasks, **Build draft** sends those briefs and transitions to the model endpoint saved with the gear under search. Tasks that already have components are left unchanged. The draft is one Undo. The workspace then opens as AI Engineer. The model token is not included in the brief.

## AI Engineer

The existing palette, component canvas, inspector, macros, portals, and deployment controls remain. Each SME task appears as a persistent group with its matching title and color. Dragging the group header moves assigned components. Moving an individual component does not silently change membership: select one or more components and use **Task group** in the inspector. Models, tools, and security resources may be shared outside groups. Every executable agent or harness must belong to a task.

Select a task group to choose **Workflow input boundary** and **Task result boundary**. Each must bind one string port on a member component. The workflow supplies its input directly, so remove any internal wire into that port. Wire the remaining implementation normally. Every assigned executable must contribute to the declared result. Use workflow transitions to pass task results across groups; do not wire execution/data flow directly between tasks.

Agents and harnesses inherit the latest SME brief by default. **Override instructions** enables a deliberate replacement, edited and applied through the component inspector. **Restore SME instructions** returns to inheritance. Assigning an already-configured component preserves non-default custom instructions as a flagged override. Later SME edits immediately affect inherited instructions. Harness requests include the effective instructions alongside their task input.

**Assistant** answers questions about this project's tasks, components, and non-secret configuration. The answer lists the retrieved component names. The question and those passages are the only project text sent to the model.

## AgentOpSec Engineer

The engineering layout highlights guardrails, sandbox policies, credential/authentication references, suspected embedded credentials, unused ports, and instruction overrides. Selecting an agent shows the SME brief beside its effective instructions. Validation findings navigate to the affected component, task, or transition and include field/port locations where relevant.

**Prune unused ports** previews the exact optional ports to remove from a component's JSON. Required ports, connected ports, task boundaries, and macro bindings are protected. **Restore optional ports** restores deliberate omissions from the current catalog. **Prune disconnected components** on a task previews only fully disconnected members; boundaries, macro/portal references, and shared resources survive. Apply the preview as one undoable operation. The graph is revalidated after pruning; editing it invalidates old validation results.

Instruction overrides are review warnings and do not require approval. Missing required connections, invalid policies, invalid task bindings, and detected embedded credentials block deployment export. Scanning includes nested configuration, metadata, task briefs, overrides, and exported descriptions; findings identify locations without repeating credential values. Use named environment/secret references and the existing Local vault/Infra tokens tools to manage credentials.

**Assistant** uses the same project index as the AI Engineer view, so deployment questions can follow a component and its immediate connections. Secret-like text is redacted before it is indexed or sent.

## Assistant model settings

Athanor automatically checks Project Maya when the API starts. Start Maya first,
with its OpenAI-compatible model API at `http://127.0.0.1:8080/v1/models`, then
start Athanor. Before showing the editor, the web app reads that startup result
and selects `http://127.0.0.1:8080/v1/chat/completions` when a model is available.
It keeps your previously selected model if it belongs to this endpoint and is
still advertised; otherwise it selects the first available model. This overrides
a previously saved assistant endpoint and turns **Use API token** off because
the startup check succeeds without credentials.

If Maya is absent, loading, requires authentication, or returns no available
models, your existing assistant preferences remain unchanged. The API probe has
a one-second request timeout; the browser waits up to three seconds for the API
startup result, then opens the editor even if that request fails. The probe only
lists models and does not start Maya, download weights, or run inference.

The gear under the search field saves the chat-completions URL and model ID as a
browser preference. You can change the automatic selection there for the current
session; reopening the app reapplies the API's startup result. These preferences
are not part of the project and are not exported. The token field is write-only:
Save stores `ATHANOR_ASSISTANT_TOKEN` in the local vault and clears the field.
Unlock the vault from **Local vault** before saving a token. A locked vault stops
the assistant before any model request only when **Use API token** is enabled.

If Maya was started after Athanor, open the gear, click **Check local servers
again**, choose its model, click **Use this endpoint**, then **Save**. Alternatively,
restart the API and reload the web app to repeat automatic selection. The startup
result is cached for the API process lifetime; it is not a continuous health check.
If Maya stops later, assistant requests can fail until you restart Maya or select
another endpoint.

For a protected Maya server, enable **Use API token**, save its token in the
unlocked vault, and use **Check this URL with saved vault token**. For a remote
server or container deployment, enter an address reachable from the API:
`127.0.0.1` always means the API's own host or container. Automatic selection
configures the in-app assistant; model blocks in workflows and exported projects
still need their own endpoint configuration. A successful model-list check does
not guarantee inference or tool-calling support.

The API also serves these catalog and draft tools at `http://127.0.0.1:8000/assistant/mcp` for a local MCP client. `list_blocks` and `describe_block` expose catalog ports and required fields. `draft_architecture` uses the same validation as **Build draft**. Placeholder endpoints and secret names are allowed; secret values are rejected.

## Preview, export, and execution

**Run preview** displays the planned stages and recovery routes without calling agent endpoints or tools. Deployment **Validate** checks design, implementation, and security readiness. **Export** revalidates the submitted graph again on the server, regardless of browser validation state. Source code, container, Helm, OpenShift, npm, and Makefile exports include `workflow.json`, `build-brief.md`, and `security-review.json`. Agent exports also include the shared `workflow_scheduler.py` and their existing runtime artifacts. Exporting downloads a ZIP; it does not publish or deploy it.

The exported CLI's `--task` overrides workflow input, including an explicitly empty string. Roots receive that input. A task with one predecessor receives its string result; multiple predecessors become a deterministic JSON object keyed by task ID. Recovery receives a JSON string with `input` and `failure: {taskId, code}`; the code is `execution_failure`, `timeout`, or `guardrail_rejection`. Its successful string result substitutes for the failed task result. Missing or failed recovery stops advancement after already-running peers finish within deadlines. Recovery runs only when triggered; no automatic retries or custom conditions are included.

Local execution retains isolated containers; cluster execution retains fresh worker processes within the deployment's pod sandbox. Both use the same scheduler and deadlines. Interactive CLI tool approvals are serialized; unattended approvals fail closed. Status events contain task/stage identifiers and states, not task payloads.

The **MCP server** starter can have an empty workflow and uses its existing `serve-mcp`/server entrypoint. Agent and harness starters contain one task; **Parallel workflow + recovery** demonstrates parallel tasks, a join, and an A1 handler. Configure endpoints, network policies, model IDs, and credential references before running any exported starter.

## Persistence and reusable components

Graph JSON export/import, project duplication, autosave, and undo/redo preserve briefs, layouts, transitions, bindings, overrides, and pruned ports. Saved block templates remain reusable without retaining a stale project task assignment. Component deletion clears any boundary referring to it; Undo restores the component and binding together. Keep exported JSON backups of projects you want to move between browsers.
