/**
 * Big Blocks — opinionated multi-technology composite nodes.
 *
 * Each block bundles popular open-source defaults, optional cloud URI + secret-name
 * bindings, and a bottom custom template for full overrides (local-first).
 */
import { portTemplate, type NodeDefinition } from "../types.js";
import {
  bigBlockCloudFields,
  bigBlockTemplateFields,
  defaultBigBlockTemplate,
  openSourceStackField,
} from "./shared.js";

function block(
  partial: Omit<NodeDefinition, "category" | "version" | "exportKind"> & {
    version?: string;
  },
): NodeDefinition {
  return {
    category: "big-blocks",
    version: partial.version ?? "1.0.0",
    exportKind: "big_blocks",
    ...partial,
  };
}

export const aiGatewayDefinition = block({
  type: "big_blocks.ai_gateway",
  displayName: "AI Gateway",
  description:
    "AI Gateway is an opinionated composite that routes prompts through LiteLLM, Kong AI, or Higress with auth hooks and provider adapters. On the canvas, wire an optional PROMPT into request and TOOL_DEFINITION ports into tools; take response as STRING and handle as MODEL_HANDLE for downstream UI or agent nodes.",
  icon: "network",
  inputs: [
    portTemplate("request", "input", "PROMPT", { required: false }),
    portTemplate("tools", "input", "TOOL_DEFINITION", { required: false, multiple: true }),
    portTemplate("runtime", "input", "MODEL_HANDLE", { required: false }),
    portTemplate("credentials", "input", "STRING", { required: false }),
  ],
  outputs: [
    portTemplate("response", "output", "STRING"),
    portTemplate("handle", "output", "MODEL_HANDLE"),
  ],
  configurationFields: [
    openSourceStackField(
      ["litellm", "kong-ai", "higress"],
      "litellm",
      "Gateway stack",
      "LiteLLM, Kong AI, or Higress — three common open-source AI gateway choices.",
    ),
    {
      key: "defaultModel",
      label: "Default model id",
      description: "Fallback model routed when callers omit one.",
      type: "string",
      required: true,
      defaultValue: "local/llama-3.2-3b",
    },
    ...bigBlockCloudFields({ defaultUri: "http://127.0.0.1:4000" }),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("ai_gateway", "litellm")),
  ],
  documentation:
    "Use this when several models or providers need one stable entry point, especially before chat UIs or agent harnesses. Prefer a local gateway; bind cloud endpoints with URI plus token secret name, and override stacks via the bottom template. Big Blocks are lineage and export only in the IDE — Run does not execute them.",
});

export const graphRagDefinition = block({
  type: "big_blocks.graphrag",
  displayName: "GraphRAG",
  description:
    "GraphRAG extracts entities and relations from documents, stores them in a knowledge graph, and answers with hybrid graph-plus-vector retrieval. Connect STRING documents for ingest and a required STRING query; consume answer as STRING and optionally graph as JSON_SCHEMA for inspection or further tooling.",
  icon: "git-fork",
  inputs: [
    portTemplate("documents", "input", "STRING", { required: false }),
    portTemplate("corpus", "input", "DATASET", { required: false }),
    portTemplate("vectorStore", "input", "DATABASE_HANDLE", { required: false }),
    portTemplate("query", "input", "STRING"),
  ],
  outputs: [
    portTemplate("answer", "output", "STRING"),
    portTemplate("graph", "output", "JSON_SCHEMA", { required: false }),
  ],
  configurationFields: [
    openSourceStackField(
      ["microsoft-graphrag", "neo4j-genai", "langchain-graph"],
      "microsoft-graphrag",
      "GraphRAG stack",
    ),
    {
      key: "graphStore",
      label: "Graph store",
      description: "Backing graph database for entities and relations.",
      type: "select",
      required: true,
      defaultValue: "neo4j",
      options: ["neo4j", "networkx", "kuzu"],
    },
    ...bigBlockCloudFields(),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("graphrag", "microsoft-graphrag")),
  ],
  documentation:
    "Best when Q&A needs multi-hop relationships, entity linking, or structured context beyond flat vector search. Default to local Neo4j or Kuzu; attach a cloud URI when you need a managed graph. This is a Big Block: it shapes lineage and export only, and Run skips it in the IDE.",
});

