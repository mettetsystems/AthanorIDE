"use client";

/**
 * PatternFly topology canvas: author-placed nodes, port connections, and overlays.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AlertActionCloseButton,
} from "@patternfly/react-core";
import {
  DRAG_NODE_END_EVENT,
  DRAG_NODE_EVENT,
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
import type { ContractType } from "@athanor/contracts";

import { componentFactory } from "@/components/topology/componentFactory";
import { portFromPoint, portFromTarget } from "@/components/topology/connect";
import { architectureModel } from "@/components/topology/model";
import { bindAthanorNavigation, centerGraph, clientToGraph } from "@/components/topology/navigation";
import { snap } from "@/components/topology/layers";
import { lodFromZoom, lodLabel, type LodLevel } from "@/lib/lod";
import { macroFlowId, parseMacroFlowId } from "@/lib/macros";
import { parseSwimlaneFlowId } from "@/lib/swimlanes";
import { evaluateConnection } from "@/lib/graph-utils";
import { parseTaskFlowId } from "@/lib/workflow";
import { useConnectionDraftStore } from "@/store/connection-draft-store";
import { usePendingDeleteStore } from "@/store/pending-delete-store";
import { useProjectStore } from "@/store/project-store";
import { useSelectionStore } from "@/store/selection-store";
import { useValidationStore } from "@/store/validation-store";
import { useExecutionStore } from "@/store/execution-store";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";

const REJECTED = "That connection was not accepted. Connect an output to a compatible input; the port labels show the supported data types.";

type DragEventLike = { dx: number; dy: number };

export function ArchitectureCanvas() {
  const graph = useProjectStore((state) => state.graph);
  const issues = useValidationStore((state) => state.issues);
  const steps = useExecutionStore((state) => state.steps);
  const edgePayloads = useExecutionStore((state) => state.edgePayloads);
  const securityView = useUiPreferencesStore((state) => state.workspaceRole === "security");
  const selectedEdgeIds = useSelectionStore((state) => state.selectedEdgeIds);
  const focusNodeId = useSelectionStore((state) => state.focusNodeId);
  const focusEdgeId = useSelectionStore((state) => state.focusEdgeId);
  const connectionError = useProjectStore((state) => state.connectionError);
  const [lod, setLod] = useState<LodLevel>(() => lodFromZoom(graph.viewport.zoom));
  const [zoom, setZoom] = useState(graph.viewport.zoom);
  const [draftLine, setDraftLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const model = useMemo(
    () => architectureModel({
      graph,
      lod,
      selectedEdgeIds,
      focusEdgeId,
      issues,
      securityView,
      steps,
      edgePayloads,
    }),
    [edgePayloads, focusEdgeId, graph, issues, lod, securityView, selectedEdgeIds, steps],
  );
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
    const viewport = useProjectStore.getState().graph.viewport;
    const surface = controller.getGraph();
    surface.setDetailsLevelThresholds({ low: 0.349, medium: 0.999 });
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
    const host = hostRef.current;
    const svg = host?.querySelector("svg");
    if (!svg) return;
    return bindAthanorNavigation(svg, controller.getGraph());
  }, [controller]);

  useEffect(() => {
    let timer = 0;
    const onMove = () => {
      const surface = controller.getGraph();
      const nextLod = lodFromZoom(surface.getScale());
      setLod((current) => (current === nextLod ? current : nextLod));
      setZoom(surface.getScale());
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const position = surface.getPosition();
        const next = { x: position.x, y: position.y, zoom: surface.getScale() };
        const current = useProjectStore.getState().graph.viewport;
        if (current.x !== next.x || current.y !== next.y || current.zoom !== next.zoom) {
          useProjectStore.getState().setViewport(next);
        }
      }, 200);
    };
    controller.addEventListener(GRAPH_POSITION_CHANGE_EVENT, onMove);
    return () => {
      controller.removeEventListener(GRAPH_POSITION_CHANGE_EVENT, onMove);
      window.clearTimeout(timer);
    };
  }, [controller]);

  useEffect(() => {
    const starts = new Map<string, { x: number; y: number }>();
    const onStart = (node: Node) => {
      dragging.current = true;
      useProjectStore.getState().beginGesture();
      starts.clear();
      const selected = useSelectionStore.getState().selectedNodeIds;
      const ids = selected.includes(node.getId()) ? selected : [node.getId()];
      for (const id of ids) {
        const item = controller.getNodeById(id);
        if (!item) continue;
        const position = item.getPosition();
        starts.set(id, { x: position.x, y: position.y });
      }
    };
    const onDrag = (node: Node, event: DragEventLike) => {
      const taskId = parseTaskFlowId(node.getId());
      if (taskId) {
        for (const item of controller.getGraph().getNodes()) {
          const data = item.getData() as { workflowTaskId?: string } | undefined;
          if (data?.workflowTaskId !== taskId) continue;
          const position = item.getPosition();
          item.setPosition(new Point(position.x + event.dx, position.y + event.dy));
        }
      }
      if (starts.size < 2) return;
      for (const id of starts.keys()) {
        if (id === node.getId()) continue;
        const item = controller.getNodeById(id);
        if (!item) continue;
        const position = item.getPosition();
        item.setPosition(new Point(position.x + event.dx, position.y + event.dy));
      }
    };
    const onEnd = () => {
      dragging.current = false;
      const state = useProjectStore.getState();
      const movedGroups = new Set<string>();
      for (const id of starts.keys()) {
        const taskId = parseTaskFlowId(id);
        const item = controller.getNodeById(id);
        if (!taskId || !item) continue;
        movedGroups.add(taskId);
        const position = item.getPosition();
        state.moveTaskGroup(taskId, snap(position.x), snap(position.y));
      }
      for (const id of starts.keys()) {
        const item = controller.getNodeById(id);
        if (!item) continue;
        const position = item.getPosition();
        const laneId = parseSwimlaneFlowId(id);
        if (laneId) {
          const size = item.getDimensions();
          state.updateSwimlaneBounds(laneId, { x: snap(position.x), y: snap(position.y), width: size.width, height: size.height });
        }
        const macroId = parseMacroFlowId(id);
        if (macroId) state.updateMacroPosition(macroId, { x: snap(position.x), y: snap(position.y) });
      }
      const updates = [...starts.keys()]
        .filter((id) => !id.startsWith("macro:") && !id.startsWith("swimlane:") && !parseTaskFlowId(id))
        .filter((id) => {
          const owner = state.graph.nodes.find((node) => node.id === id)?.workflowTaskId;
          return !owner || !movedGroups.has(owner);
        })
        .map((id) => {
          const item = controller.getNodeById(id);
          const position = item?.getPosition();
          return { id, position: { x: snap(position?.x ?? 0), y: snap(position?.y ?? 0) } };
        });
      if (updates.length) {
        state.updateNodePositions(updates);
        state.assignNodesToSwimlanes(updates.map((item) => item.id));
      }
      starts.clear();
    };
    controller.addEventListener(DRAG_NODE_START_EVENT, onStart);
    controller.addEventListener(DRAG_NODE_EVENT, onDrag);
    controller.addEventListener(DRAG_NODE_END_EVENT, onEnd);
    return () => {
      controller.removeEventListener(DRAG_NODE_START_EVENT, onStart);
      controller.removeEventListener(DRAG_NODE_EVENT, onDrag);
      controller.removeEventListener(DRAG_NODE_END_EVENT, onEnd);
    };
  }, [controller]);

  useEffect(() => {
    if (!focusNodeId) return;
    const current = useProjectStore.getState().graph;
    const taskId = parseTaskFlowId(focusNodeId);
    const task = taskId ? current.workflow.tasks.find((item) => item.id === taskId) : undefined;
    if (task) {
      centerGraph(controller.getGraph(), task.engineeringBounds.x + task.engineeringBounds.width / 2, task.engineeringBounds.y + task.engineeringBounds.height / 2, 0.65);
      return;
    }
    const hidden = current.macroBlocks.find((macro) => macro.collapsed && macro.nodeIds.includes(focusNodeId));
    const targetId = hidden ? macroFlowId(hidden.id) : focusNodeId;
    const node = controller.getNodeById(targetId);
    if (!node) return;
    const bounds = node.getBounds();
    centerGraph(controller.getGraph(), bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, 0.9);
  }, [controller, focusNodeId, model]);

  useEffect(() => {
    if (!focusEdgeId) return;
    const edge = controller.getEdgeById(focusEdgeId);
    const source = edge?.getSource();
    const target = edge?.getTarget();
    if (!source || !target) return;
    const left = source.getBounds();
    const right = target.getBounds();
    centerGraph(
      controller.getGraph(),
      (left.x + left.width / 2 + right.x + right.width / 2) / 2,
      (left.y + left.height / 2 + right.y + right.height / 2) / 2,
      0.85,
    );
  }, [controller, focusEdgeId, model]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable || target.tagName === "SELECT")) return;
      const meta = event.metaKey || event.ctrlKey;
      const store = useProjectStore.getState();
      if (meta && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        store.undo();
        return;
      }
      if (meta && (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey))) {
        event.preventDefault();
        store.redo();
        return;
      }
      if (meta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        store.duplicateNodes(useSelectionStore.getState().selectedNodeIds.filter((id) => !id.startsWith("macro:")));
        return;
      }
      if (event.key === "Escape") {
        usePendingDeleteStore.getState().cancelDelete();
        useConnectionDraftStore.getState().clearDraft();
        useSelectionStore.getState().clearSelection();
        setDraftLine(null);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        const selection = useSelectionStore.getState();
        const nodeIds = [...new Set(selection.selectedNodeIds.flatMap((id) => {
          const macroId = parseMacroFlowId(id);
          if (macroId) return store.graph.macroBlocks.find((macro) => macro.id === macroId)?.nodeIds ?? [];
          return id.startsWith("swimlane:") ? [] : [id];
        }))];
        const edgeIds = selection.selectedEdgeIds.filter((id) => !id.startsWith("portal-bus-"));
        if (edgeIds.length > 0 && nodeIds.length === 0) {
          event.preventDefault();
          usePendingDeleteStore.getState().requestDelete([], edgeIds);
          return;
        }
        if (nodeIds.length) {
          event.preventDefault();
          usePendingDeleteStore.getState().requestDelete(nodeIds, edgeIds);
        }
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
        const surface = controller.getGraph();
        surface.setScale(1);
        surface.setPosition(new Point(0, 0));
      },
    }),
    [controller],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const hit = portFromTarget(event.target);
    if (hit) {
      if (hit.nodeId.startsWith("macro:") || hit.nodeId.startsWith("swimlane:") || hit.nodeId.startsWith("workflow-task:")) return;
      const node = useProjectStore.getState().graph.nodes.find((item) => item.id === hit.nodeId);
      const port = hit.direction === "output"
        ? node?.outputs.find((item) => item.id === hit.portId)
        : node?.inputs.find((item) => item.id === hit.portId);
      if (!node || !port) return;
      event.stopPropagation();
      const selectedEdge = useSelectionStore.getState().selectedEdgeIds[0];
      const existing = useProjectStore.getState().graph.edges.find((edge) => edge.id === selectedEdge);
      const reconnectEdgeId = existing && (
        (existing.sourceNodeId === hit.nodeId && existing.sourcePortId === hit.portId) ||
        (existing.targetNodeId === hit.nodeId && existing.targetPortId === hit.portId)
      ) ? existing.id : null;
      useConnectionDraftStore.getState().setDraft({
        nodeId: node.id,
        handleId: port.id,
        handleType: hit.direction === "output" ? "source" : "target",
        contractType: port.contractType,
      });
      const origin = { nodeId: node.id, portId: port.id, direction: hit.direction, contractType: port.contractType as ContractType, reconnectEdgeId };
      const move = (ev: PointerEvent) => {
        const rect = hostRef.current?.getBoundingClientRect();
        if (!rect) return;
        setDraftLine({ x1: event.clientX - rect.left, y1: event.clientY - rect.top, x2: ev.clientX - rect.left, y2: ev.clientY - rect.top });
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        setDraftLine(null);
        useConnectionDraftStore.getState().clearDraft();
        const drop = portFromPoint(ev.clientX, ev.clientY);
        finishConnection(origin, drop);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return;
    }
    const target = event.target as Element;
    if (event.button === 0 && target.tagName === "rect" && !target.closest("[data-kind='node']")) {
      const start = { x: event.clientX, y: event.clientY };
      const move = (ev: PointerEvent) => {
        const rect = hostRef.current?.getBoundingClientRect();
        if (!rect) return;
        setBox({ x: start.x - rect.left, y: start.y - rect.top, x2: ev.clientX - rect.left, y2: ev.clientY - rect.top });
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        setBox(null);
        const svg = hostRef.current?.querySelector("svg");
        if (!svg || Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
        const a = clientToGraph(controller.getGraph(), svg, start.x, start.y);
        const b = clientToGraph(controller.getGraph(), svg, ev.clientX, ev.clientY);
        const left = Math.min(a.x, b.x);
        const top = Math.min(a.y, b.y);
        const right = Math.max(a.x, b.x);
        const bottom = Math.max(a.y, b.y);
        const ids = controller.getGraph().getNodes()
          .filter((node) => !node.getId().startsWith("swimlane:"))
          .filter((node) => {
            const bounds = node.getBounds();
            return bounds.x < right && bounds.x + bounds.width > left && bounds.y < bottom && bounds.y + bounds.height > top;
          })
          .map((node) => node.getId());
        useSelectionStore.getState().setSelection(ids, []);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }
  };

  return (
    <div ref={hostRef} className="athanor-topology" onPointerDown={onPointerDown}>
      <VisualizationProvider controller={controller}>
        <TopologyView
          aria-label="Architecture canvas"
          viewToolbar={<span className="athanor-topology__meta">{lodLabel(lod)} · zoom {(zoom * 100).toFixed(0)}%</span>}
          contextToolbar={<span className="athanor-topology__meta">Scroll to pan · Space + drag or middle mouse to pan · Controls to zoom</span>}
          controlBar={<TopologyControlBar controlButtons={buttons} />}
        >
          <VisualizationSurface />
        </TopologyView>
      </VisualizationProvider>
      {draftLine && (
        <svg className="athanor-topology__overlay" aria-hidden>
          <line x1={draftLine.x1} y1={draftLine.y1} x2={draftLine.x2} y2={draftLine.y2} />
        </svg>
      )}
      {box && (
        <div
          className="athanor-topology__box"
          style={{
            left: Math.min(box.x, box.x2),
            top: Math.min(box.y, box.y2),
            width: Math.abs(box.x2 - box.x),
            height: Math.abs(box.y2 - box.y),
          }}
        />
      )}
      {connectionError && (
        <Alert className="athanor-topology__alert" variant="danger" title="Connection rejected" isInline actionClose={<AlertActionCloseButton onClose={() => useProjectStore.getState().clearConnectionError()} />}>
          {connectionError}
        </Alert>
      )}
    </div>
  );
}

function finishConnection(
  origin: { nodeId: string; portId: string; direction: "input" | "output"; reconnectEdgeId: string | null },
  drop: { nodeId: string; portId: string; direction: "input" | "output" } | null,
) {
  const store = useProjectStore.getState();
  if (!drop || drop.nodeId === origin.nodeId && drop.portId === origin.portId) return;
  if (drop.nodeId.startsWith("macro:") || drop.nodeId.startsWith("swimlane:") || origin.nodeId.startsWith("macro:")) {
    store.setConnectionError(REJECTED);
    return;
  }
  const forward = origin.direction === "output";
  const sourceNodeId = forward ? origin.nodeId : drop.nodeId;
  const sourcePortId = forward ? origin.portId : drop.portId;
  const targetNodeId = forward ? drop.nodeId : origin.nodeId;
  const targetPortId = forward ? drop.portId : origin.portId;
  if ((forward ? drop.direction : origin.direction) !== "input" || (forward ? origin.direction : drop.direction) !== "output") {
    store.setConnectionError(REJECTED);
    return;
  }
  const decision = evaluateConnection({
    nodes: store.graph.nodes,
    edges: store.graph.edges.filter((edge) => edge.id !== origin.reconnectEdgeId),
    sourceNodeId,
    sourcePortId,
    targetNodeId,
    targetPortId,
  });
  if (!decision.ok) {
    store.setConnectionError(decision.reason);
    return;
  }
  if (origin.reconnectEdgeId) {
    store.reconnectPorts(origin.reconnectEdgeId, { sourceNodeId, sourcePortId, targetNodeId, targetPortId });
    return;
  }
  store.connectPorts({ sourceNodeId, sourcePortId, targetNodeId, targetPortId });
}
