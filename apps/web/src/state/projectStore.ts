import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type { BoardId } from "../hardware/boards";
import { createBuildRow, changeBoard, starterRow } from "../projects/projectCreation";
import { migrateProject, type KinetableProjectV4 } from "../projects/v4";
import { localProjectRepository, projectBelongsTo, type LocalProject } from "../persistence/localProjectRepository";
import { cloudProjectRepository } from "../persistence/cloudProjectRepository";
import { reconcileProjects } from "../sync/projectSyncService";
import { useAuthStore } from "../auth/authStore";
import { executeCommands, type ProjectCommand } from "../hardware-core/commands";
import { restoreRevision, WorkbenchHistory } from "../hardware-core/history";
import { bonkProject } from "../projects/starters";
import { projectHistoryRepository, projectOwner } from "../persistence/projectHistoryRepository";

type ProjectState = { project: LocalProject | null; ready: boolean; status: "local" | "syncing" | "synced" | "offline" | "conflict"; error: string | null; canUndo: boolean; canRedo: boolean; conflictProjectId: string | null;
  open: (board: BoardId, session: Session | null) => Promise<void>; setBoard: (board: BoardId, session: Session | null) => Promise<void>;
  openById: (id: string, board: BoardId, session: Session | null) => Promise<boolean>;
  createBuild: (board: BoardId, intent: string, name: string) => Promise<KinetableProjectV4>;
  createFromProposal: (base: KinetableProjectV4, commands: ProjectCommand[], ownerId: string) => Promise<KinetableProjectV4>;
  tryBonk: () => Promise<KinetableProjectV4>;
  saveDocument: (document: KinetableProjectV4, expectedRevision: string, preserveHistory?: boolean, reason?: string) => Promise<void>;
  applyTransaction: (commands: ProjectCommand[] | ((current: KinetableProjectV4) => ProjectCommand[]), source?: "AI assembly" | "Updated behavior with Kinetable") => Promise<KinetableProjectV4>;
  checkpoint: () => Promise<void>; restoreVersion: (versionId: string) => Promise<void>; restoreSnapshot: (document: KinetableProjectV4) => Promise<void>; resolveConflict: (choice: "device" | "cloud" | "both") => Promise<void>;
  undo: () => Promise<void>; redo: () => Promise<void>; sync: () => Promise<void>; cancelPending: () => void };