export const autoRagDefinition = block({
  type: "big_blocks.autorag",
  displayName: "AutoRAG",
  description:
    "AutoRAG is an automated retrieval pipeline that picks chunking, embeddings, and retrieval settings from a corpus profile. Feed an optional DATASET into corpus and a STRING query; the answer STRING is the grounded response you wire into chat UIs, agents, or evaluators.",
  icon: "wand-sparkles",
  inputs: [
    portTemplate("corpus", "input", "DATASET", { required: false }),
    portTemplate("documents", "input", "STRING", { required: false, multiple: true }),
    portTemplate("sourceFile", "input", "FILE_REFERENCE", { required: false }),
    portTemplate("vectorStore", "input", "DATABASE_HANDLE", { required: false }),
    portTemplate("query", "input", "STRING"),
  ],
  outputs: [portTemplate("answer", "output", "STRING")],
  configurationFields: [
    openSourceStackField(
      ["haystack", "llamaindex", "ragflow"],
      "haystack",
      "AutoRAG stack",
    ),
    {
      key: "embeddingModel",
      label: "Embedding model",
      description: "Local-first embedding model id.",
      type: "string",
      required: true,
      defaultValue: "sentence-transformers/all-MiniLM-L6-v2",
    },
    ...bigBlockCloudFields(),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("autorag", "haystack")),
  ],
  documentation:
    "Choose AutoRAG when you want sensible RAG defaults without hand-tuning every stage, then override via cloud URI or the custom template. It is not a live runtime in the IDE: Big Blocks contribute to lineage and export only, and Run skips them.",
});

export const localS3BucketDefinition = block({
  type: "big_blocks.local_s3_bucket",
  displayName: "Auto Local S3 Bucket",
  description:
    "Auto Local S3 Bucket connects to or provisions an S3-compatible store such as MinIO, Garage, or SeaweedFS. Optionally pass a STRING objectKey; take bucketUri as a FILE_REFERENCE for artifact pipelines and an optional object FILE_REFERENCE when resolving a specific key.",
  icon: "hard-drive",
  inputs: [
    portTemplate("objectKey", "input", "STRING", { required: false }),
    portTemplate("weights", "input", "MODEL_WEIGHTS", { required: false }),
    portTemplate("dataset", "input", "DATASET", { required: false }),
    portTemplate("manifest", "input", "JSON_SCHEMA", { required: false }),
  ],
  outputs: [
    portTemplate("bucketUri", "output", "FILE_REFERENCE"),
    portTemplate("object", "output", "FILE_REFERENCE", { required: false }),
  ],
  configurationFields: [
    openSourceStackField(
      ["minio", "garage", "seaweedfs"],
      "minio",
      "S3-compatible stack",
    ),
    {
      key: "bucketName",
      label: "Bucket name",
      description: "Default bucket to create or attach.",
      type: "string",
      required: true,
      defaultValue: "athanor-artifacts",
    },
    {
      key: "autoProvision",
      label: "Auto-provision local bucket",
      description: "When local, attempt to create the bucket if missing.",
      type: "boolean",
      required: true,
      defaultValue: true,
    },
    ...bigBlockCloudFields({
      defaultProvider: "none",
      defaultUri: "http://127.0.0.1:9000",
    }),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("local_s3_bucket", "minio")),
  ],
  documentation:
    "Use it as the local-first object store for datasets, model artifacts, and export outputs; point endpointUri at AWS S3 or another provider and set tokenSecretName when needed. Big Blocks do not run inside the IDE — they are lineage and export only, and Run skips them.",
});

export const simpleUiChatbotDefinition = block({
  type: "big_blocks.simple_ui_chatbot",
  displayName: "Simple UI (Chatbot)",
  description:
    "Simple UI (Chatbot) is an opinionated chat front-end that sits on a local or cloud model runtime. Connect an optional MODEL_HANDLE into model and a PROMPT into system to define runtime and standing instructions. Its prompt output can feed an agent harness; messages emits EVENT streams for downstream logging and uiSpec provides optional JSON_SCHEMA for shell layout. The canvas forbids cycles, so route a harness result to an Output Viewer rather than back into this same UI node.",
  icon: "message-circle",
  inputs: [
    portTemplate("model", "input", "MODEL_HANDLE", { required: false }),
    portTemplate("system", "input", "PROMPT", { required: false }),
    portTemplate("context", "input", "STRING", { required: false, multiple: true }),
    portTemplate("identity", "input", "STRING", { required: false }),
  ],
  outputs: [
    portTemplate("prompt", "output", "PROMPT"),
    portTemplate("messages", "output", "EVENT"),
    portTemplate("uiSpec", "output", "JSON_SCHEMA", { required: false }),
  ],
  configurationFields: [
    openSourceStackField(
      ["open-webui", "chatbot-ui", "librechat"],
      "open-webui",
      "Chat UI stack",
    ),
    {
      key: "title",
      label: "App title",
      description: "Displayed product name in the UI shell.",
      type: "string",
      required: true,
      defaultValue: "Athanor Chat",
    },
    ...bigBlockCloudFields(),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("simple_ui_chatbot", "open-webui")),
  ],
  documentation:
    "Use this when you need a reviewable chat shell (Open WebUI, Chatbot UI, or LibreChat) in front of a gateway or Model Runtime rather than building UI from scratch. Keep local-first defaults and bind cloud endpoints with URI plus token secret name when needed. Override stacks via the bottom custom template for non-default layouts. This is a Big Block: it shapes lineage and export only in the IDE, and Run does not start or render the UI.",
});

