"use client";

/**
 * Local vault panel: store secret values for local runs (API-encrypted).
 * Graphs keep secret names only; values never enter project-store.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Form,
  FormGroup,
  Label,
  TextInput,
  Title,
} from "@patternfly/react-core";
import { LockIcon, LockOpenIcon, ShieldAltIcon, TimesIcon, TrashIcon } from "@patternfly/react-icons";

import {
  collectLocalSecretNames,
  deleteVaultEntry,
  fetchVaultCoverage,
  fetchVaultStatus,
  initVault,
  listVaultEntries,
  lockVault,
  materializeVaultEnv,
  putVaultEntry,
  unlockVault,
  type VaultCoverage,
  type VaultEntryMeta,
  type VaultStatus,
} from "@/lib/vault";
import { useProjectStore } from "@/store/project-store";

type LocalVaultPanelProps = {
  open: boolean;
  onClose: () => void;
  initialSecretName?: string;
};

export function LocalVaultPanel({
  open,
  onClose,
  initialSecretName = "",
}: LocalVaultPanelProps) {
  const graph = useProjectStore((state) => state.graph);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [entries, setEntries] = useState<VaultEntryMeta[]>([]);
  const [coverage, setCoverage] = useState<VaultCoverage | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [secretName, setSecretName] = useState(initialSecretName);
  const [secretValue, setSecretValue] = useState("");
  const [materializePath, setMaterializePath] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const next = await fetchVaultStatus();
    setStatus(next);
    if (next.unlocked) {
      setEntries(await listVaultEntries());
      setCoverage(await fetchVaultCoverage(graph));
    } else {
      setEntries([]);
      setCoverage(null);
    }
  }, [graph]);

  useEffect(() => {
    if (!open) return;
    setSecretName(initialSecretName);
    setError(null);
    setMessage(null);
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load vault status");
    });
  }, [open, initialSecretName, refresh]);

  if (!open) return null;

  const graphNames = collectLocalSecretNames(graph);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Vault operation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside aria-label="Local secrets vault">
      <Title headingLevel="h2">
        <ShieldAltIcon /> Local vault
      </Title>
      <Button variant="plain" aria-label="Close local vault" icon={<TimesIcon />} onClick={onClose} />
      <p>
        Store secret values encrypted on this machine for local runs. Graphs keep secret names only.
      </p>
      {status && (
        <p>
          {status.exists ? (status.unlocked ? "Unlocked" : "Locked") : "Not initialized"}
          {status.unlocked && status.entryCount != null ? ` · ${status.entryCount} secret(s)` : ""}
        </p>
      )}
      {!status?.exists && (
        <Card>
          <CardBody>
            <Form>
              <p>Create a passphrase-protected vault (min 8 characters). There is no recovery if lost.</p>
              <FormGroup label="Passphrase" fieldId="vault-init-passphrase">
                <TextInput
                  id="vault-init-passphrase"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Passphrase"
                  value={passphrase}
                  onChange={(_event, value) => setPassphrase(value)}
                />
              </FormGroup>
              <Button
                variant="primary"
                icon={<LockOpenIcon />}
                isDisabled={busy || passphrase.length < 8}
                onClick={() =>
                  void run(async () => {
                    await initVault(passphrase);
                    setPassphrase("");
                    setMessage("Vault created and unlocked.");
                  })
                }
              >
                Initialize vault
              </Button>
            </Form>
          </CardBody>
        </Card>
      )}
      {status?.exists && !status.unlocked && (
        <Card>
          <CardBody>
            <Form>
              <FormGroup label="Passphrase" fieldId="vault-unlock-passphrase">
                <TextInput
                  id="vault-unlock-passphrase"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Passphrase"
                  value={passphrase}
                  onChange={(_event, value) => setPassphrase(value)}
                />
              </FormGroup>
              <Button
                variant="primary"
                icon={<LockOpenIcon />}
                isDisabled={busy || !passphrase}
                onClick={() =>
                  void run(async () => {
                    await unlockVault(passphrase);
                    setPassphrase("");
                    setMessage("Vault unlocked.");
                  })
                }
              >
                Unlock
              </Button>
            </Form>
          </CardBody>
        </Card>
      )}
      {status?.unlocked && (
        <>
          <Button
            variant="secondary"
            icon={<LockIcon />}
            isDisabled={busy}
            onClick={() =>
              void run(async () => {
                await lockVault();
                setMessage("Vault locked.");
              })
            }
          >
            Lock vault
          </Button>
          <Card>
            <CardBody>
              <Form>
                <Title headingLevel="h3">Add / update secret</Title>
                <FormGroup label="Secret name" fieldId="vault-secret-name">
                  <TextInput
                    id="vault-secret-name"
                    placeholder="Secret name (e.g. HF_TOKEN)"
                    value={secretName}
                    onChange={(_event, value) => setSecretName(value)}
                    list="vault-graph-secret-names"
                  />
                </FormGroup>
                <datalist id="vault-graph-secret-names">
                  {graphNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <FormGroup label="Secret value" fieldId="vault-secret-value">
                  <TextInput
                    id="vault-secret-value"
                    type="password"
                    autoComplete="off"
                    placeholder="Secret value"
                    value={secretValue}
                    onChange={(_event, value) => setSecretValue(value)}
                  />
                </FormGroup>
                <Button
                  variant="primary"
                  isDisabled={busy || !secretName.trim() || !secretValue}
                  onClick={() =>
                    void run(async () => {
                      await putVaultEntry(secretName.trim(), secretValue);
                      setSecretValue("");
                      setMessage(`Saved ${secretName.trim()} (value not shown).`);
                    })
                  }
                >
                  Save to vault
                </Button>
              </Form>
            </CardBody>
          </Card>
          <Title headingLevel="h3">Vault entries</Title>
          {entries.length === 0 && <p>No secrets stored yet.</p>}
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardBody>
                {entry.name}
                {!entry.hasValue && <Label>empty</Label>}
                <Button
                  variant="plain"
                  aria-label={`Delete ${entry.name}`}
                  icon={<TrashIcon />}
                  onClick={() =>
                    void run(async () => {
                      await deleteVaultEntry(entry.name);
                      setMessage(`Removed ${entry.name}.`);
                    })
                  }
                />
              </CardBody>
            </Card>
          ))}
          {coverage && (
            <Card>
              <CardBody>
                <Title headingLevel="h3">Graph coverage</Title>
                {coverage.requested.length === 0 ? (
                  <p>No secret names referenced in this project yet.</p>
                ) : (
                  <ul>
                    {coverage.requested.map((name) => {
                      const ok = coverage.present.includes(name);
                      return (
                        <li key={name}>
                          {name} <Label color={ok ? "green" : "orange"}>{ok ? "present" : "missing"}</Label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}
          <Form>
            <Title headingLevel="h3">Materialize .env for local apps</Title>
            <p>Absolute path on the API host (this machine). Writes a local `.env` — never included in export ZIPs.</p>
            <FormGroup label="Path" fieldId="vault-env-path">
              <TextInput
                id="vault-env-path"
                placeholder="/path/to/exported-project/.env"
                value={materializePath}
                onChange={(_event, value) => setMaterializePath(value)}
              />
            </FormGroup>
            <Button
              variant="secondary"
              isDisabled={busy || !materializePath.trim()}
              onClick={() =>
                void run(async () => {
                  const result = await materializeVaultEnv(materializePath.trim(), graph);
                  setMessage(
                    `Wrote ${result.writtenCount} secret(s) to ${result.path}` +
                      (result.missing.length ? ` (missing: ${result.missing.join(", ")})` : ""),
                  );
                })
              }
            >
              Write .env
            </Button>
          </Form>
        </>
      )}
      {message && <Alert variant="success" isInline title={message} />}
      {error && <Alert variant="danger" isInline title={error} />}
    </aside>
  );
}
