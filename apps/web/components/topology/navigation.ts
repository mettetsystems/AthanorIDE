/**
 * Pan, zoom, and coordinate conversion for the topology surface.
 * Wheel pans. Ctrl+wheel zooms. Space+drag and middle-mouse drag pan.
 */
import { Point, type Graph } from "@patternfly/react-topology";

let spacePan = false;

export function isSpacePan(): boolean {
  return spacePan;
}

export function centerGraph(graph: Graph, x: number, y: number, minScale: number): void {
  const scale = Math.min(graph.getScaleExtent()[1], Math.max(graph.getScale(), minScale));
  const { width, height } = graph.getDimensions();
  graph.setScale(scale);
  graph.setPosition(new Point(width / 2 - x * scale, height / 2 - y * scale));
}

export function clientToGraph(
  graph: Graph,
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const { x, y } = graph.getPosition();
  const scale = graph.getScale() || 1;
  return {
    x: (clientX - rect.left - x) / scale,
    y: (clientY - rect.top - y) / scale,
  };
}

export function bindAthanorNavigation(svg: SVGSVGElement, graph: Graph): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.code !== "Space") return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }
    spacePan = event.type === "keydown";
    if (event.type === "keydown") event.preventDefault();
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code === "Space") spacePan = false;
  };
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (event.ctrlKey) {
      const rect = svg.getBoundingClientRect();
      graph.scaleBy(event.deltaY < 0 ? 1.08 : 1 / 1.08, new Point(event.clientX - rect.left, event.clientY - rect.top));
      return;
    }
    const position = graph.getPosition();
    graph.setPosition(new Point(position.x - event.deltaX, position.y - event.deltaY));
  };
  let panning = false;
  let last = { x: 0, y: 0 };
  const onPointerDown = (event: PointerEvent) => {
    const middle = event.button === 1;
    const spaceLeft = spacePan && event.button === 0;
    if (!middle && !spaceLeft) return;
    panning = true;
    last = { x: event.clientX, y: event.clientY };
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!panning) return;
    const position = graph.getPosition();
    graph.setPosition(new Point(position.x + event.clientX - last.x, position.y + event.clientY - last.y));
    last = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = () => {
    panning = false;
  };
  const clearSpace = () => {
    spacePan = false;
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearSpace);
  svg.addEventListener("wheel", onWheel, { passive: false });
  svg.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  return () => {
    spacePan = false;
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", clearSpace);
    svg.removeEventListener("wheel", onWheel);
    svg.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };
}
