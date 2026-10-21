# `@athanor/node-definitions`

Declarative catalog of canvas nodes: ports, configuration fields, documentation, icons, and export behavior.

**This package is the authoring source of truth.** Current agent definitions live in [src/agent-studio/index.ts](src/agent-studio/index.ts). `pnpm catalog:sync` builds the package and generates [the API's agent_catalog.json](../../apps/api/athanor_api/agent_catalog.json); `catalog.py` loads it alongside retained legacy entries.

## Current palette

| Category | Prefix | Blocks |
| --- | --- | --- |
| Agents | `agent.*` | Sandboxed Agent, Guardrails, Model Endpoint, API Tool, Custom API Block |
| Harnesses | `harness.*` | LangGraph, OpenAI Agents SDK, Google ADK, PydanticAI, CrewAI, OpenClaw Enterprise, OpenCode, OpenClaw, OpenHands, Goose, Open Interpreter, AURA, Pi, OMP, and Aider endpoint adapters |
| Sandboxes | `sandbox.*` | Sandbox Policy, plus Podman, Docker, gVisor, Kata, Firecracker blueprint, OpenShell |
| MCP | `mcp.*` | Server Builder, Connection, Package / Command, Resource, Prompt |
| Foundation | Selected `foundation.*` | Text Input, JSON Input, Prompt Template, Output Viewer |

`NODE_DEFINITIONS` contains both current and retained definitions. The frontend uses `isAgentStudioType` to select its main palette. `HARNESS_OPTIONS` and `SANDBOX_OPTIONS` describe the curated alternatives; their descriptions must distinguish runnable integrations from endpoint adapters and blueprints.

Read the [agent studio guide](../../docs/agent-studio.md) for current behavior and the [root README](../../README.md) for setup. Saving a configured block as a UI template reuses its existing type; it does not register a new runtime implementation.

## Retained categories

| Category | Prefix | Examples |
| --- | --- | --- |
| Foundation | `foundation.*` | Text Input, Python Transform, Portals, Secrets |
| Fine-tuning | `fine_tuning.*` | Dataset Loader, LoRA Trainer |
| Vision | `vision.*` | Image Input, Preprocessor, Vision Model |
| Multi-agent | `multi_agent.*` | Agent, Tool Definition, MCP Server |
| Enterprise | `enterprise.*` | Policy Guardrail, Audit Log, Identity Reference, Primary DB + Vector DB |
| Big Blocks | `big_blocks.*` | Opinionated multi-tech composites (gateway, RAG, UI, harness, …) |

Historical reference: [docs/node-catalog.md](../../docs/node-catalog.md). These categories are not all shown in the current palette and their runtimes cannot automatically be mixed into agent exports.

## Anatomy of a `NodeDefinition`

```ts
{
  type: "foundation.text_input",
  displayName: "Text Input",
  description: "…",           // short palette blurb
  documentation: "…",         // how-to paragraph
  category: "foundation",
  version: "1.0.0",
  icon: "type",               // lucide key mapped in the web app
  exportKind: "pipeline_text_source",
  inputs: [/* portTemplate(...) */],
  outputs: [/* portTemplate(...) */],
  configurationFields: [/* inspector form fields */],
}
```

`createNodeFromDefinition(type, position)` materializes an `ArchitectureNode` with port ids and default config.

## Adding an agent/MCP block

1. Add the definition to `src/agent-studio/index.ts`, including typed ports, defaults, inspector fields, descriptions, and `exportKind: "agent_studio"`.
2. Ensure `src/index.ts` exports it and `isAgentStudioType` includes its type. Check the palette's category handling and icon mappings in `NodePalette.tsx` / `FoundationNode.tsx`.
3. If adding a contract type, update the shared TypeScript/Zod contracts, canonical graph JSON Schema, and API graph schema together.
4. Run `pnpm catalog:sync` from the repository root. Do not manually edit `agent_catalog.json`.
5. Implement validation in `apps/api/athanor_api/validation/agent_studio.py` and shared graph validation where needed.
6. Define design-preview behavior in `execution/engine.py`; agent previews must not call endpoints or start workers.
7. Implement real execution in the exported sources under `templates/export/agent/`. Update `exporter/agent_studio.py` and `exporter/agent_packaging.py` when dependencies, image recipes, or deployment constraints change.
8. Test required ports/configuration, graph validation, preview isolation, runtime behavior, and applicable export formats. Run `pnpm catalog:check` to verify the generated mirror.

For a retained legacy block, its category module, manually maintained entries in `catalog.py`, and the older export IR/Jinja handlers may also need changes. The agent synchronization script only maintains the agent catalog mirror.

## Development

```bash
# From the repository root, after make install; pnpm must be on PATH.
pnpm --filter @athanor/node-definitions build
pnpm --filter @athanor/node-definitions test
pnpm catalog:sync
pnpm catalog:check
```

## Related ADRs

- [0005 — Expanded node catalog](../../docs/decisions/0005-expanded-node-catalog.md)
- [0008 — Vision / multi-agent / enterprise expansion](../../docs/decisions/0008-catalog-expansion.md)
- [0010 — Big Blocks opinionated composites](../../docs/decisions/0010-big-blocks.md)
