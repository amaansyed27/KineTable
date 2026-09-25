import type { BoardId } from "../hardware/boards";
import type { LocalProject } from "../persistence/localProjectRepository";
import { parseProject, projectFromIntent, starterProject } from "./schema";
import { migrateProject, type KinetableProjectV3 } from "./v3";

export function starterRow(board: BoardId, ownerId?: string): LocalProject {
  const document = migrateProject(starterProject(board));
  return { id: document.id, name: document.name, schemaVersion: 3, document, createdAt: document.metadata.createdAt,
    updatedAt: document.metadata.updatedAt, cloudUserId: ownerId, cloudDirty: !!ownerId };
}
export function changeBoard(row: LocalProject, board: BoardId, ownerId?: string): LocalProject {
  const current = migrateProject(row.document);
  if (current.boardIds[0] === board) return row;
  if (current.components.length !== 1) {
    const next = starterRow(board, ownerId);
    const now = new Date(Math.max(Date.now(), Date.parse(row.updatedAt) + 1)).toISOString();
    next.document.metadata = { createdAt: now, updatedAt: now };
    next.createdAt = now; next.updatedAt = now;
    return next;
  }
  const document: KinetableProjectV3 = { ...current, boardIds: [board], components: [{ id: current.components[0].id, kind: "board", definitionId: board }],
    metadata: { ...current.metadata, updatedAt: new Date().toISOString() } };
  return { ...row, schemaVersion: 3, document, updatedAt: document.metadata.updatedAt, cloudDirty: row.cloudDirty || !!row.cloudUserId || !!ownerId };
}
export function createBuildRow(selected: LocalProject, rows: LocalProject[], board: BoardId, intent: string, name: string, ownerId?: string): LocalProject {
  const latestTime = rows.reduce((time, row) => Math.max(time, Date.parse(row.updatedAt) + 1), Date.now());
  const current = migrateProject(selected.document);
  const { wires, terminalPlacements, ...legacy } = current;
  const v1 = current.components.length === 1 && !wires.length && !terminalPlacements.length ? parseProject({ ...legacy, schemaVersion: 1, connections: [] }) : null;
  const document = migrateProject(projectFromIntent(v1, board, intent, name, new Date(latestTime).toISOString()));
  const promoted = document.id === selected.id;
  return { id: document.id, name: document.name, schemaVersion: 3, document,
    createdAt: document.metadata.createdAt, updatedAt: document.metadata.updatedAt,
    cloudUserId: ownerId ?? (promoted ? selected.cloudUserId : undefined), cloudDirty: !!ownerId };
}
