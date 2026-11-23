"use client";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  ExpandableSection,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  SearchInput,
  TextArea,
  TextInput,
} from "@patternfly/react-core";

import { OFFICIAL_MCP_REGISTRY, parseMcpImport, searchMcpRegistry, type McpCandidate } from "@/lib/mcp-import";
import { candidateSearchText, cosineSimilarity, loadMcpCandidates, loadMcpVectors, saveMcpCandidates, saveMcpVectors, searchMcpCandidates } from "@/lib/mcp-registry-search";
import { embedMcpSearchTexts, loadSemanticModel, unloadSemanticModel } from "@/lib/mcp-semantic-search";
import { useProjectStore } from "@/store/project-store";
import { useSelectionStore } from "@/store/selection-store";

export function McpImportPanel({ onClose }: { onClose: () => void }) {
  const [registry, setRegistry] = useState(OFFICIAL_MCP_REGISTRY);
  const [query, setQuery] = useState("");
  const [raw, setRaw] = useState("");
  const [items, setItems] = useState<McpCandidate[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [searchMode, setSearchMode] = useState<"keyword" | "semantic">("keyword");
  const [cachedItems, setCachedItems] = useState<McpCandidate[]>([]);
  const [semanticModelLoaded, setSemanticModelLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    void loadMcpCandidates().then((saved) => {
      if (!active) return;
      setCachedItems(saved);
      setItems(saved);
      setStatus(saved.length ? `${saved.length} servers available in the local registry cache.` : "Search online to create a local registry cache. Keyword search works offline afterward.");
    });
    return () => { active = false; unloadSemanticModel(); };
  }, []);

  const search = async (next?: string) => {
    setLoading(true); setError(""); setStatus("");
    try {
      const page = await searchMcpRegistry(registry, query, next);
      await saveMcpCandidates(page.items);
      const saved = await loadMcpCandidates();
      setCachedItems(saved); setItems(page.items); setCursor(page.nextCursor);
      setStatus(page.items.length ? `${page.items.length} server variants fetched. ${saved.length} variants are now cached locally.` : "No supported servers on this page.");
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Could not reach registry."} If this registry blocks browser access, paste or upload its server.json below.`);
    } finally { setLoading(false); }
  };

  const searchCached = async () => {
    setError(""); setCursor(undefined);
    const saved = await loadMcpCandidates();
    setCachedItems(saved);
    if (searchMode === "keyword") {
      const matches = searchMcpCandidates(saved, query);
      setItems(matches); setStatus(`${matches.length} local keyword/topic matches${saved.length ? ` from ${saved.length} cached servers` : ""}.`);
      return;
    }
    if (!saved.length) { setItems([]); setStatus("No local servers are cached yet. Search online once to create a cache for offline semantic search."); return; }

    setLoading(true); setStatus("Starting local semantic search…");
    try {
      await loadSemanticModel(setStatus);
      setSemanticModelLoaded(true);
      const vectors = await loadMcpVectors(saved.map((candidate) => candidate.id));
      const missing = saved.filter((candidate) => !vectors.has(candidate.id));
      for (let start = 0; start < missing.length; start += 32) {
        const batch = missing.slice(start, start + 32);
        const generated = await embedMcpSearchTexts(batch.map(candidateSearchText), setStatus);
        batch.forEach((candidate, index) => {
          const vector = generated[index];
          if (vector) vectors.set(candidate.id, vector);
        });
      }
      await saveMcpVectors(vectors);
      const [queryVector] = await embedMcpSearchTexts([query || "MCP server tools and integrations"], setStatus);
      if (!queryVector) throw new Error("The local model did not return a query embedding.");
      const matches = saved.map((candidate) => ({ candidate, score: cosineSimilarity(queryVector, vectors.get(candidate.id) ?? []) }))
        .filter((item) => item.score >= 0.15)
        .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name))
        .slice(0, 40).map((item) => item.candidate);
      setItems(matches); setStatus(`${matches.length} semantic matches, ranked locally from ${saved.length} cached servers. Model and vectors are cached in this browser.`);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Local semantic search failed."} CPU keyword search remains available.`);
    } finally { setLoading(false); }
  };

  const parse = (value: string) => {
    setError(""); setCursor(undefined);
    try { const next = parseMcpImport(value); setItems(next); setStatus(`${next.length} server variants ready to review`); }
    catch (e) { setError(e instanceof Error ? e.message : "Invalid manifest."); }
  };

  return (
    <Modal isOpen variant="large" onClose={onClose} aria-label="Import MCP servers">
      <ModalHeader title="Import MCP servers" />
      <ModalBody>
        <p>Discover servers in the official MCP Registry from the AAIF ecosystem, use a compatible registry, or import a server configuration. Listings are published by their providers.</p>
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            void searchCached();
          }}
        >
          <FormGroup label="Registry URL" fieldId="mcp-registry">
            <TextInput
              id="mcp-registry"
              aria-label="Registry URL"
              value={registry}
              onChange={(_event, value) => { setRegistry(value); setCursor(undefined); }}
            />
          </FormGroup>
          <FormGroup label="Search mode" fieldId="mcp-mode">
            <FormSelect
              id="mcp-mode"
              aria-label="MCP search mode"
              value={searchMode}
              onChange={(_event, value) => setSearchMode(value as "keyword" | "semantic")}
            >
              <FormSelectOption value="keyword" label="Keywords and topics · CPU only · offline" />
              <FormSelectOption value="semantic" label="Semantic · local model · CPU" />
            </FormSelect>
          </FormGroup>
          <SearchInput
            aria-label="Search MCP servers"
            value={query}
            onChange={(_event, value) => { setQuery(value); setCursor(undefined); }}
            placeholder={searchMode === "keyword" ? "Search names, descriptions, or topic:database…" : "Describe what you want a server to do…"}
          />
          <Button type="submit" variant="primary" isDisabled={loading}>
            {loading ? "Searching…" : searchMode === "keyword" ? "Search local cache" : "Search semantically"}
          </Button>
          <Button type="button" variant="secondary" isDisabled={loading} onClick={() => { setCursor(undefined); void search(); }}>
            {loading ? "Working…" : "Search registry online"}
          </Button>
          {semanticModelLoaded && (
            <Button
              type="button"
              variant="secondary"
              isDisabled={loading}
              onClick={() => {
                unloadSemanticModel();
                setSemanticModelLoaded(false);
                setStatus("Semantic model released from memory. Cached files and vectors remain available locally.");
              }}
            >
              Release model from memory
            </Button>
          )}
          <p>
            {cachedItems.length} cached server variants · {searchMode === "semantic" ? "first use downloads about 24 MB; runs in a background CPU worker" : "local topic and keyword matching"}
          </p>
        </Form>
        <ExpandableSection toggleText="Import server.json or mcpServers configuration">
          <TextArea
            aria-label="MCP manifest JSON"
            rows={5}
            value={raw}
            onChange={(_event, value) => setRaw(value)}
            placeholder='{"mcpServers":{"my-tools":{"url":"https://example.com/mcp"}}}'
          />
          <Button type="button" variant="secondary" onClick={() => parse(raw)}>Review JSON</Button>
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>Upload JSON</Button>
          <input
            ref={fileRef}
            aria-label="MCP manifest file"
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                if (file.size > 2_000_000) setError("Manifest exceeds 2 MB.");
                else try { parse(await file.text()); } catch { setError("Could not read the manifest."); }
              }
              event.target.value = "";
            }}
          />
        </ExpandableSection>
        {error && <Alert variant="danger" isInline title={error} />}
        <p role="status">{status}</p>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <Card>
                <CardBody>
                  <h3>{item.name}</h3>
                  <p>{item.transport} · {String(item.template.node.metadata?.serverVersion || "custom")}</p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const id = useProjectStore.getState().addTemplate(item.template);
                      useSelectionStore.getState().focusNode(id);
                      onClose();
                    }}
                  >
                    Add to canvas
                  </Button>
                  <p>{item.description}</p>
                  <p aria-label="Server topics">
                    {item.topics.map((topic) => <Label key={topic}>{topic}</Label>)}
                  </p>
                  <p>{String(item.template.node.configuration.endpoint || item.template.node.configuration.packageSpec || item.template.node.configuration.command)}</p>
                  <ul>{item.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
        {cursor && (
          <Button type="button" variant="secondary" isDisabled={loading} onClick={() => void search(cursor)}>
            Next online page
          </Button>
        )}
        <p>Import reads metadata only. Configure allowed tools and environment names in the inspector. Export to build and run in a sandbox.</p>
      </ModalBody>
    </Modal>
  );
}
