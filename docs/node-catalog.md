# Node catalog

Authoritative definitions live in `packages/node-definitions` (TypeScript) and are mirrored for the API in `apps/api/athanor_api/catalog.py`.

Each node has:

- **Typed ports** — `contractType` must match when connecting (exact match or `ANY`)
- **Configuration fields** — edited in the right-hand inspector
- **Export kind** — how the exporter records the node in generated docs / code stubs
- **IDE execution** — whether **Run** can produce payloads (many category nodes are lineage-only)
- **Palette copy** — Full mode shows two paragraphs per node (`description` then `documentation`); Compact mode shows names only for proficient users

---

## Foundation

### Text Input (`foundation.text_input`)

Text Input is a pipeline source that emits a static STRING you author in the inspector. Place it at the start of a flow and connect its output to transforms, prompts, HTTP bodies, viewers, or any node that accepts text. Use it to prototype with sample copy, fixtures, and regression strings without depending on files or APIs.

Best used when you need a controlled, replayable text seed for Validate/Run or for documenting expected inputs in an export. Prefer JSON Input when the payload must stay structured, and Environment Variable or Secret Reference when values should come from the runtime instead of the graph.

**Config:** `value`

### JSON Input (`foundation.json_input`)

JSON Input provides a static JSON document serialized as a STRING for downstream nodes. Author the document in the inspector, then wire the output into transforms, HTTP bodies, agents, or validators that expect structured text. It keeps sample schemas and fixtures visible on the canvas so architects can reason about payload shape early.

Choose JSON Input when the starting payload is structured (API bodies, tool args, config snippets) rather than free prose. Keep samples small and schema-valid; for large datasets use Dataset Loader or external files referenced by Environment Variable instead of embedding bulk data in the graph.

**Config:** `json`

### Prompt Template (`foundation.prompt_template`)

Prompt Template renders a PROMPT from a template string and an optional STRING variables input. Put placeholders such as {{input}} in the template, connect upstream text when substitution is needed, and feed the PROMPT output into agents, vision models, or other prompt-aware nodes. It makes prompt structure explicit and reviewable on the canvas.

Best used whenever prompts should be versioned with the architecture rather than buried in application code. Prefer it over ad-hoc string concatenation in Python Transformation when the primary goal is LLM prompting; use Python Transformation when you need arbitrary text munging beyond template substitution.

**Config:** `template`

### Python Transformation (`foundation.python_transform`)

Python Transformation takes STRING in and STRING out, driven by a natural-language instruction you compile through the sandboxed NL compiler. Connect text sources upstream, describe the desired reshape (normalize, extract, rewrite), compile in the inspector, then Validate/Run or export the generated project. It is the main node for deterministic text processing in foundation pipelines.

Use it when you need reusable, testable text transforms with an audit trail from instruction to compiled code. Compile before production export; uncompiled graphs still document intent but should not ship. Prefer Prompt Template for LLM prompts and HTTP Request for remote calls rather than encoding those concerns in transform instructions.

**Config:** `instruction`

### HTTP Request (`foundation.http_request`)

HTTP Request models an outbound HTTP(S) call with optional STRING body and STRING response. Configure URL, method, and timeout in the inspector, optionally connect a body, and use the response downstream. Export emits a typed client stub so the generated project can perform the call outside the IDE.

Best used to declare integration boundaries with external APIs in the architecture. IDE Run skips live HTTP by default for safety—treat this as lineage and export scaffolding. Pair with Environment Variable or Secret Reference for base URLs and credentials rather than hard-coding secrets in the URL field.

**Config:** `url`, `method`, `timeoutSeconds`

### Output Viewer (`foundation.output_viewer`)

Output Viewer is a terminal sink that accepts STRING and displays the connected payload for inspection. Place it at the end of Validate/Run paths so architects can see what a pipeline produces without adding another transform. It has no configuration and no outputs—its job is observation.

Use it whenever you need a clear readout of intermediate or final text during design. Prefer it over leaving dangling outputs unconnected. For production exports it remains a documentation sink; logging and UI presentation in deployed apps should use dedicated sinks or application code.

### Portal Input (`foundation.portal_input`)

