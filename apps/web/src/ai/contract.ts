import { parseCommands, type ProjectCommand } from "../hardware-core/commands.js";
import { validIntentText } from "../projects/schema.js";
import { getDefinition } from "../component-library/catalog.js";

export type PlanRequest = { projectId: string; revision: string; intent: string; boardId: string };
export type Plan = { status: "supported" | "unsupported"; summary: string; unsupportedReason: string; commands: ProjectCommand[] };
export type PlanResponse = Plan & { revision: string };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function parsePlanRequest(v: unknown): PlanRequest {
  if (!obj(v) || Object.keys(v).sort().join() !== "boardId,intent,projectId,revision" ||
    typeof v.projectId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.projectId) ||
    typeof v.revision !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.revision) ||
    typeof v.boardId !== "string" || getDefinition(v.boardId)?.kind !== "board" || !validIntentText(v.intent)) throw new Error("INVALID_REQUEST");
  return v as PlanRequest;
}
export function parsePlan(v: unknown): Plan {
  if (!obj(v) || Object.keys(v).sort().join() !== "commands,status,summary,unsupportedReason" ||
    (v.status !== "supported" && v.status !== "unsupported") || typeof v.summary !== "string" || !v.summary.trim() || v.summary.length > 240 ||
    typeof v.unsupportedReason !== "string" || v.unsupportedReason.length > 400) throw new Error("INVALID_MODEL_RESPONSE");
  let commands: ProjectCommand[];
  try { commands = parseCommands(v.commands); } catch { throw new Error("INVALID_MODEL_RESPONSE"); }
  if (commands.some(command => command.type.startsWith("logic.") || command.type === "project.rename") || (v.status === "unsupported" ? commands.length !== 0 || !v.unsupportedReason.trim() : commands.length === 0 || !!v.unsupportedReason)) throw new Error("INVALID_MODEL_RESPONSE");
  return { status: v.status, summary: v.summary, unsupportedReason: v.unsupportedReason, commands };
}
export function parsePlanResponse(v: unknown): PlanResponse {
  if (!obj(v) || Object.keys(v).sort().join() !== "commands,revision,status,summary,unsupportedReason" || typeof v.revision !== "string") throw new Error("INVALID_MODEL_RESPONSE");
  return { ...parsePlan({ status: v.status, summary: v.summary, unsupportedReason: v.unsupportedReason, commands: v.commands }), revision: v.revision };
}
