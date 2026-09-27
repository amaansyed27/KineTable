import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { parsePlanRequest } from "../apps/web/src/ai/contract.js";
import { parsePlan } from "../apps/web/src/ai/contract.js";
import { planBehavior } from "../apps/web/src/ai/behaviorPlanner.js";
import { planHardware } from "../apps/web/src/ai/planner.js";
import { HardwareError } from "../apps/web/src/hardware-core/commands.js";
import { migrateProject } from "../apps/web/src/projects/v4.js";
import { cliModelProvider, cliStatus, validateCliId } from "./ai/cliRuntime.js";
import { localModelProvider, localModels, validateLocalConfig } from "./ai/localRuntime.js";
import { runtimeManager } from "./ai/runtimeManager.js";
import { readJsonObject } from "./ai/requestBody.js";

type BridgeOptions = { token: string; origins: string[] };
const send = (res: ServerResponse, status: number, value: unknown) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(value)); };
function authorized(req: IncomingMessage, token: string): boolean {
  const supplied = /^Bearer (\S+)$/.exec(req.headers.authorization ?? "")?.[1] ?? "";
  const a = Buffer.from(supplied), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createLocalBridge({ token, origins }: BridgeOptions) {
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (!origin || !origins.includes(origin)) return send(res, 403, { code: "ORIGIN_REJECTED" });
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return send(res, 204, null);
    if (req.method === "GET" && req.url === "/v1/health") return send(res, 200, { running: true, version: 1 });
    if (!authorized(req, token)) return send(res, 401, { code: "BRIDGE_AUTH_REQUIRED" });
    if (req.method === "POST" && req.url === "/v1/handshake") return send(res, 200, { version: 1, capabilities: ["ollama", "lmstudio", "vllm", "codex", "agy", "claude", "kimi", "opencode", "continue"] });
    try {
      if (req.method !== "POST") return send(res, 405, { code: "METHOD_NOT_ALLOWED" });
      const body = await readJsonObject(req, 65536);
      if (req.url === "/v1/manage") {
        const config = validateLocalConfig(body.config, false);
        if (body.action === "permit" && typeof body.allowed === "boolean") runtimeManager.permit(config.runtime, body.allowed);
        else if (body.action === "start") await runtimeManager.start(config.runtime);
        else if (body.action === "stop") await runtimeManager.stop(config.runtime);
        else throw new Error("INVALID_REQUEST");
        return send(res, 200, { allowed: runtimeManager.allowed(config.runtime) });
      }
      if (req.url === "/v1/models") {
        if (body.transport === "LOCAL_CLI") {
          const result = await cliStatus(validateCliId(body.providerId));
          return send(res, 200, result);
        }
        const config = validateLocalConfig(body.config, false);
        const models = await localModels(config.runtime, config.port);
        return send(res, 200, { available: true, models, selectedModelAvailable: models.includes(config.modelId) });
      }
      if (req.url === "/v1/test") {
        const provider = body.transport === "LOCAL_CLI"
          ? cliModelProvider(validateCliId(body.providerId), typeof body.modelId === "string" ? body.modelId : undefined)
          : body.transport === "LOCAL_HTTP" ? localModelProvider(validateLocalConfig(body.config)) : null;
        if (!provider) throw new Error("INVALID_REQUEST");
        const probe = parsePlan(await provider.generate('Return exactly {"status":"unsupported","summary":"Connection verified","unsupportedReason":"Probe only","commands":[]} with no extra text.'));
        if (probe.status !== "unsupported") throw new Error("INVALID_MODEL_RESPONSE");
        return send(res, 200, { available: true, structuredOutput: true });
      }
      if (req.url === "/v1/plan") {
        const input = parsePlanRequest(body.input);
        const project = migrateProject(body.project);
        const provider = body.transport === "LOCAL_CLI"
          ? cliModelProvider(validateCliId(body.providerId), typeof body.modelId === "string" ? body.modelId : undefined)
          : body.transport === "LOCAL_HTTP" ? localModelProvider(validateLocalConfig(body.config)) : null;
        if (!provider) throw new Error("INVALID_REQUEST");
        if (body.task !== undefined && body.task !== "hardware" && body.task !== "logic") throw new Error("INVALID_REQUEST");
        const plan = body.task === "logic" ? await planBehavior(provider,input,project) : await planHardware(provider, input, project);
        return send(res, 200, { ...plan, revision: input.revision });
      }
      return send(res, 404, { code: "NOT_FOUND" });
    } catch (error) {
      if (error instanceof HardwareError) return send(res, 422, { code: "HARDWARE_VALIDATION", detail: error.code });
      const code = error instanceof Error ? error.message : "BRIDGE_FAILURE";
      const safe = ["INVALID_REQUEST", "INVALID_PROJECT", "STALE_PROJECT", "INVALID_MODEL_RESPONSE", "HARDWARE_VALIDATION", "MODEL_UNAVAILABLE", "LOCAL_RUNTIME_UNAVAILABLE", "CLI_UNAVAILABLE", "CLI_AUTH_REQUIRED", "CLI_PERMISSION_DENIED", "TIMEOUT", "CLI_OUTPUT_LIMIT", "PROVIDER_UNAVAILABLE", "PERMISSION_REQUIRED", "MANUAL_START_REQUIRED", "NOT_BRIDGE_OWNED"].includes(code) ? code : "BRIDGE_FAILURE";
      return send(res, safe === "INVALID_REQUEST" ? 400 : safe === "STALE_PROJECT" ? 409 : safe === "MODEL_UNAVAILABLE" ? 404 : safe === "PROVIDER_UNAVAILABLE" ? 503 : 422, { code: safe });
    }
  });
}
export function newBridgeToken(): string { return randomBytes(32).toString("base64url"); }
