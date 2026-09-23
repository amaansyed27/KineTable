import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { type BoardId } from "../hardware/boards";
import { starterProject, withPrimaryBoard } from "../projects/schema";
import { localProjectRepository, type LocalProject } from "../persistence/localProjectRepository";
import { cloudProjectRepository } from "../persistence/cloudProjectRepository";
import { useAuthStore } from "../auth/authStore";

type ProjectState = { project: LocalProject | null; ready: boolean; status: "local" | "syncing" | "synced" | "offline"; error: string | null;
  open: (board: BoardId, session: Session | null) => Promise<void>; setBoard: (board: BoardId, session: Session | null) => Promise<void>; sync: () => Promise<void> };
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
    sync: () => {
      if (syncing) return syncing;
      const session = useAuthStore.getState().session;
      if (!session) return Promise.resolve();
      const ownerId = session.user.id;
      syncing = (async () => {
        set({ status: "syncing", error: null });
        try {
          const remote = await cloud.list(session.access_token, ownerId);
          if (useAuthStore.getState().session?.user.id !== ownerId) return;
          const rows = await local.list();
          for (const row of remote) {
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
          set({ project, ready: true });
          if (project.cloudDirty) {
            const saved = await cloud.save(project.document, session.access_token, ownerId, remote.some(row => row.id === project?.id));
            if (useAuthStore.getState().session?.user.id !== ownerId) return;
            const latest = (await local.list()).find(row => row.id === project?.id);
            if (latest?.document.metadata.updatedAt === project.document.metadata.updatedAt) {
              project = { ...project, updatedAt: saved.updated_at, cloudDirty: false };
              await local.save(project);
            } else if (latest) project = latest;
          }
          if (useAuthStore.getState().session?.user.id === ownerId) set({ project, ready: true, status: project.cloudDirty ? "local" : "synced" });
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
