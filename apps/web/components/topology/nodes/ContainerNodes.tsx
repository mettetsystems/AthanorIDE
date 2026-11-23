"use client";

import { Layer, isNode, observer, type GraphElement } from "@patternfly/react-topology";

import { lodFromZoom, type LodLevel } from "@/lib/lod";
import { useSelectionStore } from "@/store/selection-store";

import { SWIMLANE_LAYER, TASK_GROUP_LAYER } from "../layers";
import type { SwimlaneNodeData, TaskGroupNodeData } from "../model";
import { useCardDrag } from "./drag";

function useLod(element: GraphElement): LodLevel {
  return lodFromZoom(element.getGraph().getScale());
}

export const SwimlaneView = observer(function SwimlaneView({ element }: { element: GraphElement }) {
  const [, dragRef] = useCardDrag();
  if (!isNode(element)) return null;
  const data = element.getData() as SwimlaneNodeData;
  const { x, y } = element.getPosition();
  const { width, height } = element.getDimensions();
  const lod = useLod(element);
  const selected = useSelectionStore((state) => state.selectedNodeIds.includes(element.getId()));
  return (
    <>
      <rect ref={dragRef} width={width} height={height} fill="transparent" />
      <Layer id={SWIMLANE_LAYER}>
        <g>
          <rect
            className={selected ? "athanor-lane is-selected" : "athanor-lane"}
            x={x}
            y={y}
            width={width}
            height={height}
            rx={8}
          />
          <text className="athanor-lane__title" x={x + 12} y={y + 22}>
            {data.name}
          </text>
          {lod !== "macro" ? (
            <text className="athanor-lane__meta" x={x + 12} y={y + 38}>
              {data.laneKind.replaceAll("_", " ")} · {data.nodeCount} node{data.nodeCount === 1 ? "" : "s"}
            </text>
          ) : (
            <text className="athanor-lane__meta" x={x + width - 12} y={y + 22} textAnchor="end">
              {data.nodeCount} nodes
            </text>
          )}
        </g>
      </Layer>
    </>
  );
});

export const TaskGroupView = observer(function TaskGroupView({ element }: { element: GraphElement }) {
  const [, dragRef] = useCardDrag();
  if (!isNode(element)) return null;
  const data = element.getData() as TaskGroupNodeData;
  const { x, y } = element.getPosition();
  const { width, height } = element.getDimensions();
  const selected = useSelectionStore((state) => state.selectedNodeIds.includes(element.getId()));
  return (
    <>
      <rect ref={dragRef} width={width} height={height} fill="transparent" />
      <Layer id={TASK_GROUP_LAYER}>
        <g
          onClick={(event) => {
            event.stopPropagation();
            const current = useSelectionStore.getState().selectedNodeIds;
            const next = event.shiftKey
              ? [...new Set([...current, element.getId()])]
              : [element.getId()];
            useSelectionStore.getState().setSelection(next, []);
          }}
        >
          <rect
            className="athanor-task-group"
            x={x}
            y={y}
            width={width}
            height={height}
            rx={12}
            stroke={data.color}
            strokeWidth={selected ? 3 : 2}
          />
          <rect x={x} y={y} width={width} height={28} rx={12} fill={data.color} />
          <text className="athanor-task-group__title" x={x + 12} y={y + 18}>
            {data.name} · {data.count} components
          </text>
        </g>
      </Layer>
    </>
  );
});
