/**
 * Pure graph-to-PatternFly Model mapping. Positions stay author-placed:
 * the graph model never sets a layout.
 */
import {
  CONTRACT_TYPE_LABELS,
  type ArchitectureEdge,
  type ArchitectureGraph,
  type ArchitectureNode,
  type NodePort,
} from "@athanor/contracts";
import type { EdgeModel, Model, NodeModel } from "@patternfly/react-topology";

import type { EdgePayload, ExecutionStep } from "@/lib/execute";
import type { LodLevel } from "@/lib/lod";
import {
  macroFlowId,
  macroPortBindings,
  macroPosition,
} from "@/lib/macros";
import { groupPortalsByBus, isPortalNode, portalBusId } from "@/lib/portals";
import { isCrossEnvironmentEdge, swimlaneBounds, swimlaneFlowId } from "@/lib/swimlanes";
import {
  securityCategories,
  taskFlowId,
  transitionFlowId,
  workflowEndTasks,
} from "@/lib/workflow";

import { architectureCardSize, macroCardSize } from "./geometry";
import { TOPOLOGY_LAYERS } from "./layers";

export type NodeHealth = "ok" | "warning" | "error" | "unknown";

type ValidationIssue = {
  nodeId?: string | null;
  severity: "info" | "warning" | "error";
  code: string;
};

export type ArchitectureNodeData = {
  kind: "architecture";
  name: string;
  nodeType: string;
  inputs: NodePort[];
  outputs: NodePort[];
  health: NodeHealth;
  securityTags: string[];
  deploymentLabel?: string;
  busId: string | null;
  payloadPreview: string | null;
  executionStatus: ExecutionStep["status"] | null;
  configuration: Record<string, unknown>;
  workflowTaskId?: string;
};

export type SwimlaneNodeData = {
  kind: "swimlane";
  laneId: string;
  name: string;
  laneKind: string;
  nodeCount: number;
};

export type TaskGroupNodeData = {
  kind: "task-group";
  taskId: string;
  name: string;
  color: string;
  count: number;
  width: number;
  height: number;
};

export type MacroNodeData = {
  kind: "macro";
  macroId: string;
  name: string;
  description?: string;
  nodeCount: number;
  inputs: NodePort[];
  outputs: NodePort[];
};

export type WorkflowNodeData = {
  kind: "workflow-task" | "workflow-start" | "workflow-end";
  taskId?: string;
  name: string;
  color?: string;
  width: number;
  height: number;
};

export type TopologyEdgeData = {
  kind: "contract" | "portal" | "transition" | "complete";
  sourcePortId: string;
  targetPortId: string;
  label?: string;
  stroke: string;
  strokeWidth: number;
  dash?: "cross" | "portal" | "recovery";
  animated: boolean;
  selectable: boolean;
  crossEnv?: boolean;
};

export type ArchitectureModelInput = {
  graph: ArchitectureGraph;
  lod: LodLevel;
  selectedEdgeIds: string[];
  focusEdgeId: string | null;
  issues: ValidationIssue[];
  securityView: boolean;
  steps: ExecutionStep[];
  edgePayloads: EdgePayload[];
};

const EMBER = "#c2410c";
const STONE = "#78716c";
const PAYLOAD = "#9a3412";
const PORTAL = "#a16207";

function healthStatus(health: NodeHealth): NodeModel["status"] {
  const status = {
    error: "danger",
    warning: "warning",
    ok: "success",
    unknown: "default",
  } as const;
  return status[health] as NodeModel["status"];
}

function healthByNode(
  nodes: ArchitectureNode[],
  issues: ValidationIssue[],
): Map<string, NodeHealth> {
  const map = new Map<string, NodeHealth>();
  for (const issue of issues) {
    if (!issue.nodeId) continue;
    const current = map.get(issue.nodeId);
    if (issue.severity === "error") map.set(issue.nodeId, "error");
    else if (issue.severity === "warning" && current !== "error") map.set(issue.nodeId, "warning");
    else if (!current) map.set(issue.nodeId, "ok");
  }
  if (issues.length > 0) {
    for (const node of nodes) {
      if (!map.has(node.id)) map.set(node.id, "ok");
    }
  }
  return map;
}