export const simpleUiMultimodalDefinition = block({
  type: "big_blocks.simple_ui_multimodal",
  displayName: "Simple UI Multi-modal",
  description:
    "Simple UI Multi-modal is an opinionated front-end for mixed media capture with preprocessing hooks for text, image, audio, and optional video. Wire its separately typed text, image, audio, and video outputs to compatible downstream nodes; connect an optional MODEL_HANDLE into model. Events emits EVENT streams for interaction telemetry or agent loops.",
  icon: "images",
  inputs: [portTemplate("model", "input", "MODEL_HANDLE", { required: false })],
  outputs: [
    portTemplate("text", "output", "STRING", { required: false }),
    portTemplate("image", "output", "IMAGE", { required: false }),
    portTemplate("audio", "output", "AUDIO", { required: false }),
    portTemplate("video", "output", "VIDEO", { required: false }),
    portTemplate("events", "output", "EVENT"),
  ],
  configurationFields: [
    openSourceStackField(
      ["gradio", "streamlit", "mesop"],
      "gradio",
      "Multi-modal UI stack",
    ),
    {
      key: "acceptImage",
      label: "Accept images",
      type: "boolean",
      required: true,
      defaultValue: true,
      description: "Enable image upload controls.",
    },
    {
      key: "acceptAudio",
      label: "Accept audio",
      type: "boolean",
      required: true,
      defaultValue: true,
      description: "Enable audio upload/record controls.",
    },
    {
      key: "acceptVideo",
      label: "Accept video",
      type: "boolean",
      required: true,
      defaultValue: false,
      description: "Enable video upload controls.",
    },
    ...bigBlockCloudFields(),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("simple_ui_multimodal", "gradio")),
  ],
  documentation:
    "Choose this when the entry surface must accept several modalities before multimodal RAG, classifiers, or agents. Gradio, Streamlit, or Mesop presets stay local-first with optional cloud URIs and bottom-template overrides. Toggle acceptImage, acceptAudio, and acceptVideo to match your pipeline without redesigning the graph. Big Blocks are lineage and export only in the IDE — Run skips them and does not render controls or preprocess uploads.",
});

export const modelRuntimeDefinition = block({
  type: "big_blocks.model_runtime",
  displayName: "Model Runtime",
  description:
    "Model Runtime stands up common local OSS inference (Ollama, vLLM, llama.cpp) with optional provider URI bindings. Feed an optional PROMPT; emit handle as MODEL_HANDLE for gateways and UIs, plus an optional completion STRING when you want a direct text reply on the canvas.",
  icon: "cpu",
  inputs: [
    portTemplate("prompt", "input", "PROMPT", { required: false }),
    portTemplate("endpoint", "input", "STRING", { required: false }),
    portTemplate("credentials", "input", "STRING", { required: false }),
    portTemplate("weights", "input", "MODEL_WEIGHTS", { required: false }),
  ],
  outputs: [
    portTemplate("handle", "output", "MODEL_HANDLE"),
    portTemplate("completion", "output", "STRING", { required: false }),
  ],
  configurationFields: [
    openSourceStackField(
      ["ollama", "vllm", "llama-cpp"],
      "ollama",
      "Local runtime",
      "Ollama, vLLM, or llama.cpp — the three most common local open-source runtimes.",
    ),
    {
      key: "modelId",
      label: "Model id",
      description: "Local tag or provider model name.",
      type: "string",
      required: true,
      defaultValue: "llama3.2:3b",
    },
    {
      key: "providerUriPreset",
      label: "Provider URI preset",
      description: "Optional managed endpoint family when not pure-local.",
      type: "select",
      required: true,
      defaultValue: "none",
      options: [
        "none",
        "openai-compatible",
        "azure-openai",
        "bedrock",
        "vertex",
        "custom",
      ],
    },
    ...bigBlockCloudFields({ defaultUri: "http://127.0.0.1:11434" }),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("model_runtime", "ollama")),
  ],
  documentation:
    "Prefer this as the local inference node behind chat UIs, gateways, or agent harnesses; switch to OpenAI-compatible or hyperscaler URIs with secret-name tokens when needed. Big Blocks are lineage and export only in the IDE — Run skips them and does not start a runtime here.",
});

export const imageClassifierDefinition = block({
  type: "big_blocks.image_classifier",
  displayName: "Image Classifier",
  description:
    "Image Classifier runs an opinionated vision stack (TIMM, ViT, or Ultralytics) over a required IMAGE input on the canvas. Connect image from a loader, UI bundle, or upstream transform; take labels as JSON_SCHEMA for full score maps and topLabel as STRING for routers, agents, or event paths that need a single decision.",
  icon: "scan-eye",
  inputs: [portTemplate("image", "input", "IMAGE")],
  outputs: [
    portTemplate("labels", "output", "JSON_SCHEMA"),
    portTemplate("topLabel", "output", "STRING"),
  ],
  configurationFields: [
    openSourceStackField(
      ["timm", "transformers-vit", "ultralytics-cls"],
      "timm",
      "Classifier stack",
    ),
    {
      key: "modelId",
      label: "Model id",
      type: "string",
      required: true,
      defaultValue: "resnet50",
      description: "Local checkpoint or hub id.",
    },
    ...bigBlockCloudFields(),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("image_classifier", "timm")),
  ],
  documentation:
    "Best for tagging product photos, screenshots, or vision stages before RAG, routing, or agent tools. Prefer local checkpoints and bind a cloud vision URI plus secret name when local models are insufficient. Tune modelId and stack choice in the inspector, then override via the bottom template for custom heads or post-processing. This Big Block does not classify during IDE Run — it contributes to lineage and export only.",
});

