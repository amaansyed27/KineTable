import { planJsonSchema } from "../../apps/web/src/ai/prompt.js";
import type { ModelProvider } from "../../apps/web/src/ai/planner.js";

export type LocalRuntime = "ollama" | "lmstudio" | "vllm";
export type LocalRuntimeConfig = { runtime: LocalRuntime; port: number; modelId: string };
export function validateLocalConfig(value: unknown, requireModel = true): LocalRuntimeConfig {
  if (!value || typeof value !== "object") throw new Error("INVALID_REQUEST");
  const v = value as Record<string, unknown>;
  if (!["ollama", "lmstudio", "vllm"].includes(String(v.runtime)) || !Number.isInteger(v.port) || Number(v.port) < 1 || Number(v.port) > 65535 || typeof v.modelId !== "string" || (requireModel && !v.modelId.trim()) || v.modelId.length > 160) throw new Error("INVALID_REQUEST");
  return v as LocalRuntimeConfig;
}
const base = (port: number) => `http://127.0.0.1:${port}`;
async function limitedJson(url: string, options?: RequestInit): Promise<Record<string, unknown>> {
  let response: Response;
  try { response = await fetch(url, { ...options, signal: AbortSignal.timeout(120000), redirect: "error" }); }
  catch { throw new Error("LOCAL_RUNTIME_UNAVAILABLE"); }
  if (!response.ok) throw new Error(response.status === 404 ? "MODEL_UNAVAILABLE" : response.status >= 500 ? "PROVIDER_UNAVAILABLE" : "LOCAL_RUNTIME_UNAVAILABLE");
  const text = await response.text();
  if (text.length > 65536) throw new Error("INVALID_MODEL_RESPONSE");
  try { return JSON.parse(text) as Record<string, unknown>; } catch { throw new Error("INVALID_MODEL_RESPONSE"); }
}
export async function localModels(runtime: LocalRuntime, port: number): Promise<string[]> {
  const result = await limitedJson(`${base(port)}${runtime === "ollama" ? "/api/tags" : "/v1/models"}`);
  const models = runtime === "ollama" ? result.models : result.data;
  if (!Array.isArray(models)) throw new Error("LOCAL_RUNTIME_UNAVAILABLE");
  return models.map(v => v && typeof v === "object" ? ((v as Record<string, unknown>)[runtime === "ollama" ? "name" : "id"]) : null).filter((v): v is string => typeof v === "string");
}
export function localModelProvider(config: LocalRuntimeConfig): ModelProvider {
  return { async generate(prompt, schema = planJsonSchema) {
    const installed = await localModels(config.runtime, config.port);
    if (!installed.includes(config.modelId)) throw new Error("MODEL_UNAVAILABLE");
    const ollama = config.runtime === "ollama";
    const result = await limitedJson(`${base(config.port)}${ollama ? "/api/chat" : "/v1/chat/completions"}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollama
        ? { model: config.modelId, stream: false, think: false, format: schema, options: { num_predict: 2500 }, messages: [{ role: "user", content: prompt }] }
        : { model: config.modelId, stream: false, max_tokens: 2500, response_format: { type: "json_schema", json_schema: { name: "kinetable_plan", strict: true, schema } }, messages: [{ role: "user", content: prompt }] }),
    });
    const text = ollama ? (result.message as { content?: unknown } | undefined)?.content : (result.choices as { message?: { content?: unknown } }[] | undefined)?.[0]?.message?.content;
    if (typeof text !== "string" || text.length > 32000) throw new Error("INVALID_MODEL_RESPONSE");
    try { return JSON.parse(text) as unknown; } catch { throw new Error("INVALID_MODEL_RESPONSE"); }
  } };
}
