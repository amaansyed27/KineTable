import Dexie, { type Table } from "dexie";
import { db } from "./profileRepository";
import type { LocalProject } from "./localProjectRepository";
import { migrateProject, type ProjectDocument } from "../projects/v4";
import { validateElectricalSafety } from "../hardware-core/commands";
import { validateLogic } from "../logic/compile";

export type ProjectVersion = { id: string; ownerId: string; projectId: string; document: ProjectDocument; reason: string; createdAt: string };
export type ProjectConflict = { ownerId: string; projectId: string; local: ProjectDocument; cloud: ProjectDocument; cloudRevision: number; baseRevision: number | null; detectedAt: string };
const versions: Table<ProjectVersion> = db.table("projectVersions");
const conflicts: Table<ProjectConflict, [string,string]> = db.table("projectConflicts");
export const projectOwner = (userId?: string) => userId ?? "guest";
export function validatedHistoryDocument(document: unknown) {
  const value = migrateProject(document);
  validateElectricalSafety(value);
  validateLogic(value);
  return value;
}
export async function saveLocalCheckpoint(row: LocalProject, reason: string) {
  if (!reason || reason.length > 80) throw new Error("Invalid checkpoint reason");
  const version: ProjectVersion = { id: crypto.randomUUID(), ownerId: projectOwner(row.cloudUserId), projectId: row.id,
    document: structuredClone(row.document), reason, createdAt: new Date().toISOString() };
  await db.transaction("rw", db.table("projects"), versions, async () => {
    const last = await versions.where("[ownerId+projectId+createdAt]").between([version.ownerId,row.id,Dexie.minKey],[version.ownerId,row.id,Dexie.maxKey]).last();
    version.createdAt = new Date(Math.max(Date.now(),last ? Date.parse(last.createdAt)+1 : 0)).toISOString();
    await db.table("projects").put(row);
    await versions.put(version);
  });
}
export const projectHistoryRepository = {
  async list(ownerId: string, projectId: string) {
    const rows = await versions.where("[ownerId+projectId]").equals([ownerId,projectId]).toArray();
    return rows.sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(row => ({ ...row, document: validatedHistoryDocument(row.document) }));
  },
  async adopt(projectId: string, ownerId: string) {
    const rows = await versions.where("[ownerId+projectId]").equals(["guest",projectId]).toArray();
    await db.transaction("rw", versions, async () => {
      for (const row of rows) await versions.put({ ...row, id: crypto.randomUUID(), ownerId });
    });
  },
  async conflict(ownerId: string, projectId: string) { return conflicts.get([ownerId,projectId]); },
  async saveConflict(record: ProjectConflict) { validatedHistoryDocument(record.local); validatedHistoryDocument(record.cloud); await conflicts.put(record); },
  async clearConflict(ownerId: string, projectId: string) { await conflicts.delete([ownerId,projectId]); },
  async conflicts(ownerId: string) { return conflicts.where("ownerId").equals(ownerId).toArray(); },
};
