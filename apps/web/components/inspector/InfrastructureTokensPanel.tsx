"use client";

/**
 * Project-level infrastructure pull-token slots (secret names only).
 * Per-node tokenSecretName fields remain on individual nodes.
 */
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  Title,
} from "@patternfly/react-core";
import { KeyIcon, PlusCircleIcon, TimesIcon, TrashIcon } from "@patternfly/react-icons";

import {
  DEFAULT_INFRASTRUCTURE_TOKEN_KINDS,
  newId,
  type InfrastructureTokenKind,
  type InfrastructureTokenSlot,
} from "@athanor/contracts";
import { useProjectStore } from "@/store/project-store";

type InfrastructureTokensPanelProps = {
  open: boolean;
  onClose: () => void;
};

export function InfrastructureTokensPanel({ open, onClose }: InfrastructureTokensPanelProps) {
  const tokens = useProjectStore((state) => state.graph.infrastructureTokens ?? []);
  const upsertInfrastructureToken = useProjectStore((state) => state.upsertInfrastructureToken);
  const removeInfrastructureToken = useProjectStore((state) => state.removeInfrastructureToken);
  const [addKind, setAddKind] = useState<string>("");
  const [customLabel, setCustomLabel] = useState("");

  const usedBuiltins = useMemo(
    () => new Set(tokens.filter((slot) => slot.kind !== "custom").map((slot) => slot.kind)),
    [tokens],
  );

  const addOptions = useMemo(() => {
    const builtins = DEFAULT_INFRASTRUCTURE_TOKEN_KINDS.filter(
      (item) => !usedBuiltins.has(item.kind),
    ).map((item) => ({ value: item.kind, label: item.label }));
    return [...builtins, { value: "custom", label: "Custom provider…" }];
  }, [usedBuiltins]);

  if (!open) return null;

  const updateSlot = (slot: InfrastructureTokenSlot, patch: Partial<InfrastructureTokenSlot>) => {
    upsertInfrastructureToken({ ...slot, ...patch });
  };

  const handleAdd = () => {
    if (!addKind) return;
    if (addKind === "custom") {
      const label = customLabel.trim() || "Custom registry";
      upsertInfrastructureToken({
        id: newId(),
        kind: "custom",
        label,
        secretName: "",
        provider: "env",
        recommendedEnvName: "",
      });
      setCustomLabel("");
      setAddKind("");
      return;
    }
    const preset = DEFAULT_INFRASTRUCTURE_TOKEN_KINDS.find((item) => item.kind === addKind);
    if (!preset) return;
    upsertInfrastructureToken({
      id: `infra-token-${preset.kind}`,
      kind: preset.kind as Exclude<InfrastructureTokenKind, "custom">,
      label: preset.label,
      secretName: "",
      provider: "env",
      recommendedEnvName: preset.recommendedEnvName,
    });
    setAddKind("");
  };

  return (
    <aside aria-label="Infrastructure pull tokens">
      <Title headingLevel="h2">
        <KeyIcon /> Infra pull tokens
      </Title>
      <Button variant="plain" aria-label="Close infrastructure tokens" onClick={onClose} icon={<TimesIcon />} />
      <p>
        Registry credentials for Hugging Face, Kaggle, Docker, and more. Store secret names only — never paste token values. Per-node tokens stay on each node’s inspector.
      </p>
      {tokens.map((slot) => (
        <Card key={slot.id}>
          <CardBody>
            <Title headingLevel="h3">{slot.label}</Title>
            {slot.kind === "custom" && (
              <Button
                variant="plain"
                aria-label={`Remove ${slot.label}`}
                icon={<TrashIcon />}
                onClick={() => removeInfrastructureToken(slot.id)}
              />
            )}
            <Form>
              <FormGroup label="Secret name" fieldId={`secret-${slot.id}`}>
                <TextInput
                  id={`secret-${slot.id}`}
                  value={slot.secretName}
                  placeholder={slot.recommendedEnvName || "MY_REGISTRY_TOKEN"}
                  onChange={(_event, value) => updateSlot(slot, { secretName: value })}
                />
              </FormGroup>
              <FormGroup label="Provider" fieldId={`provider-${slot.id}`}>
                <FormSelect
                  id={`provider-${slot.id}`}
                  value={slot.provider}
                  onChange={(_event, value) =>
                    updateSlot(slot, { provider: value as InfrastructureTokenSlot["provider"] })
                  }
                >
                  <FormSelectOption value="env" label="env" />
                  <FormSelectOption value="file" label="file" />
                  <FormSelectOption value="vault" label="vault" />
                  <FormSelectOption value="cloud_secret_manager" label="cloud_secret_manager" />
                </FormSelect>
              </FormGroup>
            </Form>
          </CardBody>
        </Card>
      ))}
      <Form>
        <FormGroup label="Add token slot" fieldId="add-token-kind">
          <FormSelect id="add-token-kind" value={addKind} onChange={(_event, value) => setAddKind(value)}>
            <FormSelectOption value="" label="Select provider…" />
            {addOptions.map((option) => (
              <FormSelectOption key={option.value} value={option.value} label={option.label} />
            ))}
          </FormSelect>
        </FormGroup>
        {addKind === "custom" && (
          <TextInput
            aria-label="Custom provider label"
            placeholder="Custom provider label"
            value={customLabel}
            onChange={(_event, value) => setCustomLabel(value)}
          />
        )}
        <Button
          variant="primary"
          icon={<PlusCircleIcon />}
          isDisabled={!addKind || (addKind === "custom" && !customLabel.trim())}
          onClick={handleAdd}
        >
          Add slot
        </Button>
      </Form>
    </aside>
  );
}