Portal Input re-enters data onto the canvas from a logical bus without a drawn edge. Configure a shared busId, contract type, and scope, then connect its output where the stream should continue. Pair it with one or more Portal Outputs that publish on the same bus so distant regions of a large graph stay readable.

Best used in large architectures, macros, or cross-swimlane designs where long edges would clutter the canvas. Keep busId and contractType identical across the pair; mismatch fails validation. Prefer ordinary edges for short, local connections so portals stay reserved for structural hops.

**Config:** `busId`, `displayName`, `contractType`, `scope`

### Portal Output (`foundation.portal_output`)

Portal Output publishes an upstream payload onto a portal bus for matching Portal Inputs elsewhere. Connect a compatible input, set the same busId and contract as the receiving Portal Input, and use scope to limit visibility to project, macro, or deployment. It removes the need for long crossing edges between distant canvas regions.

Use Portal Output when a stream must leave a subgraph or swimlane cleanly—auth results, shared events, or macro exits are common cases. Validate that every output bus has at least one consumer. For simple linear pipelines, a direct edge is clearer than a portal hop.

**Config:** `busId`, `displayName`, `contractType`, `scope`

### Environment Variable (`foundation.environment_variable`)

Environment Variable declares a named process env binding that resolves at runtime to a STRING. Configure the variable name and a non-secret example value for .env.example, then connect the output wherever configuration should be injected. It documents deployment-time knobs without baking host-specific values into application code.

Best used for non-secret configuration such as regions, feature flags, and public endpoints. Never put credentials in exampleValue—use Secret Reference (and the local vault for values). IDE Run may read the host environment for this node; exports only emit the example into .env.example.

**Config:** `name`, `exampleValue`

### Secret Reference (`foundation.secret_reference`)

Secret Reference points at a credential by name and provider without embedding the secret value in the graph. Set secretName and provider (env, file, vault, or cloud secret manager), then wire the output to nodes that need a credential handle. Export records only the name and provider as lineage comments.

Use it for every API token, password, or key the architecture depends on. Prefer provider vault with the Athanor local vault for local runs, and materialize .env for compose. IDE Run always redacts values; validation rejects embedded credential keys. Pair with infrastructure pull-token names when the same secret is shared across the project.

**Config:** `secretName`, `provider`

## Fine-tuning

### Dataset Loader (`fine_tuning.dataset_loader`)

Dataset Loader declares a training dataset as a DATASET output for fine-tuning graphs. Point it at a path or URI, choose a format (jsonl, csv, parquet, or Hugging Face), and connect the output into LoRA Trainer or other training consumers. It makes data lineage visible on the canvas so architects can see what feeds adaptation jobs.

Best used at the start of fine-tuning or evaluation subgraphs when the corpus should be part of the architecture record. The IDE does not download or shuffle data—export documents path and format for out-of-band training. Prefer Web-to-Markdown or Video-Chunking Big Blocks when you still need to produce the dataset before loading it.

**Config:** `datasetPath`, `format`

### LoRA Trainer (`fine_tuning.lora_trainer`)

LoRA Trainer configures a LoRA adaptation job over an incoming DATASET and emits MODEL_WEIGHTS lineage. Connect Dataset Loader (or compatible producers), set base model, rank, learning rate, and output path, then export the hyperparameters with the architecture. It captures training intent without launching GPUs inside the IDE.

Use it when you need an auditable LoRA recipe tied to a specific dataset node—product adapters, domain jargon, or IC LoRA from video chunks. Training execution remains out of band; pair with Model Runtime or Vision Model nodes to show where adapted weights will be consumed after training.

**Config:** `baseModel`, `epochs`, `batchSize`, `learningRate`, `rank`, `alpha`, `precision`, `gradientAccumulation`, `checkpointInterval`, `outputPath`

## Vision

### Image Input (`vision.image_input`)

Image Input is the vision pipeline source that declares a static image path or URI as an IMAGE output. Set path and MIME type in the inspector, then connect into preprocessors, vision models, or multimodal Big Blocks. It keeps the visual asset explicit in the architecture instead of implying images only in prose.

