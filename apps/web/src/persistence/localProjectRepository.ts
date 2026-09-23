import type { Table } from "dexie";
import { db } from "./profileRepository";
import { parseProject, type KinetableProject } from "../projects/schema";

export type LocalProject = { id: string; name: string; schemaVersion: 1; document: KinetableProject; createdAt: string; updatedAt: string; cloudUserId?: string; cloudDirty: boolean };
const projects: Table<LocalProject> = db.table("projects");
function validRow(row: LocalProject): LocalProject {
  const document = parseProject(row.document);
  if (row.id !== document.id || row.name !== document.name || row.schemaVersion !== document.schemaVersion ||
    row.createdAt !== document.metadata.createdAt || !Number.isFinite(Date.parse(row.updatedAt)) ||
    (row.cloudUserId !== undefined && typeof row.cloudUserId !== "string") || typeof row.cloudDirty !== "boolean") throw new Error("Invalid saved project");
  return row;
}
export const localProjectRepository = {
  async list(): Promise<LocalProject[]> { return (await projects.toArray()).map(validRow); },
  async save(row: LocalProject): Promise<void> { await projects.put(validRow(row)); },
};
