import type { Session } from "@supabase/supabase-js";
import type { BoardId } from "../hardware/boards";
import type { LocalProject } from "../persistence/localProjectRepository";
import { projectHistoryRepository } from "../persistence/projectHistoryRepository";
import { ProjectConflictError } from "../persistence/cloudProjectRepository";
import { starterRow } from "../projects/projectCreation";

type Remote = { id: string; name: string; document: LocalProject["document"]; updated_at: string; revision: number };
type Local = { list(): Promise<LocalProject[]>; save(row: LocalProject, reason?: string): Promise<void> };
type Cloud = { list(token: string, ownerId: string): Promise<Remote[]>;
  save(document: LocalProject["document"], token: string, ownerId: string, expectedRevision: number | null, reason?: string): Promise<Remote> };
type Hooks = { activeOwner(): string | undefined; changed(): boolean; current(): LocalProject | null;
  publish(project: LocalProject): void; conflict(projectId: string): void; retry(): void };
const remoteRow = (row: Remote, ownerId: string): LocalProject => ({
  id: row.id, name: row.name, schemaVersion: row.document.schemaVersion, document: row.document,
  createdAt: row.document.metadata.createdAt, updatedAt: row.updated_at, cloudUserId: ownerId,
  cloudRevision: row.revision, cloudDirty: false,
});

export async function reconcileProjects(local: Local, cloud: Cloud, session: Session, board: BoardId | undefined, hooks: Hooks): Promise<void> {
  const ownerId = session.user.id;
  const remote = await cloud.list(session.access_token, ownerId);
  if (hooks.activeOwner() !== ownerId) return;
  const rows = await local.list();
  const adoptGuest = remote.length === 0 && !rows.some(row => row.cloudUserId === ownerId);
  for (const head of remote) {
    if (hooks.changed()) { hooks.retry(); return; }
    const cached = rows.find(row => row.id === head.id);
    if (cached?.cloudUserId && cached.cloudUserId !== ownerId) continue;
    if (cached?.cloudDirty) {
      if (cached.cloudRevision !== head.revision) {
        await projectHistoryRepository.saveConflict({ ownerId, projectId: head.id, local: cached.document,
          cloud: head.document, baseRevision: cached.cloudRevision ?? null, cloudRevision: head.revision, detectedAt: new Date().toISOString() });
        hooks.conflict(head.id);
      }
      continue;
    }
    if (!cached || cached.cloudRevision !== head.revision) await local.save(remoteRow(head, ownerId));
  }
  let current = hooks.current();
  if (current && current.cloudUserId !== ownerId && (current.cloudUserId || !adoptGuest)) current = null;
  if (!current) {
    current = remote[0] ? (await local.list()).find(row => row.id === remote[0].id) ?? remoteRow(remote[0], ownerId)
      : rows.find(row => row.cloudUserId === ownerId) ?? (adoptGuest ? rows.find(row => !row.cloudUserId) : undefined) ?? null;
    if (!current && board) { current = starterRow(board, ownerId); await local.save(current, "Created project"); }
    if (!current) throw new Error("Board not ready");
  } else if (!current.cloudDirty) {
    const head = remote.find(row => row.id === current?.id);
    if (head && head.revision !== current.cloudRevision) current = remoteRow(head, ownerId);
  }
  if (!hooks.changed()) hooks.publish(current);
  for (const original of await local.list()) {
    if (hooks.changed()) { hooks.retry(); return; }
    if (original.cloudUserId && original.cloudUserId !== ownerId || !original.cloudUserId && !adoptGuest) continue;
    let row = original;
    if (!row.cloudUserId) {
      await projectHistoryRepository.adopt(row.id, ownerId);
      row = { ...row, cloudUserId: ownerId, cloudDirty: true };
      await local.save(row);
    }
    const head = remote.find(item => item.id === row.id);
    if (await projectHistoryRepository.conflict(ownerId, row.id)) { hooks.conflict(row.id); continue; }
    if (head && !row.cloudDirty) continue;
    if (head && row.cloudRevision !== head.revision) {
      await projectHistoryRepository.saveConflict({ ownerId, projectId: row.id, local: row.document,
        cloud: head.document, baseRevision: row.cloudRevision ?? null, cloudRevision: head.revision, detectedAt: new Date().toISOString() });
      hooks.conflict(row.id); continue;
    }
    if (!head && row.cloudRevision) { hooks.conflict(row.id); continue; }
    try {
      const saved = await cloud.save(row.document, session.access_token, ownerId, head?.revision ?? null, row.checkpointReason ?? (head ? "Updated project" : "Created project"));
      if (hooks.activeOwner() !== ownerId) return;
      const latest = (await local.list()).find(item => item.id === row.id);
      if (latest?.document.metadata.updatedAt === row.document.metadata.updatedAt) {
        const clean = { ...row, updatedAt: saved.updated_at, cloudRevision: saved.revision, cloudDirty: false, checkpointReason: undefined };
        await local.save(clean);
        if (current.id === row.id) current = clean;
      } else hooks.retry();
    } catch (error) {
      if (!(error instanceof ProjectConflictError)) throw error;
      const fresh = error.head ?? (await cloud.list(session.access_token, ownerId)).find(item => item.id === row.id);
      if (!fresh) throw error;
      await projectHistoryRepository.saveConflict({ ownerId, projectId: row.id, local: row.document,
        cloud: fresh.document, baseRevision: row.cloudRevision ?? null, cloudRevision: fresh.revision, detectedAt: new Date().toISOString() });
      hooks.conflict(row.id);
    }
  }
  if (!hooks.changed()) hooks.publish(current);
}
