import { z } from "zod";

import { getApiBaseUrl } from "@/lib/api";

const EndpointSchema = z.object({
  base_url: z.string(),
  endpoint: z.string(),
  models: z.array(z.string()),
  status: z.enum(["ready", "auth_required", "unavailable"]),
  detail: z.string(),
  useToken: z.boolean(),
});

export type ModelEndpoint = z.infer<typeof EndpointSchema>;

export async function discoverModelEndpoints(
  endpoint = "", useToken = false, signal?: AbortSignal,
): Promise<ModelEndpoint[]> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/assistant/endpoints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint, useToken }),
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `Endpoint discovery failed (${response.status}).`);
  }
  return z.object({ items: z.array(EndpointSchema) }).parse(await response.json()).items;
}

/** Read the Maya probe completed by the API before it accepted requests. */
export async function fetchStartupModelEndpoint(signal?: AbortSignal): Promise<ModelEndpoint | null> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/assistant/startup-endpoint`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Startup endpoint check failed (${response.status}).`);
  const { items } = z.object({ items: z.array(EndpointSchema) }).parse(await response.json());
  return items.find((item) => item.status === "ready" && item.models.length > 0) ?? null;
}
