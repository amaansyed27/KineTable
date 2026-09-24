import type { IncomingMessage, ServerResponse } from "node:http";
import { parsePlan } from "../../apps/web/src/ai/contract.js";
import { remoteModelProvider, validateRemoteConfig } from "../../server/ai/remoteProvider.js";
import { readJsonObject } from "../../server/ai/requestBody.js";

type Request = IncomingMessage & { body?: unknown };
export default async function handler(req: Request, res: ServerResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ code: "METHOD_NOT_ALLOWED" })); }
  try {
    const body = await readJsonObject(req, 8192);
    const provider = remoteModelProvider(validateRemoteConfig(body));
    const output = parsePlan(await provider.generate('Return exactly {"status":"unsupported","summary":"Connection verified","unsupportedReason":"Probe only","commands":[]} with no extra text.'));
    if (output.status !== "unsupported" || output.commands.length) throw new Error("INVALID_MODEL_RESPONSE");
    return res.end(JSON.stringify({ available: true, structuredOutput: true }));
  } catch (error) {
    const code = error instanceof Error ? error.message : "PROVIDER_UNAVAILABLE";
    const safe = ["INVALID_REQUEST", "INVALID_ENDPOINT", "INVALID_MODEL_RESPONSE", "MODEL_UNAVAILABLE", "CREDENTIAL_REJECTED", "RATE_LIMIT", "QUOTA_EXHAUSTED", "TIMEOUT", "NETWORK_FAILURE", "PROVIDER_UNAVAILABLE", "SAFETY_REFUSAL"].includes(code) ? code : "PROVIDER_UNAVAILABLE";
    res.statusCode = safe === "INVALID_REQUEST" || safe === "INVALID_ENDPOINT" ? 400 : 503;
    return res.end(JSON.stringify({ code: safe }));
  }
}
