import { useEffect, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../backend/supabaseClient";
import { useProfileStore } from "../state/profileStore";
import { cloudProfileRepository, reconcileProfile } from "../persistence/cloudProfileRepository";
import { getBoard } from "../hardware/boards";
import { useAuthStore } from "./authStore";
import { syncInventory } from "../sync/inventorySync";
import { useProjectStore } from "../state/projectStore";

let syncing: Promise<void> | undefined;
let queued = false;
let pushPending = false;
export function syncProfile(pushLocal = false): Promise<void> {
  pushPending ||= pushLocal;
  if (syncing) { queued = true; return syncing; }
  const session = useAuthStore.getState().session;
  if (!session) { pushPending = false; return Promise.resolve(); }
  const userId = session.user.id;
  const push = pushPending; pushPending = false;
  syncing = (async () => {
    useAuthStore.setState({ syncStatus: "syncing", error: null });
    try {
      await useProfileStore.getState().hydrate();
      const snapshot = useProfileStore.getState();
      if (!snapshot.hydrated || snapshot.saving || snapshot.error) throw new Error("Local profile is not ready");
      const local = snapshot.profile;
      const cloud = await cloudProfileRepository.load(session.access_token);
      const merged = local && (push || (local.cloudUserId === userId && local.cloudDirty))
        ? { primary_board_id: local.primaryBoardId, setup_completed: local.setupCompleted }
        : reconcileProfile(local, cloud, userId);
      if (useAuthStore.getState().session?.user.id !== userId) return;
      const saved = await cloudProfileRepository.save(merged, session.access_token);
      if (useAuthStore.getState().session?.user.id !== userId) return;
      if (useProfileStore.getState().profile !== local || useProfileStore.getState().saving) { queued = true; return; }
      const board = getBoard(saved.primary_board_id);
      if (board) {
        const profile = { primaryBoardId: board.id, setupCompleted: saved.setup_completed, updatedAt: saved.updated_at, cloudUserId: userId, cloudDirty: false };
        if (!await useProfileStore.getState().applyCloud(local, profile)) throw new Error("Local profile changed");
      }
      if (useAuthStore.getState().session?.user.id === userId) useAuthStore.setState({ syncStatus: board ? "synced" : "idle", error: null });
    } catch {
      if (useAuthStore.getState().session?.user.id === userId) useAuthStore.setState({ syncStatus: "offline", error: "Your table is available on this device. Cloud sync will retry when you’re online." });
    }
  })().finally(async () => { syncing = undefined; if (queued) { queued = false; await syncProfile(); } });
  return syncing;
}

export function AuthBoundary({ children }: { children: ReactNode }) {
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;
    let version = 0;
    const accept = (session: Session | null) => {
      if (!active) return;
      const previous = useAuthStore.getState().session?.user.id;
      useAuthStore.setState({ session, resolved: true, ...(session ? (previous !== session.user.id ? { syncStatus: "syncing" as const } : {}) : { syncStatus: "idle", error: null }) });
      if (session && previous !== session.user.id) setTimeout(() => { if (active) void syncProfile(); }, 0);
      if (session && previous !== session.user.id) setTimeout(() => { if (active) void syncInventory(session).catch(() => undefined); }, 0);
    };
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { version++; accept(session); });
    const timeout = window.setTimeout(() => { if (active) useAuthStore.setState({ resolved: true }); }, 8000);
    const initialVersion = version;
    void client.auth.getSession().then(({ data, error }) => {
      if (version === initialVersion) accept(error ? null : data.session);
    }).catch(() => { if (active) useAuthStore.setState({ resolved: true }); });
    const unsubscribe = useProfileStore.subscribe((state, previous) => {
      if (!state.saving && !state.error && state.profile && useAuthStore.getState().session && (state.profile.cloudDirty || !state.profile.cloudUserId) && previous.hydrated && previous.saving) void syncProfile(true);
    });
    const unsubscribeOwner = useAuthStore.subscribe((state, previous) => {
      if (state.session?.user.id !== previous.session?.user.id) useProjectStore.getState().cancelPending();
    });
    const retry = () => { void syncProfile(); const session = useAuthStore.getState().session; if (session) void syncInventory(session).catch(() => undefined); };
    window.addEventListener("online", retry);
    return () => { active = false; window.clearTimeout(timeout); subscription.unsubscribe(); unsubscribe(); unsubscribeOwner(); window.removeEventListener("online", retry); };
  }, []);
  return children;
}
