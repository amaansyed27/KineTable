import type { Table } from "dexie";
import { db } from "../persistence/profileRepository";
import { getMission, type Mission } from "./missions";
import type { Roles } from "./starters";
import type { Evidence } from "./evaluate";

export type Progress = { ownerId: string; missionId: string; missionVersion: number; projectId: string; roles: Roles; stageId: string; completed: string[]; hints: Record<string,number>; updatedAt: string };
const rows: Table<Progress,[string,string]> = db.table("learningProgress");
export function parseProgress(value: unknown, mission: Mission, ownerId: string): Progress {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid learning progress.");
  const p = value as Progress, ids = mission.stages.map(stage => stage.id);
  if (p.ownerId !== ownerId || p.missionId !== mission.id || p.missionVersion !== mission.version ||
    typeof p.projectId !== "string" || !/^[0-9a-f-]{36}$/i.test(p.projectId) || !ids.includes(p.stageId) ||
    !Array.isArray(p.completed) || p.completed.length > ids.length || new Set(p.completed).size !== p.completed.length || p.completed.some((id,index) => id !== ids[index]) ||
    ids.indexOf(p.stageId) > p.completed.length || !p.hints || typeof p.hints !== "object" || Array.isArray(p.hints) || Object.entries(p.hints).some(([id,depth])=>!ids.includes(id) || !Number.isInteger(depth) || depth < 0 || depth > 3) ||
    !p.roles || typeof p.roles !== "object" || Array.isArray(p.roles) || !Object.keys(p.roles).length || new Set(Object.values(p.roles)).size !== Object.keys(p.roles).length || Object.entries(p.roles).some(([key,id])=>!["probeA","probeB","led","resistor","button","oled","buzzer"].includes(key) || typeof id !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(id)) ||
    typeof p.updatedAt !== "string" || !Number.isFinite(Date.parse(p.updatedAt))) throw new Error("Learning progress has changed or is invalid. Your project is still in Projects. Start a new mission to continue safely.");
  return p;
}
export function newProgress(mission: Mission, ownerId: string, projectId: string, roles: Roles): Progress {
  return parseProgress({ ownerId,missionId:mission.id,missionVersion:mission.version,projectId,roles,stageId:mission.stages[0].id,completed:[],hints:{},updatedAt:new Date().toISOString() },mission,ownerId);
}
export const missionComplete = (p: Progress, mission: Mission) => mission.stages.every(stage => p.completed.includes(stage.id));
export function completeStage(p: Progress, mission: Mission, evidence: Evidence): Progress {
  parseProgress(p,mission,p.ownerId);
  if (!evidence.pass || p.completed.includes(p.stageId)) return p;
  return { ...p,completed:[...p.completed,p.stageId],updatedAt:new Date().toISOString() };
}
export const progressRepository = {
  async list(ownerId: string) { return (await rows.where("ownerId").equals(ownerId).toArray()).flatMap(row => { const mission=getMission(row.missionId); if (!mission) return []; try { return [parseProgress(row,mission,ownerId)]; } catch { return []; } }); },
  async load(ownerId: string, mission: Mission) { const row=await rows.get([ownerId,mission.id]); return row ? parseProgress(row,mission,ownerId) : null; },
  async save(p: Progress) { const mission=getMission(p.missionId); if (!mission) throw new Error("Unknown mission."); await rows.put(parseProgress(p,mission,p.ownerId)); },
};
