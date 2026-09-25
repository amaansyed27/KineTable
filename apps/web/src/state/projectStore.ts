import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type { BoardId } from "../hardware/boards";
import { createBuildRow, changeBoard, starterRow } from "../projects/projectCreation";
import { migrateProject, type KinetableProjectV3 } from "../projects/v3";
import { localProjectRepository, type LocalProject } from "../persistence/localProjectRepository";
import { cloudProjectRepository } from "../persistence/cloudProjectRepository";
import { reconcileProjects } from "../sync/projectSyncService";
import { useAuthStore } from "../auth/authStore";
import { executeCommands, type ProjectCommand } from "../hardware-core/commands";
import { restoreRevision, WorkbenchHistory } from "../hardware-core/history";

type ProjectState = { project: LocalProject | null; ready: boolean; status: "local" | "syncing" | "synced" | "offline"; error: string | null; canUndo: boolean; canRedo: boolean;
  open: (board: BoardId, session: Session | null) => Promise<void>; setBoard: (board: BoardId, session: Session | null) => Promise<void>;
  createBuild: (board: BoardId, intent: string, name: string) => Promise<KinetableProjectV3>;
  saveDocument: (document: KinetableProjectV3, expectedRevision: string, preserveHistory?: boolean) => Promise<void>;
  applyTransaction: (commands: ProjectCommand[] | ((current: KinetableProjectV3) => ProjectCommand[])) => Promise<KinetableProjectV3>;
  undo: () => Promise<void>; redo: () => Promise<void>; sync: () => Promise<void> };
export function createProjectStore(local = localProjectRepository, cloud = cloudProjectRepository) {
  let generation = 0;
  let syncing: Promise<void> | undefined;
  let checkpoint: ReturnType<typeof setTimeout> | undefined;
  let boardForStarter: BoardId | undefined;
  let syncAgain = false;
  const history = new WorkbenchHistory();
  let editQueue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(action: () => Promise<T>): Promise<T> => {
    const next = editQueue.then(action);
    editQueue = next.catch(() => undefined);
    return next;
  };
  return create<ProjectState>((set, get) => ({
    project: null, ready: false, status: "local", error: null, canUndo: false, canRedo: false,
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
        if (!project && !session) { project = starterRow(board); await local.save(project); }
        if (current !== generation) return;
        if (project) history.ensure(project.id);
        set({ project, ready: !!project, canUndo: history.canUndo, canRedo: history.canRedo });
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
      const current = rows.filter(row => !ownerId || !row.cloudUserId || row.cloudUserId === ownerId).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const project = current ? changeBoard(current, board, ownerId) : starterRow(board, ownerId);
      await local.save(project);
      history.reset(project.id);
      set({ project, ready: true, status: "local", error: null, canUndo: false, canRedo: false });
      if (session) { if (syncing) syncAgain = true; else void get().sync(); }
    },
    createBuild: async (board, intent, name) => {
      generation++;
      const ownerId = useAuthStore.getState().session?.user.id;
      const rows = await local.list();
      const selected = get().project;
      if (!selected || (selected.cloudUserId && selected.cloudUserId !== ownerId && ownerId)) throw new Error("Open your table before starting a build.");
      const project = createBuildRow(selected, rows, board, intent, name, ownerId);
      await local.save(project);
      history.reset(project.id);
      set({ project, ready: true, status: "local", error: null, canUndo: false, canRedo: false });
      if (ownerId) { if (syncing) syncAgain = true; else void get().sync(); }
      return migrateProject(project.document);
    },
    saveDocument: async (document, expectedRevision, preserveHistory = false) => {
      const current = get().project;
      if (!current || current.id !== document.id || current.document.metadata.updatedAt !== expectedRevision) throw new Error("STALE_PROJECT");
      const ownerId = useAuthStore.getState().session?.user.id;
      if (current.cloudUserId && current.cloudUserId !== ownerId) throw new Error("AUTH_REQUIRED");
      const project: LocalProject = { ...current, document, schemaVersion: 3, updatedAt: document.metadata.updatedAt, cloudUserId: ownerId, cloudDirty: !!ownerId };
      generation++;
      await local.save(project);
      if (!preserveHistory) history.reset(project.id);
      set({ project, ready: true, status: "local", error: null, canUndo: history.canUndo, canRedo: history.canRedo });
      if (ownerId) { if (checkpoint) clearTimeout(checkpoint); checkpoint = setTimeout(() => { checkpoint = undefined; if (syncing) syncAgain = true; else void get().sync(); }, 500); }
    },
    applyTransaction: commands => enqueue(async () => {
      const row = get().project;
      if (!row) throw new Error("PROJECT_UNAVAILABLE");
      const before = migrateProject(row.document);
      history.ensure(before.id);
      const revision = new Date(Math.max(Date.now(), Date.parse(before.metadata.updatedAt) + 1)).toISOString();
      const resolved = typeof commands === "function" ? commands(before) : commands;
      if (!resolved.length) return before;
      const candidate = executeCommands(before, resolved, revision, "editor");
      await get().saveDocument(candidate, before.metadata.updatedAt, true);
      history.record(before);
      set({ canUndo: history.canUndo, canRedo: history.canRedo });
      return candidate;
    }),
    undo: () => enqueue(async () => {
      const row = get().project; if (!row) return;
      const current = migrateProject(row.document);
      history.ensure(current.id);
      const target = history.undoTarget(); if (!target) return;
      await get().saveDocument(restoreRevision(target, current), current.metadata.updatedAt, true);
      history.finishUndo(current);
      set({ canUndo: history.canUndo, canRedo: history.canRedo });
    }),
    redo: () => enqueue(async () => {
      const row = get().project; if (!row) return;
      const current = migrateProject(row.document);
      history.ensure(current.id);
      const target = history.redoTarget(); if (!target) return;
      await get().saveDocument(restoreRevision(target, current), current.metadata.updatedAt, true);
      history.finishRedo(current);
      set({ canUndo: history.canUndo, canRedo: history.canRedo });
    }),
    sync: () => {
      if (checkpoint) { clearTimeout(checkpoint); checkpoint = undefined; }
      if (syncing) return syncing;
      const session = useAuthStore.getState().session;
      if (!session) return Promise.resolve();
      const ownerId = session.user.id;
      const startedAt = generation;
      syncing = (async () => {
        set({ status: "syncing", error: null });
        try {
          await reconcileProjects(local, cloud, session, boardForStarter, {
            activeOwner: () => useAuthStore.getState().session?.user.id,
            changed: () => startedAt !== generation,
            current: () => get().project,
            publish: project => {
              const visible = get().project;
              if (!visible || visible.id !== project.id || visible.document.metadata.updatedAt !== project.document.metadata.updatedAt) history.reset(project.id);
              else history.ensure(project.id);
              set({ project, ready: true, status: project.cloudDirty ? "local" : "synced", canUndo: history.canUndo, canRedo: history.canRedo });
            },
            retry: () => { syncAgain = true; },
          });
        } catch {
          if (useAuthStore.getState().session?.user.id === ownerId) {
            if (!get().project && boardForStarter) {
              const offline = starterRow(boardForStarter, ownerId);
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
