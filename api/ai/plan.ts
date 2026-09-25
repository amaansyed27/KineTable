import type { IncomingMessage, ServerResponse } from "node:http";
import { parsePlanRequest } from "../../apps/web/src/ai/contract.js";
import { planHardware } from "../../apps/web/src/ai/planner.js";
import { HardwareError } from "../../apps/web/src/hardware-core/commands.js";
import { migrateProject, type KinetableProjectV3 } from "../../apps/web/src/projects/v3.js";
import { remoteModelProvider, validateRemoteConfig } from "../../server/ai/remoteProvider.js";
import { readJsonObject } from "../../server/ai/requestBody.js";

type Request = IncomingMessage & { body?: unknown };
const send = (res: ServerResponse, status: number, value: unknown) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(value)); };
async function ownedProject(token: string, id: string): Promise<KinetableProjectV3> {
  const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("BACKEND_UNAVAILABLE");
  const headers = { apikey: key, Authorization: `Bearer ${token}` };
  const identity = await fetch(`${url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(10000) });
  if (!identity.ok) throw new Error("AUTH_REQUIRED");
  const user = await identity.json() as { id?: string };
  if (!user.id) throw new Error("AUTH_REQUIRED");
  const rows = await fetch(`${url}/rest/v1/projects?id=eq.${id}&select=id,owner_id,name,primary_board_id,schema_version,document,archived`, { headers, signal: AbortSignal.timeout(10000) });
  if (!rows.ok) throw new Error("BACKEND_UNAVAILABLE");
  const row = (await rows.json() as unknown[])[0] as { id: string; owner_id: string; name: string; primary_board_id: string; schema_version: number; document: unknown; archived: boolean } | undefined;
  if (!row || row.owner_id !== user.id || row.archived) throw new Error("PROJECT_NOT_FOUND");
  const project = migrateProject(row.document);
  if (row.id !== project.id || row.name !== project.name || row.primary_board_id !== project.boardIds[0] || row.schema_version !== (row.document as { schemaVersion: number }).schemaVersion) throw new Error("INVALID_PROJECT");
  return project;
}
export default async function handler(req: Request, res: ServerResponse) {
  if (req.method !== "POST") return send(res, 405, { code: "METHOD_NOT_ALLOWED" });
  try {
    const body = await readJsonObject(req, 65536);
    const input = parsePlanRequest(body.input);
    const provider = remoteModelProvider(validateRemoteConfig(body.provider));
    const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization ?? "")?.[1];
    const project = bearer ? await ownedProject(bearer, input.projectId) : migrateProject(body.project);
    const plan = await planHardware(provider, input, project);
    return send(res, 200, { ...plan, revision: input.revision });
  } catch (error) {
    if (error instanceof HardwareError) return send(res, 422, { code: "HARDWARE_VALIDATION", detail: error.code });
    const code = error instanceof Error ? error.message : "BACKEND_UNAVAILABLE";
    const status: Record<string, number> = { INVALID_REQUEST: 400, INVALID_ENDPOINT: 400, AUTH_REQUIRED: 401, PROJECT_NOT_FOUND: 404, STALE_PROJECT: 409, INVALID_PROJECT: 422, INVALID_MODEL_RESPONSE: 422, SAFETY_REFUSAL: 422, MODEL_UNAVAILABLE: 422, CREDENTIAL_REJECTED: 401, RATE_LIMIT: 429, QUOTA_EXHAUSTED: 429, TIMEOUT: 503, NETWORK_FAILURE: 503, PROVIDER_UNAVAILABLE: 503, BACKEND_UNAVAILABLE: 503 };
    return send(res, status[code] ?? 503, { code: code in status ? code : "BACKEND_UNAVAILABLE" });
  }
}
