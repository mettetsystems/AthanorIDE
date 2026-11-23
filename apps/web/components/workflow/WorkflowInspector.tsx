"use client";
import { useState } from "react";
import {
  Alert,
  Button,
  ExpandableSection,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  Title,
} from "@patternfly/react-core";
import {
  taskInstructions,
  type ArchitectureGraph,
  type WorkflowTask,
} from "@athanor/contracts";

import { validateCurrentProject } from "@/lib/validate";
import {
  disconnectedCandidates,
  isExecutable,
  optionalPortCandidates,
  parseTaskFlowId,
  pruneOptionalPorts,
  restoreOptionalPorts,
  taskFlowId,
} from "@/lib/workflow";
import { useProjectStore } from "@/store/project-store";
import { useSelectionStore } from "@/store/selection-store";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";
import { BriefField } from "./TaskNode";
import { parseTransitionFlowId } from "./WorkflowCanvas";

export function PruneControls({ nodeId, taskId }: { nodeId?: string; taskId?: string }) {
  const graph = useProjectStore((s) => s.graph);
  const [preview, setPreview] = useState<{ graph: ArchitectureGraph; names: string[] } | null>(null);
  const names = nodeId
    ? optionalPortCandidates(graph, nodeId).map((port) => `${port.direction}: ${port.name} (${port.id})`)
    : disconnectedCandidates(graph, taskId!).map((node) => `${node.name} (${node.id})`);
  return (
    <div>
      <Button variant="secondary" isDisabled={!names.length} onClick={() => setPreview({ graph, names })}>
        {nodeId ? "Prune unused ports" : "Prune disconnected components"} ({names.length})
      </Button>
      {nodeId && (
        <Button
          variant="secondary"
          isDisabled={!graph.nodes.find((node) => node.id === nodeId)?.prunedPorts}
          onClick={() => {
            useProjectStore.getState().mutateGraph((next) => restoreOptionalPorts(next, nodeId));
            void validateCurrentProject();
          }}
        >
          Restore optional ports
        </Button>
      )}
      {preview && (
        <Alert variant="warning" isInline title="Remove these items" aria-label="Pruning preview">
          <ul>
            {preview.names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          {preview.graph !== graph && <p>Project changed. Open a fresh preview before pruning.</p>}
          <Button
            variant="danger"
            isDisabled={preview.graph !== graph}
            onClick={() => {
              useProjectStore.getState().mutateGraph((next) =>
                nodeId
                  ? pruneOptionalPorts(next, nodeId)
                  : {
                      ...next,
                      nodes: next.nodes.filter(
                        (node) => !disconnectedCandidates(next, taskId!).some((candidate) => candidate.id === node.id),
                      ),
                    },
              );
              setPreview(null);
              void validateCurrentProject();
            }}
          >
            Apply pruning
          </Button>
          <Button variant="link" onClick={() => setPreview(null)}>Cancel</Button>
          <p>Required ports, task boundaries, and linked components are preserved. Undo restores removals.</p>
        </Alert>
      )}
    </div>
  );
}

function Boundaries({ task }: { task: WorkflowTask }) {
  const graph = useProjectStore((s) => s.graph);
  const members = graph.nodes.filter((node) => node.workflowTaskId === task.id);
  return (
    <Form>
      {(["inputBinding", "outputBinding"] as const).map((key) => (
        <FormGroup
          key={key}
          label={key === "inputBinding" ? "Workflow input boundary" : "Task result boundary"}
          fieldId={key}
        >
          <FormSelect
            id={key}
            value={task[key] ? JSON.stringify(task[key]) : ""}
            onChange={(_event, value) =>
              useProjectStore.getState().updateTask(task.id, {
                [key]: value ? JSON.parse(value) : undefined,
              })
            }
          >
            <FormSelectOption value="" label="Choose a string port…" />
            {members.flatMap((node) =>
              node[key === "inputBinding" ? "inputs" : "outputs"]
                .filter((port) => port.contractType === "STRING")
                .map((port) => (
                  <FormSelectOption
                    key={`${node.id}:${port.id}`}
                    value={JSON.stringify({ nodeId: node.id, portId: port.id })}
                    label={`${node.name} · ${port.name}`}
                  />
                )),
            )}
          </FormSelect>
        </FormGroup>
      ))}
      <p>The workflow supplies the input boundary. Remove any component wire into that port.</p>
    </Form>
  );
}

export function WorkflowInspector() {
  const graph = useProjectStore((s) => s.graph);
  const { updateTask, cloneTask, removeTask, mutateGraph } = useProjectStore();
  const selected = useSelectionStore();
  const role = useUiPreferencesStore((s) => s.workspaceRole);
  const taskId = parseTaskFlowId(selected.selectedNodeIds[0] ?? "");
  const task = graph.workflow.tasks.find((item) => item.id === taskId);
  const edgeId = parseTransitionFlowId(selected.selectedEdgeIds[0] ?? "");
  const edge = graph.workflow.transitions.find((item) => item.id === edgeId);
  if (edge) {
    return (
      <aside aria-label="Workflow connection">
        <Title headingLevel="h2">Workflow connection</Title>
        <p>
          {graph.workflow.tasks.find((item) => item.id === edge.sourceTaskId)?.name ?? "Start"} →{" "}
          {graph.workflow.tasks.find((item) => item.id === edge.targetTaskId)?.name}
        </p>
        <Form>
          <FormGroup label="Path type" fieldId="transition-kind">
            <FormSelect
              id="transition-kind"
              value={edge.kind}
              onChange={(_event, value) =>
                mutateGraph((next) => ({
                  ...next,
                  workflow: {
                    ...next.workflow,
                    transitions: next.workflow.transitions.map((item) =>
                      item.id === edge.id
                        ? {
                            ...item,
                            kind: value as "normal" | "recovery",
                            stage:
                              value === "recovery"
                                ? (next.workflow.transitions.find(
                                    (candidate) =>
                                      candidate.kind === "normal" && candidate.targetTaskId === edge.sourceTaskId,
                                  )?.stage ?? 1)
                                : item.stage,
                          }
                        : item,
                    ),
                  },
                }))
              }
            >
              <FormSelectOption value="normal" label="Normal stage" />
              <FormSelectOption value="recovery" label="Failure recovery (A)" isDisabled={edge.sourceTaskId === null} />
            </FormSelect>
          </FormGroup>
          <FormGroup label={edge.kind === "recovery" ? "Failed task stage" : "Stage number"} fieldId="transition-stage">
            <TextInput
              id="transition-stage"
              type="number"
              min={1}
              value={edge.stage}
              onChange={(_event, value) => {
                const stage = Number(value);
                if (Number.isInteger(stage) && stage > 0) {
                  mutateGraph((next) => ({
                    ...next,
                    workflow: {
                      ...next.workflow,
                      transitions: next.workflow.transitions.map((item) =>
                        item.id === edge.id ? { ...item, stage } : item,
                      ),
                    },
                  }));
                }
              }}
            />
          </FormGroup>
        </Form>
        {edge.kind === "recovery" && (
          <BriefField
            label="Recovery behavior"
            value={edge.recoveryDescription}
            onSave={(recoveryDescription) =>
              mutateGraph((next) => ({
                ...next,
                workflow: {
                  ...next.workflow,
                  transitions: next.workflow.transitions.map((item) =>
                    item.id === edge.id ? { ...item, recoveryDescription } : item,
                  ),
                },
              }))
            }
          />
        )}
        <p>Equal numbers run in parallel. Recovery replaces the failed task’s result and resumes its normal path.</p>
        <Button
          variant="danger"
          onClick={() => {
            mutateGraph((next) => ({
              ...next,
              workflow: {
                ...next.workflow,
                transitions: next.workflow.transitions.filter((item) => item.id !== edge.id),
              },
            }));
            selected.clearSelection();
          }}
        >
          Delete connection
        </Button>
      </aside>
    );
  }
  if (task) {
    return (
      <aside aria-label="Workflow task">
        <Title headingLevel="h2">Task brief</Title>
        <Form>
          <FormGroup label="Task name" fieldId="task-name">
            <TextInput
              id="task-name"
              value={task.name}
              onChange={(_event, value) => updateTask(task.id, { name: value || "Untitled task" })}
            />
          </FormGroup>
          <FormGroup label="Color" fieldId="task-color">
            <input
              id="task-color"
              aria-label="Task color"
              type="color"
              value={task.color}
              onChange={(event) => updateTask(task.id, { color: event.target.value })}
            />
          </FormGroup>
        </Form>
        {role !== "sme" && (
          <>
            <p>{taskInstructions(task)}</p>
            <Boundaries task={task} />
          </>
        )}
        <Button variant="secondary" onClick={() => cloneTask(task.id)}>Clone brief</Button>
        <Button
          variant="danger"
          onClick={() => {
            removeTask(task.id);
            selected.clearSelection();
          }}
        >
          Delete task
        </Button>
        <p>Deleting a task unassigns its components.</p>
        {role === "security" && <PruneControls key={task.id} taskId={task.id} />}
      </aside>
    );
  }
  return (
    <aside aria-label="Workflow overview">
      <Title headingLevel="h2">Workflow overview</Title>
      <p>
        Draw task boxes, define their briefs, and connect Start to stage 1. Final normal branches automatically connect to End; completion waits for all branches. Select a connection to edit its stage or recovery path.
      </p>
      <BriefField
        label="Workflow input"
        value={graph.workflow.input}
        onSave={(input) => mutateGraph((next) => ({ ...next, workflow: { ...next.workflow, input } }))}
      />
      <Form>
        <FormGroup label="Maximum parallel tasks" fieldId="max-parallel">
          <TextInput
            id="max-parallel"
            type="number"
            min={1}
            max={32}
            value={graph.workflow.maxParallelTasks}
            onChange={(_event, value) => {
              const maxParallelTasks = Number(value);
              if (Number.isInteger(maxParallelTasks) && maxParallelTasks >= 1 && maxParallelTasks <= 32) {
                mutateGraph((next) => ({
                  ...next,
                  workflow: { ...next.workflow, maxParallelTasks },
                }));
              }
            }}
          />
        </FormGroup>
      </Form>
      <p>Planned stages · no endpoints are called</p>
      <ul>
        {graph.workflow.tasks.map((item) => {
          const paths = graph.workflow.transitions.filter((transition) => transition.targetTaskId === item.id);
          return (
            <li key={item.id}>
              <Button variant="link" onClick={() => selected.focusNode(taskFlowId(item.id))}>
                <span style={{ color: item.color }}>●</span> {item.name} ·{" "}
                {[...new Set(paths.map((transition) => `${transition.kind === "recovery" ? "A" : ""}${transition.stage}`))].join(", ") || "Unconnected"}
              </Button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export function ComponentWorkflowControls() {
  const graph = useProjectStore((s) => s.graph);
  const ids = useSelectionStore((s) => s.selectedNodeIds);
  const role = useUiPreferencesStore((s) => s.workspaceRole);
  const nodes = graph.nodes.filter((node) => ids.includes(node.id));
  if (!nodes.length) return null;
  const node = nodes.length === 1 ? nodes[0] : undefined;
  const task = graph.workflow.tasks.find((item) => item.id === node?.workflowTaskId);
  return (
    <section aria-label="Task membership and instructions">
      <Form>
        <FormGroup label="Task group" fieldId="task-group">
          <FormSelect
            id="task-group"
            value={
              nodes.every((item) => item.workflowTaskId === nodes[0]?.workflowTaskId)
                ? (nodes[0]?.workflowTaskId ?? "")
                : "mixed"
            }
            onChange={(_event, value) =>
              useProjectStore.getState().assignTask(nodes.map((item) => item.id), value || undefined)
            }
          >
            <FormSelectOption value="" label="Shared / unassigned" />
            <FormSelectOption value="mixed" label="Multiple groups" isDisabled />
            {graph.workflow.tasks.map((item) => (
              <FormSelectOption key={item.id} value={item.id} label={item.name} />
            ))}
          </FormSelect>
        </FormGroup>
      </Form>
      {node && task && isExecutable(node.type) && (
        <>
          <p>
            {node.instructionMode === "override"
              ? "Instruction override · AgentOpSec review"
              : "Instructions inherited from SME"}
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              useProjectStore.getState().mutateGraph((next) => ({
                ...next,
                nodes: next.nodes.map((item) =>
                  item.id === node.id
                    ? {
                        ...item,
                        instructionMode: item.instructionMode === "override" ? "inherit" : "override",
                        configuration: {
                          ...item.configuration,
                          instructions:
                            item.instructionMode === "override"
                              ? item.configuration.instructions
                              : taskInstructions(task),
                        },
                      }
                    : item,
                ),
              }))
            }
          >
            {node.instructionMode === "override" ? "Restore SME instructions" : "Override instructions"}
          </Button>
          <ExpandableSection toggleText="SME brief and effective instructions" isExpanded={role === "security"}>
            <Title headingLevel="h3">SME brief</Title>
            <pre>{taskInstructions(task)}</pre>
            <Title headingLevel="h3">Effective instructions</Title>
            <pre>
              {node.instructionMode === "override"
                ? String(node.configuration.instructions ?? "")
                : taskInstructions(task)}
            </pre>
          </ExpandableSection>
        </>
      )}
      {node && role === "security" && <PruneControls key={node.id} nodeId={node.id} />}
    </section>
  );
}
