"use client";

/**
 * Left sidebar node library with two-click add, docs, and compact mode.
 */
import { useEffect, useRef, useState } from "react";
import { listNodeDefinitions, isAgentStudioType } from "@athanor/node-definitions";
import {
  Alert,
  Button,
  Card,
  CardBody,
  SearchInput,
  Title,
} from "@patternfly/react-core";
import { AngleDownIcon, AngleRightIcon } from "@patternfly/react-icons";
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

import { McpImportPanel } from "./McpImportPanel";
import { SchemaImportPanel } from "./SchemaImportPanel";
import { serializeBlockTemplates } from "@/lib/block-templates";
import { useBlockTemplateStore } from "@/store/block-template-store";
import { useProjectStore } from "@/store/project-store";
import { useSelectionStore } from "@/store/selection-store";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";

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
  "badge-check": BadgeCheck,
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
} as const;

const CATEGORY_LABELS: Record<string, string> = {
  agents: "Agents & API tools",
  harnesses: "Harnesses",
  sandboxes: "Sandboxes",
  mcp: "MCP servers",
  foundation: "Inputs & wiring",
  "fine-tuning": "Fine-tuning",
  vision: "Vision",
  "multi-agent": "Multi-agent",
  enterprise: "Enterprise",
  "big-blocks": "Big Blocks",
};

