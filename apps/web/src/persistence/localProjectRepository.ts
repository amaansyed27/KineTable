import type { Table } from "dexie";
import { db } from "./profileRepository";
import { migrateProject, type ProjectDocument } from "../projects/v3";
import { validateElectricalSafety } from "../hardware-core/commands";

export type LocalProject = { id: string; name: string; schemaVersion: 1 | 2 | 3; document: ProjectDocument; createdAt: string; updatedAt: string; cloudUserId?: string; cloudDirty: boolean };
const projects: Table<LocalProject> = db.table("projects");
function validRow(row: LocalProject): LocalProject {
  const document = migrateProject(row.document);
  validateElectricalSafety(document);
  if (row.id !== document.id || row.name !== document.name || row.schemaVersion !== row.document.schemaVersion ||
    row.createdAt !== document.metadata.createdAt || !Number.isFinite(Date.parse(row.updatedAt)) ||
    (row.cloudUserId !== undefined && typeof row.cloudUserId !== "string") || typeof row.cloudDirty !== "boolean") throw new Error("Invalid saved project");
  return { ...row, document };
}
export const localProjectRepository = {
  async list(): Promise<LocalProject[]> { return (await projects.toArray()).map(validRow); },
  async save(row: LocalProject): Promise<void> { validRow(row); await projects.put(row); },
};
