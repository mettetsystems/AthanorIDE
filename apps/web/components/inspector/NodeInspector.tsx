"use client";

/**
 * Right sidebar: node configuration forms, compile actions, and delete initiation.
 */
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { getNodeDefinition } from "@athanor/node-definitions";
import {
  Alert,
  Button,
  Card,
  CardBody,
  ExpandableSection,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextArea,
  TextInput,
  Title,
} from "@patternfly/react-core";

import { ToolSchemaEditor } from "./ToolSchemaEditor";
import { useBlockTemplateStore } from "@/store/block-template-store";
import { compileTransformation } from "@/lib/compiler";
import { findLinkedPortalNodes, isPortalNode, portalBusId } from "@/lib/portals";
import { useProjectStore } from "@/store/project-store";
import { usePendingDeleteStore } from "@/store/pending-delete-store";
import { useSelectionStore } from "@/store/selection-store";

type InspectorFormValues = {
  name: string;
  configuration: Record<string, string>;
};

export function NodeInspector() {
  const saveTemplate = useBlockTemplateStore((state) => state.save);
  const templateError = useBlockTemplateStore((state) => state.error);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const selectedNodeIds = useSelectionStore((state) => state.selectedNodeIds);
  const selectedEdgeIds = useSelectionStore((state) => state.selectedEdgeIds);
  const focusNode = useSelectionStore((state) => state.focusNode);
  const graph = useProjectStore((state) => state.graph);
  const nodes = graph.nodes;
  const edges = graph.edges;
  const addNode = useProjectStore((state) => state.addNode);
  const updateNodeConfiguration = useProjectStore((state) => state.updateNodeConfiguration);
  const updateNodeName = useProjectStore((state) => state.updateNodeName);
  const updateNodeDeploymentTarget = useProjectStore((state) => state.updateNodeDeploymentTarget);
  const setMacroCollapsed = useProjectStore((state) => state.setMacroCollapsed);
  const disconnect = useProjectStore((state) => state.deleteSelection);
  const requestDelete = usePendingDeleteStore((state) => state.requestDelete);
  const [compiling, setCompiling] = useState(false);
  const [compileMessage, setCompileMessage] = useState<string | null>(null);

  const realSelectedIds = selectedNodeIds.filter(
    (id) => !id.startsWith("macro:") && !id.startsWith("swimlane:"),
  );

  const node = useMemo(
    () => (realSelectedIds.length === 1 ? nodes.find((item) => item.id === realSelectedIds[0]) : undefined),
    [nodes, realSelectedIds],
  );

  const selectedMacro = useMemo(() => {
    if (selectedNodeIds.length !== 1) return undefined;
    const id = selectedNodeIds[0]!;
    if (!id.startsWith("macro:")) return undefined;
    const macroId = id.slice("macro:".length);
    return graph.macroBlocks.find((macro) => macro.id === macroId);
  }, [graph.macroBlocks, selectedNodeIds]);

  const definition = node ? getNodeDefinition(node.type) : undefined;
  const linkedPortals = node ? findLinkedPortalNodes(nodes, node.id) : [];
  const deploymentLane = node?.deploymentTarget
    ? graph.deploymentEnvironments.find((lane) => lane.id === node.deploymentTarget)
    : undefined;

  const compiledCode = typeof node?.configuration.compiledCode === "string" ? node.configuration.compiledCode : null;
  const compileStatus = typeof node?.configuration.compileStatus === "string" ? node.configuration.compileStatus : null;

  const primaryFields = useMemo(
    () => definition?.configurationFields.filter((field) => !field.advanced) ?? [],
    [definition],
  );
  const advancedFields = useMemo(
    () => definition?.configurationFields.filter((field) => field.advanced) ?? [],
    [definition],
  );

  const formValues = useMemo<InspectorFormValues>(() => {
    if (!node || !definition) return { name: "", configuration: {} };
    const configuration: Record<string, string> = {};
    for (const field of definition.configurationFields) {
      const value = node.configuration[field.key];
      configuration[field.key] = typeof value === "string" ? value : String(value ?? field.defaultValue ?? "");
    }
    return { name: node.name, configuration };
  }, [definition, node]);

  const { register, handleSubmit, reset, getValues, watch, setValue, formState: { errors } } = useForm<InspectorFormValues>({
    values: formValues,
  });
  const watchedConfiguration = watch("configuration");

  const fieldVisible = (field: NonNullable<typeof definition>["configurationFields"][number]): boolean => {
    if (!field.showWhen) return true;
    const current = watchedConfiguration?.[field.showWhen.key] ?? "";
    const expected = field.showWhen.equals;
    return Array.isArray(expected) ? expected.includes(current) : current === expected;
  };

  useEffect(() => {
    reset(formValues);
  }, [formValues, reset]);

  const renderConfigField = (field: NonNullable<typeof definition>["configurationFields"][number]) => {
    if (!fieldVisible(field)) return null;
    if (field.key === "instructions" && node?.workflowTaskId && node.instructionMode !== "override") return null;
    return (
      <FormGroup key={field.key} label={field.label} fieldId={`config-${field.key}`}>
        <p>{field.description}</p>
        {field.type === "schema" ? (
          <ToolSchemaEditor
            value={watchedConfiguration?.[field.key] ?? String(field.defaultValue)}
            onChange={(value) => setValue(`configuration.${field.key}`, value, { shouldDirty: true })}
          />
        ) : field.type === "text" ? (
          <TextArea
            id={`config-${field.key}`}
            aria-label={field.label}
            rows={5}
            {...register(`configuration.${field.key}`, { required: field.required })}
          />
        ) : field.type === "select" && field.options ? (
          <FormSelect
            id={`config-${field.key}`}
            aria-label={field.label}
            {...register(`configuration.${field.key}`, { required: field.required })}
          >
            {field.options.map((option) => (
              <FormSelectOption key={option} value={option} label={option} />
            ))}
          </FormSelect>
        ) : field.type === "boolean" ? (
          <FormSelect
            id={`config-${field.key}`}
            aria-label={field.label}
            {...register(`configuration.${field.key}`, { required: field.required })}
          >
            <FormSelectOption value="true" label="true" />
            <FormSelectOption value="false" label="false" />
          </FormSelect>
        ) : (
          <TextInput
            id={`config-${field.key}`}
            type={field.type === "number" ? "number" : "text"}
            aria-label={field.label}
            {...register(`configuration.${field.key}`, { required: field.required })}
          />
        )}
        {field.recommendedDefaultExplanation && <p>Tip: {field.recommendedDefaultExplanation}</p>}
        {errors.configuration?.[field.key] && (
          <Alert variant="danger" isInline isPlain title="This field is required." />
        )}
      </FormGroup>
    );
  };

  const selectedConnections = useMemo(
    () =>
      selectedEdgeIds
        .filter((id) => !id.startsWith("portal-bus-"))
        .map((id) => edges.find((edge) => edge.id === id))
        .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge)),
    [edges, selectedEdgeIds],
  );

  if (selectedMacro) {
    return (
      <aside aria-label="Node inspector">
        <Title headingLevel="h2">{selectedMacro.name}</Title>
        <p>{selectedMacro.description ?? "Collapsed macro block"}</p>
        <p>
          Contains {selectedMacro.nodeIds.length} node(s) with {selectedMacro.inputs.length} external input(s) and {selectedMacro.outputs.length} external output(s).
        </p>
        <Button variant="primary" onClick={() => setMacroCollapsed(selectedMacro.id, false)}>
          Expand macro
        </Button>
      </aside>
    );
  }

  if (realSelectedIds.length === 0 && selectedConnections.length > 0) {
    return (
      <aside aria-label="Connection inspector">
        <Title headingLevel="h2">Connection</Title>
        <p>
          {selectedConnections.length === 1
            ? "Selected wire — delete removes only this connection, not the nodes."
            : `${selectedConnections.length} connections selected — delete removes only these wires.`}
        </p>
        <ul>
          {selectedConnections.map((edge) => {
            const source = nodes.find((item) => item.id === edge.sourceNodeId);
            const target = nodes.find((item) => item.id === edge.targetNodeId);
            const sourcePort = source?.outputs.find((port) => port.id === edge.sourcePortId);
            const targetPort = target?.inputs.find((port) => port.id === edge.targetPortId);
            return (
              <li key={edge.id}>
                <Card>
                  <CardBody>
                    <p>{source?.name ?? edge.sourceNodeId} → {target?.name ?? edge.targetNodeId}</p>
                    <p>
                      {sourcePort?.name ?? edge.sourcePortId} ({sourcePort?.contractType ?? "?"}) → {targetPort?.name ?? edge.targetPortId} ({targetPort?.contractType ?? "?"})
                    </p>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
        <Button variant="danger" onClick={() => disconnect([], selectedConnections.map((edge) => edge.id))}>
          Disconnect{selectedConnections.length === 1 ? " connection" : " connections"}
        </Button>
      </aside>
    );
  }

  if (realSelectedIds.length > 1) {
    return (
      <aside aria-label="Node inspector">
        <Title headingLevel="h2">Inspector</Title>
        <p>{realSelectedIds.length} nodes selected. Use Collapse macro in the toolbar to group them.</p>
        <Button variant="danger" onClick={() => requestDelete(realSelectedIds, [])}>Delete selected…</Button>
      </aside>
    );
  }

  if (!node || !definition) {
    return (
      <aside aria-label="Node inspector">
        <Title headingLevel="h2">Inspector</Title>
        <p>
          Select a node to edit configuration, or click a connection (wire) to delete it without removing its nodes. Press Delete/Backspace, then confirm here.
        </p>
      </aside>
    );
  }

  return (
    <aside aria-label="Node inspector">
      <Title headingLevel="h2">Inspector</Title>
      <p>{definition.description}</p>
      <Form
        onSubmit={handleSubmit((values) => {
          updateNodeName(node.id, values.name);
          const configuration: Record<string, unknown> = { ...values.configuration };
          for (const field of definition.configurationFields) {
            const raw = configuration[field.key];
            if (field.type === "number" && typeof raw === "string") {
              const parsed = Number(raw);
              configuration[field.key] = Number.isFinite(parsed) ? parsed : field.defaultValue;
            } else if (field.type === "boolean" && typeof raw === "string") {
              configuration[field.key] = raw === "true";
            }
          }
          updateNodeConfiguration(node.id, configuration);
        })}
      >
        <FormGroup label="Display name" fieldId="node-display-name">
          <TextInput id="node-display-name" {...register("name", { required: true })} />
        </FormGroup>
        {primaryFields.map(renderConfigField)}
        {advancedFields.length > 0 && (
          <ExpandableSection toggleText="Advanced">
            {advancedFields.map(renderConfigField)}
          </ExpandableSection>
        )}
        <FormGroup label="Deployment target" fieldId="deployment-target">
          <p>Inherited from swimlane placement; override only when needed.</p>
          <FormSelect
            id="deployment-target"
            value={node.deploymentTarget ?? ""}
            onChange={(_event, value) => updateNodeDeploymentTarget(node.id, value || undefined)}
          >
            <FormSelectOption value="" label="None" />
            {graph.deploymentEnvironments.map((lane) => (
              <FormSelectOption key={lane.id} value={lane.id} label={`${lane.name} (${lane.kind})`} />
            ))}
          </FormSelect>
          {deploymentLane && <p>Active: {deploymentLane.name}</p>}
        </FormGroup>
        <Button type="submit" variant="primary">Apply</Button>
        <Button type="button" variant="secondary" onClick={() => reset(formValues)}>Reset</Button>
        {node.type === "foundation.python_transform" && (
          <Button
            type="button"
            variant="secondary"
            isDisabled={compiling}
            onClick={async () => {
              setCompiling(true);
              setCompileMessage(null);
              try {
                const instruction = getValues("configuration.instruction") || String(node.configuration.instruction ?? "");
                updateNodeConfiguration(node.id, { instruction });
                const result = await compileTransformation({ instruction, provenance: [node.id] });
                updateNodeConfiguration(node.id, {
                  instruction,
                  compiledCode: result.sourceCode,
                  compileStatus: result.status,
                  compileAudit: result.audit,
                  compiledSpec: result.spec,
                });
                setCompileMessage(
                  result.status === "success"
                    ? `Compiled via ${result.audit.provider} (${result.durationMs.toFixed(1)} ms)`
                    : `Compile finished with status ${result.status}`,
                );
              } catch (error) {
                setCompileMessage(error instanceof Error ? error.message : "Compile request failed");
              } finally {
                setCompiling(false);
              }
            }}
          >
            {compiling ? "Compiling…" : "Compile transform"}
          </Button>
        )}
        <Button type="button" variant="danger" onClick={() => requestDelete([node.id], [])}>Delete…</Button>
      </Form>
      <section>
        <Title headingLevel="h3">Connections</Title>
        <p>Drag a wire endpoint to reconnect. Disconnecting is reversible with Undo.</p>
        {edges.filter((edge) => edge.sourceNodeId === node.id || edge.targetNodeId === node.id).map((edge) => (
          <div key={edge.id}>
            <span>{nodes.find((item) => item.id === edge.sourceNodeId)?.name} → {nodes.find((item) => item.id === edge.targetNodeId)?.name}</span>
            <Button variant="link" isDanger onClick={() => disconnect([], [edge.id])}>Disconnect</Button>
          </div>
        ))}
      </section>
      <section>
        <Button
          variant="secondary"
          onClick={() => {
            saveTemplate(node);
            setTemplateMessage("Saved applied configuration to My blocks.");
          }}
        >
          Save applied block as template
        </Button>
        {(templateError || templateMessage) && <p role="status">{templateError ?? templateMessage}</p>}
      </section>
      {isPortalNode(node) && (
        <section>
          <Title headingLevel="h3">Portal bus</Title>
          <p>Bus id: <code>{portalBusId(node) || "(missing)"}</code></p>
          {linkedPortals.length === 0 ? (
            <p>No linked portal endpoints on this bus yet.</p>
          ) : (
            <ul>
              {linkedPortals.map((portal) => (
                <li key={portal.id}>
                  <Button variant="link" onClick={() => focusNode(portal.id)}>Jump to {portal.name}</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {node.type === "foundation.python_transform" && (
        <section>
          <Title headingLevel="h3">Compiler</Title>
          <p>Status: {compileStatus ?? "not compiled"}</p>
          {compileMessage && <p>{compileMessage}</p>}
          {compiledCode && <pre>{compiledCode}</pre>}
        </section>
      )}
      <section>
        <p>Type: <code>{node.type}</code></p>
        <p>Version: <code>{node.version}</code></p>
        <p>Category: <code>{definition.category}</code></p>
        <p>Export: <code>{definition.exportKind}</code></p>
        {node.parentMacroId && <p>Parent macro: <code>{node.parentMacroId}</code></p>}
        <p>{definition.documentation}</p>
        <RecommendedAdjacentSection
          feedsIn={definition.recommendedAdjacent?.feedsIn ?? []}
          feedsOut={definition.recommendedAdjacent?.feedsOut ?? []}
          onAdd={(type) => {
            const id = addNode(type, {
              x: (node.position.x ?? 80) + 40,
              y: (node.position.y ?? 80) + 80,
            });
            focusNode(id);
          }}
        />
      </section>
    </aside>
  );
}

function RecommendedAdjacentSection({
  feedsIn,
  feedsOut,
  onAdd,
}: {
  feedsIn: readonly string[];
  feedsOut: readonly string[];
  onAdd: (type: string) => void;
}) {
  if (feedsIn.length === 0 && feedsOut.length === 0) return null;
  const renderList = (types: readonly string[], emptyLabel: string) => {
    if (types.length === 0) return <p>{emptyLabel}</p>;
    return (
      <ul>
        {types.map((type) => {
          const adjacent = getNodeDefinition(type);
          const label = adjacent?.displayName ?? type;
          return (
            <li key={type}>
              <Button variant="link" title={`Add ${label} to canvas`} onClick={() => onAdd(type)}>{label}</Button>
              <span> ({type})</span>
            </li>
          );
        })}
      </ul>
    );
  };
  return (
    <div>
      <Title headingLevel="h3">Recommended adjacent nodes</Title>
      <p>Feeds into this node</p>
      {renderList(feedsIn, "Typically a pipeline source — nothing upstream.")}
      <p>This node feeds out to</p>
      {renderList(feedsOut, "Typically a sink — nothing downstream.")}
    </div>
  );
}
