import { describe, expect, it } from "vitest";
import { areContractsCompatible } from "@athanor/contracts";

import {
  createNodeFromDefinition,
  getNodeDefinition,
  listNodeDefinitions,
  listNodeDefinitionsByCategory,
  requiredConfigKeys,
} from "./index.js";

describe("node definitions catalog", () => {
  it("includes foundation through big-blocks categories", () => {
    const types = listNodeDefinitions().map((definition) => definition.type);
    expect(types).toContain("foundation.text_input");
    expect(types).toContain("enterprise.identity_reference");
    expect(types).toContain("big_blocks.ai_gateway");
    expect(types).toContain("big_blocks.agentic_harness");
    expect(types).toContain("big_blocks.video_chunking_ic_lora");
    expect(types).toContain("harness.openclaw_enterprise");
    expect(types).toContain("harness.opencode");
    expect(types).toContain("harness.openclaw");
    expect(types).toContain("harness.openhands");
    expect(types).toContain("harness.goose");
    expect(types).toContain("harness.open_interpreter");
    expect(types).toContain("harness.aura");
    expect(types).toContain("harness.pi");
    expect(types).toContain("harness.omp");
    expect(types).toContain("harness.aider");
    expect(types).toContain("sandbox.openshell");
    expect(types).toContain("sandbox.policy");
    expect(types).toContain("agent.guardrails");
    expect(types).toContain("big_blocks.web_to_markdown");
    expect(types).toContain("big_blocks.postgres_pgvector");
    expect(types).toContain("big_blocks.guardrail_builder");
    expect(types).toContain("enterprise.primary_vector_dbs");
    expect(types).toHaveLength(73);
  });

  it("creates a text input node with STRING output", () => {
    const node = createNodeFromDefinition("foundation.text_input", { x: 10, y: 20 });
    expect(node.type).toBe("foundation.text_input");
    expect(node.position).toEqual({ x: 10, y: 20 });
    expect(node.outputs[0]?.contractType).toBe("STRING");
    expect(node.configuration).toHaveProperty("value");
  });

  it("looks up definitions by type and exposes export metadata", () => {
    expect(getNodeDefinition("foundation.python_transform")?.displayName).toBe(
      "Python Transformation",
    );
    expect(getNodeDefinition("foundation.secret_reference")?.exportKind).toBe(
      "secret_reference",
    );
    expect(requiredConfigKeys(getNodeDefinition("fine_tuning.lora_trainer")!)).toContain(
      "baseModel",
    );
    expect(getNodeDefinition("vision.vision_model")?.exportKind).toBe("vision");
    expect(getNodeDefinition("multi_agent.agent")?.exportKind).toBe("multi_agent");
    expect(getNodeDefinition("enterprise.policy_guardrail")?.exportKind).toBe("enterprise");
    expect(getNodeDefinition("big_blocks.ai_gateway")?.exportKind).toBe("big_blocks");
    expect(requiredConfigKeys(getNodeDefinition("big_blocks.agentic_harness")!)).toContain(
      "harness",
    );
  });

  it("groups fine-tuning nodes by category", () => {
    const fineTuning = listNodeDefinitionsByCategory("fine-tuning");
    expect(fineTuning.map((item) => item.type)).toEqual([
      "fine_tuning.dataset_loader",
      "fine_tuning.lora_trainer",
    ]);
  });

  it("groups vision, multi-agent, and enterprise categories", () => {
    expect(listNodeDefinitionsByCategory("vision").map((item) => item.type)).toEqual([
      "vision.image_input",
      "vision.image_preprocessor",
      "vision.vision_model",
    ]);
    expect(listNodeDefinitionsByCategory("multi-agent").map((item) => item.type)).toEqual([
      "multi_agent.agent",
      "multi_agent.tool_definition",
      "multi_agent.mcp_server",
    ]);
    expect(listNodeDefinitionsByCategory("enterprise").map((item) => item.type)).toEqual([
      "enterprise.policy_guardrail",
      "enterprise.audit_log",
      "enterprise.identity_reference",
      "enterprise.primary_vector_dbs",
    ]);
  });

  it("creates JSON input and LoRA trainer with typed ports", () => {
    const jsonNode = createNodeFromDefinition("foundation.json_input", { x: 0, y: 0 });
    expect(jsonNode.outputs[0]?.contractType).toBe("STRING");
    const lora = createNodeFromDefinition("fine_tuning.lora_trainer", { x: 0, y: 0 });
    expect(lora.inputs[0]?.contractType).toBe("DATASET");
    expect(lora.outputs[0]?.contractType).toBe("MODEL_WEIGHTS");
    expect(lora.configuration.rank).toBe(8);
  });

  it("groups big-blocks with shared cloud + template fields", () => {
    const blocks = listNodeDefinitionsByCategory("big-blocks");
    expect(blocks).toHaveLength(18);
    const gateway = createNodeFromDefinition("big_blocks.ai_gateway", { x: 0, y: 0 });
    expect(gateway.configuration.openSourceStack).toBe("litellm");
    expect(gateway.configuration).toHaveProperty("customTemplate");
    expect(gateway.configuration.useCustomTemplate).toBe(false);
    const harness = createNodeFromDefinition("big_blocks.agentic_harness", { x: 0, y: 0 });
    expect(harness.configuration.harness).toBe("goose");
    expect(getNodeDefinition("big_blocks.agentic_harness")?.configurationFields.find((field) => field.key === "harness")?.options).toEqual(
      expect.arrayContaining(["opencode", "openclaw", "openhands", "goose", "open_interpreter", "aura", "pi", "omp", "aider"]),
    );
    const webMd = createNodeFromDefinition("big_blocks.web_to_markdown", { x: 0, y: 0 });
    expect(webMd.configuration.openSourceStack).toBe("markitdown");
    expect(webMd.outputs[0]?.contractType).toBe("STRING");
    const pg = createNodeFromDefinition("big_blocks.postgres_pgvector", { x: 0, y: 0 });
    expect(pg.configuration.openSourceStack).toBe("postgresql-pgvector");
    const guardrail = createNodeFromDefinition("big_blocks.guardrail_builder", {
      x: 0,
      y: 0,
    });
    expect(guardrail.configuration.systemPromptPosture).toBe("standard");
    expect(guardrail.configuration.vectorStore).toBe("chromadb");
    expect(guardrail.outputs[0]?.contractType).toBe("GUARDRAIL");
    expect(guardrail.outputs[1]?.name).toBe("reasoningDocument");
    const dualDb = createNodeFromDefinition("enterprise.primary_vector_dbs", { x: 0, y: 0 });
    expect(dualDb.configuration.primaryDb).toBe("postgresql");
    expect(dualDb.configuration.vectorDb).toBe("qdrant");
  });

  it("attaches recommended adjacent feeds for every catalog node", () => {
    for (const definition of listNodeDefinitions()) {
      expect(definition.recommendedAdjacent).toBeDefined();
      const adjacent = definition.recommendedAdjacent!;
      for (const type of adjacent.feedsIn) {
        const source = getNodeDefinition(type);
        expect(source?.displayName).toBeTruthy();
        expect(source?.outputs.some(output => definition.inputs.some(input => areContractsCompatible(output.contractType, input.contractType)))).toBe(true);
      }
      for (const type of adjacent.feedsOut) {
        const target = getNodeDefinition(type);
        expect(target?.displayName).toBeTruthy();
        expect(definition.outputs.some(output => target?.inputs.some(input => areContractsCompatible(output.contractType, input.contractType)))).toBe(true);
      }
    }
    const text = getNodeDefinition("foundation.text_input");
    expect(text?.recommendedAdjacent?.feedsOut).toContain("foundation.prompt_template");
    expect(text?.recommendedAdjacent?.feedsIn).toEqual([]);
  });

  it("defines unique port identifiers with explicit directions and contract types", () => {
    for (const definition of listNodeDefinitions()) {
      const node = createNodeFromDefinition(definition.type, { x: 0, y: 0 });
      const inputIds = node.inputs.map(port => port.id);
      const outputIds = node.outputs.map(port => port.id);
      expect(new Set(inputIds).size, `${definition.type} input ids`).toBe(inputIds.length);
      expect(new Set(outputIds).size, `${definition.type} output ids`).toBe(outputIds.length);
      expect(node.inputs.every(port => port.direction === "input" && port.contractType)).toBe(true);
      expect(node.outputs.every(port => port.direction === "output" && port.contractType)).toBe(true);
    }
  });

  it("supports the intended agent, UI, model, guardrail, RAG, and training paths", () => {
    const port = (type: string, direction: "inputs" | "outputs", name: string) =>
      getNodeDefinition(type)?.[direction].find(candidate => candidate.name === name);
    const canConnect = (sourceType: string, sourcePort: string, targetType: string, targetPort: string) => {
      const source = port(sourceType, "outputs", sourcePort);
      const target = port(targetType, "inputs", targetPort);
      return source !== undefined && target !== undefined && areContractsCompatible(source.contractType, target.contractType);
    };

    expect(canConnect("big_blocks.simple_ui_chatbot", "prompt", "big_blocks.agentic_harness", "goal")).toBe(true);
    expect(canConnect("big_blocks.model_runtime", "handle", "big_blocks.agentic_harness", "model")).toBe(true);
    expect(canConnect("big_blocks.model_runtime", "handle", "big_blocks.simple_ui_chatbot", "model")).toBe(true);
    expect(canConnect("multi_agent.tool_definition", "tool", "big_blocks.agentic_harness", "tools")).toBe(true);
    expect(canConnect("multi_agent.mcp_server", "server", "big_blocks.agentic_harness", "mcp")).toBe(true);
    expect(canConnect("big_blocks.guardrail_builder", "guardrailPolicy", "big_blocks.agentic_harness", "guardrails")).toBe(true);
    expect(canConnect("big_blocks.guardrail_builder", "guardrailPolicy", "enterprise.policy_guardrail", "guardrail")).toBe(true);
    expect(canConnect("big_blocks.web_to_markdown", "markdown", "big_blocks.autorag", "documents")).toBe(true);
    expect(canConnect("big_blocks.postgres_pgvector", "connection", "big_blocks.autorag", "vectorStore")).toBe(true);
    expect(canConnect("enterprise.primary_vector_dbs", "vector", "big_blocks.graphrag", "vectorStore")).toBe(true);
    expect(canConnect("foundation.text_input", "text", "big_blocks.autorag", "vectorStore")).toBe(false);
    expect(canConnect("big_blocks.video_chunking_ic_lora", "dataset", "fine_tuning.lora_trainer", "dataset")).toBe(true);
    expect(canConnect("big_blocks.simple_ui_multimodal", "image", "big_blocks.image_classifier", "image")).toBe(true);
    expect(canConnect("big_blocks.simple_ui_multimodal", "audio", "big_blocks.voice_to_text", "audio")).toBe(true);
    expect(canConnect("big_blocks.simple_ui_multimodal", "video", "big_blocks.video_to_rag", "video")).toBe(true);
    expect(canConnect("big_blocks.simple_ui_multimodal", "image", "big_blocks.voice_to_text", "audio")).toBe(false);
  });
});