export function createProjectStore(local = localProjectRepository, cloud: Pick<typeof cloudProjectRepository, "list" | "save"> = cloudProjectRepository) {
  let generation = 0;
  let selection = 0;
  let syncing: Promise<void> | undefined;
  let checkpoint: ReturnType<typeof setTimeout> | undefined;
  let layoutCheckpoint: ReturnType<typeof setTimeout> | undefined;
  let syncFollowup: ReturnType<typeof setTimeout> | undefined;
  let boardForStarter: BoardId | undefined;
  let syncAgain = false;
  let editGeneration = 0;
  let lastAutomaticEdit = -1;
  const history = new WorkbenchHistory<KinetableProjectV4>();
  let editQueue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(action: () => Promise<T>): Promise<T> => {
    const next = editQueue.then(action);
    editQueue = next.catch(() => undefined);
    return next;
  };
  return create<ProjectState>((set, get) => ({
    project: null, ready: false, status: "local", error: null, canUndo: false, canRedo: false, conflictProjectId: null,
    openById: async (id, board, session) => {
      const request=++selection;
      boardForStarter=board;
      const eligible=(row:LocalProject)=>row.id===id && projectBelongsTo(row, session?.user.id);
      if (!(await local.list()).some(eligible)) await get().open(board,session);
      return enqueue(async () => {
        if (request!==selection) return false;
        const row = (await local.list()).find(eligible);
        if (!row) return false;
        generation++;
        history.ensure(row.id);
        const conflict = await projectHistoryRepository.conflict(projectOwner(session?.user.id), row.id);
        set({ project: row, ready: true, status: conflict ? "conflict" : row.cloudUserId && !row.cloudDirty ? "synced" : "local", conflictProjectId: conflict ? row.id : null, canUndo: history.canUndo, canRedo: history.canRedo });
        try { localStorage.setItem("kinetable.current-project", row.id); localStorage.setItem(`kinetable.opened.${row.id}`, new Date().toISOString()); } catch { /* Optional navigation preference. */ }
        if (session) void get().sync();
        return true;
      });
    },
    open: async (board, session) => {
      boardForStarter = board;
      const current = ++generation;
      const ownerId = session?.user.id;
      const visible = get().project;
      const keepVisible = !!visible && projectBelongsTo(visible, ownerId);
      set({ project: keepVisible ? visible : null, ready: keepVisible, status: "local", error: null, conflictProjectId: null });
      try {
        const rows = await local.list();
        if (current !== generation) return;
        const eligible = rows.filter(row => projectBelongsTo(row, ownerId)).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
        let remembered: string | null = null;
        try { remembered = localStorage.getItem("kinetable.current-project"); } catch { /* Optional navigation preference. */ }
        let project = (keepVisible ? eligible.find(row => row.id === visible.id) : null) ?? eligible.find(row => row.id === remembered) ?? eligible[0] ?? null;
        if (!project && !session) { project = starterRow(board); await local.save(project, "Created project"); }
        if (current !== generation) return;
        if (project) history.ensure(project.id);
        const conflict = project && await projectHistoryRepository.conflict(projectOwner(ownerId), project.id);
        set({ project, ready: !!project, conflictProjectId: conflict ? project?.id ?? null : null, status: conflict ? "conflict" : "local", canUndo: history.canUndo, canRedo: history.canRedo });
        if (session) { if (syncing) syncAgain = true; else await get().sync(); }
      } catch {
        if (current === generation) set({ ready: true, error: "We couldn’t open your saved project. Please allow browser storage and try again." });
      }
    },
    setBoard: async (board, session) => {
      editGeneration++;
      generation++;
      boardForStarter = board;
      const ownerId = session?.user.id;
      const rows = await local.list();
      const current = rows.filter(row => projectBelongsTo(row, ownerId)).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const project = current ? changeBoard(current, board, ownerId) : starterRow(board, ownerId);
      await local.save(project, current && current.id === project.id ? "Changed board" : "Created project");
      history.reset(project.id);
      set({ project, ready: true, status: "local", error: null, canUndo: false, canRedo: false });
      if (session) { if (syncing) syncAgain = true; else void get().sync(); }
    },
    createBuild: async (board, intent, name) => {
      editGeneration++;
      generation++;
      const ownerId = useAuthStore.getState().session?.user.id;
      const rows = await local.list();
      const selected = get().project;
      if (!selected || !projectBelongsTo(selected, ownerId)) throw new Error("Open your table before starting a build.");
      const project = createBuildRow(selected, rows, board, intent, name, ownerId);
      await local.save(project, "Created project");
      history.reset(project.id);
      set({ project, ready: true, status: "local", error: null, canUndo: false, canRedo: false });
      if (ownerId) { if (syncing) syncAgain = true; else void get().sync(); }
      return migrateProject(project.document);
    },
    createFromProposal: (base, commands, expectedOwner) => enqueue(async () => {
      const ownerId = useAuthStore.getState().session?.user.id;
      if (projectOwner(ownerId) !== expectedOwner) throw new Error("AUTH_REQUIRED");
      const existing = (await local.list()).find(row => row.id === base.id);
      if (existing) {
        if (!projectBelongsTo(existing, ownerId)) throw new Error("AUTH_REQUIRED");
        return migrateProject(existing.document);
      }
      const document = executeCommands(base, commands);
      const project: LocalProject = { id: document.id, name: document.name, schemaVersion: 4, document,
        createdAt: document.metadata.createdAt, updatedAt: document.metadata.updatedAt, cloudUserId: ownerId, cloudDirty: !!ownerId };
      await local.save(project, "Created project");
      editGeneration++; generation++;
      history.reset(project.id);
      history.record(base);
      set({ project, ready: true, status: "local", error: null, canUndo: history.canUndo, canRedo: false, conflictProjectId: null });
      try { localStorage.setItem("kinetable.current-project", project.id); } catch { /* Optional navigation preference. */ }
      if (ownerId) void get().sync();
      return document;
    }),
    tryBonk: () => enqueue(async () => {
      editGeneration++;
      const ownerId = useAuthStore.getState().session?.user.id;
      const row = starterRow("esp32-dev-module", ownerId);
      const document = bonkProject({ ...migrateProject(row.document), name: "BONK", intent: { text: "A button, display, LED and buzzer build." } });
      const project = { ...row, name: document.name, document, updatedAt: document.metadata.updatedAt };
      await local.save(project, "Created project");
      generation++;
      history.reset(project.id);
      set({ project, ready: true, status: "local", error: null, canUndo: false, canRedo: false });
      try { localStorage.setItem("kinetable.current-project", project.id); } catch { /* Optional navigation preference. */ }
      if (ownerId) void get().sync();
      return document;
    }),
    saveDocument: async (document, expectedRevision, preserveHistory = false, reason = "Updated project") => {
      const current = get().project;
      if (!current || current.id !== document.id || current.document.metadata.updatedAt !== expectedRevision) throw new Error("STALE_PROJECT");
      const ownerId = useAuthStore.getState().session?.user.id;
      if (current.cloudUserId && current.cloudUserId !== ownerId) throw new Error("AUTH_REQUIRED");
      editGeneration++;
      const project: LocalProject = { ...current, name: document.name, document, schemaVersion: 4, updatedAt: document.metadata.updatedAt, cloudUserId: ownerId, cloudDirty: !!ownerId, checkpointReason: reason };
      generation++;
      if (reason === "Moved hardware") {
        await local.save(project);
        if (layoutCheckpoint) clearTimeout(layoutCheckpoint);
        layoutCheckpoint = setTimeout(() => { layoutCheckpoint = undefined; void enqueue(async () => {
          const latest = (await local.list()).find(row => row.id === project.id);
          if (latest?.document.metadata.updatedAt === document.metadata.updatedAt) await local.save(latest, reason);
        }); }, 900);
      } else { if (layoutCheckpoint) clearTimeout(layoutCheckpoint); await local.save(project, reason); }
      if (get().conflictProjectId === project.id && ownerId) {
        const record = await projectHistoryRepository.conflict(ownerId,project.id);
        if (record) await projectHistoryRepository.saveConflict({ ...record, local: document });
      }
      if (!preserveHistory) history.reset(project.id);
      set({ project, ready: true, status: get().conflictProjectId === project.id ? "conflict" : "local", error: null, canUndo: history.canUndo, canRedo: history.canRedo });
      if (ownerId) { if (checkpoint) clearTimeout(checkpoint); checkpoint = setTimeout(() => { checkpoint = undefined; if (syncing) syncAgain = true; else void get().sync(); }, 500); }
    },
    applyTransaction: (commands, source) => enqueue(async () => {
      const row = get().project;
      if (!row) throw new Error("PROJECT_UNAVAILABLE");
      const before = migrateProject(row.document);
      history.ensure(before.id);
      const revision = new Date(Math.max(Date.now(), Date.parse(before.metadata.updatedAt) + 1)).toISOString();
      const resolved = typeof commands === "function" ? commands(before) : commands;
      if (!resolved.length) return before;
      const candidate = executeCommands(before, resolved, revision, "editor");
      const reason = source ?? (resolved.some(c => c.type.startsWith("logic.")) ? "Updated behavior" :
        resolved.some(c => c.type === "wire.add" || c.type === "wire.remove" || c.type === "connection.create" || c.type === "connection.remove") ? "Changed wiring" :
        resolved.some(c => c.type === "project.rename") ? "Renamed project" :
        resolved.every(c => c.type === "layout.move") ? "Moved hardware" : "Edited circuit");
      await get().saveDocument(candidate, before.metadata.updatedAt, true, reason);
      history.record(before);
      set({ canUndo: history.canUndo, canRedo: history.canRedo });
      return candidate;
    }),
    undo: () => enqueue(async () => {
      const row = get().project; if (!row) return;
      const current = migrateProject(row.document);
      history.ensure(current.id);
      const target = history.undoTarget(); if (!target) return;
      await get().saveDocument(restoreRevision(migrateProject(target), current), current.metadata.updatedAt, true);
      history.finishUndo(current);
      set({ canUndo: history.canUndo, canRedo: history.canRedo });
    }),
    redo: () => enqueue(async () => {
      const row = get().project; if (!row) return;
      const current = migrateProject(row.document);
      history.ensure(current.id);
      const target = history.redoTarget(); if (!target) return;
      await get().saveDocument(restoreRevision(migrateProject(target), current), current.metadata.updatedAt, true);
      history.finishRedo(current);
      set({ canUndo: history.canUndo, canRedo: history.canRedo });
    }),
    checkpoint: () => enqueue(async () => {
      const row = get().project; if (!row) throw new Error("PROJECT_UNAVAILABLE");
      editGeneration++;
      const dirty = { ...row, cloudDirty: !!row.cloudUserId || row.cloudDirty, checkpointReason: "Manual checkpoint" };
      await local.save(dirty, "Manual checkpoint"); set({ project: dirty, status: "local" });
      if (row.cloudUserId) void get().sync();
    }),
    restoreVersion: versionId => enqueue(async () => {
      const row = get().project; if (!row) throw new Error("PROJECT_UNAVAILABLE");
      const version = (await projectHistoryRepository.list(projectOwner(row.cloudUserId), row.id)).find(item => item.id === versionId);
      if (!version) throw new Error("VERSION_UNAVAILABLE");
      await get().saveDocument(restoreRevision(version.document, migrateProject(row.document)), row.document.metadata.updatedAt, false, "Restored version");
    }),
    restoreSnapshot: document => enqueue(async () => {
      const row = get().project; if (!row || document.id !== row.id) throw new Error("VERSION_UNAVAILABLE");
      await get().saveDocument(restoreRevision(document, migrateProject(row.document)), row.document.metadata.updatedAt, false, "Restored version");
    }),
    resolveConflict: choice => enqueue(async () => {
      const row = get().project, session = useAuthStore.getState().session;
      if (!row || !session || row.cloudUserId !== session.user.id) throw new Error("AUTH_REQUIRED");
      const record = await projectHistoryRepository.conflict(session.user.id, row.id);
      if (!record) throw new Error("CONFLICT_UNAVAILABLE");
      editGeneration++;
      const head = (await cloud.list(session.access_token, session.user.id)).find(item => item.id === row.id);
      if (!head) throw new Error("CLOUD_UNAVAILABLE");
      if (head.revision !== record.cloudRevision) {
        await projectHistoryRepository.saveConflict({ ...record, cloud: head.document, cloudRevision: head.revision, detectedAt: new Date().toISOString() });
        throw new Error("Cloud project changed again. Review both versions before choosing.");
      }
      if (choice === "device") {
        const saved = await cloud.save(row.document, session.access_token, session.user.id, head.revision, "Resolved with this device");
        await local.save({ ...row, cloudDirty: false, cloudRevision: saved.revision, updatedAt: saved.updated_at, checkpointReason: undefined }, "Resolved with this device");
      } else {
        if (choice === "both") {
          const now = new Date().toISOString(), suffix = " — this device", document = { ...migrateProject(row.document), id: crypto.randomUUID(), name: `${row.name.slice(0,120-suffix.length)}${suffix}`, metadata: { createdAt: now, updatedAt: now } };
          const duplicate: LocalProject = { id: document.id, name: document.name, schemaVersion: 4, document, createdAt: now, updatedAt: now,
            cloudUserId: session.user.id, cloudDirty: true, checkpointReason: "Kept both versions" };
          await local.save(duplicate, "Kept both versions");
          const saved = await cloud.save(document, session.access_token, session.user.id, null, "Kept both versions");
          await local.save({ ...duplicate, cloudDirty: false, cloudRevision: saved.revision, updatedAt: saved.updated_at, checkpointReason: undefined });
        } else await local.save(row, "This device before cloud restore");
        await local.save({ ...row, document: head.document, name: head.name, schemaVersion: head.document.schemaVersion,
          updatedAt: head.updated_at, cloudRevision: head.revision, cloudDirty: false, checkpointReason: undefined });
      }
      await projectHistoryRepository.clearConflict(session.user.id, row.id);
      const updated = (await local.list()).find(item => item.id === row.id)!;
      generation++; history.reset(row.id); set({ project: updated, conflictProjectId: null, status: "synced", error: null, canUndo: false, canRedo: false });
    }),
    sync: () => {
      if (checkpoint) { clearTimeout(checkpoint); checkpoint = undefined; }
      if (syncFollowup) { clearTimeout(syncFollowup); syncFollowup = undefined; }
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
              set({ project, ready: true, status: get().conflictProjectId === project.id ? "conflict" : project.cloudDirty ? "local" : "synced", canUndo: history.canUndo, canRedo: history.canRedo });
            },
            conflict: projectId => { if (get().project?.id === projectId) set({ conflictProjectId: projectId, status: "conflict" }); },
            retry: () => { syncAgain = true; },
          });
        } catch {
          syncAgain = false;
          if (useAuthStore.getState().session?.user.id === ownerId) {
            if (!get().project && boardForStarter) {
              const offline = starterRow(boardForStarter, ownerId);
              try { await local.save(offline); set({ project: offline }); } catch { set({ error: "We couldn’t save your project on this device." }); return; }
            }
            set({ status: "offline", ready: true, error: "Saved on this device. Cloud sync will retry when you’re online." });
          }
        }
      })().finally(() => {
        syncing = undefined;
        const followup = syncAgain && lastAutomaticEdit !== editGeneration && useAuthStore.getState().session?.user.id === ownerId;
        syncAgain = false;
        if (followup) {
          lastAutomaticEdit = editGeneration;
          syncFollowup = setTimeout(() => { syncFollowup = undefined; void get().sync(); }, 500);
        }
      });
      return syncing;
    },
    cancelPending: () => {
      generation++;
      syncAgain = false;
      if (checkpoint) clearTimeout(checkpoint);
      if (layoutCheckpoint) clearTimeout(layoutCheckpoint);
      if (syncFollowup) clearTimeout(syncFollowup);
      checkpoint = layoutCheckpoint = syncFollowup = undefined;
    },
  }));
}
export const useProjectStore = createProjectStore();
