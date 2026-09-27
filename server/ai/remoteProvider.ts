import { planJsonSchema } from "../../apps/web/src/ai/prompt.js";
import { remotePreset } from "../../apps/web/src/ai/remoteCatalog.js";
import type { ModelProvider } from "../../apps/web/src/ai/planner.js";
import { pinnedJsonPost } from "./safeEndpoint.js";

export type RemoteConfig = { providerId: string; modelId: string; baseUrl?: string; secret: string; authMode?: "bearer" | "x-api-key" | "none" };
export function validateRemoteConfig(value: unknown, requireModel = true): RemoteConfig {
  if (!value || typeof value !== "object") throw new Error("INVALID_REQUEST");
  const v = value as Record<string, unknown>;
  if (typeof v.providerId !== "string" || (v.providerId !== "custom" && !remotePreset(v.providerId)) ||
    typeof v.modelId !== "string" || (requireModel && !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/.test(v.modelId)) || v.modelId.length > 160 ||
    typeof v.secret !== "string" || v.secret.length > 4096 || (v.providerId !== "custom" && !v.secret.trim()) ||
    (v.authMode !== undefined && !["bearer", "x-api-key", "none"].includes(String(v.authMode))) ||
    ((v.providerId === "custom" || !remotePreset(String(v.providerId))?.baseUrl) && (typeof v.baseUrl !== "string" || v.baseUrl.length > 300))) throw new Error("INVALID_REQUEST");
  return v as RemoteConfig;
}
function failure(status: number, data: unknown): Error {
  const error = data && typeof data === "object" && "error" in data ? (data as { error: unknown }).error : null;
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
  if (/content|safety|policy|refusal/i.test(code)) return new Error("SAFETY_REFUSAL");
  if (status === 401 || status === 403) return new Error("CREDENTIAL_REJECTED");
  if (status === 429) return new Error(/quota|insufficient/i.test(code) ? "QUOTA_EXHAUSTED" : "RATE_LIMIT");
  if (status === 404 || /model/i.test(code)) return new Error("MODEL_UNAVAILABLE");
  if (status >= 500) return new Error("PROVIDER_UNAVAILABLE");
  return new Error("PROVIDER_UNAVAILABLE");
}
async function fixedPost(url: string, body: unknown, headers: Record<string, string>): Promise<{ status: number; data: unknown }> {
  let response: Response;
  try { response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(30000), redirect: "error" }); }
  catch (error) { throw new Error(error instanceof Error && error.name === "TimeoutError" ? "TIMEOUT" : "NETWORK_FAILURE"); }
  const text = await response.text();
  if (text.length > 65536) throw new Error("INVALID_MODEL_RESPONSE");
  let data: unknown;
  try { data = JSON.parse(text) as unknown; } catch { throw new Error("INVALID_MODEL_RESPONSE"); }
  return { status: response.status, data };
}
export function remoteModelProvider(config: RemoteConfig): ModelProvider {
  return { async generate(prompt, schema = planJsonSchema) {
    const preset = remotePreset(config.providerId);
    const anthropic = preset?.protocol === "anthropic";
    const body = anthropic
      ? { model: config.modelId, max_tokens: 2500, messages: [{ role: "user", content: prompt }], tools: [{ name: "kinetable_plan", description: "Return the exact validated assembly proposal.", input_schema: schema }], tool_choice: { type: "tool", name: "kinetable_plan" } }
      : { model: config.modelId, max_tokens: 2500, stream: false, messages: [{ role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { name: "kinetable_plan", strict: true, schema } } };
    const response = !preset?.baseUrl
      ? await pinnedJsonPost(config.baseUrl!, "chat/completions", body, config.secret, config.authMode ?? "bearer")
      : await fixedPost(`${preset!.baseUrl}/${anthropic ? "messages" : "chat/completions"}`, body, anthropic
        ? { "Content-Type": "application/json", "x-api-key": config.secret, "anthropic-version": "2023-06-01" }
        : { "Content-Type": "application/json", Authorization: `Bearer ${config.secret}` });
    if (response.status >= 400) throw failure(response.status, response.data);
    const data = response.data as Record<string, unknown>;
    if (anthropic) {
      const blocks = data.content as { type?: string; name?: string; input?: unknown }[] | undefined;
      const input = blocks?.find(block => block.type === "tool_use" && block.name === "kinetable_plan")?.input;
      if (!input) throw new Error("INVALID_MODEL_RESPONSE");
      return input;
    }
    const choice = (data.choices as { finish_reason?: string; message?: { content?: unknown; refusal?: unknown } }[] | undefined)?.[0];
    if (choice?.message?.refusal || choice?.finish_reason === "content_filter") throw new Error("SAFETY_REFUSAL");
    const content = choice?.message?.content;
    if (typeof content !== "string" || content.length > 32000) throw new Error("INVALID_MODEL_RESPONSE");
    try { return JSON.parse(content) as unknown; } catch { throw new Error("INVALID_MODEL_RESPONSE"); }
  } };
}
