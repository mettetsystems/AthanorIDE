"use client";

import { isEdge, observer, type GraphElement } from "@patternfly/react-topology";

import { lodFromZoom } from "@/lib/lod";
import { useSelectionStore } from "@/store/selection-store";

import { architectureCardSize, macroCardSize, portAnchor } from "../geometry";
import type { ArchitectureNodeData, MacroNodeData, TopologyEdgeData, WorkflowNodeData } from "../model";

function endpoint(element: GraphElement | undefined, portId: string): { x: number; y: number } | null {
  if (!element || element.getKind() !== "node") return null;
  const node = element;
  const position = "getPosition" in node ? (node as { getPosition: () => { x: number; y: number } }).getPosition() : null;
  const size = "getDimensions" in node ? (node as { getDimensions: () => { width: number; height: number } }).getDimensions() : null;
  if (!position || !size) return null;
  const data = node.getData() as ArchitectureNodeData | MacroNodeData | WorkflowNodeData | undefined;
  if (!data) return { x: position.x + size.width / 2, y: position.y + size.height / 2 };
  if (data.kind === "workflow-task" || data.kind === "workflow-start" || data.kind === "workflow-end") {
    const y = position.y + size.height / 2;
    return { x: portId === "in" ? position.x : position.x + size.width, y };
  }
  const lod = lodFromZoom(node.getGraph().getScale());
  if (data.kind === "macro") {
    const card = { inputs: data.inputs, outputs: data.outputs, description: data.description };
    return portAnchor(position, macroCardSize(card, lod), card, portId, lod);
  }
  if (data.kind !== "architecture") return null;
  return portAnchor(position, architectureCardSize(data, lod), data, portId, lod);
}

export const ContractEdge = observer(function ContractEdge({ element }: { element: GraphElement }) {
  if (!isEdge(element)) return null;
  const data = element.getData() as TopologyEdgeData | undefined;
  if (!data) return null;
  const lod = lodFromZoom(element.getGraph().getScale());
  if (data.kind === "portal" && lod === "micro") return null;
  const start = endpoint(element.getSource(), data.sourcePortId);
  const end = endpoint(element.getTarget(), data.targetPortId);
  if (!start || !end) return null;
  const selected = data.selectable && useSelectionStore((state) => state.selectedEdgeIds.includes(element.getId()));
  const midX = (start.x + end.x) / 2;
  const path = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
  const dash = data.dash === "portal" ? "2 6" : data.dash ? "6 4" : undefined;
  return (
    <g className={["athanor-edge", data.animated ? "is-animated" : "", data.dash === "portal" ? "is-portal" : ""].filter(Boolean).join(" ")}>
      <defs>
        <marker id="athanor-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={data.stroke} />
        </marker>
      </defs>
      <path d={path} className="athanor-edge__hit" />
      <path
        d={path}
        fill="none"
        stroke={selected ? "var(--athanor-ember)" : data.stroke}
        strokeWidth={selected ? Math.max(data.strokeWidth, 3) : data.strokeWidth}
        strokeDasharray={dash}
        markerEnd="url(#athanor-arrow)"
        onClick={(event) => {
          if (!data.selectable) return;
          event.stopPropagation();
          useSelectionStore.getState().setSelection([], [element.getId()]);
        }}
      />
      {data.label && lod !== "macro" && (
        <g transform={`translate(${midX}, ${(start.y + end.y) / 2})`}>
          <rect className="athanor-edge__label-bg" x={-4} y={-12} width={Math.max(24, data.label.length * 6.2)} height={16} />
          <text className="athanor-edge__label" y={0}>
            {data.label}
          </text>
        </g>
      )}
    </g>
  );
});