export function NodePalette() {
  const [importMcp, setImportMcp] = useState(false);
  const [query, setQuery] = useState("");
  const [importSchemas, setImportSchemas] = useState(false);
  const templateFile = useRef<HTMLInputElement>(null);
  const templates = useBlockTemplateStore((state) => state.templates);
  const templateError = useBlockTemplateStore((state) => state.error);
  const hydrateTemplates = useBlockTemplateStore((state) => state.hydrate);
  const importTemplates = useBlockTemplateStore((state) => state.importJson);
  const removeTemplate = useBlockTemplateStore((state) => state.remove);
  const addTemplate = useProjectStore((state) => state.addTemplate);
  useEffect(() => { hydrateTemplates(); }, [hydrateTemplates]);
  const addNode = useProjectStore((state) => state.addNode);
  const focusNode = useSelectionStore((state) => state.focusNode);
  const compact = useUiPreferencesStore((state) => state.paletteCompact);
  const toggleCompact = useUiPreferencesStore((state) => state.togglePaletteCompact);
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<readonly string[]>([]);
  const definitions = listNodeDefinitions().filter(
    (definition) =>
      isAgentStudioType(definition.type) &&
      `${definition.displayName} ${definition.description}`.toLowerCase().includes(query.toLowerCase()),
  );

  const alternativeCount = (category: "harnesses" | "sandboxes") =>
    listNodeDefinitions().filter(
      (definition) =>
        isAgentStudioType(definition.type) &&
        definition.category === category &&
        definition.type !== "sandbox.policy",
    ).length;

  const grouped = definitions.reduce<Record<string, Array<(typeof definitions)[number]>>>(
    (acc, definition) => {
      const list = acc[definition.category] ?? [];
      list.push(definition);
      acc[definition.category] = list;
      return acc;
    },
    {},
  );

  const placeNode = (type: string) => {
    const id = addNode(type, {
      x: 80 + Math.random() * 80,
      y: 80 + Math.random() * 120,
    });
    focusNode(id);
    setPendingType(null);
  };

  const onPaletteClick = (type: string) => {
    if (pendingType === type) {
      placeNode(type);
      return;
    }
    setPendingType(type);
  };

  const toggleDescription = (type: string) => {
    setExpandedDescriptions((prev) => {
      if (prev.includes(type)) return prev.filter((item) => item !== type);
      const next = [...prev, type];
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });
  };

  return (
    <aside aria-label="Node palette" className="editor-scroll">
      <Title headingLevel="h2">Agent block library</Title>
      <p>
        {compact
          ? "Names only — for proficient users. Click twice to place."
          : "Descriptions collapsed by default. Expand with the chevron (max 3 open). Click twice to place."}
      </p>
      <Button
        variant={compact ? "primary" : "secondary"}
        aria-pressed={compact}
        onClick={toggleCompact}
        title={compact ? "Show full two-paragraph guides" : "Compact mode for proficient users (names only)"}
      >
        {compact ? "Compact" : "Full"}
      </Button>
      {pendingType && (
        <Alert variant="info" isInline title="Selected — click again to place on canvas">
          <Button variant="link" isInline onClick={() => setPendingType(null)}>Cancel</Button>
        </Alert>
      )}
      <Button variant="secondary" onClick={() => setImportMcp(true)}>Import MCP servers</Button>
      {importMcp && <McpImportPanel onClose={() => setImportMcp(false)} />}
      <Button variant="secondary" onClick={() => setImportSchemas(true)}>Import OpenAPI / JSON Schema</Button>
      {importSchemas && <SchemaImportPanel onClose={() => setImportSchemas(false)} />}
      <SearchInput
        aria-label="Search blocks"
        placeholder="Search blocks…"
        value={query}
        onChange={(_event, value) => setQuery(value)}
        onClear={() => setQuery("")}
      />
      <section>
        <Title headingLevel="h3">My blocks</Title>
        <Button variant="secondary" onClick={() => placeNode("agent.custom_tool")}>+ Custom API block</Button>
        <Button variant="secondary" onClick={() => templateFile.current?.click()}>Import templates</Button>
        <Button
          variant="secondary"
          isDisabled={!templates.length}
          onClick={() => {
            const url = URL.createObjectURL(new Blob([serializeBlockTemplates(templates)], { type: "application/json" }));
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "athanor-blocks.json";
            anchor.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export templates
        </Button>
        <input
          ref={templateFile}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Import block templates"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) {
              try { importTemplates(await file.text()); }
              catch { useBlockTemplateStore.setState({ error: "Could not read this template file." }); }
            }
            event.target.value = "";
          }}
        />
        {templateError && <Alert variant="danger" isInline title={templateError} />}
        {!templates.length && (
          <p>Configure a block, apply changes, then save it as a template in the inspector.</p>
        )}
        {templates.filter((template) => template.name.toLowerCase().includes(query.toLowerCase())).map((template) => (
          <Card key={template.id}>
            <CardBody>
              <Button variant="link" onClick={() => focusNode(addTemplate(template))}>{template.name}</Button>
              <Button variant="plain" aria-label={`Remove ${template.name} template`} onClick={() => removeTemplate(template.id)}>×</Button>
            </CardBody>
          </Card>
        ))}
      </section>
      {!definitions.length && <p>No matching blocks.</p>}
      {Object.entries(grouped).map(([category, items]) => (
        <section key={category}>
          <Title headingLevel="h3">
            {category === "harnesses" || category === "sandboxes"
              ? `${CATEGORY_LABELS[category]} · ${alternativeCount(category)} alternatives`
              : (CATEGORY_LABELS[category] ?? category)}
          </Title>
          <ul>
            {items.map((definition) => {
              const Icon = ICONS[definition.icon as keyof typeof ICONS] ?? Type;
              const selected = pendingType === definition.type;
              const docsId = `palette-docs-${definition.type.replace(/\./g, "-")}`;
              const descriptionExpanded = !compact && expandedDescriptions.includes(definition.type);
              return (
                <li key={definition.type}>
                  <Card isCompact isSelected={selected}>
                    <CardBody>
                      {!compact && (
                        <Button
                          variant="plain"
                          aria-expanded={descriptionExpanded}
                          aria-controls={docsId}
                          title={descriptionExpanded ? "Collapse description" : "Expand description"}
                          icon={descriptionExpanded ? <AngleDownIcon /> : <AngleRightIcon />}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleDescription(definition.type);
                          }}
                        />
                      )}
                      <Button
                        variant="plain"
                        aria-pressed={selected}
                        onClick={() => onPaletteClick(definition.type)}
                      >
                        <Icon aria-hidden width={16} height={16} />
                        <span>{definition.displayName}</span>
                      </Button>
                      {descriptionExpanded && (
                        <div id={docsId}>
                          <p>{definition.description}</p>
                          <p>{definition.documentation}</p>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </aside>
  );
}