export const voiceToTextDefinition = block({
  type: "big_blocks.voice_to_text",
  displayName: "Voice-to-Text",
  description:
    "Voice-to-Text converts a required AUDIO input into text using common OSS ASR stacks such as faster-whisper, whisper.cpp, or Vosk. Wire audio from recorders, file loaders, or multimodal UIs; consume transcript as STRING for RAG, prompts, or agents, and optional segments as JSON_SCHEMA when timed spans matter for chunking or search.",
  icon: "mic",
  inputs: [portTemplate("audio", "input", "AUDIO")],
  outputs: [
    portTemplate("transcript", "output", "STRING"),
    portTemplate("segments", "output", "JSON_SCHEMA", { required: false }),
  ],
  configurationFields: [
    openSourceStackField(
      ["whisper.cpp", "faster-whisper", "vosk"],
      "faster-whisper",
      "ASR stack",
    ),
    {
      key: "language",
      label: "Language",
      type: "string",
      required: true,
      defaultValue: "en",
      description: "BCP-47 language code or 'auto'.",
    },
    ...bigBlockCloudFields(),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("voice_to_text", "faster-whisper")),
  ],
  documentation:
    "Use it for meetings, calls, and voice notes before Audio-to-RAG, chat grounding, or agent tools. Local Whisper variants are the default; bind cloud STT via URI plus secret name when accuracy or language coverage requires it. Set language to a BCP-47 code or auto for detection. Big Blocks are lineage and export only — Run skips them in the IDE.",
});

export const soundClassifierDefinition = block({
  type: "big_blocks.sound_classifier",
  displayName: "Sound Classifier",
  description:
    "Sound Classifier labels non-speech audio events with popular OSS models such as YAMNet, PANNs, or BEATs. Connect AUDIO on input from microphones, files, or multimodal bundles; take labels as JSON_SCHEMA for ranked scores and topLabel as STRING for alerts, routers, or downstream multimodal pipelines.",
  icon: "audio-lines",
  inputs: [portTemplate("audio", "input", "AUDIO")],
  outputs: [
    portTemplate("labels", "output", "JSON_SCHEMA"),
    portTemplate("topLabel", "output", "STRING"),
  ],
  configurationFields: [
    openSourceStackField(
      ["yamnet", "panns", "beats"],
      "yamnet",
      "Sound classifier stack",
    ),
    {
      key: "topK",
      label: "Top-K labels",
      type: "number",
      required: true,
      defaultValue: 5,
      description: "How many class labels to emit.",
    },
    ...bigBlockCloudFields(),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("sound_classifier", "yamnet")),
  ],
  documentation:
    "Best for environmental or event detection rather than speech transcription — alarms, machinery, wildlife, or scene cues. Keep local defaults unless you need a managed audio API; cloud URIs and secret names are optional. Adjust topK when downstream nodes need broader label coverage. It does not classify during IDE Run — Big Blocks contribute to lineage and export only.",
});

