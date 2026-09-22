import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { createProfileStore } from "./profileStore";
import { profileRepository, isProfile } from "../persistence/profileRepository";
it("persists selection, rapid switching, completion and fresh-store hydration through IndexedDB", async () => {
  const store = createProfileStore(); await store.getState().hydrate();
  await Promise.all([store.getState().selectBoard("esp32-dev-module"),store.getState().selectBoard("raspberry-pi-pico"),store.getState().selectBoard("arduino-uno")]);
  expect((await profileRepository.load())?.primaryBoardId).toBe("arduino-uno");
  expect(await store.getState().completeSetup()).toBe(true);
  const restored = createProfileStore(); await restored.getState().hydrate();
  expect(restored.getState().profile).toMatchObject({ primaryBoardId: "arduino-uno", setupCompleted: true });
  await restored.getState().selectBoard("raspberry-pi-pico");
  expect((await profileRepository.load())?.setupCompleted).toBe(false);
});
it("rejects invalid persisted profiles", () => {
  expect(isProfile({ primaryBoardId: "not-a-board", setupCompleted: true, updatedAt: new Date().toISOString() })).toBe(false);
  expect(isProfile({ primaryBoardId: "esp32-dev-module", setupCompleted: true, updatedAt: "bad" })).toBe(false);
});
it("does not claim setup succeeded when storage fails", async () => {
  const store = createProfileStore({ load: async () => null, save: async () => { throw new Error("quota"); } });
  await store.getState().hydrate(); await store.getState().selectBoard("esp32-dev-module");
  expect(store.getState().error).toContain("couldn’t save");
  expect(await store.getState().completeSetup()).toBe(false);
  expect(store.getState().profile?.setupCompleted).toBe(false);
});
it("keeps hydration failures explicit and allows retry", async () => {
  let fail = true;
  const store = createProfileStore({ load: async () => { if (fail) throw new Error("denied"); return null; }, save: async () => {} });
  await store.getState().hydrate(); expect(store.getState().hydrated).toBe(false); expect(store.getState().error).toBeTruthy();
  fail = false; await store.getState().hydrate(); expect(store.getState().hydrated).toBe(true); expect(store.getState().error).toBeNull();
});
