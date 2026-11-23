"use client";

/**
 * Endpoint preferences and optional write-only vault authentication.
 */
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Switch,
  TextInput,
} from "@patternfly/react-core";

import { ASSISTANT_TOKEN_NAME, assistantTokenStatus } from "@/lib/assistant";
import { discoverModelEndpoints, type ModelEndpoint } from "@/lib/model-endpoints";
import { fetchVaultStatus, listVaultEntries, putVaultEntry } from "@/lib/vault";
import { useUiPreferencesStore } from "@/store/ui-preferences-store";

type AssistantSettingsProps = {
  onOpenVault: () => void;
};

export function AssistantSettings({ onOpenVault }: AssistantSettingsProps) {
  const endpoint = useUiPreferencesStore((state) => state.assistantEndpoint);
  const model = useUiPreferencesStore((state) => state.assistantModel);
  const useToken = useUiPreferencesStore((state) => state.assistantUseToken);
  const setAssistantEndpoint = useUiPreferencesStore((state) => state.setAssistantEndpoint);
  const setAssistantModel = useUiPreferencesStore((state) => state.setAssistantModel);
  const setAssistantUseToken = useUiPreferencesStore((state) => state.setAssistantUseToken);
  const [endpointDraft, setEndpointDraft] = useState(endpoint);
  const [modelDraft, setModelDraft] = useState(model);
  const [useTokenDraft, setUseTokenDraft] = useState(useToken);
  const [tokenDraft, setTokenDraft] = useState("");
  const [stored, setStored] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [endpoints, setEndpoints] = useState<ModelEndpoint[]>([]);
  const [discovering, setDiscovering] = useState(true);
  const [discoveryMessage, setDiscoveryMessage] = useState("");
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const discoveryController = useRef<AbortController | null>(null);

  const discover = async (url = "", withToken = false) => {
    discoveryController.current?.abort();
    const controller = new AbortController();
    discoveryController.current = controller;
    setDiscovering(true);
    setDiscoveryMessage("");
    setEndpoints([]);
    try {
      const found = await discoverModelEndpoints(url, withToken, controller.signal);
      if (controller.signal.aborted) return;
      setEndpoints(found);
      if (!found.length) {
        setDiscoveryMessage(
          "No compatible model list found. Enter a server URL to check it, or configure the endpoint manually.",
        );
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        setDiscoveryMessage(err instanceof Error ? err.message : "Could not check existing endpoints.");
      }
    } finally {
      if (!controller.signal.aborted) setDiscovering(false);
    }
  };

  useEffect(() => {
    void discover();
    return () => discoveryController.current?.abort();
  }, []);

  useEffect(() => {
    setEndpointDraft(endpoint);
    setModelDraft(model);
    setUseTokenDraft(useToken);
  }, [endpoint, model, useToken]);

  useEffect(() => {
    if (!useTokenDraft) return;
    let current = true;
    void (async () => {
      try {
        const status = await fetchVaultStatus();
        if (!status.unlocked) {
          if (current) setStored(false);
          return;
        }
        const entries = await listVaultEntries();
        if (current) setStored(entries.some((entry) => entry.name === ASSISTANT_TOKEN_NAME && entry.hasValue));
      } catch {
        if (current) setStored(false);
      }
    })();
    return () => {
      current = false;
    };
  }, [message, useTokenDraft]);

  const save = async () => {
    setError(null);
    setMessage(null);
    setAssistantEndpoint(endpointDraft.trim());
    setAssistantModel(modelDraft.trim() || "assistant");
    setAssistantUseToken(useTokenDraft);
    if (!useTokenDraft || !tokenDraft.trim()) {
      setTokenDraft("");
      setMessage("Endpoint saved.");
      return;
    }
    try {
      const status = await fetchVaultStatus();
      if (!status.exists || !status.unlocked) {
        setError("Unlock the local vault before saving the token.");
        setTokenDraft("");
        return;
      }
      await putVaultEntry(ASSISTANT_TOKEN_NAME, tokenDraft.trim());
      setTokenDraft("");
      setStored(true);
      setMessage("Endpoint saved. The token is stored in the local vault.");
    } catch (err: unknown) {
      setTokenDraft("");
      setError(err instanceof Error ? err.message : "Could not store the token.");
    }
  };

  return (
    <Form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <FormGroup label="Use an existing model endpoint?">
        <p>
          Reuse Project Maya, vLLM, llama.cpp, or another OpenAI-compatible server to avoid loading another model.
          Checks list models without running inference. Local discovery checks the machine running the API.
        </p>
        <Button variant="link" isInline isDisabled={discovering} onClick={() => void discover()}>
          {discovering ? "Checking existing endpoints…" : "Check local servers again"}
        </Button>
        <p role="status">{discoveryMessage}</p>
        {endpoints.map((candidate) => (
          <div key={candidate.endpoint}>
            <p>{candidate.base_url}</p>
            <p>{candidate.detail}</p>
            {candidate.models.length > 0 && (
              <FormSelect
                aria-label={`Model at ${candidate.base_url}`}
                value={
                  candidate.models.includes(selectedModels[candidate.endpoint] ?? "")
                    ? selectedModels[candidate.endpoint]
                    : candidate.models[0]
                }
                onChange={(_event, value) =>
                  setSelectedModels((previous) => ({ ...previous, [candidate.endpoint]: value }))
                }
              >
                {candidate.models.map((id) => (
                  <FormSelectOption key={id} value={id} label={id} />
                ))}
              </FormSelect>
            )}
            {candidate.status !== "unavailable" && (
              <Button
                variant="link"
                isInline
                onClick={() => {
                  const selection = selectedModels[candidate.endpoint];
                  setEndpointDraft(candidate.endpoint);
                  setModelDraft(
                    selection && candidate.models.includes(selection) ? selection : (candidate.models[0] ?? ""),
                  );
                  setUseTokenDraft(candidate.useToken || (candidate.endpoint === endpoint && useToken));
                  setTokenDraft("");
                  setError(null);
                  setMessage(
                    candidate.status === "auth_required"
                      ? "Save the server token in the local vault, then check this URL again."
                      : "Existing endpoint selected. Click Save to use it.",
                  );
                }}
              >
                {candidate.status === "auth_required" ? "Configure authentication" : "Use this endpoint"}
              </Button>
            )}
          </div>
        ))}
      </FormGroup>
      <FormGroup label="Chat completions endpoint" fieldId="assistant-endpoint">
        <TextInput
          id="assistant-endpoint"
          aria-label="Chat completions endpoint"
          value={endpointDraft}
          onChange={(_event, value) => setEndpointDraft(value)}
          placeholder="https://models.example/v1/chat/completions"
          autoComplete="off"
        />
      </FormGroup>
      <Button
        variant="link"
        isInline
        isDisabled={discovering || !endpointDraft.trim()}
        onClick={() => void discover(endpointDraft.trim(), useTokenDraft)}
      >
        Check this URL{useTokenDraft ? " with saved vault token" : ""}
      </Button>
      <FormGroup label="Model ID" fieldId="assistant-model">
        <TextInput
          id="assistant-model"
          aria-label="Model ID"
          value={modelDraft}
          onChange={(_event, value) => setModelDraft(value)}
          autoComplete="off"
        />
      </FormGroup>
      <Switch
        id="assistant-use-token"
        label="Use API token"
        isChecked={useTokenDraft}
        onChange={(_event, checked) => {
          setUseTokenDraft(checked);
          setTokenDraft("");
          setError(null);
          setMessage(null);
        }}
      />
      <p>Turn off for local or other endpoints that do not require authentication.</p>
      {useTokenDraft && (
        <FormGroup label="Token" fieldId="assistant-token">
          <TextInput
            id="assistant-token"
            aria-label="Assistant token"
            type="password"
            value={tokenDraft}
            onChange={(_event, value) => setTokenDraft(value)}
            placeholder="Write-only"
            autoComplete="new-password"
          />
        </FormGroup>
      )}
      <p>{assistantTokenStatus(stored, useTokenDraft)}</p>
      {message && <p>{message}</p>}
      {error && (
        <Alert
          variant="danger"
          isInline
          title={error}
          actionLinks={
            <Button variant="link" isInline onClick={onOpenVault}>
              Open the local vault
            </Button>
          }
        />
      )}
      <Button type="submit" variant="primary">
        Save
      </Button>
    </Form>
  );
}
