"use client";

/**
 * Bottom panel summarizing the latest Run: steps, payloads, and failures.
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

import { useExecutionStore, selectPayloadPreview } from "@/store/execution-store";
import { useSelectionStore } from "@/store/selection-store";

export function ExecutionPanel() {
  const {
    status,
    runStatus,
    steps,
    finalOutputs,
    durationMs,
    errorMessage,
    selectedStepNodeId,
    selectStep,
  } = useExecutionStore();
  const focusNode = useSelectionStore((state) => state.focusNode);
  const [expanded, setExpanded] = useState(status !== "idle");

  useEffect(() => {
    if (status !== "idle") setExpanded(true);
  }, [status]);

  const summary =
    status === "idle"
      ? "Not run yet"
      : status === "running"
        ? "Running…"
        : status === "done"
          ? `${runStatus ?? "done"}${durationMs != null ? ` · ${durationMs.toFixed(1)} ms` : ""}`
          : (errorMessage ?? "Execution failed");

  return (
    <Panel aria-live="polite" aria-label="Execution debug">
      <PanelMain>
        <ExpandableSection
          isExpanded={expanded}
          onToggle={(_event, isExpanded) => setExpanded(isExpanded)}
          toggleText={`Execution · ${summary}`}
        >
          <PanelMainBody>
            {status === "idle" && (
              <p>
                Run preview checks the design without calling models or tools. Export to execute your agent in its sandbox.
              </p>
            )}
            {status === "done" && steps.length === 0 && (
              <p>Execution refused because the graph has validation errors. Fix issues, then Run again.</p>
            )}
            {finalOutputs.length > 0 && (
              <div>
                <p>Final output</p>
                {finalOutputs.map((item) => (
                  <pre key={String(item.nodeId)}>{String(item.value ?? "")}</pre>
                ))}
              </div>
            )}
            {steps.length > 0 && (
              <ul className="editor-scroll">
                {steps.map((step) => {
                  const preview = selectPayloadPreview(steps, step.nodeId);
                  return (
                    <li key={step.nodeId}>
                      <Button
                        variant={selectedStepNodeId === step.nodeId ? "primary" : "secondary"}
                        isBlock
                        onClick={() => {
                          selectStep(step.nodeId);
                          focusNode(step.nodeId);
                        }}
                      >
                        <Label
                          color={
                            step.status === "error"
                              ? "red"
                              : step.status === "skipped"
                                ? "orange"
                                : "green"
                          }
                        >
                          {step.status} · {step.nodeName}
                        </Label>
                        {step.message && <span>{step.message}</span>}
                        {preview != null && preview !== "" && <span>{preview}</span>}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </PanelMainBody>
        </ExpandableSection>
      </PanelMain>
    </Panel>
  );
}
