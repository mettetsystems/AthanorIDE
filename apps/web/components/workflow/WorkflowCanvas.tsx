"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@patternfly/react-core";
import {
  DRAG_NODE_END_EVENT,
  DRAG_NODE_START_EVENT,
  GRAPH_POSITION_CHANGE_EVENT,
  Point,
  TopologyControlBar,
  TopologyView,
  Visualization,
  VisualizationProvider,
  VisualizationSurface,
  createTopologyControlButtons,
  defaultControlButtonsOptions,
  type Node,
} from "@patternfly/react-topology";
import { newId } from "@athanor/contracts";

import { componentFactory } from "@/components/topology/componentFactory";
import { portFromPoint, portFromTarget } from "@/components/topology/connect";
import { workflowModel } from "@/components/topology/model";
import { bindAthanorNavigation, centerGraph, clientToGraph } from "@/components/topology/navigation";
import { snap } from "@/components/topology/layers";
import { parseTaskFlowId, taskFlowId } from "@/lib/workflow";
import { useProjectStore } from "@/store/project-store";
import { useSelectionStore } from "@/store/selection-store";

export { parseTransitionFlowId, transitionFlowId } from "@/lib/workflow";

export function WorkflowCanvas() {
  const workflow = useProjectStore((state) => state.graph.workflow);
  const selectedEdgeIds = useSelectionStore((state) => state.selectedEdgeIds);
  const focusNodeId = useSelectionStore((state) => state.focusNodeId);
  const [drawing, setDrawing] = useState(false);
  const [rect, setRect] = useState<{ x: number; y: number; endX: number; endY: number } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const model = useMemo(() => workflowModel(workflow, selectedEdgeIds), [selectedEdgeIds, workflow]);
  const controllerRef = useRef<Visualization | null>(null);
  if (!controllerRef.current) {
    const created = new Visualization();
    created.registerComponentFactory(componentFactory);
    created.fromModel(model, false);
    created.getGraph().setDetailsLevelThresholds({ low: 0.349, medium: 0.999 });
    controllerRef.current = created;
  }
  const controller = controllerRef.current;

  useEffect(() => {
    if (dragging.current) return;
    controller.fromModel(model, true);
  }, [controller, model]);

  useEffect(() => {
    const viewport = useProjectStore.getState().graph.workflow.viewport;
    const surface = controller.getGraph();
    if (viewport.x === 0 && viewport.y === 0 && viewport.zoom === 1) {
      const frame = window.requestAnimationFrame(() => {
        surface.setScale(1);
        surface.fit(64);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    surface.setScale(viewport.zoom);
    surface.setPosition(new Point(viewport.x, viewport.y));
    return undefined;
  }, [controller]);

  useEffect(() => {
    const svg = hostRef.current?.querySelector("svg");
    if (!svg) return;
    return bindAthanorNavigation(svg, controller.getGraph());
  }, [controller]);

  useEffect(() => {
    let timer = 0;
    const onMove = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const surface = controller.getGraph();
        const position = surface.getPosition();
        useProjectStore.getState().mutateGraph(
          (graph) => ({
            ...graph,
            workflow: { ...graph.workflow, viewport: { x: position.x, y: position.y, zoom: surface.getScale() } },
          }),
          false,
        );
      }, 200);
    };
    controller.addEventListener(GRAPH_POSITION_CHANGE_EVENT, onMove);
    return () => {
      controller.removeEventListener(GRAPH_POSITION_CHANGE_EVENT, onMove);
      window.clearTimeout(timer);
    };
  }, [controller]);

  useEffect(() => {
    const onStart = () => {
      dragging.current = true;
      useProjectStore.getState().beginGesture();
    };
    const onEnd = (node: Node) => {
      dragging.current = false;
      const id = parseTaskFlowId(node.getId());
      if (!id) return;
      const position = node.getPosition();
      useProjectStore.getState().mutateGraph(
        (graph) => ({
          ...graph,
          workflow: {
            ...graph.workflow,
            tasks: graph.workflow.tasks.map((task) =>
              task.id === id ? { ...task, bounds: { ...task.bounds, x: snap(position.x), y: snap(position.y) } } : task,
            ),
          },
        }),
        false,
      );
    };
    controller.addEventListener(DRAG_NODE_START_EVENT, onStart);
    controller.addEventListener(DRAG_NODE_END_EVENT, onEnd);
    return () => {
      controller.removeEventListener(DRAG_NODE_START_EVENT, onStart);
      controller.removeEventListener(DRAG_NODE_END_EVENT, onEnd);
    };
  }, [controller]);

  useEffect(() => {
    const id = focusNodeId ? parseTaskFlowId(focusNodeId) : null;
    const task = workflow.tasks.find((item) => item.id === id);
    if (!task) return;
    centerGraph(controller.getGraph(), task.bounds.x + task.bounds.width / 2, task.bounds.y + task.bounds.height / 2, 1);
  }, [controller, focusNodeId, model, workflow.tasks]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,select")) return;
      const selection = useSelectionStore.getState();
      const ids = selection.selectedNodeIds.map(parseTaskFlowId).filter((id): id is string => Boolean(id));
      const store = useProjectStore.getState();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        ids.forEach((id) => store.cloneTask(id));
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        store.redo();
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        ids.forEach((id) => store.removeTask(id));
        const edgeIds = selection.selectedEdgeIds
          .map((id) => (id.startsWith("workflow-transition:") ? id.slice("workflow-transition:".length) : null))
          .filter((id): id is string => Boolean(id));
        if (edgeIds.length) {
          store.mutateGraph((graph) => ({
            ...graph,
            workflow: {
              ...graph.workflow,
              transitions: graph.workflow.transitions.filter((transition) => !edgeIds.includes(transition.id)),
            },
          }));
        }
        selection.clearSelection();
      }
      if (event.key === "Escape") {
        setDrawing(false);
        setRect(null);
        selection.clearSelection();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const buttons = useMemo(
    () => createTopologyControlButtons({
      ...defaultControlButtonsOptions,
      legend: false,
      zoomInCallback: () => controller.getGraph().scaleBy(1.2),
      zoomOutCallback: () => controller.getGraph().scaleBy(1 / 1.2),
      fitToScreenCallback: () => {
        controller.getGraph().setScale(1);
        controller.getGraph().fit(64);
      },
      resetViewCallback: () => {
        controller.getGraph().setScale(1);
        controller.getGraph().setPosition(new Point(0, 0));
      },
    }),
    [controller],
  );

  const connect = (sourceId: string | null, targetId: string) => {
    const current = useProjectStore.getState().graph.workflow;
    if (!targetId || sourceId === targetId) return;
    if (current.transitions.some((transition) => transition.sourceTaskId === sourceId && transition.targetTaskId === targetId)) return;
    const stage = sourceId === null
      ? 1
      : 1 + (current.transitions.find((transition) => transition.kind === "normal" && transition.targetTaskId === sourceId)?.stage ?? 1);
    const id = newId();
    useProjectStore.getState().mutateGraph((graph) => ({
      ...graph,
      workflow: {
        ...graph.workflow,
        transitions: [...graph.workflow.transitions, { id, sourceTaskId: sourceId, targetTaskId: targetId, kind: "normal" as const, stage, recoveryDescription: "" }],
      },
    }));
    useSelectionStore.getState().setSelection([], [`workflow-transition:${id}`]);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drawing) return;
    const hit = portFromTarget(event.target);
    if (!hit || hit.direction !== "output") return;
    const source = hit.nodeId === "workflow-start" ? null : parseTaskFlowId(hit.nodeId);
    if (source === null && hit.nodeId !== "workflow-start") return;
    event.stopPropagation();
    const move = (ev: PointerEvent) => {
      const host = hostRef.current?.getBoundingClientRect();
      if (!host) return;
      setRect({ x: event.clientX - host.left, y: event.clientY - host.top, endX: ev.clientX - host.left, endY: ev.clientY - host.top });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setRect(null);
      const drop = portFromPoint(ev.clientX, ev.clientY);
      const target = drop && drop.direction === "input" ? parseTaskFlowId(drop.nodeId) : null;
      if (target) connect(source, target);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div ref={hostRef} className="athanor-topology" onPointerDown={onPointerDown}>
      <VisualizationProvider controller={controller}>
        <TopologyView
          aria-label="Workflow canvas"
          contextToolbar={
            <div className="athanor-topology__actions">
              <Button
                variant="primary"
                onClick={() => {
                  const id = useProjectStore.getState().addTask();
                  useSelectionStore.getState().focusNode(taskFlowId(id));
                }}
              >
                Add task
              </Button>
              <Button variant={drawing ? "secondary" : "tertiary"} aria-pressed={drawing} onClick={() => setDrawing((value) => !value)}>
                {drawing ? "Cancel drawing" : "Draw task"}
              </Button>
            </div>
          }
          controlBar={<TopologyControlBar controlButtons={buttons} />}
        >
          <VisualizationSurface />
        </TopologyView>
      </VisualizationProvider>
      {drawing && (
        <div
          className="athanor-topology__draw"
          role="application"
          aria-label="Draw task area"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const box = event.currentTarget.getBoundingClientRect();
            const origin = { x: event.clientX, y: event.clientY };
            setRect({ x: event.clientX - box.left, y: event.clientY - box.top, endX: event.clientX - box.left, endY: event.clientY - box.top });
            const move = (ev: PointerEvent) => {
              setRect((current) => current && {
                ...current,
                endX: ev.clientX - box.left,
                endY: ev.clientY - box.top,
              });
            };
            const up = (ev: PointerEvent) => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
              const svg = hostRef.current?.querySelector("svg");
              if (svg) {
                const a = clientToGraph(controller.getGraph(), svg, origin.x, origin.y);
                const b = clientToGraph(controller.getGraph(), svg, ev.clientX, ev.clientY);
                const id = useProjectStore.getState().addTask({
                  x: Math.min(a.x, b.x),
                  y: Math.min(a.y, b.y),
                  width: Math.max(280, Math.abs(a.x - b.x)),
                  height: Math.max(300, Math.abs(a.y - b.y)),
                });
                useSelectionStore.getState().setSelection([taskFlowId(id)]);
              }
              setRect(null);
              setDrawing(false);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          {rect && (
            <div
              className="athanor-topology__rubber"
              style={{
                left: Math.min(rect.x, rect.endX),
                top: Math.min(rect.y, rect.endY),
                width: Math.abs(rect.endX - rect.x),
                height: Math.abs(rect.endY - rect.y),
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
