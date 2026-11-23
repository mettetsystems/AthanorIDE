"use client";
import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  ExpandableSection,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextArea,
  TextInput,
} from "@patternfly/react-core";

type Property = { type?: string; description?: string; [key: string]: unknown };
type Schema = { type?: string; properties?: Record<string, Property>; required?: string[]; [key: string]: unknown };

/** A small field builder preserves advanced schemas via the JSON editor. */
export function ToolSchemaEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draftName, setDraftName] = useState("");
  let schema: Schema | null = null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) schema = parsed as Schema;
  } catch { /* Keep malformed text editable. */ }
  const properties = schema?.properties;
  const simple = schema?.type === "object" && (schema.required === undefined || (Array.isArray(schema.required) && schema.required.every((name) => typeof name === "string"))) && (!properties || (typeof properties === "object" && !Array.isArray(properties) && Object.values(properties).every((property) => property && typeof property === "object" && !Array.isArray(property))));
  const update = (next: Schema) => onChange(JSON.stringify(next, null, 2));
  return (
    <div>
      {simple && schema && (
        <>
          {Object.entries(properties ?? {}).map(([name, property]) => (
            <div key={name}>
              <FormGroup label={name}>
                <Button
                  variant="link"
                  isDanger
                  onClick={() => {
                    const next = { ...properties };
                    delete next[name];
                    update({ ...schema, properties: next, required: (schema?.required ?? []).filter((item) => item !== name) });
                  }}
                >
                  Remove
                </Button>
                <FormSelect
                  aria-label={`${name} type`}
                  value={property.type ?? "string"}
                  onChange={(_event, next) => update({ ...schema, properties: { ...properties, [name]: { ...property, type: next } } })}
                >
                  {["string", "number", "integer", "boolean", "object", "array"].map((type) => (
                    <FormSelectOption key={type} value={type} label={type} />
                  ))}
                </FormSelect>
                <TextInput
                  aria-label={`${name} description`}
                  placeholder="Describe this argument"
                  value={property.description ?? ""}
                  onChange={(_event, next) => update({ ...schema, properties: { ...properties, [name]: { ...property, description: next } } })}
                />
                <Checkbox
                  id={`schema-required-${name}`}
                  label="Required"
                  isChecked={(schema.required ?? []).includes(name)}
                  onChange={(_event, checked) =>
                    update({
                      ...schema,
                      required: checked
                        ? [...new Set([...(schema?.required ?? []), name])]
                        : (schema?.required ?? []).filter((item) => item !== name),
                    })
                  }
                />
              </FormGroup>
            </div>
          ))}
          <FormGroup label="New argument">
            <TextInput
              aria-label="New argument name"
              placeholder="Argument name"
              value={draftName}
              onChange={(_event, next) => setDraftName(next)}
            />
            <Button
              variant="link"
              isDisabled={!/^[A-Za-z_][A-Za-z0-9_]*$/.test(draftName) || Object.hasOwn(properties ?? {}, draftName) || ["__proto__", "constructor", "prototype"].includes(draftName)}
              onClick={() => {
                update({ ...schema, properties: { ...properties, [draftName]: { type: "string" } } });
                setDraftName("");
              }}
            >
              Add
            </Button>
          </FormGroup>
        </>
      )}
      {!schema && <Alert variant="danger" isInline title="Invalid JSON. Correct the schema below." />}
      <ExpandableSection toggleText="JSON Schema · advanced" isExpanded={!simple}>
        <TextArea
          aria-label="Tool input JSON Schema"
          rows={7}
          value={value}
          onChange={(_event, next) => onChange(next)}
        />
      </ExpandableSection>
    </div>
  );
}