Best used for demos, golden fixtures, and documenting which assets a vision flow expects. The IDE does not decode pixels—export records path and MIME for out-of-band runtimes. Prefer multimodal UI or dataset loaders when images arrive dynamically from users or batches.

**Config:** `imagePath`, `mimeType`

### Image Preprocessor (`vision.image_preprocessor`)

Image Preprocessor sits between IMAGE producers and consumers to declare resize, fit, and output format. Connect an Image Input or other IMAGE source, configure width/height/fit, and pass the normalized IMAGE downstream to Vision Model or classifiers. It makes preprocessing policy visible before inference.

Use it when models require fixed geometry or when you want export docs to capture preprocessing contracts. Pixel transforms do not run in the IDE; this node is lineage for deployed pipelines. Skip it for architectures that already normalize images inside a Vision Model or Big Block stack.

**Config:** `width`, `height`, `fit`, `outputFormat`

### Vision Model (`vision.vision_model`)

Vision Model declares a caption, OCR, VQA, or classify task over an IMAGE input with an optional PROMPT. Connect Image Input/Preprocessor and optionally Prompt Template, set modelId and task, and take STRING text out. It documents which vision capability the architecture depends on.

Best used in fine-grained graphs where you want an explicit vision hop before agents or RAG. Inference is out of band—IDE Run skips lineage vision nodes. Prefer Image Classifier or Multimodal-RAG Big Blocks when you want an opinionated multi-tech composite instead of wiring atomic vision nodes.

**Config:** `modelId`, `task`, `maxTokens`

## Multi-agent

### Agent (`multi_agent.agent`)

Agent defines a role, system prompt, and model handle for multi-agent architectures. Optionally connect PROMPT and one or more TOOL_DEFINITION inputs, then use MODEL_HANDLE and EVENT outputs to show how the agent participates in a larger orchestration. It makes agent responsibilities and model choices reviewable on the canvas.

Use Agent when designing multi-role systems—researchers, critics, routers, planners—before committing to a specific harness or runtime. Wire optional PROMPT and TOOL_DEFINITION inputs to show how each role is prompted and which tools it may call. The IDE does not invoke models or run agent loops; export captures role, prompt, model, and tool lineage for review. Prefer Agentic Harness Big Block when you want an opinionated Pi/Goose-style assembly with MCP and companion frameworks instead of composing atomic agent nodes by hand.

**Config:** `role`, `systemPrompt`, `modelId`, `temperature`

### Tool Definition (`multi_agent.tool_definition`)

Tool Definition declares a named tool schema agents may call, emitting TOOL_DEFINITION. Author toolName, description, and a JSON Schema for arguments, then connect into Agent tool inputs (multiple allowed). It documents the callable surface of your agent system without implementing the tool body in the IDE.

Best used whenever agents need structured capabilities—search, ticketing, retrieval—that should be reviewed as contracts. Runtime binding happens outside the IDE; invalid JSON Schema fails validation. Prefer MCP Server when tools are discovered from an external MCP endpoint rather than hand-authored schemas.

**Config:** `toolName`, `description`, `inputSchema`

### MCP Server (`multi_agent.mcp_server`)

MCP Server references an Model Context Protocol endpoint for tool discovery, emitting MCP_SERVER. Configure server name, endpoint, and transport, then connect into harnesses or agents that consume MCP. It records how the architecture reaches external tool hosts without opening those connections from the IDE.

Use it when tools live behind MCP (filesystem, browser, SaaS bridges) and should appear as first-class architecture dependencies. The IDE never connects to the server. Prefer Tool Definition for a small number of hand-written tools, and Agentic Harness when MCP is one ingredient of a larger opinionated stack.

**Config:** `serverName`, `endpoint`, `transport`

## Enterprise

### Policy Guardrail (`enterprise.policy_guardrail`)

Policy Guardrail declares content allow/deny rules on a STRING path—block, redact, or warn. Connect text or prompt payloads through it before agents or egress nodes, and author policyName plus rules in the inspector. It makes safety policy part of the architecture rather than an afterthought in application code.

Best used on user-facing or regulated flows where PII, medical, or egress controls must be explicit. Enforcement runs in the deployed runtime, not the IDE. Place it immediately before external HTTP or agent calls when you need a clear compliance boundary on the canvas.

