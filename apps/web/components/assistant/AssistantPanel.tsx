"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  ExpandableSection,
  Form,
  FormGroup,
  TextArea,
  Title,
} from "@patternfly/react-core";

import {
  applyDraft,
  briefsReady,
  emptyTaskIds,
  engineeringPlans,
  requestAnswer,
  requestDraft,
} from "@/lib/assistant";
import { retrievePassages } from "@/lib/graphrag";
import { useProjectStore } from "@/store/project-store";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";

export function AssistantPanel() {
  const role = useUiPreferencesStore((state) => state.workspaceRole);
  const endpoint = useUiPreferencesStore((state) => state.assistantEndpoint);
  const model = useUiPreferencesStore((state) => state.assistantModel);
  const useToken = useUiPreferencesStore((state) => state.assistantUseToken);
  const setWorkspaceRole = useUiPreferencesStore((state) => state.setWorkspaceRole);
  const graph = useProjectStore((state) => state.graph);
  const replaceGraph = useProjectStore((state) => state.replaceGraph);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [rebuild, setRebuild] = useState(false);
  const plans = engineeringPlans(graph);
  const openIds = emptyTaskIds(graph);
  const targetIds = rebuild ? graph.workflow.tasks.map((task) => task.id) : openIds;
  const ready = briefsReady(graph.workflow.tasks);

  const build = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      if (!endpoint.trim()) {
        throw new Error("Set the model endpoint with the gear under search.");
      }
      if (targetIds.length === 0) {
        setStatus("Choose Rebuild all tasks to replace the existing components.");
        return;
      }
      const draft = await requestDraft(endpoint, model, graph, useToken, targetIds);
      if (useProjectStore.getState().graph !== graph) {
        throw new Error("The project changed while building. Try again to use the updated brief.");
      }
      const applied = applyDraft(graph, draft, targetIds);
      if (applied.added === 0) {
        setStatus("Every task already has components. The draft was not applied.");
        return;
      }
      replaceGraph(applied.graph, true);
      setStatus(draft.summary);
      setRebuild(false);
      setWorkspaceRole("engineer");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "The draft could not be built.");
    } finally {
      setBusy(false);
    }
  };

  const ask = async () => {
    setBusy(true);
    setError(null);
    setAnswer("");
    setSources([]);
    try {
      if (!endpoint.trim()) {
        throw new Error("Set the model endpoint with the gear under search.");
      }
      const passages = await retrievePassages(graph, question);
      setSources(passages.map((passage) => passage.label));
      const response = await requestAnswer(endpoint, model, question, passages, useToken);
      setAnswer(response.answer);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "The assistant could not answer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="AI assistant">
      <Title headingLevel="h2">AI assistant</Title>
      <p>Set the endpoint and optional API token with the gear under search.</p>
      <p>Build each task into an agent stage. Task results feed the next prompts through your workflow transitions.</p>
      {openIds.length < graph.workflow.tasks.length && (
        <Checkbox
          id="rebuild-tasks"
          label="Rebuild all tasks (replace components; Undo available)"
          isChecked={rebuild}
          isDisabled={busy}
          onChange={(_event, checked) => setRebuild(checked)}
        />
      )}
      {rebuild && (
        <p>Existing task components and their configuration will be replaced. Task briefs and drawn transitions stay in place.</p>
      )}
      <Button variant="primary" isDisabled={!ready || busy || targetIds.length === 0} onClick={() => void build()}>
        {busy ? "Working…" : rebuild ? "Rebuild agent chain" : "Build agent chain"}
      </Button>
      {!ready && <p>Add a role and expected tasks to every task before building.</p>}
      {ready && targetIds.length === 0 && (
        <p>Every task already has components. Select Rebuild all tasks to improve this implementation.</p>
      )}
      {role !== "sme" && (
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            void ask();
          }}
        >
          <FormGroup label="Ask about this deployment" fieldId="assistant-question">
            <TextArea
              id="assistant-question"
              value={question}
              onChange={(_event, value) => setQuestion(value)}
              placeholder="Which sandbox and model does this task use?"
            />
          </FormGroup>
          <Button type="submit" variant="primary" isDisabled={busy || !question.trim()}>
            {busy ? "Asking…" : "Ask"}
          </Button>
        </Form>
      )}
      {status && <p>{status}</p>}
      {error && <Alert variant="danger" isInline title={error} />}
      {plans.length > 0 && (
        <div aria-label="Engineering stage plans">
          <Title headingLevel="h3">Engineering stage plans</Title>
          <p>Rebuild after editing task briefs to refresh these plans. Review setup requirements before exporting. Run preview does not execute the models.</p>
          {plans.map((plan) => (
            <ExpandableSection key={plan.taskId} toggleText={plan.name}>
              <p>{plan.approach}</p>
              <p><strong>Input:</strong> {plan.inputContract}</p>
              <p><strong>Output:</strong> {plan.outputContract}</p>
              <p>Acceptance checks</p>
              <ul>{plan.acceptanceChecks.map((check, index) => <li key={index}>{check}</li>)}</ul>
              <p><strong>Connected tools:</strong> {plan.connectedTools.join(", ") || "None"}</p>
              {plan.setupRequirements.length > 0 && (
                <>
                  <p>Setup requirements</p>
                  <ul>{plan.setupRequirements.map((item, index) => <li key={index}>{item}</li>)}</ul>
                </>
              )}
            </ExpandableSection>
          ))}
        </div>
      )}
      {answer && <p>{answer}</p>}
      {sources.length > 0 && (
        <div>
          <p>From this project</p>
          <ul>{sources.map((source) => <li key={source}>{source}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
