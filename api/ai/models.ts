import type { IncomingMessage, ServerResponse } from "node:http";
import { remotePreset } from "../../apps/web/src/ai/remoteCatalog.js";
import { validateRemoteConfig } from "../../server/ai/remoteProvider.js";
import { pinnedJsonGet } from "../../server/ai/safeEndpoint.js";
import { readJsonObject } from "../../server/ai/requestBody.js";

type Request = IncomingMessage & { body?: unknown };
export default async function handler(req: Request, res: ServerResponse) {
  res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ code: "METHOD_NOT_ALLOWED" })); }
  try {
    const body = await readJsonObject(req, 8192);
    const config = validateRemoteConfig(body, false), preset = remotePreset(config.providerId);
    if (preset && !preset.models) throw new Error("MODEL_DISCOVERY_UNAVAILABLE");
    const response = preset?.baseUrl
      ? await fetch(`${preset.baseUrl}/models`, { headers: preset.protocol === "anthropic" ? { "x-api-key": config.secret, "anthropic-version": "2023-06-01" } : { Authorization: `Bearer ${config.secret}` }, signal: AbortSignal.timeout(10000), redirect: "error" }).then(async response => ({ status: response.status, data: await response.json() as unknown }))
      : await pinnedJsonGet(config.baseUrl!, "models", config.secret, config.authMode ?? "bearer");
    if (response.status >= 400) throw new Error(response.status === 401 ? "CREDENTIAL_REJECTED" : "MODEL_DISCOVERY_UNAVAILABLE");
    const value = response.data as { data?: unknown; models?: unknown };
    const list = Array.isArray(value.data) ? value.data : Array.isArray(value.models) ? value.models : null;
    if (!list) throw new Error("MODEL_DISCOVERY_UNAVAILABLE");
    const models = list.map(item => item && typeof item === "object" && "id" in item ? item.id : null).filter((id): id is string => typeof id === "string").slice(0, 300);
    return res.end(JSON.stringify({ models }));
  } catch (error) {
    const code = error instanceof Error && ["INVALID_REQUEST", "INVALID_ENDPOINT", "CREDENTIAL_REJECTED", "MODEL_DISCOVERY_UNAVAILABLE", "NETWORK_FAILURE"].includes(error.message) ? error.message : "MODEL_DISCOVERY_UNAVAILABLE";
    res.statusCode = code === "INVALID_REQUEST" || code === "INVALID_ENDPOINT" ? 400 : 503;
    return res.end(JSON.stringify({ code }));
  }
}