**Config:** `policyName`, `mode`, `rules`

### Audit Log (`enterprise.audit_log`)

Audit Log is a compliance sink that accepts EVENT inputs and records sink, retention, and payload-inclusion lineage. Connect agent events or other EVENT producers into it to show where decisions are retained. It has no outputs—its purpose is documenting the audit trail in the architecture.

Use it whenever regulated workflows need a declared audit destination such as SIEM, file, or stdout sinks with explicit retention. Connect EVENT producers from agents, harnesses, or orchestration nodes to show where decisions are retained in the architecture. The IDE does not write events during Run — export records sink choice, retention days, and payload policy for compliance review. Keep includePayload false unless you have a clear retention, access, and redaction plan for sensitive event content.

**Config:** `sink`, `retentionDays`, `includePayload`

### Identity Reference (`enterprise.identity_reference`)

Identity Reference documents an IdP client with public identifiers only—provider, clientId, and issuer—emitting a STRING identity handle. Place it where authentication context enters the architecture and connect to consumers that need to know which IdP the system trusts. Validation rejects embedded credentials.

Best used in enterprise apps that integrate OIDC/SAML/LDAP and must show identity boundaries on the canvas. Never paste client secrets—use Secret Reference and the local vault for values. Prefer this over encoding IdP details only in deployment YAML so architects can review trust relationships visually.

**Config:** `provider`, `clientId`, `issuer`

### Primary DB + Dedicated Vector DB (`enterprise.primary_vector_dbs`)

Primary DB + Dedicated Vector DB records an enterprise data topology: a transactional primary (PostgreSQL, MySQL, or MariaDB) paired with a dedicated vector store (Qdrant, Weaviate, or Milvus). Configure endpoints and secret names, then use the primary and vector STRING outputs to show how application services depend on each store.

Use this when you deliberately split OLTP from vector search for scale, compliance, or team ownership. Prefer PostgreSQL + pgvector Big Block when a single database should hold both relational data and embeddings. Always reference credentials by secret name; never embed passwords or API keys in the graph.

**Config:** `primaryDb`, `vectorDb`, `primaryEndpointUri`, `vectorEndpointUri`, `primarySecretName`, `vectorSecretName`

## Big Blocks

### AI Gateway (`big_blocks.ai_gateway`)

AI Gateway is an opinionated composite that routes prompts through LiteLLM, Kong AI, or Higress with auth hooks and provider adapters. On the canvas, wire an optional PROMPT into request and TOOL_DEFINITION ports into tools; take response as STRING and handle as MODEL_HANDLE for downstream UI or agent nodes.

Use this when several models or providers need one stable entry point, especially before chat UIs or agent harnesses. Prefer a local gateway; bind cloud endpoints with URI plus token secret name, and override stacks via the bottom template. Big Blocks are lineage and export only in the IDE — Run does not execute them.

**Config:** `openSourceStack`, `defaultModel`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### GraphRAG (`big_blocks.graphrag`)

GraphRAG extracts entities and relations from documents, stores them in a knowledge graph, and answers with hybrid graph-plus-vector retrieval. Connect STRING documents for ingest and a required STRING query; consume answer as STRING and optionally graph as JSON_SCHEMA for inspection or further tooling.

Best when Q&A needs multi-hop relationships, entity linking, or structured context beyond flat vector search. Default to local Neo4j or Kuzu; attach a cloud URI when you need a managed graph. This is a Big Block: it shapes lineage and export only, and Run skips it in the IDE.

**Config:** `openSourceStack`, `graphStore`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### AutoRAG (`big_blocks.autorag`)

AutoRAG is an automated retrieval pipeline that picks chunking, embeddings, and retrieval settings from a corpus profile. Feed an optional DATASET into corpus and a STRING query; the answer STRING is the grounded response you wire into chat UIs, agents, or evaluators.

Choose AutoRAG when you want sensible RAG defaults without hand-tuning every stage, then override via cloud URI or the custom template. It is not a live runtime in the IDE: Big Blocks contribute to lineage and export only, and Run skips them.