export const agenticHarnessDefinition = block({
  type: "big_blocks.agentic_harness",
  displayName: "Agentic Harness",
  description:
    "Agentic Harness assembles an opinionated agent loop (OpenCode, OpenClaw, OpenHands, Goose, Open Interpreter, AURA, Pi, OMP, Aider, OpenHarness, Omnigents, or Archcon) with tools and MCP servers on the canvas. Require a PROMPT goal; optionally attach TOOL_DEFINITION and MCP_SERVER ports (multiple allowed). The run port emits EVENT for lifecycle telemetry, and result provides optional STRING completion signals for downstream consumers.",
  icon: "bot",
  inputs: [
    portTemplate("goal", "input", "PROMPT"),
    portTemplate("tools", "input", "TOOL_DEFINITION", { required: false, multiple: true }),
    portTemplate("mcp", "input", "MCP_SERVER", { required: false, multiple: true }),
    portTemplate("model", "input", "MODEL_HANDLE", { required: false }),
    portTemplate("guardrails", "input", "GUARDRAIL", { required: false, multiple: true }),
    portTemplate("sandbox", "input", "SANDBOX_RUNTIME", { required: false }),
  ],
  outputs: [
    portTemplate("run", "output", "EVENT"),
    portTemplate("result", "output", "STRING", { required: false }),
  ],
  configurationFields: [
    {
      key: "harness",
      label: "Harness",
      description: "Which agentic harness to assemble.",
      type: "select",
      required: true,
      defaultValue: "goose",
      options: ["opencode", "openclaw", "openhands", "goose", "open_interpreter", "aura", "pi", "omp", "aider", "openharness", "omnigents", "archcon"],
    },
    openSourceStackField(
      ["openclaw", "crewai", "autogen"],
      "openclaw",
      "Companion OSS agent framework",
      "Supporting open-source agent framework paired with the harness selection.",
    ),
    {
      key: "harnessRuntime",
      label: "Harness runtime",
      description: "Deployment location for the harness process. Use the optional Sandbox Runtime input to attach an explicit isolation runtime; this setting alone does not provide sandbox isolation.",
      type: "select",
      required: true,
      defaultValue: "local",
      options: [
        "local",
        "docker",
        "kubernetes",
        "aws",
        "azure",
        "gcp",
        "custom",
      ],
    },
    ...bigBlockCloudFields(),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("agentic_harness", "goose")),
  ],
  documentation:
    "Use when you need a full tool-using agent rather than a single model call or atomic Agent node. Connect a Sandbox Runtime when the exported harness should run inside an explicit isolation boundary. The Harness runtime setting selects a deployment location; by itself it does not provide isolation. Keep local-first runtimes and opt into Docker, Kubernetes, or hyperscaler targets via URI plus secret name when required. Pair harness selection with a companion OSS framework and override behavior via the bottom template. Big Blocks are lineage and export only — Run does not launch the harness in the IDE.",
});

export const videoToRagDefinition = block({
  type: "big_blocks.video_to_rag",
  displayName: "Video-to-RAG",
  description:
    "Video-to-RAG ingests VIDEO, extracts frames and transcripts, and indexes them for retrieval-augmented answering. Connect video from loaders or capture nodes; optionally supply a STRING query on the same graph. Take index as DATASET for storage or reuse, and answer as optional STRING when querying in place.",
  icon: "video",
  inputs: [
    portTemplate("video", "input", "VIDEO"),
    portTemplate("query", "input", "STRING", { required: false }),
    portTemplate("vectorStore", "input", "DATABASE_HANDLE", { required: false }),
  ],
  outputs: [
    portTemplate("index", "output", "DATASET"),
    portTemplate("answer", "output", "STRING", { required: false }),
  ],
  configurationFields: [
    openSourceStackField(
      ["whisper-ffmpeg-llamaindex", "videodb", "twelve-open"],
      "whisper-ffmpeg-llamaindex",
      "Video-to-RAG stack",
    ),
    {
      key: "frameIntervalSeconds",
      label: "Frame interval (s)",
      type: "number",
      required: true,
      defaultValue: 5,
      description: "Seconds between sampled frames for visual indexing.",
    },
    ...bigBlockCloudFields(),
    ...bigBlockTemplateFields(
      defaultBigBlockTemplate("video_to_rag", "whisper-ffmpeg-llamaindex"),
    ),
  ],
  documentation:
    "Best for lectures, demos, and recorded sessions that need searchable visual and spoken context together. Local ffmpeg plus ASR presets are the default; bind cloud media APIs via URI and secret name for large libraries or managed transcription. Tune frameIntervalSeconds to balance index size and visual fidelity. Big Blocks are lineage and export only — Run skips them in the IDE.",
});

export const audioToRagDefinition = block({
  type: "big_blocks.audio_to_rag",
  displayName: "Audio-to-RAG",
  description:
    "Audio-to-RAG transcribes and chunks AUDIO into a retrievable corpus for grounded Q&A on the canvas. Wire audio from files, ASR outputs, or multimodal sources; optionally connect a STRING query. Emit index as DATASET for reuse in other RAG nodes and answer as optional STRING when asking within the same graph.",
  icon: "headphones",
  inputs: [
    portTemplate("audio", "input", "AUDIO"),
    portTemplate("transcript", "input", "STRING", { required: false, multiple: true }),
    portTemplate("query", "input", "STRING", { required: false }),
    portTemplate("vectorStore", "input", "DATABASE_HANDLE", { required: false }),
  ],
  outputs: [
    portTemplate("index", "output", "DATASET"),
    portTemplate("answer", "output", "STRING", { required: false }),
  ],
  configurationFields: [
    openSourceStackField(
      ["whisper-haystack", "speechbrain-rag", "nemo-asr-rag"],
      "whisper-haystack",
      "Audio-to-RAG stack",
    ),
    {
      key: "chunkSeconds",
      label: "Chunk length (s)",
      type: "number",
      required: true,
      defaultValue: 30,
      description: "Transcript chunk size before embedding.",
    },
    ...bigBlockCloudFields(),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("audio_to_rag", "whisper-haystack")),
  ],
  documentation:
    "Prefer this for podcasts, calls, and meetings that need searchable transcripts rather than one-shot ASR alone. Local ASR plus chunk-and-embed presets are the default; cloud URIs are optional for managed speech or vector services. Adjust chunkSeconds to match speaking pace and retrieval granularity. Big Blocks are lineage and export only — Run skips them in the IDE.",
});

