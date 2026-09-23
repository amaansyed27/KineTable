import { create } from "zustand";
import { getBoard, type BoardId } from "../hardware/boards";
import { profileRepository, type HardwareProfile } from "../persistence/profileRepository";
type ProfileState = {
  profile: HardwareProfile | null;
  hydrated: boolean;
  saving: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  selectBoard: (id: BoardId) => Promise<void>;
  applyCloud: (expected: HardwareProfile | null, profile: HardwareProfile) => Promise<boolean>;
  completeSetup: () => Promise<boolean>;
};
export function createProfileStore(repository = profileRepository) {
  let hydration: Promise<void> | undefined;
  let revision = 0;
  return create<ProfileState>((set, get) => ({
    profile: null, hydrated: false, saving: false, error: null,
    hydrate: () => {
      if (get().hydrated) return Promise.resolve();
      if (hydration) return hydration;
      hydration = repository.load().then(profile => { set({ profile, hydrated: true, error: null }); })
        .catch(() => { set({ error: "We couldn’t read your saved table. Please allow browser storage and try again." }); })
        .finally(() => { hydration = undefined; });
      return hydration;
    },
    applyCloud: async (expected, profile) => {
      if (get().profile !== expected || get().saving) return false;
      const current = ++revision;
      set({ profile, saving: true });
      try { await repository.save(profile); return current === revision; }
      catch { if (current === revision) set({ profile: expected, error: "Your cloud table could not be saved on this device." }); return false; }
      finally { if (current === revision) set({ saving: false }); }
    },
    selectBoard: async id => {
      if (!get().hydrated || !getBoard(id)) return;
      const current = ++revision;
      const profile = { ...get().profile, cloudDirty: !!get().profile?.cloudUserId, primaryBoardId: id, setupCompleted: false, updatedAt: new Date().toISOString() };
      set({ profile, saving: true, error: null });
      try { await repository.save(profile); }
      catch { if (current === revision) set({ error: "We couldn’t save your board. Please allow browser storage, then select it again." }); }
      finally { if (current === revision) set({ saving: false }); }
    },
    completeSetup: async () => {
      const state = get();
      if (!state.profile || !state.hydrated || state.saving || state.error) return false;
      const current = ++revision;
      const profile = { ...state.profile, cloudDirty: !!state.profile.cloudUserId, setupCompleted: true, updatedAt: new Date().toISOString() };
      set({ saving: true });
      try {
        await repository.save(profile);
        if (current !== revision) return false;
        set({ profile });
        return true;
      } catch { if (current === revision) set({ error: "We couldn’t save your table. Please select your board to try again." }); return false; }
      finally { if (current === revision) set({ saving: false }); }
    },
  }));
}
export const useProfileStore = createProfileStore();