**Config:** `openSourceStack`, `embeddingModel`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Auto Local S3 Bucket (`big_blocks.local_s3_bucket`)

Auto Local S3 Bucket connects to or provisions an S3-compatible store such as MinIO, Garage, or SeaweedFS. Optionally pass a STRING objectKey; take bucketUri as a FILE_REFERENCE for artifact pipelines and an optional object FILE_REFERENCE when resolving a specific key.

Use it as the local-first object store for datasets, model artifacts, and export outputs; point endpointUri at AWS S3 or another provider and set tokenSecretName when needed. Big Blocks do not run inside the IDE — they are lineage and export only, and Run skips them.

**Config:** `openSourceStack`, `bucketName`, `autoProvision`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Simple UI (Chatbot) (`big_blocks.simple_ui_chatbot`)

Simple UI (Chatbot) is an opinionated chat front-end that sits on a local or cloud model runtime. Connect an optional MODEL_HANDLE into model and a PROMPT into system to define runtime and standing instructions. The messages port emits EVENT streams for downstream logging or orchestration, and uiSpec provides optional JSON_SCHEMA for shell layout or tooling integration.

Use this when you need a reviewable chat shell (Open WebUI, Chatbot UI, or LibreChat) in front of a gateway or Model Runtime rather than building UI from scratch. Keep local-first defaults and bind cloud endpoints with URI plus token secret name when needed. Override stacks via the bottom custom template for non-default layouts. This is a Big Block: it shapes lineage and export only in the IDE, and Run does not start or render the UI.

**Config:** `openSourceStack`, `title`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Simple UI Multi-modal (`big_blocks.simple_ui_multimodal`)

Simple UI Multi-modal is an opinionated front-end for mixed media capture with preprocessing hooks for text, image, audio, and optional video. Wire an optional MODEL_HANDLE into model so downstream stacks know which runtime backs the UI. The bundle output carries ANY mixed payloads for RAG or classifiers, and events emits EVENT streams for interaction telemetry or agent loops.

Choose this when the entry surface must accept several modalities before multimodal RAG, classifiers, or agents. Gradio, Streamlit, or Mesop presets stay local-first with optional cloud URIs and bottom-template overrides. Toggle acceptImage, acceptAudio, and acceptVideo to match your pipeline without redesigning the graph. Big Blocks are lineage and export only in the IDE — Run skips them and does not render controls or preprocess uploads.

**Config:** `openSourceStack`, `acceptImage`, `acceptAudio`, `acceptVideo`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Model Runtime (`big_blocks.model_runtime`)

Model Runtime stands up common local OSS inference (Ollama, vLLM, llama.cpp) with optional provider URI bindings. Feed an optional PROMPT; emit handle as MODEL_HANDLE for gateways and UIs, plus an optional completion STRING when you want a direct text reply on the canvas.

Prefer this as the local inference node behind chat UIs, gateways, or agent harnesses; switch to OpenAI-compatible or hyperscaler URIs with secret-name tokens when needed. Big Blocks are lineage and export only in the IDE — Run skips them and does not start a runtime here.

**Config:** `openSourceStack`, `modelId`, `providerUriPreset`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Image Classifier (`big_blocks.image_classifier`)

Image Classifier runs an opinionated vision stack (TIMM, ViT, or Ultralytics) over a required IMAGE input on the canvas. Connect image from a loader, UI bundle, or upstream transform; take labels as JSON_SCHEMA for full score maps and topLabel as STRING for routers, agents, or event paths that need a single decision.

Best for tagging product photos, screenshots, or vision stages before RAG, routing, or agent tools. Prefer local checkpoints and bind a cloud vision URI plus secret name when local models are insufficient. Tune modelId and stack choice in the inspector, then override via the bottom template for custom heads or post-processing. This Big Block does not classify during IDE Run — it contributes to lineage and export only.

**Config:** `openSourceStack`, `modelId`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Voice-to-Text (`big_blocks.voice_to_text`)

Voice-to-Text converts a required AUDIO input into text using common OSS ASR stacks such as faster-whisper, whisper.cpp, or Vosk. Wire audio from recorders, file loaders, or multimodal UIs; consume transcript as STRING for RAG, prompts, or agents, and optional segments as JSON_SCHEMA when timed spans matter for chunking or search.