export const multimodalRagDefinition = block({
  type: "big_blocks.multimodal_rag",
  displayName: "Multimodal-RAG",
  description:
    "Multimodal-RAG unifies retrieval over text, image, audio, and video on a shared index plane. Require a STRING query and attach optional text, IMAGE, AUDIO, or VIDEO inputs as your corpus channels. The answer STRING is the fused grounded response to wire into chat UIs, agents, or evaluators.",
  icon: "layers",
  inputs: [
    portTemplate("query", "input", "STRING"),
    portTemplate("text", "input", "STRING", { required: false }),
    portTemplate("vectorStore", "input", "DATABASE_HANDLE", { required: false }),
    portTemplate("image", "input", "IMAGE", { required: false }),
    portTemplate("audio", "input", "AUDIO", { required: false }),
    portTemplate("video", "input", "VIDEO", { required: false }),
  ],
  outputs: [portTemplate("answer", "output", "STRING")],
  configurationFields: [
    openSourceStackField(
      ["colpali-rag", "llava-rag", "unstructured-mm"],
      "colpali-rag",
      "Multimodal RAG stack",
    ),
    {
      key: "fusion",
      label: "Fusion strategy",
      type: "select",
      required: true,
      defaultValue: "late",
      options: ["early", "late", "hybrid"],
      description: "How modalities are fused before answering.",
    },
    ...bigBlockCloudFields(),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("multimodal_rag", "colpali-rag")),
  ],
  documentation:
    "Use when the corpus mixes modalities and single-channel RAG or separate indexes are not enough. Keep local fusion presets and bind cloud VLMs or embedding APIs via URI plus secret name when needed. Choose early, late, or hybrid fusion to match how modalities should combine before answering. Big Blocks are lineage and export only — Run does not execute multimodal retrieval in the IDE.",
});

export const videoChunkingIcLoraDefinition = block({
  type: "big_blocks.video_chunking_ic_lora",
  displayName: "Video-Chunking for IC LoRA",
  description:
    "Video-Chunking for IC LoRA cuts VIDEO into instruction-compatible clips and frames for image or video LoRA fine-tuning datasets. Connect video from loaders or capture pipelines; take dataset as DATASET into a trainer or storage node, and optional manifest as JSON_SCHEMA for per-clip metadata and captions.",
  icon: "clapperboard",
  inputs: [portTemplate("video", "input", "VIDEO")],
  outputs: [
    portTemplate("dataset", "output", "DATASET"),
    portTemplate("manifest", "output", "JSON_SCHEMA", { required: false }),
  ],
  configurationFields: [
    openSourceStackField(
      ["ffmpeg-clips", "decord-sampler", "torchvision-io"],
      "ffmpeg-clips",
      "Chunking stack",
    ),
    {
      key: "clipSeconds",
      label: "Clip length (s)",
      type: "number",
      required: true,
      defaultValue: 4,
      description: "Duration of each training clip.",
    },
    {
      key: "strideSeconds",
      label: "Stride (s)",
      type: "number",
      required: true,
      defaultValue: 2,
      description: "Overlap stride between clips.",
    },
    {
      key: "instructionTemplate",
      label: "IC instruction template",
      type: "text",
      required: true,
      defaultValue: "Describe the visual content of this clip for LoRA training.",
      description: "Instruction-compatible caption/prompt template per chunk.",
    },
    ...bigBlockCloudFields(),
    ...bigBlockTemplateFields(
      defaultBigBlockTemplate("video_chunking_ic_lora", "ffmpeg-clips"),
    ),
  ],
  documentation:
    "Best when preparing IC-style training data from long videos before a LoRA trainer or dataset export. Tune clip length, stride, and instruction templates in the inspector, then override ffmpeg sampling via the bottom template when needed. Pair with Local S3 Bucket or Postgres when datasets need durable storage references. It does not train models or run ffmpeg in the IDE — Big Blocks are lineage and export only, and Run skips them.",
});

