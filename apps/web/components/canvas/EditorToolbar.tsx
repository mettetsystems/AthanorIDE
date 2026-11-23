"use client";

/**
 * Editor chrome: project name, validate/run/export, undo, search, deploy toggles.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  FormSelect,
  FormSelectOption,
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  Popover,
  SearchInput,
  TextInput,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import {
  BoxesIcon,
  CogIcon,
  DownloadIcon,
  FolderOpenIcon,
  KeyIcon,
  OutlinedSaveIcon,
  PlayIcon,
  RedoIcon,
  ShieldAltIcon,
  TachometerAltIcon,
  TopologyIcon,
  UndoIcon,
  UploadIcon,
} from "@patternfly/react-icons";

import { AssistantSettings } from "@/components/assistant/AssistantSettings";
import { executeProject } from "@/lib/execute";
import {
  downloadExportZip,
  downloadHandoff,
  exportProject,
  type ExportOptions,
} from "@/lib/export";
import { downloadGraphJson, importGraphJson } from "@/lib/persistence";
import { importProjectIntoLibrary } from "@/lib/project-library";
import { validateCurrentProject } from "@/lib/validate";
import { useExecutionStore } from "@/store/execution-store";
import {
  selectCanRedo,
  selectCanUndo,
  useProjectStore,
} from "@/store/project-store";
import { useSelectionStore } from "@/store/selection-store";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";
import { useValidationStore } from "@/store/validation-store";

type EditorToolbarProps = {
  onOpenInfrastructureTokens?: () => void;
  onOpenLocalVault?: () => void;
  onToggleNodeLibrary?: () => void;
  onToggleInspector?: () => void;
};

const FORMATS: { value: NonNullable<ExportOptions["exportFormat"]>; label: string }[] = [
  { value: "code", label: "Source code" },
  { value: "helm", label: "Helm Chart" },
  { value: "podman", label: "Podman container" },
  { value: "docker", label: "Docker container" },
  { value: "openshift", label: "OpenShift deployment" },
  { value: "npm", label: "npm package" },
  { value: "makefile", label: "Makefiles" },
];

export function EditorToolbar({
  onOpenInfrastructureTokens,
  onOpenLocalVault,
  onToggleNodeLibrary,
  onToggleInspector,
}: EditorToolbarProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [exportFormat, setExportFormat] =
    useState<NonNullable<ExportOptions["exportFormat"]>>("code");
  const [searchQuery, setSearchQuery] = useState("");
  const graph = useProjectStore((state) => state.graph);
  const setProjectName = useProjectStore((state) => state.setProjectName);
  const setExportConfiguration = useProjectStore((state) => state.setExportConfiguration);
  const replaceGraph = useProjectStore((state) => state.replaceGraph);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const markSaved = useProjectStore((state) => state.markSaved);
  const persistenceError = useProjectStore((state) => state.persistenceError);
  const lowResourceMode = useUiPreferencesStore((state) => state.lowResourceMode);
  const setLowResourceMode = useUiPreferencesStore((state) => state.setLowResourceMode);
  const collapseSelectionToMacro = useProjectStore((state) => state.collapseSelectionToMacro);
  const addSwimlane = useProjectStore((state) => state.addSwimlane);
  const canUndo = useProjectStore(selectCanUndo);
  const canRedo = useProjectStore(selectCanRedo);
  const role = useUiPreferencesStore((state) => state.workspaceRole);
  const setResult = useValidationStore((state) => state.setResult);
  const setError = useValidationStore((state) => state.setError);
  const setExecRunning = useExecutionStore((state) => state.setRunning);
  const setExecResult = useExecutionStore((state) => state.setResult);
  const setExecError = useExecutionStore((state) => state.setError);
  const selectedNodeIds = useSelectionStore((state) => state.selectedNodeIds);
  const focusNode = useSelectionStore((state) => state.focusNode);

  const selectableNodeIds = useMemo(
    () =>
      selectedNodeIds.filter(
        (id) =>
          !id.startsWith("macro:") &&
          !id.startsWith("swimlane:") &&
          !id.startsWith("workflow-task:"),
      ),
    [selectedNodeIds],
  );

  const searchHits = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    if (role === "sme") {
      return graph.workflow.tasks
        .filter((task) =>
          `${task.name} ${task.role} ${task.expectedTasks}`.toLowerCase().includes(query),
        )
        .map((task) => ({
          id: `workflow-task:${task.id}`,
          name: task.name,
          type: "Workflow task",
        }));
    }
    return graph.nodes.filter(
      (node) =>
        node.name.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query) ||
        String(node.configuration.busId ?? "").toLowerCase().includes(query),
    );
  }, [graph.nodes, graph.workflow.tasks, role, searchQuery]);

  return (
    <Toolbar id="editor-toolbar" isExpanded={actionsOpen}>
      <ToolbarContent>
        {persistenceError && (
          <ToolbarItem>
            <Alert variant="danger" isInline isPlain title={persistenceError} />
          </ToolbarItem>
        )}
        {role !== "sme" && (
          <ToolbarItem visibility={{ default: "visible", lg: "hidden" }}>
            <Button variant="control" onClick={onToggleNodeLibrary}>
              Node library
            </Button>
          </ToolbarItem>
        )}
        <ToolbarItem visibility={{ default: "visible", lg: "hidden" }}>
          <Button variant="control" onClick={onToggleInspector}>
            Inspector
          </Button>
        </ToolbarItem>
        <ToolbarItem visibility={{ default: "visible", lg: "hidden" }}>
          <Button
            variant="control"
            aria-expanded={actionsOpen}
            onClick={() => setActionsOpen((open) => !open)}
          >
            Actions
          </Button>
        </ToolbarItem>
        <ToolbarItem>
          <Link href="/" title="Back to projects">
            <Button variant="secondary" icon={<img src="/logo.jpg" alt="" width={28} height={28} />}>
              Projects
            </Button>
          </Link>
        </ToolbarItem>
        <ToolbarItem>
          <TextInput
            id="project-name"
            aria-label="Project name"
            value={graph.project.name}
            onChange={(_event, value) => setProjectName(value)}
          />
          <p>AthanorIDE · schema {graph.schemaVersion} · autosaves locally</p>
        </ToolbarItem>
        <ToolbarItem style={{ position: "relative", minWidth: "14rem" }}>
          <SearchInput
            aria-label="Search graph"
            placeholder={role === "sme" ? "Search tasks…" : "Search nodes…"}
            value={searchQuery}
            onChange={(_event, value) => setSearchQuery(value)}
            onClear={() => setSearchQuery("")}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchHits[0]) focusNode(searchHits[0].id);
            }}
          />
          {searchQuery.trim() && (
            <Menu className="editor-search-results">
              <MenuContent>
                <MenuList>
                  {searchHits.length === 0 ? (
                    <MenuItem isDisabled>No matches</MenuItem>
                  ) : (
                    searchHits.slice(0, 8).map((node) => (
                      <MenuItem
                        key={node.id}
                        description={node.type}
                        onClick={() => {
                          focusNode(node.id);
                          setSearchQuery("");
                        }}
                      >
                        {node.name}
                      </MenuItem>
                    ))
                  )}
                </MenuList>
              </MenuContent>
            </Menu>
          )}
        </ToolbarItem>
        <ToolbarItem>
          {onOpenLocalVault && (
            <Popover
              aria-label="Assistant model settings"
              position="bottom-end"
              bodyContent={<AssistantSettings onOpenVault={onOpenLocalVault} />}
            >
              <Button variant="control" icon={<CogIcon />} aria-label="Assistant model settings">
                Assistant
              </Button>
            </Popover>
          )}
        </ToolbarItem>
        <ToolbarGroup>
          <ToolbarItem>
            <Button variant="secondary" icon={<UndoIcon />} onClick={() => undo()} isDisabled={!canUndo} aria-label="Undo">
              Undo
            </Button>
          </ToolbarItem>
          <ToolbarItem>
            <Button variant="secondary" icon={<RedoIcon />} onClick={() => redo()} isDisabled={!canRedo} aria-label="Redo">
              Redo
            </Button>
          </ToolbarItem>
          {role !== "sme" && (
            <>
              <ToolbarItem>
                <Button
                  variant="secondary"
                  icon={<BoxesIcon />}
                  isDisabled={selectableNodeIds.length < 2}
                  onClick={() => {
                    const macroId = collapseSelectionToMacro(selectableNodeIds);
                    if (macroId) useSelectionStore.getState().clearSelection();
                  }}
                >
                  Collapse macro
                </Button>
              </ToolbarItem>
              <ToolbarItem>
                <Button variant="secondary" icon={<TopologyIcon />} onClick={() => addSwimlane("LOCAL_WORKSTATION")}>
                  Add swimlane
                </Button>
              </ToolbarItem>
              <ToolbarItem>
                <Button
                  variant={lowResourceMode ? "primary" : "secondary"}
                  icon={<TachometerAltIcon />}
                  aria-pressed={lowResourceMode}
                  title="Hide the minimap to reduce canvas rendering work"
                  onClick={() => setLowResourceMode(!lowResourceMode)}
                >
                  {lowResourceMode ? "Low-resource view on" : "Low-resource view"}
                </Button>
              </ToolbarItem>
              <ToolbarItem>
                <fieldset className="editor-export-targets">
                  <legend>Export deployment targets</legend>
                  <span title="Podman Containerfile and deploy/podman/ are always included">Podman always</span>
                  <Checkbox
                    id="export-k8s"
                    label="K8s"
                    isChecked={Boolean(graph.exportConfiguration?.includeKubernetes)}
                    onChange={(_event, checked) => setExportConfiguration({ includeKubernetes: checked })}
                  />
                  <Checkbox
                    id="export-okd"
                    label="OKD"
                    isChecked={Boolean(graph.exportConfiguration?.includeOpenShift)}
                    onChange={(_event, checked) =>
                      setExportConfiguration({
                        includeOpenShift: checked,
                        includeKubernetes: checked ? true : graph.exportConfiguration?.includeKubernetes,
                      })
                    }
                  />
                  <Checkbox
                    id="export-argo"
                    label="Argo CD"
                    isChecked={Boolean(graph.exportConfiguration?.includeArgoCd)}
                    onChange={(_event, checked) =>
                      setExportConfiguration({
                        includeArgoCd: checked,
                        includeKubernetes: checked ? true : graph.exportConfiguration?.includeKubernetes,
                      })
                    }
                  />
                  <Checkbox
                    id="export-terraform"
                    label="Terraform"
                    isChecked={Boolean(graph.exportConfiguration?.includeTerraform)}
                    onChange={(_event, checked) => setExportConfiguration({ includeTerraform: checked })}
                  />
                </fieldset>
              </ToolbarItem>
              <ToolbarItem>
                <Button variant="secondary" icon={<KeyIcon />} onClick={() => onOpenInfrastructureTokens?.()}>
                  Infra tokens
                </Button>
              </ToolbarItem>
              <ToolbarItem>
                <Button variant="secondary" icon={<ShieldAltIcon />} onClick={() => onOpenLocalVault?.()}>
                  Local vault
                </Button>
              </ToolbarItem>
            </>
          )}
          <ToolbarItem>
            <Button variant="secondary" icon={<OutlinedSaveIcon />} onClick={() => markSaved()}>
              Save
            </Button>
          </ToolbarItem>
          <ToolbarItem>
            <Button variant="secondary" icon={<DownloadIcon />} onClick={() => downloadGraphJson(graph)}>
              Graph JSON
            </Button>
          </ToolbarItem>
          <ToolbarItem>
            <Button variant="secondary" icon={<FolderOpenIcon />} onClick={() => fileRef.current?.click()}>
              Import JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const imported = await importProjectIntoLibrary(importGraphJson(text));
                  replaceGraph(imported, false);
                  router.push(`/editor/${imported.project.id}`);
                } catch (error) {
                  window.alert(
                    error instanceof Error
                      ? error.message
                      : "Could not import project JSON. Check the schema version and format.",
                  );
                } finally {
                  event.target.value = "";
                }
              }}
            />
          </ToolbarItem>
          <ToolbarItem>
            <Button
              variant="secondary"
              isDisabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await downloadHandoff(useProjectStore.getState().graph);
                } catch (error) {
                  await validateCurrentProject("design");
                  setError(error instanceof Error ? error.message : "Handoff failed");
                } finally {
                  setExporting(false);
                }
              }}
            >
              Export build brief
            </Button>
          </ToolbarItem>
          {role !== "sme" && (
            <>
              <ToolbarItem>
                <FormSelect
                  aria-label="Export format"
                  value={exportFormat}
                  onChange={(_event, value) =>
                    setExportFormat(value as NonNullable<ExportOptions["exportFormat"]>)
                  }
                >
                  {FORMATS.map((format) => (
                    <FormSelectOption key={format.value} value={format.value} label={format.label} />
                  ))}
                </FormSelect>
              </ToolbarItem>
              <ToolbarItem>
                <Button
                  variant="secondary"
                  icon={<UploadIcon />}
                  isDisabled={exporting}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      const submitted = useProjectStore.getState().graph;
                      const result = await exportProject(submitted, { exportFormat });
                      downloadExportZip(result);
                      if (useProjectStore.getState().graph === submitted) {
                        setResult(true, result.validationIssues, result.durationMs);
                      }
                    } catch (error) {
                      setError(
                        error instanceof Error
                          ? error.message
                          : "Export failed. Validate the graph and confirm the API is running.",
                      );
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  {exporting ? "Exporting…" : "Export"}
                </Button>
              </ToolbarItem>
              <ToolbarItem>
                <Button
                  variant="primary"
                  icon={<PlayIcon />}
                  onClick={async () => {
                    setExecRunning();
                    try {
                      const result = await executeProject(useProjectStore.getState().graph);
                      setExecResult({
                        status: result.status,
                        steps: result.steps,
                        edgePayloads: result.edgePayloads,
                        finalOutputs: result.finalOutputs,
                        durationMs: result.durationMs,
                      });
                    } catch (error) {
                      setExecError(
                        error instanceof Error ? error.message : "Unable to execute. Is make dev running?",
                      );
                    }
                  }}
                >
                  Run preview
                </Button>
              </ToolbarItem>
            </>
          )}
          <ToolbarItem>
            <Button
              variant="primary"
              icon={<ShieldAltIcon />}
              onClick={() => void validateCurrentProject(role === "sme" ? "design" : "deployment")}
            >
              Validate
            </Button>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );
}
