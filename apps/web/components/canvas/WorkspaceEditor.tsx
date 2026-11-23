"use client";

/**
 * Editor shell that hydrates a projectId and lays out palette, canvas, and inspector.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Button,
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelContent,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Page,
  PageSection,
  Tab,
  TabTitleText,
  Tabs,
  Title,
} from "@patternfly/react-core";

import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { ArchitectureCanvas } from "@/components/canvas/ArchitectureCanvas";
import { EditorToolbar } from "@/components/canvas/EditorToolbar";
import { ExecutionPanel } from "@/components/execution/ExecutionPanel";
import { DeleteConfirmationPanel } from "@/components/inspector/DeleteConfirmationPanel";
import { InfrastructureTokensPanel } from "@/components/inspector/InfrastructureTokensPanel";
import { LocalVaultPanel } from "@/components/inspector/LocalVaultPanel";
import { NodeInspector } from "@/components/inspector/NodeInspector";
import { NodePalette } from "@/components/sidebar/NodePalette";
import { ValidationPanel } from "@/components/validation/ValidationPanel";
import { RoleTabs } from "@/components/workflow/RoleTabs";
import {
  parseTransitionFlowId,
  WorkflowCanvas,
} from "@/components/workflow/WorkflowCanvas";
import {
  ComponentWorkflowControls,
  WorkflowInspector,
} from "@/components/workflow/WorkflowInspector";
import { refreshProjectIndex } from "@/lib/graphrag";
import { validateCurrentProject } from "@/lib/validate";
import { parseTaskFlowId } from "@/lib/workflow";
import { useProjectStore } from "@/store/project-store";
import { useSelectionStore } from "@/store/selection-store";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";

type WorkspaceEditorProps = {
  projectId?: string;
};

type RightPanel = "inspector" | "infra" | "vault";

function useWideLayout() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 64rem)");
    const apply = () => setWide(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return wide;
}

export function WorkspaceEditor({ projectId }: WorkspaceEditorProps) {
  const role = useUiPreferencesStore((s) => s.workspaceRole);
  const graph = useProjectStore((s) => s.graph);
  const selection = useSelectionStore();
  const workflowSelection = Boolean(
    parseTaskFlowId(selection.selectedNodeIds[0] ?? "") ||
      parseTransitionFlowId(selection.selectedEdgeIds[0] ?? ""),
  );
  const wide = useWideLayout();
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("role");
    if (requested === "sme" || requested === "engineer" || requested === "security") {
      useUiPreferencesStore.getState().setWorkspaceRole(requested);
    }
  }, []);
  useEffect(() => {
    if (role !== "security") return;
    const timer = setTimeout(() => void validateCurrentProject(), 450);
    return () => clearTimeout(timer);
  }, [graph, role]);
  const hydrate = useProjectStore((state) => state.hydrate);
  const hydrated = useProjectStore((state) => state.hydrated);
  const [missing, setMissing] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>("inspector");
  const [rightView, setRightView] = useState<"details" | "assistant">("details");
  const [mobilePanel, setMobilePanel] = useState<"palette" | "inspector" | null>(null);

  useEffect(() => {
    setRightPanel("inspector");
    setMobilePanel(null);
  }, [role]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshProjectIndex(graph).catch(() => {
        // Indexing waits until the local embedding model is available.
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [graph]);

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    setMissing(false);
    useProjectStore.setState({ hydrated: false });
    let current = true;
    void hydrate(projectId)
      .then((ok) => {
        if (current) setMissing(Boolean(projectId) && !ok);
      })
      .catch(() => {
        if (current) setMissing(Boolean(projectId));
      });
    return () => {
      current = false;
    };
  }, [hydrate, projectId]);

  if (missing) {
    return (
      <Page>
        <PageSection>
          <EmptyState>
            <Title headingLevel="h1">Project not found</Title>
            <EmptyStateBody>That project was not found in local storage.</EmptyStateBody>
            <EmptyStateFooter>
              <EmptyStateActions>
                <Link href="/">
                  <Button variant="primary">Back to projects</Button>
                </Link>
              </EmptyStateActions>
            </EmptyStateFooter>
          </EmptyState>
        </PageSection>
      </Page>
    );
  }

  if (!hydrated || (projectId && graph.project.id !== projectId)) {
    return (
      <Page>
        <PageSection>Loading workspace…</PageSection>
      </Page>
    );
  }

  const paletteOpen = role !== "sme" && (wide || mobilePanel === "palette");
  const inspectorOpen = wide || mobilePanel === "inspector";

  const inspector = (
    <div className="editor-inspector editor-scroll">
      {rightPanel === "infra" ? (
        <InfrastructureTokensPanel open onClose={() => setRightPanel("inspector")} />
      ) : rightPanel === "vault" ? (
        <LocalVaultPanel open onClose={() => setRightPanel("inspector")} />
      ) : (
        <>
          <Tabs
            activeKey={rightView}
            onSelect={(_event, key) => setRightView(key as "details" | "assistant")}
            aria-label="Right column"
          >
            <Tab eventKey="details" title={<TabTitleText>Details</TabTitleText>} />
            <Tab eventKey="assistant" title={<TabTitleText>Assistant</TabTitleText>} />
          </Tabs>
          {rightView === "assistant" ? (
            <AssistantPanel />
          ) : (
            <>
              <DeleteConfirmationPanel />
              <div className="editor-scroll">
                {role === "sme" || workflowSelection ? (
                  <WorkflowInspector />
                ) : (
                  <>
                    <ComponentWorkflowControls />
                    <NodeInspector />
                    <WorkflowInspector />
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );

  return (
    <Page className="editor-shell">
      <PageSection padding={{ default: "noPadding" }} className="editor-workspace">
        <EditorToolbar
          onOpenInfrastructureTokens={() => {
            setRightPanel("infra");
            setMobilePanel("inspector");
          }}
          onOpenLocalVault={() => {
            setRightPanel("vault");
            setMobilePanel("inspector");
          }}
          onToggleNodeLibrary={() =>
            setMobilePanel((current) => (current === "palette" ? null : "palette"))
          }
          onToggleInspector={() =>
            setMobilePanel((current) => (current === "inspector" ? null : "inspector"))
          }
        />
        <RoleTabs />
        <div id="role-workspace" role="tabpanel" aria-labelledby={`role-${role}`} className="editor-workspace">
          <Drawer isExpanded={paletteOpen} isInline={wide} isStatic={wide} position="start">
            <DrawerContent
              panelContent={
                role === "sme" ? undefined : (
                  <DrawerPanelContent defaultSize="20rem" minSize="14rem" isResizable>
                    {!wide && (
                      <DrawerHead>
                        <DrawerActions>
                          <DrawerCloseButton onClick={() => setMobilePanel(null)} />
                        </DrawerActions>
                      </DrawerHead>
                    )}
                    <NodePalette />
                  </DrawerPanelContent>
                )
              }
            >
              <DrawerContentBody>
                <Drawer isExpanded={inspectorOpen} isInline={wide} isStatic={wide} position="end">
                  <DrawerContent
                    panelContent={
                      <DrawerPanelContent defaultSize="20rem" minSize="16rem">
                        {!wide && (
                          <DrawerHead>
                            <DrawerActions>
                              <DrawerCloseButton onClick={() => setMobilePanel(null)} />
                            </DrawerActions>
                          </DrawerHead>
                        )}
                        {inspector}
                      </DrawerPanelContent>
                    }
                  >
                    <DrawerContentBody>
                      <div className="editor-canvas-column">
                        <div className="editor-canvas">
                          {role === "sme" ? <WorkflowCanvas /> : <ArchitectureCanvas />}
                        </div>
                        {role !== "sme" && <ExecutionPanel />}
                        <ValidationPanel />
                      </div>
                    </DrawerContentBody>
                  </DrawerContent>
                </Drawer>
              </DrawerContentBody>
            </DrawerContent>
          </Drawer>
        </div>
      </PageSection>
    </Page>
  );
}
