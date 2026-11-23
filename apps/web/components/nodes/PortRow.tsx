"use client";

/**
 * Port row with contract badge, hover tooltip, and live compatibility highlighting.
 */
import type { PointerEvent } from "react";
import {
  CONTRACT_TYPE_LABELS,
  areContractsCompatible,
  type ContractType,
  type NodePort,
} from "@athanor/contracts";

import { useProjectStore } from "@/store/project-store";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";
import { portLinked } from "@/lib/workflow";
import { cn } from "@/lib/cn";
import {
  useConnectionDraftStore,
  type ConnectionDraft,
} from "@/store/connection-draft-store";

export function portTitle(port: NodePort, direction: "input" | "output"): string {
  const label = CONTRACT_TYPE_LABELS[port.contractType];
  const req = port.required ? "Required" : "Optional";
  if (direction === "input") {
    const accepts = port.contractType === "ANY"
      ? "Accepts outputs of any contract type."
      : `Accepts ${label} outputs only. An Any output cannot connect to a typed input.`;
    return `Input “${port.name}” · ${label} · ${req}. ${accepts}`;
  }
  const connects = port.contractType === "ANY"
    ? "Connects only to Any inputs; it cannot satisfy a typed input."
    : `Connect to ${label} inputs or an Any input.`;
  return `Output “${port.name}” · ${label} · ${req}. ${connects}`;
}

function compatibilityForPort(
  draft: ConnectionDraft | null,
  nodeId: string,
  port: NodePort,
  direction: "input" | "output",
): "neutral" | "compatible" | "incompatible" | "origin" {
  if (!draft) return "neutral";
  if (draft.nodeId === nodeId && draft.handleId === port.id) return "origin";

  if (draft.handleType === "source") {
    if (direction !== "input") return "incompatible";
    return areContractsCompatible(draft.contractType, port.contractType)
      ? "compatible"
      : "incompatible";
  }

  if (direction !== "output") return "incompatible";
  return areContractsCompatible(port.contractType, draft.contractType)
    ? "compatible"
    : "incompatible";
}

type PortRowProps = {
  nodeId: string;
  port: NodePort;
  direction: "input" | "output";
  compact?: boolean;
  onPortPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
};

export function PortRow({ nodeId, port, direction, compact = false, onPortPointerDown }: PortRowProps) {
  const review = useUiPreferencesStore(s => s.workspaceRole === "security");
  const unused = useProjectStore(s => review && !portLinked(s.graph, nodeId, port.id));
  const draft = useConnectionDraftStore((state) => state.draft);
  const match = compatibilityForPort(draft, nodeId, port, direction);
  const label = CONTRACT_TYPE_LABELS[port.contractType];
  const isInput = direction === "input";

  return (
    <div
      className={cn(
        "athanor-port",
        unused && "athanor-port--unused",
        isInput ? "athanor-port--in" : "athanor-port--out",
        match === "incompatible" && draft ? "athanor-port--dim" : null,
        match === "compatible" && "athanor-port--compatible",
        match === "origin" && "athanor-port--origin",
      )}
      title={portTitle(port, direction)}
      data-port-id={port.id}
      data-port-node={nodeId}
      data-port-direction={direction}
    >
      {isInput && (
        <button
          type="button"
          className={cn("athanor-port__handle", "athanor-port__handle--in", match === "compatible" && "is-compatible")}
          aria-label={portTitle(port, direction)}
          onPointerDown={onPortPointerDown}
        />
      )}

      <span className={cn("athanor-port__dir", isInput ? "is-in" : "is-out")} aria-hidden="true">
        {isInput ? "IN" : "OUT"}
      </span>
      <span className="athanor-port__name">{port.name}</span>
      <span className={cn("athanor-port__contract", isInput ? "is-in" : "is-out")}>{label}</span>
      {unused && <span className="athanor-port__unused">unused</span>}
      {!compact && port.required === false && <span className="athanor-port__opt">opt</span>}

      {!isInput && (
        <button
          type="button"
          className={cn("athanor-port__handle", "athanor-port__handle--out", match === "compatible" && "is-compatible")}
          aria-label={portTitle(port, direction)}
          onPointerDown={onPortPointerDown}
        />
      )}

      <div className={cn("athanor-port__tip", isInput ? "is-in" : "is-out")} role="tooltip">
        <p className="athanor-port__tip-title">
          {isInput ? "Input" : "Output"} · {label}
        </p>
        <p>
          {isInput
            ? port.contractType === "ANY"
              ? "Connect any output contract here."
              : `Connect a ${label} output here. Any outputs do not match this typed input.`
            : port.contractType === "ANY"
              ? "Connect this only to an Any input."
              : `Connect this to a ${label} input or an Any input.`}
        </p>
        {port.required ? <p className="athanor-port__required">Required</p> : <p>Optional</p>}
        {match === "compatible" && <p className="athanor-port__ok">Compatible with current drag</p>}
        {match === "incompatible" && draft && <p className="athanor-port__bad">Not compatible with current drag</p>}
      </div>
    </div>
  );
}

export function contractBadgeLabel(type: ContractType): string {
  return CONTRACT_TYPE_LABELS[type];
}