function payloadByNode(steps: ExecutionStep[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const step of steps) {
    const payload =
      step.nodeType === "foundation.output_viewer"
        ? (Object.values(step.inputs)[0] ?? null)
        : (Object.values(step.outputs)[0] ?? step.message ?? null);
    if (payload !== null && payload !== undefined) map.set(step.nodeId, payload);
  }
  return map;
}

function securityTagsFor(
  node: ArchitectureNode,
  issues: ValidationIssue[],
  securityView: boolean,
): string[] {
  if (!securityView) return [];
  return [
    ...securityCategories(node),
    ...(issues.some((issue) => issue.nodeId === node.id && issue.code === "SECURITY_EMBEDDED_CREDENTIAL")
      ? ["Possible embedded credential"]
      : []),
    ...(issues.some((issue) => issue.nodeId === node.id && issue.code === "SECURITY_DISCONNECTED_COMPONENT")
      ? ["Disconnected component"]
      : []),
  ];
}

type CollapsedIndex = {
  hiddenByMacro: Map<string, string>;
  handleByNodePort: Map<string, { macroId: string; handleId: string }>;
};

function collapsedIndex(graph: ArchitectureGraph): CollapsedIndex {
  const hiddenByMacro = new Map<string, string>();
  const handleByNodePort = new Map<string, { macroId: string; handleId: string }>();
  for (const macro of graph.macroBlocks) {
    if (!macro.collapsed) continue;
    for (const id of macro.nodeIds) hiddenByMacro.set(id, macro.id);
    for (const [handleId, binding] of Object.entries(macroPortBindings(macro))) {
      const direction = handleId.startsWith("macro-in-") ? "target" : "source";
      handleByNodePort.set(`${binding.nodeId}\0${binding.portId}\0${direction}`, {
        macroId: macro.id,
        handleId,
      });
    }
  }
  return { hiddenByMacro, handleByNodePort };
}

function graphShell(id: string, scaleExtent: [number, number]): Model["graph"] {
  return {
    id,
    type: "graph",
    layers: [...TOPOLOGY_LAYERS],
    scaleExtent,
  };
}

