import { describe, expect, it } from "vitest";
import { createEmptyGraph, type ArchitectureNode, type NodePort } from "@athanor/contracts";

import { architectureModel, workflowModel } from "./model";
import { TOPOLOGY_LAYERS } from "./layers";

function port(id: string, direction: "input" | "output"): NodePort {
  return {
    id,
    name: id,
    direction,
    contractType: "STRING",
    required: true,
    multiple: false,
  };
}

function node(partial: Partial<ArchitectureNode> & Pick<ArchitectureNode, "id" | "type">): ArchitectureNode {
  return {
    version: "1.0.0",
    name: partial.id,
    position: { x: 0, y: 0 },
    configuration: {},
    inputs: [],
    outputs: [],
    ...partial,
  };
}

describe("architectureModel", () => {
  it("keeps author positions and stacks swimlanes under task groups without a layout", () => {
    const graph = createEmptyGraph("Map");
    graph.deploymentEnvironments = [
      {
        id: "lane-1",
        name: "Lab",
        kind: "LOCAL_WORKSTATION",
        bounds: { x: 8, y: 16, width: 400, height: 500 },
      },
    ];
    graph.workflow.tasks = [
      {
        id: "task-1",
        name: "Review",
        color: "#2563eb",
        role: "",
        expectedTasks: "",
        constraints: "",
        bounds: { x: 260, y: 100, width: 320, height: 300 },
        engineeringBounds: { x: 40, y: 80, width: 900, height: 800 },
      },
    ];
    graph.nodes = [
      node({
        id: "a",
        type: "foundation.text_input",
        position: { x: 120, y: 240 },
        outputs: [port("out-text", "output")],
      }),
    ];

    const model = architectureModel({
      graph,
      lod: "mid",
      selectedEdgeIds: [],
      focusEdgeId: null,
      issues: [],
      securityView: false,
      steps: [],
      edgePayloads: [],
    });

    expect(model.graph?.layout).toBeUndefined();
    expect(model.graph?.layers).toEqual([...TOPOLOGY_LAYERS]);
    const swimlane = model.nodes?.find((item) => item.id === "swimlane:lane-1");
    const group = model.nodes?.find((item) => item.id === "workflow-task:task-1");
    const card = model.nodes?.find((item) => item.id === "a");
    expect(swimlane).toMatchObject({ type: "swimlane", x: 8, y: 16, width: 400, height: 500 });
    expect(group).toMatchObject({ type: "task-group", x: 40, y: 80, width: 900, height: 800 });
    expect(card).toMatchObject({ type: "architecture", x: 120, y: 240 });
    expect(model.nodes?.findIndex((item) => item.type === "swimlane")).toBeLessThan(
      model.nodes?.findIndex((item) => item.type === "task-group") ?? 0,
    );
    expect(model.nodes?.findIndex((item) => item.type === "task-group")).toBeLessThan(
      model.nodes?.findIndex((item) => item.type === "architecture") ?? 0,
    );
  });

  it("rewires edges through a collapsed macro and drops edges that stay inside it", () => {
    const graph = createEmptyGraph("Macro");
    graph.nodes = [
      node({
        id: "a",
        type: "foundation.text_input",
        position: { x: 0, y: 0 },
        outputs: [port("out-text", "output")],
      }),
      node({
        id: "b",
        type: "foundation.output_viewer",
        position: { x: 400, y: 0 },
        inputs: [port("in-text", "input")],
      }),
      node({
        id: "c",
        type: "foundation.text_input",
        position: { x: 20, y: 20 },
        outputs: [port("out-inner", "output")],
      }),
    ];
    graph.edges = [
      {
        id: "e1",
        sourceNodeId: "a",
        sourcePortId: "out-text",
        targetNodeId: "b",
        targetPortId: "in-text",
      },
      {
        id: "inner",
        sourceNodeId: "a",
        sourcePortId: "out-text",
        targetNodeId: "c",
        targetPortId: "in-text",
      },
    ];
    graph.macroBlocks = [
      {
        id: "m1",
        name: "Group",
        collapsed: true,
        nodeIds: ["a", "c"],
        inputs: [],
        outputs: [port("macro-out-e1", "output")],
        metadata: {
          position: { x: 10, y: 20 },
          portBindings: { "macro-out-e1": { nodeId: "a", portId: "out-text" } },
        },
      },
    ];

    const model = architectureModel({
      graph,
      lod: "mid",
      selectedEdgeIds: [],
      focusEdgeId: null,
      issues: [],
      securityView: false,
      steps: [],
      edgePayloads: [],
    });

    expect(model.nodes?.some((item) => item.id === "a" || item.id === "c")).toBe(false);
    expect(model.nodes?.find((item) => item.id === "macro:m1")).toMatchObject({ x: 10, y: 20 });
    expect(model.edges?.map((edge) => edge.id)).toEqual(["e1"]);
    expect(model.edges?.[0]).toMatchObject({
      source: "macro:m1",
      target: "b",
      data: { sourcePortId: "macro-out-e1", targetPortId: "in-text" },
    });
  });

  it("draws portal-bus edges until micro zoom and dashes cross-environment wires", () => {
    const graph = createEmptyGraph("Buses");
    graph.nodes = [
      node({
        id: "out",
        type: "foundation.portal_output",
        position: { x: 0, y: 0 },
        deploymentTarget: "left",
        configuration: { busId: "alpha" },
        outputs: [port("bus-out", "output")],
      }),
      node({
        id: "inp",
        type: "foundation.portal_input",
        position: { x: 300, y: 0 },
        deploymentTarget: "right",
        configuration: { busId: "alpha" },
        inputs: [port("bus-in", "input")],
      }),
    ];
    graph.edges = [
      {
        id: "cross",
        sourceNodeId: "out",
        sourcePortId: "bus-out",
        targetNodeId: "inp",
        targetPortId: "bus-in",
      },
    ];
    const base = {
      graph,
      selectedEdgeIds: [] as string[],
      focusEdgeId: null,
      issues: [],
      securityView: false,
      steps: [],
      edgePayloads: [],
    };
    const mid = architectureModel({ ...base, lod: "mid" });
    const portal = mid.edges?.find((edge) => edge.id === "portal-bus-alpha-out-inp");
    expect(portal).toMatchObject({
      type: "portal",
      source: "out",
      target: "inp",
      data: { selectable: false, dash: "portal", stroke: "#a16207" },
    });
    expect(mid.edges?.find((edge) => edge.id === "cross")?.data).toMatchObject({
      dash: "cross",
      crossEnv: true,
      stroke: "#c2410c",
    });
    const micro = architectureModel({ ...base, lod: "micro" });
    expect(micro.edges?.some((edge) => String(edge.id).startsWith("portal-bus-"))).toBe(false);
  });
});

