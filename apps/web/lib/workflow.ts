import {
  newId,
  type ArchitectureGraph,
  type WorkflowTask,
  type ArchitectureNode,
} from "@athanor/contracts";
import { getNodeDefinition } from "@athanor/node-definitions";

export const TASK_PREFIX = "workflow-task:";
export const taskFlowId = (id: string) => `${TASK_PREFIX}${id}`;
export const parseTaskFlowId = (id: string) =>
  id.startsWith(TASK_PREFIX) ? id.slice(TASK_PREFIX.length) : null;
export const TRANSITION_PREFIX = "workflow-transition:";
export const transitionFlowId = (id: string) => `${TRANSITION_PREFIX}${id}`;
export const parseTransitionFlowId = (id: string) =>
  id.startsWith(TRANSITION_PREFIX) ? id.slice(TRANSITION_PREFIX.length) : null;
export const isExecutable = (type: string) =>
  type === "agent.sandboxed" || type.startsWith("harness.");
export function createWorkflowTask(index = 0): WorkflowTask {
  return {
    id: newId(),
    name: `Task ${index + 1}`,
    color: ["#2563eb", "#7c3aed", "#059669", "#d97706"][index % 4]!,
    role: "",
    expectedTasks: "",
    constraints: "",
    bounds: { x: 260 + index * 380, y: 100, width: 320, height: 300 },
    engineeringBounds: { x: index * 1000, y: 0, width: 900, height: 800 },
  };
}
export function boundPort(
  graph: ArchitectureGraph,
  nodeId: string,
  portId: string,
): boolean {
  return (
    graph.workflow.tasks.some((t) =>
      [t.inputBinding, t.outputBinding].some(
        (b) => b?.nodeId === nodeId && b.portId === portId,
      ),
    ) ||
    graph.macroBlocks.some((m) => {
      const bindings = m.metadata?.portBindings;
      return (
        bindings &&
        typeof bindings === "object" &&
        Object.values(bindings).some(
          (b) => b?.nodeId === nodeId && b?.portId === portId,
        )
      );
    })
  );
}
export function portLinked(
  graph: ArchitectureGraph,
  nodeId: string,
  portId: string,
): boolean {
  return (
    boundPort(graph, nodeId, portId) ||
    graph.edges.some(
      (e) =>
        (e.sourceNodeId === nodeId && e.sourcePortId === portId) ||
        (e.targetNodeId === nodeId && e.targetPortId === portId),
    )
  );
}
export function optionalPortCandidates(
  graph: ArchitectureGraph,
  nodeId: string,
): Array<{ direction: "inputs" | "outputs"; id: string; name: string }> {
  const node = graph.nodes.find((n) => n.id === nodeId);
  const definition = node && getNodeDefinition(node.type);
  if (!node || !definition || definition.exportKind !== "agent_studio")
    return [];
  return (["inputs", "outputs"] as const).flatMap((direction) =>
    node[direction]
      .filter(
        (p) =>
          !p.required &&
          definition[direction].some((d) => d.name === p.name && !d.required) &&
          !portLinked(graph, nodeId, p.id),
      )
      .map((p) => ({ direction, id: p.id, name: p.name })),
  );
}
export function pruneOptionalPorts(
  graph: ArchitectureGraph,
  nodeId: string,
): ArchitectureGraph {
  const candidates = optionalPortCandidates(graph, nodeId);
  return {
    ...graph,
    nodes: graph.nodes.map((n) =>
      n.id !== nodeId
        ? n
        : {
            ...n,
            inputs: n.inputs.filter(
              (p) =>
                !candidates.some(
                  (c) => c.direction === "inputs" && c.id === p.id,
                ),
            ),
            outputs: n.outputs.filter(
              (p) =>
                !candidates.some(
                  (c) => c.direction === "outputs" && c.id === p.id,
                ),
            ),
            prunedPorts: {
              inputs: [
                ...new Set([
                  ...(n.prunedPorts?.inputs ?? []),
                  ...candidates
                    .filter((c) => c.direction === "inputs")
                    .map((c) => c.name),
                ]),
              ],
              outputs: [
                ...new Set([
                  ...(n.prunedPorts?.outputs ?? []),
                  ...candidates
                    .filter((c) => c.direction === "outputs")
                    .map((c) => c.name),
                ]),
              ],
            },
          },
    ),
  };
}
export function restoreOptionalPorts(
  graph: ArchitectureGraph,
  nodeId: string,
): ArchitectureGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const definition = getNodeDefinition(n.type);
      if (n.id !== nodeId || !definition) return n;
      const restored = { ...n, prunedPorts: undefined };
      for (const direction of ["inputs", "outputs"] as const)
        restored[direction] = [
          ...n[direction],
          ...definition[direction]
            .filter(
              (p) =>
                !p.required &&
                n.prunedPorts?.[direction].includes(p.name) &&
                !n[direction].some((existing) => existing.name === p.name),
            )
            .map((p) => ({ ...p, id: newId() })),
        ];
      return restored;
    }),
  };
}
export function disconnectedCandidates(
  graph: ArchitectureGraph,
  taskId: string,
): ArchitectureNode[] {
  return graph.nodes.filter(
    (n) =>
      n.workflowTaskId === taskId &&
      !n.type.includes("portal") &&
      !graph.macroBlocks.some((m) => m.nodeIds.includes(n.id)) &&
      !graph.workflow.tasks.some((t) =>
        [t.inputBinding, t.outputBinding].some((b) => b?.nodeId === n.id),
      ) &&
      !graph.edges.some(
        (e) => e.sourceNodeId === n.id || e.targetNodeId === n.id,
      ),
  );
}
export function securityCategories(node: ArchitectureNode): string[] {
  const tags: string[] = [];
  if (node.type.includes("guardrail")) tags.push("Guardrails");
  if (node.type.startsWith("sandbox.") || node.type.includes("policy"))
    tags.push("Security policy");
  if (
    /auth|secret|credential/.test(node.type) ||
    node.configuration.secretName ||
    node.configuration.environmentNames
  )
    tags.push("Authentication");
  if (node.instructionMode === "override") tags.push("Instruction override");
  return tags;
}

/** Normal terminal tasks reach End; recovery handlers substitute their failed task's result. */
export function workflowEndTasks(workflow: ArchitectureGraph["workflow"]): WorkflowTask[] {
  const reachable = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of workflow.transitions) {
      if (edge.kind === "normal" && (edge.sourceTaskId === null || reachable.has(edge.sourceTaskId)) && !reachable.has(edge.targetTaskId)) {
        reachable.add(edge.targetTaskId);
        changed = true;
      }
    }
  }
  const continuing = new Set(workflow.transitions.filter(e => e.kind === "normal").map(e => e.sourceTaskId));
  return workflow.tasks.filter(task => reachable.has(task.id) && !continuing.has(task.id));
}