export const webToMarkdownDefinition = block({
  type: "big_blocks.web_to_markdown",
  displayName: "Web-to-Markdown",
  description:
    "Web-to-Markdown fetches pages or accepts HTML and converts them into clean Markdown for RAG, agents, and docs pipelines. Require a STRING url or optionally pass html when content is already in memory. Take markdown as STRING for downstream chunking and optional metadata as JSON_SCHEMA for title, URL, and fetch details.",
  icon: "file-text",
  inputs: [
    portTemplate("url", "input", "STRING"),
    portTemplate("html", "input", "STRING", { required: false }),
  ],
  outputs: [
    portTemplate("markdown", "output", "STRING"),
    portTemplate("metadata", "output", "JSON_SCHEMA", { required: false }),
  ],
  configurationFields: [
    openSourceStackField(
      ["markitdown", "crawl4ai", "trafilatura"],
      "markitdown",
      "Web-to-Markdown stack",
      "Microsoft MarkItDown, Crawl4AI, or Trafilatura — three common open-source converters.",
    ),
    {
      key: "includeImages",
      label: "Include images",
      description: "Keep image references (and optional downloads) in the Markdown output.",
      type: "boolean",
      required: true,
      defaultValue: true,
    },
    {
      key: "includeFrontmatter",
      label: "YAML frontmatter",
      description: "Prefix output with title/url/fetchedAt metadata as YAML frontmatter.",
      type: "boolean",
      required: true,
      defaultValue: true,
    },
    {
      key: "maxPages",
      label: "Max pages",
      description: "Upper bound when the stack crawls linked pages from a seed URL (1 = single page).",
      type: "number",
      required: true,
      defaultValue: 1,
    },
    ...bigBlockCloudFields({ defaultUri: "http://127.0.0.1:8080" }),
    ...bigBlockTemplateFields(defaultBigBlockTemplate("web_to_markdown", "markitdown")),
  ],
  documentation:
    "Use it to normalize docs sites and articles before AutoRAG, GraphRAG, or agent tools. Prefer local MarkItDown, Crawl4AI, or Trafilatura and bind managed crawl APIs via URI plus secret name when rate limits or auth require it. Raise maxPages cautiously when crawling linked content from a seed URL. Big Blocks are lineage and export only — Run does not fetch or convert pages in the IDE.",
});

export const postgresPgvectorDefinition = block({
  type: "big_blocks.postgres_pgvector",
  displayName: "PostgreSQL + pgvector",
  description:
    "PostgreSQL + pgvector is an opinionated relational-plus-vector store for embeddings and structured data in one database. Optionally feed STRING documents (multiple allowed) for ingest lineage and a query for similarity search. Take connection as a typed DATABASE_HANDLE for downstream retrieval nodes and optional results STRING when search answers are modeled on the canvas.",
  icon: "cylinder",
  inputs: [
    portTemplate("documents", "input", "STRING", { required: false, multiple: true }),
    portTemplate("corpus", "input", "DATASET", { required: false }),
    portTemplate("query", "input", "STRING", { required: false }),
  ],
  outputs: [
    portTemplate("connection", "output", "DATABASE_HANDLE"),
    portTemplate("results", "output", "STRING", { required: false }),
  ],
  configurationFields: [
    openSourceStackField(
      ["postgresql-pgvector", "supabase", "neon"],
      "postgresql-pgvector",
      "Postgres + pgvector stack",
      "Self-managed PostgreSQL+pgvector, Supabase, or Neon — three common open-source-friendly options.",
    ),
    {
      key: "databaseName",
      label: "Database name",
      description: "Logical database / project name for the Postgres instance.",
      type: "string",
      required: true,
      defaultValue: "athanor",
    },
    {
      key: "embeddingDimensions",
      label: "Embedding dimensions",
      description: "Vector column size (must match your embedding model).",
      type: "number",
      required: true,
      defaultValue: 1536,
    },
    {
      key: "indexType",
      label: "Vector index",
      description: "Approximate nearest-neighbor index for similarity search.",
      type: "select",
      required: true,
      defaultValue: "hnsw",
      options: ["hnsw", "ivfflat", "none"],
    },
    ...bigBlockCloudFields({ defaultUri: "postgresql://127.0.0.1:5432/athanor" }),
    ...bigBlockTemplateFields(
      defaultBigBlockTemplate("postgres_pgvector", "postgresql-pgvector"),
    ),
  ],
  documentation:
    "Choose this when RAG or agents need both SQL and vector search without a separate vector DB. Prefer local Postgres and bind Supabase, Neon, or managed instances via URI plus token secret name. Match embeddingDimensions to your embedding model and pick hnsw or ivfflat for expected corpus size. Big Blocks are lineage and export only — Run does not open connections or query data in the IDE.",
});