export function architectureModel(input: ArchitectureModelInput): Model {
  const { graph, lod } = input;
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const health = healthByNode(graph.nodes, input.issues);
  const payloads = payloadByNode(input.steps);
  const stepsByNode = new Map(input.steps.map((step) => [step.nodeId, step]));
  const laneNames = new Map(graph.deploymentEnvironments.map((lane) => [lane.id, lane.name]));
  const collapsed = collapsedIndex(graph);
  const countByLane = new Map<string, number>();
  for (const node of graph.nodes) {
    if (!node.deploymentTarget) continue;
    countByLane.set(node.deploymentTarget, (countByLane.get(node.deploymentTarget) ?? 0) + 1);
  }

  const nodes: NodeModel[] = [];

  for (const lane of graph.deploymentEnvironments) {
    const bounds = swimlaneBounds(lane);
    const data: SwimlaneNodeData = {
      kind: "swimlane",
      laneId: lane.id,
      name: lane.name,
      laneKind: lane.kind,
      nodeCount: countByLane.get(lane.id) ?? 0,
    };
    nodes.push({
      id: swimlaneFlowId(lane.id),
      type: "swimlane",
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      data,
    });
  }

  for (const task of graph.workflow.tasks) {
    const data: TaskGroupNodeData = {
      kind: "task-group",
      taskId: task.id,
      name: task.name,
      color: task.color,
      count: graph.nodes.filter((node) => node.workflowTaskId === task.id).length,
      width: task.engineeringBounds.width,
      height: task.engineeringBounds.height,
    };
    nodes.push({
      id: taskFlowId(task.id),
      type: "task-group",
      x: task.engineeringBounds.x,
      y: task.engineeringBounds.y,
      width: task.engineeringBounds.width,
      height: task.engineeringBounds.height,
      data,
    });
  }

  for (const node of graph.nodes) {
    if (collapsed.hiddenByMacro.has(node.id)) continue;
    const tags = securityTagsFor(node, input.issues, input.securityView);
    const preview = payloads.get(node.id) ?? null;
    const data: ArchitectureNodeData = {
      kind: "architecture",
      name: node.name,
      nodeType: node.type,
      inputs: node.inputs,
      outputs: node.outputs,
      health: health.get(node.id) ?? "unknown",
      securityTags: tags,
      deploymentLabel: node.deploymentTarget ? laneNames.get(node.deploymentTarget) : undefined,
      busId: isPortalNode(node) ? portalBusId(node) || null : null,
      payloadPreview: preview,
      executionStatus: stepsByNode.get(node.id)?.status ?? null,
      configuration: node.configuration,
      workflowTaskId: node.workflowTaskId,
    };
    const size = architectureCardSize(data, lod);
    nodes.push({
      id: node.id,
      type: "architecture",
      x: node.position.x,
      y: node.position.y,
      width: size.width,
      height: size.height,
      status: healthStatus(data.health),
      data,
    });
  }

  for (const macro of graph.macroBlocks) {
    if (!macro.collapsed) continue;
    const position = macroPosition(macro);
    const data: MacroNodeData = {
      kind: "macro",
      macroId: macro.id,
      name: macro.name,
      description: macro.description,
      nodeCount: macro.nodeIds.length,
      inputs: macro.inputs,
      outputs: macro.outputs,
    };
    const size = macroCardSize(data, lod);
    nodes.push({
      id: macroFlowId(macro.id),
      type: "macro",
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      data,
    });
  }

  const payloadByEdge = new Map(input.edgePayloads.map((payload) => [payload.edgeId, payload]));
  const edges: EdgeModel[] = [];
  for (const edge of graph.edges) {
    const mapped = mapContractEdge(edge, collapsed, nodesById, payloadByEdge, input, lod);
    if (mapped) edges.push(mapped);
  }
  if (lod !== "micro") {
    for (const [busId, portals] of groupPortalsByBus(graph.nodes)) {
      const inputs = portals.filter((node) => node.type === "foundation.portal_input");
      const outputs = portals.filter((node) => node.type === "foundation.portal_output");
      for (const output of outputs) {
        if (collapsed.hiddenByMacro.has(output.id)) continue;
        for (const input of inputs) {
          if (collapsed.hiddenByMacro.has(input.id)) continue;
          const data: TopologyEdgeData = {
            kind: "portal",
            sourcePortId: "bus-out",
            targetPortId: "bus-in",
            label: lod === "macro" ? busId : `bus:${busId}`,
            stroke: PORTAL,
            strokeWidth: 1.5,
            dash: "portal",
            animated: true,
            selectable: false,
          };
          edges.push({
            id: `portal-bus-${busId}-${output.id}-${input.id}`,
            type: "portal",
            source: output.id,
            target: input.id,
            data,
          });
        }
      }
    }
  }

  return { graph: graphShell("architecture", [0.1, 2]), nodes, edges };
}

function mapContractEdge(
  edge: ArchitectureEdge,
  collapsed: CollapsedIndex,
  nodesById: Map<string, ArchitectureNode>,
  payloadByEdge: Map<string, EdgePayload>,
  input: ArchitectureModelInput,
  lod: LodLevel,
): EdgeModel | null {
  const sourceMacro = collapsed.hiddenByMacro.get(edge.sourceNodeId);
  const targetMacro = collapsed.hiddenByMacro.get(edge.targetNodeId);
  if (sourceMacro && sourceMacro === targetMacro) return null;

  let source = edge.sourceNodeId;
  let target = edge.targetNodeId;
  let sourcePortId = edge.sourcePortId;
  let targetPortId = edge.targetPortId;
  if (sourceMacro) {
    const resolved = collapsed.handleByNodePort.get(`${edge.sourceNodeId}\0${edge.sourcePortId}\0source`);
    if (!resolved) return null;
    source = macroFlowId(resolved.macroId);
    sourcePortId = resolved.handleId;
  }
  if (targetMacro) {
    const resolved = collapsed.handleByNodePort.get(`${edge.targetNodeId}\0${edge.targetPortId}\0target`);
    if (!resolved) return null;
    target = macroFlowId(resolved.macroId);
    targetPortId = resolved.handleId;
  }

  const cross = isCrossEnvironmentEdge(edge, nodesById);
  const payload = payloadByEdge.get(edge.id);
  const selected = input.selectedEdgeIds.includes(edge.id) || input.focusEdgeId === edge.id;
  const sourceNode = nodesById.get(edge.sourceNodeId);
  const sourcePort = sourceNode?.outputs.find((port) => port.id === edge.sourcePortId);
  const contractLabel = sourcePort ? CONTRACT_TYPE_LABELS[sourcePort.contractType] : "Unresolved contract";
  const payloadLabel =
    payload && lod !== "macro"
      ? payload.value.length > 24
        ? `${payload.value.slice(0, 24)}…`
        : payload.value
      : undefined;
  const data: TopologyEdgeData = {
    kind: "contract",
    sourcePortId,
    targetPortId,
    label:
      lod === "macro"
        ? undefined
        : [contractLabel, cross ? "cross-env" : undefined, payloadLabel].filter(Boolean).join(" · "),
    stroke: selected ? EMBER : cross ? EMBER : payload ? PAYLOAD : STONE,
    strokeWidth: selected ? 3 : cross || payload ? 2 : 1.75,
    dash: cross ? "cross" : undefined,
    animated: cross || Boolean(payload) || selected,
    selectable: true,
    crossEnv: cross,
  };
  return { id: edge.id, type: "contract", source, target, data };
}

