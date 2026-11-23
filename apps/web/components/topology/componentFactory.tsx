"use client";

import {
  GraphComponent,
  ModelKind,
  isGraph,
  observer,
  type ComponentFactory,
  type GraphElement,
} from "@patternfly/react-topology";

import { useSelectionStore } from "@/store/selection-store";

import { ContractEdge } from "./edges/ContractEdge";
import { ArchitectureNodeView } from "./nodes/ArchitectureNodeView";
import { MacroNodeView } from "./nodes/MacroNodeView";
import { SwimlaneView, TaskGroupView } from "./nodes/ContainerNodes";
import { WorkflowEndView, WorkflowStartView, WorkflowTaskView } from "./nodes/WorkflowNodes";

const GraphView = observer(function GraphView({ element }: { element: GraphElement }) {
  if (!isGraph(element)) return null;
  return (
    <GraphComponent
      element={element}
      onSelect={(event) => {
        const target = event.target as Element | null;
        if (target?.tagName === "rect") useSelectionStore.getState().clearSelection();
      }}
    />
  );
});

export const componentFactory: ComponentFactory = (kind, type) => {
  if (kind === ModelKind.graph) return GraphView;
  if (kind === ModelKind.edge) return ContractEdge;
  switch (type) {
    case "swimlane":
      return SwimlaneView;
    case "task-group":
      return TaskGroupView;
    case "architecture":
      return ArchitectureNodeView;
    case "macro":
      return MacroNodeView;
    case "workflow-task":
      return WorkflowTaskView;
    case "workflow-start":
      return WorkflowStartView;
    case "workflow-end":
      return WorkflowEndView;
    default:
      return undefined;
  }
};