export const guardrailBuilderDefinition = block({
  type: "big_blocks.guardrail_builder",
  displayName: "Guardrail Builder",
  description:
    "Guardrail Builder drafts an initial agentic or model guardrail from company policy documents and security best practices. Point it at a hosted policy corpus (URI or connected STRING documents), chunk and embed those docs into a small local vector store sized for a few hundred documents, then call a local or remote generation model via API. Outputs a typed GUARDRAIL policy for agent and policy nodes, a STRING reasoning document, optional JSON_SCHEMA references, and an optional DATASET index.",
  icon: "badge-check",
  inputs: [
    portTemplate("policySource", "input", "STRING", { required: false }),
    portTemplate("documents", "input", "STRING", { required: false, multiple: true }),
    portTemplate("model", "input", "MODEL_HANDLE", { required: false }),
    portTemplate("credentials", "input", "STRING", { required: false }),
  ],
  outputs: [
    portTemplate("guardrailPolicy", "output", "GUARDRAIL"),
    portTemplate("reasoningDocument", "output", "STRING"),
    portTemplate("references", "output", "JSON_SCHEMA", { required: false }),
    portTemplate("index", "output", "DATASET", { required: false }),
  ],
  configurationFields: [
    openSourceStackField(
      ["guardrails-ai", "nemo-guardrails", "llama-guard"],
      "guardrails-ai",
      "Guardrail stack",
      "Opinionated open-source guardrail frameworks for agentic or model policy generation.",
    ),
    {
      key: "systemPromptPosture",
      label: "System prompt posture",
      description:
        "restrictive — only allow what is specifically permitted; standard — baseline guardrails adapted to what the org explicitly allows and forbids; permissive — enforce only when clearly stated as not allowed; custom — use the custom system prompt field.",
      type: "select",
      required: true,
      defaultValue: "standard",
      options: ["restrictive", "standard", "permissive", "custom"],
      recommendedDefaultExplanation:
        "Start with standard for most enterprise policies; switch to restrictive for high-risk domains.",
    },
    {
      key: "customSystemPrompt",
      label: "Custom system prompt",
      description:
        "Full generation instructions used when System prompt posture is custom. Leave empty for the built-in restrictive/standard/permissive presets.",
      type: "text",
      required: false,
      defaultValue: "",
      showWhen: { key: "systemPromptPosture", equals: "custom" },
    },
    {
      key: "policySourceUri",
      label: "Policy documents URI",
      description:
        "Where company security policy and documentation are hosted (HTTPS docs site, object prefix, or local path). Prefer connecting policySource/documents ports when the corpus is already on the canvas.",
      type: "string",
      required: true,
      defaultValue: "",
      recommendedDefaultExplanation:
        "Point at the canonical policy library the security team maintains.",
    },
    {
      key: "embeddingModel",
      label: "Embedding model",
      description:
        "Model used to chunk and embed policy documents into the local vector store before generation.",
      type: "string",
      required: true,
      defaultValue: "sentence-transformers/all-MiniLM-L6-v2",
    },
    {
      key: "vectorStore",
      label: "Local vector store",
      description:
        "Small local vector database for a few hundred policy documents (not a full enterprise vector platform).",
      type: "select",
      required: true,
      defaultValue: "chromadb",
      options: ["chromadb", "lancedb", "faiss"],
    },
    {
      key: "maxDocuments",
      label: "Max documents",
      description: "Upper bound on ingested policy documents (designed for a few hundred).",
      type: "number",
      required: true,
      defaultValue: 300,
    },
    {
      key: "chunkSize",
      label: "Chunk size (tokens)",
      description: "Approximate token size for policy document chunks before embedding.",
      type: "number",
      required: true,
      defaultValue: 512,
    },
    {
      key: "chunkOverlap",
      label: "Chunk overlap (tokens)",
      description: "Overlap between consecutive chunks to preserve policy section context.",
      type: "number",
      required: true,
      defaultValue: 64,
    },
    {
      key: "generationModelId",
      label: "Generation model id",
      description:
        "Local or remote chat/completion model used to draft the guardrail and reasoning document. Override via MODEL_HANDLE input or endpoint URI when calling a larger API model.",
      type: "string",
      required: true,
      defaultValue: "llama3.2",
    },
    {
      key: "includeCitations",
      label: "Include citations",
      description:
        "When true, the reasoning document and references output cite retrieved policy chunks.",
      type: "boolean",
      required: true,
      defaultValue: true,
    },
    ...bigBlockCloudFields({ defaultUri: "http://127.0.0.1:11434" }),
    ...bigBlockTemplateFields(
      defaultBigBlockTemplate("guardrail_builder", "guardrails-ai"),
    ),
  ],
  documentation:
    "Best used early when security or platform teams need a first-pass agentic or model guardrail grounded in their own policy corpus rather than a generic template. Restrictive posture suits regulated or high-risk agents; standard adapts common guardrail patterns to explicit allow/deny language in the org docs; permissive only blocks behaviors the policies clearly forbid; custom lets authors paste a full system prompt into the node. Keep the local vector store small (hundreds of docs), bind larger generation models through local or remote API endpoints with token secret names, and wire guardrailPolicy into Policy Guardrail or Agentic Harness. Big Blocks are lineage and export only — Run does not fetch policies, embed chunks, or call models in the IDE.",
});

export const BIG_BLOCKS_NODE_DEFINITIONS: readonly NodeDefinition[] = [
  aiGatewayDefinition,
  graphRagDefinition,
  autoRagDefinition,
  localS3BucketDefinition,
  simpleUiChatbotDefinition,
  simpleUiMultimodalDefinition,
  modelRuntimeDefinition,
  imageClassifierDefinition,
  voiceToTextDefinition,
  soundClassifierDefinition,
  agenticHarnessDefinition,
  videoToRagDefinition,
  audioToRagDefinition,
  multimodalRagDefinition,
  videoChunkingIcLoraDefinition,
  webToMarkdownDefinition,
  postgresPgvectorDefinition,
  guardrailBuilderDefinition,
] as const;
