import type { IncomingMessage } from "node:http";

export async function readJsonObject(req: IncomingMessage & { body?: unknown }, limit: number): Promise<Record<string, unknown>> {
  let value = req.body;
  if (value === undefined) {
    let text = "";
    for await (const chunk of req) {
      text += chunk;
      if (Buffer.byteLength(text) > limit) throw new Error("INVALID_REQUEST");
    }
    try { value = JSON.parse(text) as unknown; } catch { throw new Error("INVALID_REQUEST"); }
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || Buffer.byteLength(JSON.stringify(value)) > limit) throw new Error("INVALID_REQUEST");
  return value as Record<string, unknown>;
}