const WORKFLOW_START = "workflow-start";
const WORKFLOW_END = "workflow-end";

export function workflowModel(
  workflow: ArchitectureGraph["workflow"],
  selectedEdgeIds: string[],
): Model {
  const tasks = workflow.tasks;
  const startX = Math.min(40, ...tasks.map((task) => task.bounds.x - 180));
  const endX = Math.max(240, ...tasks.map((task) => task.bounds.x + task.bounds.width + 120));
  const endY = tasks.length ? Math.min(...tasks.map((task) => task.bounds.y)) + 60 : 160;
  const nodes: NodeModel[] = [
    {
      id: WORKFLOW_START,
      type: "workflow-start",
      x: startX,
      y: 160,
      width: 96,
      height: 48,
      data: { kind: "workflow-start", name: "Start", width: 96, height: 48 } satisfies WorkflowNodeData,
    },
    {
      id: WORKFLOW_END,
      type: "workflow-end",
      x: endX,
      y: endY,
      width: 96,
      height: 48,
      data: { kind: "workflow-end", name: "End", width: 96, height: 48 } satisfies WorkflowNodeData,
    },
    ...tasks.map((task) => {
      const data: WorkflowNodeData = {
        kind: "workflow-task",
        taskId: task.id,
        name: task.name,
        color: task.color,
        width: task.bounds.width,
        height: task.bounds.height,
      };
      return {
        id: taskFlowId(task.id),
        type: "workflow-task",
        x: task.bounds.x,
        y: task.bounds.y,
        width: task.bounds.width,
        height: task.bounds.height,
        data,
      };
    }),
  ];
  const edges: EdgeModel[] = workflow.transitions.map((transition) => {
    const selected = selectedEdgeIds.includes(transitionFlowId(transition.id));
    const recovery = transition.kind === "recovery";
    const data: TopologyEdgeData = {
      kind: "transition",
      sourcePortId: "out",
      targetPortId: "in",
      label: `${recovery ? "A" : ""}${transition.stage}`,
      stroke: recovery ? "#b45309" : "#475569",
      strokeWidth: selected ? 3 : 2,
      dash: recovery ? "recovery" : undefined,
      animated: selected,
      selectable: true,
    };
    return {
      id: transitionFlowId(transition.id),
      type: "transition",
      source: transition.sourceTaskId ? taskFlowId(transition.sourceTaskId) : WORKFLOW_START,
      target: taskFlowId(transition.targetTaskId),
      data,
    };
  });
  for (const task of workflowEndTasks(workflow)) {
    const data: TopologyEdgeData = {
      kind: "complete",
      sourcePortId: "out",
      targetPortId: "in",
      label: "Complete",
      stroke: "#047857",
      strokeWidth: 2,
      animated: false,
      selectable: false,
    };
    edges.push({
      id: `workflow-end:${task.id}`,
      type: "complete",
      source: taskFlowId(task.id),
      target: WORKFLOW_END,
      data,
    });
  }
  return { graph: graphShell("workflow", [0.2, 2]), nodes, edges };
}
