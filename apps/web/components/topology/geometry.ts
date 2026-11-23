/**
 * Card sizes and port anchors shared by the model mapper and the edge renderer.
 * Macro LOD collapses a card to a label; mid and micro keep a fixed port pitch.
 */
import type { LodLevel } from "@/lib/lod";

export const ARCH_WIDTH = 280;
export const ARCH_HEADER = 64;
export const PORT_ROW_HEIGHT = 28;
export const SECURITY_BANNER = 32;
export const MACRO_CARD_WIDTH = 220;

export type PortRef = { id: string };

export type CardMetrics = {
  inputs: PortRef[];
  outputs: PortRef[];
  securityTags?: string[];
  configuration?: Record<string, unknown>;
  payloadPreview?: string | null;
  description?: string;
};

function configLineCount(configuration: Record<string, unknown> | undefined): number {
  if (!configuration) return 0;
  return Object.entries(configuration).filter(
    ([key]) =>
      !key.startsWith("compile") &&
      key !== "compiledCode" &&
      key !== "compiledSpec",
  ).length;
}

export function architectureCardSize(
  card: CardMetrics,
  lod: LodLevel,
): { width: number; height: number } {
  if (lod === "macro") return { width: 180, height: 52 };
  const ports = card.inputs.length + card.outputs.length;
  const security = card.securityTags?.length ? SECURITY_BANNER : 0;
  const micro =
    lod === "micro" && configLineCount(card.configuration) > 0
      ? 12 + Math.min(3, configLineCount(card.configuration)) * 14
      : 0;
  const payload = card.payloadPreview ? 40 : 0;
  const body = ports === 0 ? 24 : ports * PORT_ROW_HEIGHT;
  return {
    width: ARCH_WIDTH,
    height: ARCH_HEADER + security + body + micro + payload + 12,
  };
}

export function macroCardSize(card: CardMetrics, lod: LodLevel): { width: number; height: number } {
  if (lod === "macro") return { width: MACRO_CARD_WIDTH, height: 56 };
  const ports = card.inputs.length + card.outputs.length;
  const body = ports === 0 ? 24 : ports * PORT_ROW_HEIGHT;
  const description = card.description ? 8 : 0;
  return { width: MACRO_CARD_WIDTH, height: 52 + description + body + 12 };
}

/** Graph-space point where an edge should meet a port. */
export function portAnchor(
  origin: { x: number; y: number },
  size: { width: number; height: number },
  card: CardMetrics,
  portId: string,
  lod: LodLevel,
): { x: number; y: number } | null {
  if (portId === "bus-in") return { x: origin.x, y: origin.y + size.height / 2 };
  if (portId === "bus-out") return { x: origin.x + size.width, y: origin.y + size.height / 2 };
  const inputIndex = card.inputs.findIndex((port) => port.id === portId);
  const outputIndex = card.outputs.findIndex((port) => port.id === portId);
  if (lod === "macro") {
    if (inputIndex >= 0) return { x: origin.x, y: origin.y + size.height / 2 };
    if (outputIndex >= 0) return { x: origin.x + size.width, y: origin.y + size.height / 2 };
    return null;
  }
  const security = card.securityTags?.length ? SECURITY_BANNER : 0;
  if (inputIndex >= 0) {
    return {
      x: origin.x,
      y: origin.y + ARCH_HEADER + security + inputIndex * PORT_ROW_HEIGHT + PORT_ROW_HEIGHT / 2,
    };
  }
  if (outputIndex >= 0) {
    return {
      x: origin.x + size.width,
      y:
        origin.y +
        ARCH_HEADER +
        security +
        card.inputs.length * PORT_ROW_HEIGHT +
        outputIndex * PORT_ROW_HEIGHT +
        PORT_ROW_HEIGHT / 2,
    };
  }
  return null;
}
