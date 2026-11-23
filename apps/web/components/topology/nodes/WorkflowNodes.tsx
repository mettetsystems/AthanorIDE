"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { Dimensions, isNode, observer, type GraphElement } from "@patternfly/react-topology";

import { BriefField } from "@/components/workflow/TaskNode";
import { parseTaskFlowId } from "@/lib/workflow";
import { useProjectStore } from "@/store/project-store";
import { useSelectionStore } from "@/store/selection-store";

import type { WorkflowNodeData } from "../model";
import { useCardDrag } from "./drag";

function selectNode(id: string, shiftKey: boolean) {
  const current = useSelectionStore.getState().selectedNodeIds;
  useSelectionStore.getState().setSelection(shiftKey ? [...new Set([...current, id])] : [id], []);
}

export const WorkflowTaskView = observer(function WorkflowTaskView({ element }: { element: GraphElement }) {
  const [, dragRef] = useCardDrag();
  if (!isNode(element)) return null;
  const data = element.getData() as WorkflowNodeData;
  const { width, height } = element.getDimensions();
  const taskId = data.taskId ?? parseTaskFlowId(element.getId()) ?? "";
  const task = useProjectStore((state) => state.graph.workflow.tasks.find((item) => item.id === taskId));
  const selected = useSelectionStore((state) => state.selectedNodeIds.includes(element.getId()));
  if (!task) return null;
  const resize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY, width: task.bounds.width, height: task.bounds.height };
    const scale = element.getGraph().getScale() || 1;
    const move = (ev: PointerEvent) => {
      const widthNext = Math.max(240, start.width + (ev.clientX - start.x) / scale);
      const heightNext = Math.max(180, start.height + (ev.clientY - start.y) / scale);
      element.setDimensions(new Dimensions(widthNext, heightNext));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      useProjectStore.getState().updateTask(task.id, {
        bounds: {
          ...task.bounds,
          width: Math.max(240, start.width + (ev.clientX - start.x) / scale),
          height: Math.max(180, start.height + (ev.clientY - start.y) / scale),
        },
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <foreignObject width={width} height={height} className="athanor-fo">
      <article
        {...{ xmlns: "http://www.w3.org/1999/xhtml" }}
        className={["athanor-flow", selected ? "is-selected" : ""].filter(Boolean).join(" ")}
        style={{ borderColor: task.color, width, height }}
        onClick={(event) => {
          event.stopPropagation();
          selectNode(element.getId(), event.shiftKey);
        }}
      >
        <header ref={dragRef} className="athanor-flow__title" style={{ background: task.color }}>
          {task.name}
        </header>
        <button type="button" className="athanor-port__handle athanor-port__handle--in athanor-flow__handle is-in" data-port-id="in" data-port-node={element.getId()} data-port-direction="input" aria-label="Task input" />
        <button type="button" className="athanor-port__handle athanor-port__handle--out athanor-flow__handle is-out" data-port-id="out" data-port-node={element.getId()} data-port-direction="output" aria-label="Task output" />
        <div className="athanor-flow__body">
          <BriefField label="Role" value={task.role} onSave={(role) => useProjectStore.getState().updateTask(task.id, { role })} />
          <BriefField label="Expected tasks" value={task.expectedTasks} onSave={(expectedTasks) => useProjectStore.getState().updateTask(task.id, { expectedTasks })} />
          <BriefField label="Functional constraints" value={task.constraints} onSave={(constraints) => useProjectStore.getState().updateTask(task.id, { constraints })} />
        </div>
        <button type="button" className="athanor-resize" aria-label="Resize task" onPointerDown={resize} />
      </article>
    </foreignObject>
  );
});

export const WorkflowStartView = observer(function WorkflowStartView({ element }: { element: GraphElement }) {
  if (!isNode(element)) return null;
  const { width, height } = element.getDimensions();
  const selected = useSelectionStore((state) => state.selectedNodeIds.includes(element.getId()));
  return (
    <foreignObject width={width} height={height} className="athanor-fo">
      <div {...{ xmlns: "http://www.w3.org/1999/xhtml" }} className={["athanor-pill", selected ? "is-selected" : ""].filter(Boolean).join(" ")} onClick={(event) => { event.stopPropagation(); selectNode(element.getId(), event.shiftKey); }}>
        Start
        <button type="button" className="athanor-port__handle athanor-port__handle--out athanor-flow__handle is-out" data-port-id="out" data-port-node={element.getId()} data-port-direction="output" aria-label="Start output" />
      </div>
    </foreignObject>
  );
});

export const WorkflowEndView = observer(function WorkflowEndView({ element }: { element: GraphElement }) {
  if (!isNode(element)) return null;
  const { width, height } = element.getDimensions();
  return (
    <foreignObject width={width} height={height} className="athanor-fo">
      <div {...{ xmlns: "http://www.w3.org/1999/xhtml" }} className="athanor-pill is-end" title="Workflow completes after all normal branches finish. Recovery results resume their original branch.">
        End
        <span className="athanor-port__handle athanor-port__handle--in athanor-flow__handle is-in" data-port-id="in" data-port-node={element.getId()} data-port-direction="input" />
      </div>
    </foreignObject>
  );
});