Use it for meetings, calls, and voice notes before Audio-to-RAG, chat grounding, or agent tools. Local Whisper variants are the default; bind cloud STT via URI plus secret name when accuracy or language coverage requires it. Set language to a BCP-47 code or auto for detection. Big Blocks are lineage and export only — Run skips them in the IDE.

**Config:** `openSourceStack`, `language`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Sound Classifier (`big_blocks.sound_classifier`)

Sound Classifier labels non-speech audio events with popular OSS models such as YAMNet, PANNs, or BEATs. Connect AUDIO on input from microphones, files, or multimodal bundles; take labels as JSON_SCHEMA for ranked scores and topLabel as STRING for alerts, routers, or downstream multimodal pipelines.

Best for environmental or event detection rather than speech transcription — alarms, machinery, wildlife, or scene cues. Keep local defaults unless you need a managed audio API; cloud URIs and secret names are optional. Adjust topK when downstream nodes need broader label coverage. It does not classify during IDE Run — Big Blocks contribute to lineage and export only.

**Config:** `openSourceStack`, `topK`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Agentic Harness (`big_blocks.agentic_harness`)

Agentic Harness assembles an opinionated agent loop (OpenCode, OpenClaw, OpenHands, Goose, Open Interpreter, AURA, Pi, OMP, Aider, OpenHarness, Omnigents, or Archcon) with tools and MCP servers on the canvas. Require a PROMPT goal; optionally attach TOOL_DEFINITION and MCP_SERVER ports (multiple allowed). The run port emits EVENT for lifecycle telemetry, and result provides optional STRING completion signals for downstream consumers.

Use when you need a full tool-using agent rather than a single model call or atomic Agent node. Keep local-first runtimes and opt into Docker, Kubernetes, or hyperscaler targets via URI plus secret name when required. Pair harness selection with a companion OSS framework and override behavior via the bottom template. Big Blocks are lineage and export only — Run does not launch the harness in the IDE.

**Config:** `harness`, `openSourceStack`, `harnessRuntime`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Video-to-RAG (`big_blocks.video_to_rag`)

Video-to-RAG ingests VIDEO, extracts frames and transcripts, and indexes them for retrieval-augmented answering. Connect video from loaders or capture nodes; optionally supply a STRING query on the same graph. Take index as DATASET for storage or reuse, and answer as optional STRING when querying in place.

Best for lectures, demos, and recorded sessions that need searchable visual and spoken context together. Local ffmpeg plus ASR presets are the default; bind cloud media APIs via URI and secret name for large libraries or managed transcription. Tune frameIntervalSeconds to balance index size and visual fidelity. Big Blocks are lineage and export only — Run skips them in the IDE.

**Config:** `openSourceStack`, `frameIntervalSeconds`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Audio-to-RAG (`big_blocks.audio_to_rag`)

Audio-to-RAG transcribes and chunks AUDIO into a retrievable corpus for grounded Q&A on the canvas. Wire audio from files, ASR outputs, or multimodal sources; optionally connect a STRING query. Emit index as DATASET for reuse in other RAG nodes and answer as optional STRING when asking within the same graph.

Prefer this for podcasts, calls, and meetings that need searchable transcripts rather than one-shot ASR alone. Local ASR plus chunk-and-embed presets are the default; cloud URIs are optional for managed speech or vector services. Adjust chunkSeconds to match speaking pace and retrieval granularity. Big Blocks are lineage and export only — Run skips them in the IDE.

**Config:** `openSourceStack`, `chunkSeconds`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Multimodal-RAG (`big_blocks.multimodal_rag`)

Multimodal-RAG unifies retrieval over text, image, audio, and video on a shared index plane. Require a STRING query and attach optional text, IMAGE, AUDIO, or VIDEO inputs as your corpus channels. The answer STRING is the fused grounded response to wire into chat UIs, agents, or evaluators.

Use when the corpus mixes modalities and single-channel RAG or separate indexes are not enough. Keep local fusion presets and bind cloud VLMs or embedding APIs via URI plus secret name when needed. Choose early, late, or hybrid fusion to match how modalities should combine before answering. Big Blocks are lineage and export only — Run does not execute multimodal retrieval in the IDE.

