"use client";

import { getNodeDefinition } from "@athanor/node-definitions";
import {
  NodeStatus,
  isNode,
  observer,
  type GraphElement,
} from "@patternfly/react-topology";
import CheckCircleIcon from "@patternfly/react-icons/dist/esm/icons/check-circle-icon";
import ExclamationCircleIcon from "@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon";
import ExclamationTriangleIcon from "@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon";
import {
  AudioLines,
  BadgeCheck,
  Bot,
  Boxes,
  Braces,
  Clapperboard,
  Code2,
  Cpu,
  Cylinder,
  Database,
  Eye,
  FileText,
  Fingerprint,
  GitFork,
  Globe,
  HardDrive,
  Headphones,
  Image,
  Images,
  KeyRound,
  Layers,
  LogIn,
  LogOut,
  MessageCircle,
  MessageSquare,
  Mic,
  Network,
  Scan,
  ScanEye,
  ScrollText,
  Server,
  Shield,
  Sparkles,
  Type,
  Variable,
  Video,
  WandSparkles,
  Wrench,
} from "lucide-react";

import { PortRow } from "@/components/nodes/PortRow";
import { lodFromZoom } from "@/lib/lod";
import { useSelectionStore } from "@/store/selection-store";

import type { ArchitectureNodeData } from "../model";
import { useCardDrag } from "./drag";

const ICONS = {
  type: Type,
  "code-2": Code2,
  eye: Eye,
  "log-in": LogIn,
  "log-out": LogOut,
  braces: Braces,
  "message-square": MessageSquare,
  globe: Globe,
  variable: Variable,
  "key-round": KeyRound,
  database: Database,
  sparkles: Sparkles,
  image: Image,
  scan: Scan,
  "scan-eye": ScanEye,
  bot: Bot,
  wrench: Wrench,
  server: Server,
  shield: Shield,
  "scroll-text": ScrollText,
  fingerprint: Fingerprint,
  network: Network,
  "git-fork": GitFork,
  "wand-sparkles": WandSparkles,
  "hard-drive": HardDrive,
  "message-circle": MessageCircle,
  images: Images,
  cpu: Cpu,
  mic: Mic,
  "audio-lines": AudioLines,
  video: Video,
  headphones: Headphones,
  layers: Layers,
  clapperboard: Clapperboard,
  "file-text": FileText,
  cylinder: Cylinder,
  boxes: Boxes,
  "badge-check": BadgeCheck,
} as const;

function HealthIcon({ status }: { status: NodeStatus }) {
  if (status === NodeStatus.danger) return <ExclamationCircleIcon className="athanor-health is-danger" />;
  if (status === NodeStatus.warning) return <ExclamationTriangleIcon className="athanor-health is-warning" />;
  if (status === NodeStatus.success) return <CheckCircleIcon className="athanor-health is-success" />;
  return <span className="athanor-health is-unknown" aria-hidden />;
}

export const ArchitectureNodeView = observer(function ArchitectureNodeView({
  element,
}: {
  element: GraphElement;
}) {
  const [, dragRef] = useCardDrag();
  if (!isNode(element)) return null;
  const data = element.getData() as ArchitectureNodeData;
  const { width, height } = element.getDimensions();
  const lod = lodFromZoom(element.getGraph().getScale());
  const selected = useSelectionStore((state) => state.selectedNodeIds.includes(element.getId()));
  const definition = getNodeDefinition(data.nodeType);
  const iconKey = (definition?.icon ?? "type") as keyof typeof ICONS;
  const Icon = ICONS[iconKey] ?? Type;
  const select = (event: { shiftKey: boolean; stopPropagation: () => void }) => {
    event.stopPropagation();
    const current = useSelectionStore.getState().selectedNodeIds;
    const next = event.shiftKey ? [...new Set([...current, element.getId()])] : [element.getId()];
    useSelectionStore.getState().setSelection(next, []);
  };
  return (
    <foreignObject width={width} height={height} className="athanor-fo">
      <article
        {...{ xmlns: "http://www.w3.org/1999/xhtml" }}
        className={[
          "athanor-card",
          lod === "macro" ? "is-macro" : "",
          selected ? "is-selected" : "",
          data.securityTags.length ? "is-security" : "",
        ].filter(Boolean).join(" ")}
        aria-label={`${data.name} node`}
        onClick={select}
      >
        <header ref={dragRef} className="athanor-card__header">
          <HealthIcon status={element.getNodeStatus()} />
          <Icon className="athanor-card__icon" aria-hidden />
          <div className="athanor-card__titles">
            <h3>{data.name}</h3>
            {lod !== "macro" && <p>{definition?.displayName ?? data.nodeType}</p>}
            {data.deploymentLabel && <p className="athanor-card__deploy">{data.deploymentLabel}</p>}
            {data.busId && lod !== "macro" && <p className="athanor-card__bus">bus:{data.busId}</p>}
          </div>
        </header>
        {lod !== "macro" && data.securityTags.length > 0 && (
          <p className="athanor-card__security">{data.securityTags.join(" · ")}</p>
        )}
        {lod !== "macro" && (
          <div className="athanor-card__ports">
            {data.inputs.map((port) => (
              <PortRow
                key={port.id}
                nodeId={element.getId()}
                port={port}
                direction="input"
              />
            ))}
            {data.outputs.map((port) => (
              <PortRow
                key={port.id}
                nodeId={element.getId()}
                port={port}
                direction="output"
              />
            ))}
            {data.inputs.length === 0 && data.outputs.length === 0 && <p className="athanor-card__empty">No ports</p>}
            {lod === "micro" && (
              <div className="athanor-card__config">
                {Object.entries(data.configuration)
                  .filter(([key]) => !key.startsWith("compile") && key !== "compiledCode" && key !== "compiledSpec")
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <p key={key}>
                      <span>{key}:</span> {typeof value === "string" ? value : JSON.stringify(value)}
                    </p>
                  ))}
              </div>
            )}
            {data.payloadPreview && (
              <div className="athanor-card__payload">
                <p>Last payload{data.executionStatus ? ` · ${data.executionStatus}` : ""}</p>
                <p>{data.payloadPreview}</p>
              </div>
            )}
          </div>
        )}
      </article>
    </foreignObject>
  );
});
