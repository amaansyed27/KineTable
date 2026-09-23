import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { type BoardId } from "../hardware/boards";
import { projectFromIntent, starterProject, validateBuildInput, withPrimaryBoard, type KinetableProject } from "../projects/schema";
import { localProjectRepository, type LocalProject } from "../persistence/localProjectRepository";
import { cloudProjectRepository } from "../persistence/cloudProjectRepository";
import { useAuthStore } from "../auth/authStore";

type ProjectState = { project: LocalProject | null; ready: boolean; status: "local" | "syncing" | "synced" | "offline"; error: string | null;
  open: (board: BoardId, session: Session | null) => Promise<void>; setBoard: (board: BoardId, session: Session | null) => Promise<void>;
  createBuild: (board: BoardId, intent: string, name: string) => Promise<KinetableProject>; sync: () => Promise<void> };
export function createProjectStore(local = localProjectRepository, cloud = cloudProjectRepository) {
  let generation = 0;
  let syncing: Promise<void> | undefined;
  let boardForStarter: BoardId | undefined;
  let syncAgain = false;
  return create<ProjectState>((set, get) => ({
    project: null, ready: false, status: "local", error: null,
    open: async (board, session) => {
      boardForStarter = board;
      const current = ++generation;
      const ownerId = session?.user.id;
      const visible = get().project;
      const keepVisible = !!visible && (!ownerId || !visible.cloudUserId || visible.cloudUserId === ownerId);
      set({ project: keepVisible ? visible : null, ready: keepVisible, status: "local", error: null });
      try {
        const rows = await local.list();
        if (current !== generation) return;
        const eligible = rows.filter(row => !ownerId || !row.cloudUserId || row.cloudUserId === ownerId).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
        let project = eligible[0] ?? null;
        if (!project && !session) {
          const document = starterProject(board);
          project = { id: document.id, name: document.name, schemaVersion: 1, document, createdAt: document.metadata.createdAt, updatedAt: document.metadata.updatedAt, cloudDirty: false };
          await local.save(project);
        }
        if (current !== generation) return;
        set({ project, ready: !!project });
        if (session) { if (syncing) syncAgain = true; else await get().sync(); }
      } catch {
        if (current === generation) set({ ready: true, error: "We couldn’t open your saved project. Please allow browser storage and try again." });
      }
    },
    setBoard: async (board, session) => {
      generation++;
      boardForStarter = board;
      const ownerId = session?.user.id;
      const rows = await local.list();
      let project = rows.filter(row => !ownerId || !row.cloudUserId || row.cloudUserId === ownerId).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (!project) { const document = starterProject(board); project = { id: document.id, name: document.name, schemaVersion: 1, document, createdAt: document.metadata.createdAt, updatedAt: document.metadata.updatedAt, cloudDirty: !!session, cloudUserId: ownerId }; }
      else { const document = withPrimaryBoard(project.document, board); project = { ...project, document, updatedAt: document.metadata.updatedAt, cloudDirty: project.cloudDirty || !!project.cloudUserId || !!session }; }
      await local.save(project);
      set({ project, ready: true, status: "local", error: null });
      if (session) { if (syncing) syncAgain = true; else void get().sync(); }
    },
    createBuild: async (board, intent, name) => {
      validateBuildInput(intent, name);
      generation++;
      const ownerId = useAuthStore.getState().session?.user.id;
      const rows = await local.list();
      const selected = get().project;
      if (!selected || (selected.cloudUserId && selected.cloudUserId !== ownerId && ownerId)) throw new Error("Open your table before starting a build.");
      const latestTime = rows.reduce((time, row) => Math.max(time, Date.parse(row.updatedAt) + 1), Date.now());
      const current = !selected.cloudUserId || selected.cloudUserId === ownerId ? selected.document : null;
      const document = projectFromIntent(current, board, intent, name, new Date(latestTime).toISOString());
      const promoted = document.id === selected.id;
      const project: LocalProject = { id: document.id, name: document.name, schemaVersion: 1, document,
        createdAt: document.metadata.createdAt, updatedAt: document.metadata.updatedAt,
        cloudUserId: ownerId ?? (promoted ? selected.cloudUserId : undefined), cloudDirty: !!ownerId };
      await local.save(project);
      set({ project, ready: true, status: "local", error: null });
      if (ownerId) { if (syncing) syncAgain = true; else void get().sync(); }
      return document;
    },
    sync: () => {
      if (syncing) return syncing;
      const session = useAuthStore.getState().session;
      if (!session) return Promise.resolve();
      const ownerId = session.user.id;
      const startedAt = generation;
      syncing = (async () => {
        set({ status: "syncing", error: null });
        try {
          const remote = await cloud.list(session.access_token, ownerId);
          if (useAuthStore.getState().session?.user.id !== ownerId) return;
          const rows = await local.list();
          for (const row of remote) {
            if (startedAt !== generation) { syncAgain = true; return; }
            const existing = rows.find(localRow => localRow.id === row.id);
            if (existing?.cloudDirty || (existing?.cloudUserId && existing.cloudUserId !== ownerId)) continue;
            await local.save({ id: row.id, name: row.name, schemaVersion: 1, document: row.document,
              createdAt: row.document.metadata.createdAt, updatedAt: row.updated_at, cloudUserId: ownerId, cloudDirty: false });
          }
          let project = get().project;
          if (!project) {
            const restored = remote[0];
            if (restored) project = { id: restored.id, name: restored.name, schemaVersion: 1, document: restored.document,
              createdAt: restored.document.metadata.createdAt, updatedAt: restored.updated_at, cloudUserId: ownerId, cloudDirty: false };
            else {
              const board = boardForStarter;
              if (!board) throw new Error("Board not ready");
              const document = starterProject(board);
              project = { id: document.id, name: document.name, schemaVersion: 1, document, createdAt: document.metadata.createdAt,
                updatedAt: document.metadata.updatedAt, cloudUserId: ownerId, cloudDirty: true };
              await local.save(project);
            }
          } else if (project.cloudUserId === ownerId && !project.cloudDirty) {
            const counterpart = remote.find(row => row.id === project?.id);
            if (counterpart && counterpart.updated_at > project.updatedAt) project = { ...project, document: counterpart.document, updatedAt: counterpart.updated_at };
          }
          if (!project.cloudUserId) { project = { ...project, cloudUserId: ownerId, cloudDirty: true }; await local.save(project); }
          if (project.cloudUserId !== ownerId) return;
          if (!remote.some(row => row.id === project?.id) && !project.cloudDirty) { project = { ...project, cloudDirty: true }; await local.save(project); }
          if (startedAt === generation) set({ project, ready: true });
          if (project.cloudDirty) {
            const saved = await cloud.save(project.document, session.access_token, ownerId, remote.some(row => row.id === project?.id));
            if (useAuthStore.getState().session?.user.id !== ownerId) return;
            const latest = (await local.list()).find(row => row.id === project?.id);
            if (latest?.document.metadata.updatedAt === project.document.metadata.updatedAt) {
              project = { ...project, updatedAt: saved.updated_at, cloudDirty: false };
              await local.save(project);
            } else if (latest) project = latest;
          }
          for (let row of await local.list()) {
            if (startedAt !== generation) { syncAgain = true; return; }
            if (row.id === project.id || (row.cloudUserId && row.cloudUserId !== ownerId)) continue;
            const exists = remote.some(cloudRow => cloudRow.id === row.id);
            if (!row.cloudDirty && row.cloudUserId === ownerId && exists) continue;
            row = { ...row, cloudUserId: ownerId, cloudDirty: true };
            await local.save(row);
            const saved = await cloud.save(row.document, session.access_token, ownerId, exists);
            if (useAuthStore.getState().session?.user.id !== ownerId) return;
            const latest = (await local.list()).find(localRow => localRow.id === row.id);
            if (latest?.document.metadata.updatedAt === row.document.metadata.updatedAt) await local.save({ ...row, updatedAt: saved.updated_at, cloudDirty: false });
          }
          if (useAuthStore.getState().session?.user.id === ownerId && startedAt === generation) set({ project, ready: true, status: project.cloudDirty ? "local" : "synced" });
        } catch {
          if (useAuthStore.getState().session?.user.id === ownerId) {
            if (!get().project && boardForStarter) {
              const document = starterProject(boardForStarter);
              const offline = { id: document.id, name: document.name, schemaVersion: 1 as const, document,
                createdAt: document.metadata.createdAt, updatedAt: document.metadata.updatedAt, cloudUserId: ownerId, cloudDirty: true };
              try { await local.save(offline); set({ project: offline }); } catch { set({ error: "We couldn’t save your project on this device." }); return; }
            }
            set({ status: "offline", ready: true, error: "Saved on this device. Cloud sync will retry when you’re online." });
          }
        }
      })().finally(() => { syncing = undefined; if (syncAgain) { syncAgain = false; void get().sync(); } });
      return syncing;
    },
  }));
}
export const useProjectStore = createProjectStore();