**Config:** `openSourceStack`, `fusion`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Video-Chunking for IC LoRA (`big_blocks.video_chunking_ic_lora`)

Video-Chunking for IC LoRA cuts VIDEO into instruction-compatible clips and frames for image or video LoRA fine-tuning datasets. Connect video from loaders or capture pipelines; take dataset as DATASET into a trainer or storage node, and optional manifest as JSON_SCHEMA for per-clip metadata and captions.

Best when preparing IC-style training data from long videos before a LoRA trainer or dataset export. Tune clip length, stride, and instruction templates in the inspector, then override ffmpeg sampling via the bottom template when needed. Pair with Local S3 Bucket or Postgres when datasets need durable storage references. It does not train models or run ffmpeg in the IDE — Big Blocks are lineage and export only, and Run skips them.

**Config:** `openSourceStack`, `clipSeconds`, `strideSeconds`, `instructionTemplate`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Web-to-Markdown (`big_blocks.web_to_markdown`)

Web-to-Markdown fetches pages or accepts HTML and converts them into clean Markdown for RAG, agents, and docs pipelines. Require a STRING url or optionally pass html when content is already in memory. Take markdown as STRING for downstream chunking and optional metadata as JSON_SCHEMA for title, URL, and fetch details.

Use it to normalize docs sites and articles before AutoRAG, GraphRAG, or agent tools. Prefer local MarkItDown, Crawl4AI, or Trafilatura and bind managed crawl APIs via URI plus secret name when rate limits or auth require it. Raise maxPages cautiously when crawling linked content from a seed URL. Big Blocks are lineage and export only — Run does not fetch or convert pages in the IDE.

**Config:** `openSourceStack`, `includeImages`, `includeFrontmatter`, `maxPages`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### PostgreSQL + pgvector (`big_blocks.postgres_pgvector`)

PostgreSQL + pgvector is an opinionated relational-plus-vector store for embeddings and structured data in one database. Optionally feed STRING documents (multiple allowed) for ingest lineage and a query for similarity search. Take connection as STRING for downstream clients and optional results STRING when search answers are modeled on the canvas.

Choose this when RAG or agents need both SQL and vector search without a separate vector DB. Prefer local Postgres and bind Supabase, Neon, or managed instances via URI plus token secret name. Match embeddingDimensions to your embedding model and pick hnsw or ivfflat for expected corpus size. Big Blocks are lineage and export only — Run does not open connections or query data in the IDE.

**Config:** `openSourceStack`, `databaseName`, `embeddingDimensions`, `indexType`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

### Guardrail Builder (`big_blocks.guardrail_builder`)

Guardrail Builder drafts an initial agentic or model guardrail from company policy documents and security best practices. Point it at a hosted policy corpus (URI or connected STRING documents), chunk and embed those docs into a small local vector store sized for a few hundred documents, then call a local or remote generation model via API. Outputs are a guardrailPolicy STRING, a reasoningDocument STRING with cited rationale, optional references JSON_SCHEMA, and an optional index DATASET for the embedded corpus.

Best used early when security or platform teams need a first-pass agentic or model guardrail grounded in their own policy corpus rather than a generic template. Restrictive posture suits regulated or high-risk agents; standard adapts common guardrail patterns to explicit allow/deny language in the org docs; permissive only blocks behaviors the policies clearly forbid; custom lets authors paste a full system prompt into the node. Keep the local vector store small (hundreds of docs), bind larger generation models through local or remote API endpoints with token secret names, and wire guardrailPolicy into Policy Guardrail or Agentic Harness. Big Blocks are lineage and export only — Run does not fetch policies, embed chunks, or call models in the IDE.

**Config:** `openSourceStack`, `systemPromptPosture`, `customSystemPrompt`, `policySourceUri`, `embeddingModel`, `vectorStore`, `maxDocuments`, `chunkSize`, `chunkOverlap`, `generationModelId`, `includeCitations`, `deploymentMode`, `cloudProvider`, `endpointUri`, `tokenSecretName`, `useCustomTemplate`, `customTemplate`

