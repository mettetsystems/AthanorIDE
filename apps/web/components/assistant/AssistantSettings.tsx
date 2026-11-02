"use client";

/**
 * Endpoint preferences and optional write-only vault authentication.
 */
import { useEffect, useRef, useState } from "react";

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
      if (!found.length) setDiscoveryMessage("No compatible model list found. Enter a server URL to check it, or configure the endpoint manually.");
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
    <form
      className="absolute right-0 z-30 mt-1 max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] space-y-2 overflow-y-auto rounded border border-[var(--athanor-mist)] bg-white p-3 text-sm shadow"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="space-y-2 rounded bg-slate-50 p-2">
        <p className="font-medium">Use an existing model endpoint?</p>
        <p className="text-xs text-[var(--athanor-slate)]">
          Reuse Project Maya, vLLM, llama.cpp, or another OpenAI-compatible server to avoid loading another model.
          Checks list models without running inference. Local discovery checks the machine running the API.
        </p>
        <button type="button" disabled={discovering} className="text-xs underline disabled:opacity-50" onClick={() => void discover()}>
          {discovering ? "Checking existing endpoints…" : "Check local servers again"}
        </button>
        <p role="status" className="text-xs text-[var(--athanor-slate)]">{discoveryMessage}</p>
        {endpoints.map((candidate) => (
          <div key={candidate.endpoint} className="space-y-1 border-t border-slate-200 pt-2">
            <p className="break-all text-xs font-medium">{candidate.base_url}</p>
            <p className="text-xs">{candidate.detail}</p>
            {candidate.models.length > 0 && (
              <select
                aria-label={`Model at ${candidate.base_url}`}
                className="w-full rounded border border-[var(--athanor-mist)] p-1 text-xs"
                value={candidate.models.includes(selectedModels[candidate.endpoint] ?? "") ? selectedModels[candidate.endpoint] : candidate.models[0]}
                onChange={(event) => setSelectedModels((previous) => ({ ...previous, [candidate.endpoint]: event.target.value }))}
              >
                {candidate.models.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            )}
            {candidate.status !== "unavailable" && (
              <button type="button" className="text-xs underline" onClick={() => {
                const selection = selectedModels[candidate.endpoint];
                setEndpointDraft(candidate.endpoint);
                setModelDraft(selection && candidate.models.includes(selection) ? selection : candidate.models[0] ?? "");
                setUseTokenDraft(candidate.useToken || (candidate.endpoint === endpoint && useToken));
                setTokenDraft("");
                setError(null);
                setMessage(candidate.status === "auth_required"
                  ? "Save the server token in the local vault, then check this URL again."
                  : "Existing endpoint selected. Click Save to use it.");
              }}>
                {candidate.status === "auth_required" ? "Configure authentication" : "Use this endpoint"}
              </button>
            )}
          </div>
        ))}
      </div>
      <label className="block space-y-1">
        <span className="font-medium">Chat completions endpoint</span>
        <input
          aria-label="Chat completions endpoint"
          className="w-full rounded border border-[var(--athanor-mist)] px-2 py-1"
          value={endpointDraft}
          onChange={(event) => setEndpointDraft(event.target.value)}
          placeholder="https://models.example/v1/chat/completions"
          autoComplete="off"
        />
      </label>
      <button
        type="button"
        disabled={discovering || !endpointDraft.trim()}
        className="text-xs underline disabled:opacity-50"
        onClick={() => void discover(endpointDraft.trim(), useTokenDraft)}
      >
        Check this URL{useTokenDraft ? " with saved vault token" : ""}
      </button>
      <label className="block space-y-1">
        <span className="font-medium">Model ID</span>
        <input
          aria-label="Model ID"
          className="w-full rounded border border-[var(--athanor-mist)] px-2 py-1"
          value={modelDraft}
          onChange={(event) => setModelDraft(event.target.value)}
          autoComplete="off"
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="font-medium">Use API token</span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Use API token"
          className="peer sr-only"
          checked={useTokenDraft}
          onChange={(event) => {
            setUseTokenDraft(event.target.checked);
            setTokenDraft("");
            setError(null);
            setMessage(null);
          }}
        />
        <span
          aria-hidden="true"
          className="relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[var(--athanor-ink)] peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--athanor-ink)] peer-focus-visible:ring-offset-2"
        />
      </label>
      <p className="text-xs text-[var(--athanor-slate)]">
        Turn off for local or other endpoints that do not require authentication.
      </p>
      {useTokenDraft && (
        <label className="block space-y-1">
          <span className="font-medium">Token</span>
          <input
            aria-label="Assistant token"
            className="w-full rounded border border-[var(--athanor-mist)] px-2 py-1"
            type="password"
            value={tokenDraft}
            onChange={(event) => setTokenDraft(event.target.value)}
            placeholder="Write-only"
            autoComplete="new-password"
          />
        </label>
      )}
      <p className="text-xs text-[var(--athanor-slate)]">{assistantTokenStatus(stored, useTokenDraft)}</p>
      {message && <p className="text-xs text-[var(--athanor-slate)]">{message}</p>}
      {error && (
        <p className="text-xs text-red-700">
          {error}{" "}
          <button type="button" className="underline" onClick={onOpenVault}>
            Open the local vault
          </button>
        </p>
      )}
      <button type="submit" className="rounded bg-[var(--athanor-ink)] px-2.5 py-1 text-white">
        Save
      </button>
    </form>
  );
}
