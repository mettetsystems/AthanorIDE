/** Hit-test a port row or workflow handle from a pointer event. */
export type PortHit = {
  nodeId: string;
  portId: string;
  direction: "input" | "output";
};

export function portFromTarget(target: EventTarget | null): PortHit | null {
  if (!(target instanceof Element)) return null;
  const row = target.closest("[data-port-id]");
  if (!(row instanceof HTMLElement)) return null;
  const nodeId = row.dataset.portNode;
  const portId = row.dataset.portId;
  const direction = row.dataset.portDirection;
  if (!nodeId || !portId || (direction !== "input" && direction !== "output")) return null;
  return { nodeId, portId, direction };
}

export function portFromPoint(x: number, y: number): PortHit | null {
  const stack = document.elementsFromPoint(x, y);
  for (const item of stack) {
    const hit = portFromTarget(item);
    if (hit) return hit;
  }
  return null;
}
