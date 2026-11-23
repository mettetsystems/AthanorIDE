"use client";

import { Button } from "@patternfly/react-core";
import { isNode, observer, type GraphElement } from "@patternfly/react-topology";
import { Boxes } from "lucide-react";

import { PortRow } from "@/components/nodes/PortRow";
import { lodFromZoom } from "@/lib/lod";
import { useProjectStore } from "@/store/project-store";
import { useSelectionStore } from "@/store/selection-store";

import type { MacroNodeData } from "../model";
import { useCardDrag } from "./drag";

export const MacroNodeView = observer(function MacroNodeView({ element }: { element: GraphElement }) {
  const [, dragRef] = useCardDrag();
  if (!isNode(element)) return null;
  const data = element.getData() as MacroNodeData;
  const { width, height } = element.getDimensions();
  const lod = lodFromZoom(element.getGraph().getScale());
  const selected = useSelectionStore((state) => state.selectedNodeIds.includes(element.getId()));
  return (
    <foreignObject width={width} height={height} className="athanor-fo">
      <article
        {...{ xmlns: "http://www.w3.org/1999/xhtml" }}
        className={["athanor-card", "athanor-macro", selected ? "is-selected" : ""].filter(Boolean).join(" ")}
        aria-label={`${data.name} macro block`}
        onClick={(event) => {
          event.stopPropagation();
          const current = useSelectionStore.getState().selectedNodeIds;
          const next = event.shiftKey ? [...new Set([...current, element.getId()])] : [element.getId()];
          useSelectionStore.getState().setSelection(next, []);
        }}
      >
        <header ref={dragRef} className="athanor-card__header">
          <Boxes className="athanor-card__icon" aria-hidden />
          <div className="athanor-card__titles">
            <h3>{data.name}</h3>
            <p>
              {data.nodeCount} node{data.nodeCount === 1 ? "" : "s"}
              {lod !== "macro" && data.description ? ` · ${data.description}` : ""}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              useProjectStore.getState().expandMacro(data.macroId);
            }}
          >
            Expand
          </Button>
        </header>
        {lod !== "macro" && (
          <div className="athanor-card__ports">
            {data.inputs.map((port) => (
              <PortRow key={port.id} nodeId={element.getId()} port={port} direction="input" />
            ))}
            {data.outputs.map((port) => (
              <PortRow key={port.id} nodeId={element.getId()} port={port} direction="output" />
            ))}
            {data.inputs.length === 0 && data.outputs.length === 0 && (
              <p className="athanor-card__empty">No external ports</p>
            )}
          </div>
        )}
      </article>
    </foreignObject>
  );
});
