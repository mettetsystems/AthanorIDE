"use client";

/**
 * Bottom panel listing Validate issues with focus navigation.
 */
import { useEffect, useState } from "react";
import {
  Button,
  ExpandableSection,
  Label,
  Panel,
  PanelMain,
  PanelMainBody,
} from "@patternfly/react-core";

import { useValidationStore } from "@/store/validation-store";
import { useSelectionStore } from "@/store/selection-store";
import { taskFlowId } from "@/lib/workflow";
import { transitionFlowId } from "@/components/workflow/WorkflowCanvas";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";

export function ValidationPanel() {
  const { issues, valid, status, errorMessage, durationMs } = useValidationStore();
  const focusNode = useSelectionStore((state) => state.focusNode);
  const focusEdge = useSelectionStore((state) => state.focusEdge);
  const [expanded, setExpanded] = useState(status !== "idle");

  useEffect(() => {
    if (status !== "idle") setExpanded(true);
  }, [status]);

  const summary =
    status === "idle"
      ? "Not validated yet"
      : status === "running"
        ? "Validating…"
        : status === "done"
          ? valid
            ? `Valid${durationMs != null ? ` · ${durationMs.toFixed(1)} ms` : ""}`
            : `${issues.filter((issue) => issue.severity === "error").length} error(s)`
          : (errorMessage ?? "Validation failed");

  return (
    <Panel aria-live="polite" aria-label="Validation results">
      <PanelMain>
        <ExpandableSection
          isExpanded={expanded}
          onToggle={(_event, isExpanded) => setExpanded(isExpanded)}
          toggleText={`Validation · ${summary}`}
        >
          <PanelMainBody>
            {issues.length === 0 ? (
              <p>
                {status === "done" && valid
                  ? "No issues. Architecture checks passed."
                  : "Run Validate to check configuration, contracts, portals, and deployment boundaries."}
              </p>
            ) : (
              <ul className="editor-scroll">
                {issues.map((issue) => (
                  <li key={issue.id}>
                    <Button
                      variant="secondary"
                      isBlock
                      isDisabled={!issue.nodeId && !issue.edgeId && !issue.taskId && !issue.transitionId}
                      onClick={() => {
                        if (issue.nodeId) focusNode(issue.nodeId);
                        else if (issue.edgeId) focusEdge(issue.edgeId);
                        else if (issue.taskId) focusNode(taskFlowId(issue.taskId));
                        else if (issue.transitionId) {
                          useUiPreferencesStore.getState().setWorkspaceRole("sme");
                          focusEdge(transitionFlowId(issue.transitionId));
                        }
                      }}
                    >
                      <Label
                        color={
                          issue.severity === "error"
                            ? "red"
                            : issue.severity === "warning"
                              ? "orange"
                              : "blue"
                        }
                      >
                        {issue.severity} · {issue.code}
                      </Label>
                      <span>{issue.message}</span>
                      {issue.portId && <span>Port: {issue.portId}</span>}
                      {issue.fieldPath && <span>{issue.fieldPath}</span>}
                      {issue.suggestedAction && <span>Suggested: {issue.suggestedAction}</span>}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </PanelMainBody>
        </ExpandableSection>
      </PanelMain>
    </Panel>
  );
}
