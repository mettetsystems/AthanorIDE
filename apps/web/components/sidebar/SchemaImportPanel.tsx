"use client";

import { useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Form,
  Modal,
  ModalBody,
  ModalHeader,
  TextArea,
} from "@patternfly/react-core";

import { parseSchemaImport, type ImportedTool } from "@/lib/schema-import";
import { useProjectStore } from "@/store/project-store";
import { useSelectionStore } from "@/store/selection-store";

export function SchemaImportPanel({ onClose }: { onClose: () => void }) {
  const [raw, setRaw] = useState("");
  const [items, setItems] = useState<ImportedTool[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const parse = (content: string, name?: string) => {
    try {
      setItems(parseSchemaImport(content, name));
      setError("");
    } catch (reason) {
      setItems([]);
      setError(reason instanceof Error ? reason.message : "Could not parse schema.");
    }
  };
  const add = (tool: ImportedTool) => {
    const schemaOnly = tool.sourceKind !== "openapi";
    const type = schemaOnly ? "multi_agent.tool_definition" : "agent.tool";
    const id = useProjectStore.getState().addNode(type, {
      x: 100 + Math.random() * 100,
      y: 100 + Math.random() * 100,
    });
    useProjectStore.getState().updateNodeConfiguration(id, {
      toolName: tool.name,
      description: tool.description,
      ...(schemaOnly ? {} : { endpoint: tool.endpoint, method: tool.method }),
      inputSchema: JSON.stringify(tool.inputSchema, null, 2),
      importedFrom: { kind: tool.sourceKind, version: tool.sourceVersion ?? "unknown" },
    });
    useSelectionStore.getState().focusNode(id);
  };
  return (
    <Modal isOpen variant="large" onClose={onClose} aria-label="Import tool schemas">
      <ModalHeader title="Import API and tool schemas" />
      <ModalBody>
        <p>
          Paste or upload OpenAPI JSON, a JSON Schema, or an MCP tools/list result. Athanor reads schemas only; it does not connect, install packages, or call a model. Review each generated block and configure its runtime before use.
        </p>
        <Form>
          <TextArea
            aria-label="API or tool schema JSON"
            rows={8}
            value={raw}
            onChange={(_event, value) => setRaw(value)}
            placeholder='{"openapi":"3.1.0","paths":{...}}'
          />
          <Button variant="secondary" onClick={() => parse(raw)}>
            Review schemas
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Upload JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Upload schema file"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                if (file.size > 2_000_000) setError("Schema file exceeds 2 MB.");
                else {
                  const text = await file.text();
                  setRaw(text);
                  parse(text, file.name);
                }
              }
              event.target.value = "";
            }}
          />
        </Form>
        {error && <Alert variant="danger" isInline title={error} />}
        <ul>
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              <Card>
                <CardBody>
                  <strong>{item.name}</strong>
                  <p>
                    {item.method} {item.endpoint || "Schema only; no endpoint will be called"} · {item.sourceKind}{" "}
                    {item.sourceVersion ?? ""}
                  </p>
                  <p>{item.description}</p>
                  <Button variant="secondary" onClick={() => add(item)}>
                    Add block
                  </Button>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </ModalBody>
    </Modal>
  );
}