describe("workflowModel", () => {
  it("links start, recovery transitions, and completion edges", () => {
    const graph = createEmptyGraph("Flow");
    graph.workflow.tasks = [
      {
        id: "t1",
        name: "Draft",
        color: "#2563eb",
        role: "writer",
        expectedTasks: "draft",
        constraints: "",
        bounds: { x: 200, y: 80, width: 320, height: 300 },
        engineeringBounds: { x: 0, y: 0, width: 900, height: 800 },
      },
    ];
    graph.workflow.transitions = [
      {
        id: "n1",
        sourceTaskId: null,
        targetTaskId: "t1",
        kind: "normal",
        stage: 1,
        recoveryDescription: "",
      },
      {
        id: "r1",
        sourceTaskId: "t1",
        targetTaskId: "t1",
        kind: "recovery",
        stage: 2,
        recoveryDescription: "retry",
      },
    ];
    const model = workflowModel(graph.workflow, ["workflow-transition:r1"]);
    expect(model.graph?.layout).toBeUndefined();
    expect(model.nodes?.find((item) => item.id === "workflow-task:t1")).toMatchObject({
      x: 200,
      y: 80,
      width: 320,
      height: 300,
    });
    expect(model.edges?.find((edge) => edge.id === "workflow-transition:n1")).toMatchObject({
      source: "workflow-start",
      target: "workflow-task:t1",
    });
    expect(model.edges?.find((edge) => edge.id === "workflow-transition:r1")?.data).toMatchObject({
      dash: "recovery",
      stroke: "#b45309",
      strokeWidth: 3,
    });
    expect(model.edges?.find((edge) => edge.id === "workflow-end:t1")).toMatchObject({
      source: "workflow-task:t1",
      target: "workflow-end",
      data: { kind: "complete", selectable: false, label: "Complete" },
    });
  });
});
