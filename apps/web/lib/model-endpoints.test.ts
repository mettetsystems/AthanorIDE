import { afterEach, describe, expect, it, vi } from "vitest";

import { discoverModelEndpoints } from "@/lib/model-endpoints";

afterEach(() => vi.unstubAllGlobals());

describe("model endpoint discovery", () => {
  it("scans without authentication and preserves the server's exact model IDs", async () => {
    const items = [{
      base_url: "http://localhost:8080/v1", endpoint: "http://localhost:8080/v1/chat/completions",
      models: ["org/model.gguf", "other-model"], status: "ready", detail: "Listed", useToken: false,
    }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await discoverModelEndpoints()).toEqual(items);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ endpoint: "", useToken: false });
  });

  it("requests vault authentication for only the selected URL and surfaces failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Unlock the vault." }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(discoverModelEndpoints("https://host/custom/v1", true)).rejects.toThrow("Unlock the vault.");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ endpoint: "https://host/custom/v1", useToken: true });
  });
});
