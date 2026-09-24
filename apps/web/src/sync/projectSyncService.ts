import type { Session } from "@supabase/supabase-js";
import type { BoardId } from "../hardware/boards";
import type { LocalProject } from "../persistence/localProjectRepository";
import { starterRow } from "../projects/projectCreation";

type Local = { list(): Promise<LocalProject[]>; save(row: LocalProject): Promise<void> };
type Cloud = { list(token: string, ownerId: string): Promise<{ id: string; name: string; document: LocalProject["document"]; updated_at: string }[]>;
  save(document: LocalProject["document"], token: string, ownerId: string, exists: boolean): Promise<{ updated_at: string }> };
type Hooks = { activeOwner(): string | undefined; changed(): boolean; current(): LocalProject | null; publish(project: LocalProject): void; retry(): void };
const remoteRow = (row: Awaited<ReturnType<Cloud["list"]>>[number], ownerId: string): LocalProject => ({
  id: row.id, name: row.name, schemaVersion: row.document.schemaVersion, document: row.document,
  createdAt: row.document.metadata.createdAt, updatedAt: row.updated_at, cloudUserId: ownerId, cloudDirty: false,
});
export async function reconcileProjects(local: Local, cloud: Cloud, session: Session, board: BoardId | undefined, hooks: Hooks): Promise<void> {
  const ownerId = session.user.id;
  const remote = await cloud.list(session.access_token, ownerId);
  if (hooks.activeOwner() !== ownerId) return;
  const rows = await local.list();
  for (const row of remote) {
    if (hooks.changed()) { hooks.retry(); return; }
    const existing = rows.find(localRow => localRow.id === row.id);
    if (existing?.cloudDirty || (existing?.cloudUserId && existing.cloudUserId !== ownerId)) continue;
    await local.save(remoteRow(row, ownerId));
  }
  let project = hooks.current();
  if (!project) {
    project = remote[0] ? remoteRow(remote[0], ownerId) : board ? starterRow(board, ownerId) : null;
    if (!project) throw new Error("Board not ready");
    if (!remote[0]) await local.save(project);
  } else if (project.cloudUserId === ownerId && !project.cloudDirty) {
    const counterpart = remote.find(row => row.id === project?.id);
    if (counterpart && counterpart.updated_at > project.updatedAt) project = remoteRow(counterpart, ownerId);
  }
  if (!project.cloudUserId) { project = { ...project, cloudUserId: ownerId, cloudDirty: true }; await local.save(project); }
  if (project.cloudUserId !== ownerId) return;
  if (!remote.some(row => row.id === project?.id) && !project.cloudDirty) { project = { ...project, cloudDirty: true }; await local.save(project); }
  if (!hooks.changed()) hooks.publish(project);
  if (project.cloudDirty) {
    const saved = await cloud.save(project.document, session.access_token, ownerId, remote.some(row => row.id === project?.id));
    if (hooks.activeOwner() !== ownerId) return;
    const latest = (await local.list()).find(row => row.id === project?.id);
    if (latest?.document.metadata.updatedAt === project.document.metadata.updatedAt) {
      project = { ...project, updatedAt: saved.updated_at, cloudDirty: false };
      await local.save(project);
    } else if (latest) project = latest;
  }
  for (let row of await local.list()) {
    if (hooks.changed()) { hooks.retry(); return; }
    if (row.id === project.id || (row.cloudUserId && row.cloudUserId !== ownerId)) continue;
    const exists = remote.some(cloudRow => cloudRow.id === row.id);
    if (!row.cloudDirty && row.cloudUserId === ownerId && exists) continue;
    row = { ...row, cloudUserId: ownerId, cloudDirty: true };
    await local.save(row);
    const saved = await cloud.save(row.document, session.access_token, ownerId, exists);
    if (hooks.activeOwner() !== ownerId) return;
    const latest = (await local.list()).find(localRow => localRow.id === row.id);
    if (latest?.document.metadata.updatedAt === row.document.metadata.updatedAt) await local.save({ ...row, updatedAt: saved.updated_at, cloudDirty: false });
  }
  if (!hooks.changed()) hooks.publish(project);
}
