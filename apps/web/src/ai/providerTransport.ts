import type { Session } from "@supabase/supabase-js";
import type { KinetableProjectV3 } from "../projects/v3.js";
import type { PlanRequest } from "./contract.js";
import { credentialVault } from "./credentialVault.js";
import type { RouteCandidate } from "./routing.js";

const bridge = "http://127.0.0.1:46837";
let token: string | null = null;
export async function connectBridge(value: string): Promise<void> {
  const response = await fetch(`${bridge}/v1/handshake`, { method: "POST", headers: { Authorization: `Bearer ${value}` }, signal: AbortSignal.timeout(5000) });
  if (!response.ok || (await response.json() as { version?: number }).version !== 1) throw new Error("LOCAL_BRIDGE_UNAVAILABLE");
  token = value;
}
export function bridgeConnected(): boolean { return !!token; }
export async function bridgeRequest(path: string, body: unknown): Promise<unknown> {
  if (!token) throw new Error("LOCAL_BRIDGE_UNAVAILABLE");
  let response: Response;
  try { response = await fetch(`${bridge}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(path === "/v1/plan" ? 125000 : 10000) }); }
  catch { throw new Error("LOCAL_BRIDGE_UNAVAILABLE"); }
  const value = await response.json().catch(() => null) as { code?: string } | null;
  if (!response.ok) throw new Error(value?.code ?? "LOCAL_BRIDGE_UNAVAILABLE");
  return value;
}
function localConfig(route: RouteCandidate) {
  const defaults: Record<string, number> = { ollama: 11434, lmstudio: 1234, vllm: 8000 };
  let port = defaults[route.providerId];
  if (route.baseUrl) {
    let url: URL;
    try { url = new URL(route.baseUrl); } catch { throw new Error("INVALID_REQUEST"); }
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("INVALID_REQUEST");
    port = Number(url.port);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("INVALID_REQUEST");
  return { runtime: route.providerId, port, modelId: route.modelId };
}
export async function invokeProvider(route: RouteCandidate, credentialId: string | null, input: PlanRequest, project: KinetableProjectV3, session: Session | null): Promise<unknown> {
  if (route.transport === "LOCAL_HTTP" || route.transport === "LOCAL_CLI") {
    return bridgeRequest("/v1/plan", { transport: route.transport, providerId: route.providerId, modelId: route.modelId, config: route.transport === "LOCAL_HTTP" ? localConfig(route) : undefined, input, project });
  }
  const secret = credentialId ? await credentialVault.get(credentialId) : null;
  if (!secret && route.authMode !== "none") throw new Error("CREDENTIAL_UNAVAILABLE");
  let response: Response;
  try { response = await fetch("/api/ai/plan", { method: "POST", headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify({ input, project: session ? undefined : project, provider: { providerId: route.providerId, modelId: route.modelId, baseUrl: route.baseUrl, authMode: route.authMode, secret: secret ?? "" } }), signal: AbortSignal.timeout(35000) }); }
  catch { throw new Error("NETWORK_FAILURE"); }
  const value = await response.json().catch(() => null) as { code?: string } | null;
  if (!response.ok) throw new Error(value?.code ?? "NETWORK_FAILURE");
  return value;
}
const modelCache = new Map<string, { until: number; models: string[] }>();
export async function discoverRoute(route: RouteCandidate, credentialId: string | null): Promise<{ models?: string[]; available?: boolean; version?: string }> {
  const cached = modelCache.get(route.id);
  if (cached && cached.until > Date.now()) return { models: cached.models, available: true };
  if (route.transport === "LOCAL_HTTP" || route.transport === "LOCAL_CLI") return await bridgeRequest("/v1/models", { transport: route.transport, providerId: route.providerId, config: route.transport === "LOCAL_HTTP" ? localConfig(route) : undefined }) as { models?: string[]; available?: boolean; version?: string };
  const secret = credentialId ? await credentialVault.get(credentialId) : null;
  if (!secret && route.authMode !== "none") throw new Error("CREDENTIAL_UNAVAILABLE");
  const response = await fetch("/api/ai/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerId: route.providerId, modelId: route.modelId, baseUrl: route.baseUrl, authMode: route.authMode, secret: secret ?? "" }), signal: AbortSignal.timeout(12000) });
  const data = await response.json().catch(() => null) as { code?: string; models?: string[] } | null;
  if (!response.ok) throw new Error(data?.code ?? "MODEL_DISCOVERY_UNAVAILABLE");
  modelCache.set(route.id, { until: Date.now() + 60000, models: data?.models ?? [] });
  return { models: data?.models ?? [], available: true };
}
export async function testRoute(route: RouteCandidate, credentialId: string | null): Promise<void> {
  if (route.transport === "LOCAL_HTTP" || route.transport === "LOCAL_CLI") {
    await bridgeRequest("/v1/test", { transport: route.transport, providerId: route.providerId, modelId: route.modelId, config: route.transport === "LOCAL_HTTP" ? localConfig(route) : undefined });
    return;
  }
  const secret = credentialId ? await credentialVault.get(credentialId) : null;
  if (!secret && route.authMode !== "none") throw new Error("CREDENTIAL_UNAVAILABLE");
  const response = await fetch("/api/ai/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerId: route.providerId, modelId: route.modelId, baseUrl: route.baseUrl, authMode: route.authMode, secret: secret ?? "" }), signal: AbortSignal.timeout(35000) });
  const data = await response.json().catch(() => null) as { code?: string } | null;
  if (!response.ok) throw new Error(data?.code ?? "PROVIDER_UNAVAILABLE");
}
export async function manageLocalRoute(route: RouteCandidate, action: "permit" | "start" | "stop", allowed?: boolean): Promise<void> {
  if (route.transport !== "LOCAL_HTTP") throw new Error("INVALID_REQUEST");
  await bridgeRequest("/v1/manage", { action, allowed, config: localConfig(route) });
}
