import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { isPristineStarter, isProject, parseProject, projectFromIntent, starterProject, titleFromIntent, validIntentText, validProjectName, type KinetableProject } from "./schema";
import { db } from "../persistence/profileRepository";
import { localProjectRepository } from "../persistence/localProjectRepository";
import { createProjectStore } from "../state/projectStore";
import { useAuthStore } from "../auth/authStore";
import { validateCloudProject, type CloudProject } from "../persistence/cloudProjectRepository";

const user = (id: string) => ({ user: { id }, access_token: `${id}-token` } as Session);
beforeEach(async () => { await db.table("projects").clear(); useAuthStore.setState({ session: null }); });
it("validates versioned documents and rejects invalid or unsupported data", () => {
  const project = starterProject("esp32-dev-module");
  expect(isProject(project)).toBe(true);
  expect(parseProject(JSON.parse(JSON.stringify(project))).layout).toEqual(project.layout);
  expect(isProject({ ...project, schemaVersion: 2 })).toBe(false);
  expect(isProject({ ...project, layout: { entities: {} } })).toBe(false);
  expect(() => parseProject({ ...project, components: [{ id: "board-main", kind: "board", definitionId: "unknown" }] })).toThrow();
});
it("validates intent and names without breaking existing v1 documents", () => {
  const old = starterProject("esp32-dev-module");
  expect(parseProject(old)).toBe(old);
  expect(validIntentText("Make a motion alarm")).toBe(true);
  expect(validIntentText("  ")).toBe(false);
  expect(validIntentText("x".repeat(501))).toBe(false);
  expect(validProjectName("Motion Alarm")).toBe(true);
  expect(validProjectName("\n")).toBe(false);
  expect(validProjectName("x".repeat(121))).toBe(false);
  const created = projectFromIntent(old, "esp32-dev-module", "  Make a motion alarm.  ", "  Motion Alarm  ");
  expect(parseProject(created).intent).toEqual({ text: "Make a motion alarm." });
  expect(isProject({ ...created, intent: { text: " " } })).toBe(false);
  expect(isProject({ ...created, intent: { text: "x".repeat(501) } })).toBe(false);
  expect(isProject({ ...created, intent: { text: "safe", unknown: "extra" } })).toBe(false);
});
it("generates readable deterministic local names", () => {
  expect(titleFromIntent("Make a motion alarm.")).toBe("Motion Alarm");
  expect(titleFromIntent("Show temperature on an OLED")).toBe("OLED Temperature");
  expect(titleFromIntent("Make an LED blink")).toBe("LED Blink");
  expect(titleFromIntent("Create " + "long ".repeat(40)).length).toBeLessThanOrEqual(60);
});
it("rejects malformed intent from cloud documents", () => {
  const document = projectFromIntent(starterProject("esp32-dev-module"), "esp32-dev-module", "Make a motion alarm", "Motion Alarm");
  const row = { id: document.id, owner_id: "user-a", name: document.name, primary_board_id: document.boardIds[0],
    schema_version: 1, document, archived: false, created_at: document.metadata.createdAt, updated_at: document.metadata.updatedAt };
  expect(validateCloudProject(row, "user-a").document.intent?.text).toBe("Make a motion alarm");
  expect(() => validateCloudProject({ ...row, document: { ...document, intent: { text: " " } } }, "user-a")).toThrow();
});
it("promotes only a pristine starter while preserving its identity and board placement", () => {
  const starter = starterProject("esp32-dev-module");
  const original = structuredClone(starter);
  expect(isPristineStarter(starter)).toBe(true);
  const promoted = projectFromIntent(starter, "esp32-dev-module", "Make a motion alarm", "Motion Alarm", "2026-09-23T14:00:00.000Z");
  expect(promoted.id).toBe(original.id);
  expect(promoted.metadata.createdAt).toBe(original.metadata.createdAt);
  expect(promoted.metadata.updatedAt).toBe("2026-09-23T14:00:00.000Z");
  expect(promoted.layout).toEqual(original.layout);
  expect(isPristineStarter(promoted)).toBe(false);
  const moved = structuredClone(starter); moved.layout.entities["board-main"].position[0] = 1;
  expect(isPristineStarter(moved)).toBe(false);
  expect(projectFromIntent(moved, "esp32-dev-module", "Make an LED blink", "LED Blink").id).not.toBe(moved.id);
  expect(projectFromIntent(promoted, "esp32-dev-module", "Make an LED blink", "LED Blink").id).not.toBe(promoted.id);
});
it("keeps earlier projects and opens the newest build", async () => {
  const store = createProjectStore();
  await store.getState().open("esp32-dev-module", null);
  const starterId = store.getState().project!.id;
  await store.getState().createBuild("esp32-dev-module", "Make a motion alarm", "Motion Alarm");
  expect(store.getState().project!.id).toBe(starterId);
  await store.getState().createBuild("esp32-dev-module", "Make an LED blink", "LED Blink");
  expect(store.getState().project!.id).not.toBe(starterId);
  expect((await localProjectRepository.list()).map(row => row.id)).toContain(starterId);
  expect(await localProjectRepository.list()).toHaveLength(2);
  expect(isProject(store.getState().project!.document)).toBe(true);
  const restored = createProjectStore(); await restored.getState().open("esp32-dev-module", null);
  expect(restored.getState().project?.id).toBe(store.getState().project?.id);
});
it("creates one local starter and restores its board and transform after reload", async () => {
  const first = createProjectStore(); await first.getState().open("raspberry-pi-pico", null);
  const id = first.getState().project!.id;
  const transform = first.getState().project!.document.layout.entities["board-main"];
  const second = createProjectStore(); await second.getState().open("esp32-dev-module", null);
  expect(second.getState().project?.id).toBe(id);
  expect(second.getState().project?.document.boardIds).toEqual(["raspberry-pi-pico"]);
  expect(second.getState().project?.document.layout.entities["board-main"]).toEqual(transform);
  expect(await localProjectRepository.list()).toHaveLength(1);
});
it("adopts a guest project, retries failed cloud writes, and never transfers another owner's row", async () => {
  const cloud = { list: vi.fn(async () => [] as CloudProject[]), save: vi.fn() };
  const store = createProjectStore(localProjectRepository, cloud);
  await store.getState().open("esp32-dev-module", null);
  const guestId = store.getState().project!.id;
  useAuthStore.setState({ session: user("user-a") });
  cloud.save.mockRejectedValueOnce(new Error("offline"));
  await store.getState().open("esp32-dev-module", user("user-a"));
  expect(store.getState().project?.id).toBe(guestId);
  expect(store.getState().status).toBe("offline");
  expect((await localProjectRepository.list())[0].cloudDirty).toBe(true);
  cloud.save.mockImplementation(async document => ({ id: document.id, owner_id: "user-a", name: document.name,
    schema_version: 1, primary_board_id: document.boardIds[0], document, archived: false,
    created_at: document.metadata.createdAt, updated_at: "2026-09-23T12:00:00Z" } as CloudProject));
  await store.getState().sync();
  expect(store.getState().status).toBe("synced");
  expect((await localProjectRepository.list())[0]).toMatchObject({ cloudUserId: "user-a", cloudDirty: false, updatedAt: "2026-09-23T12:00:00Z" });
  useAuthStore.setState({ session: user("user-b") });
  await store.getState().open("arduino-uno", user("user-b"));
  expect(store.getState().project?.id).not.toBe(guestId);
  expect((await localProjectRepository.list()).find(row => row.id === guestId)?.cloudUserId).toBe("user-a");
});
it("starts an authenticated local table when cloud is unavailable", async () => {
  const cloud = { list: vi.fn(async () => { throw new Error("offline"); }), save: vi.fn() };
  useAuthStore.setState({ session: user("user-a") });
  const store = createProjectStore(localProjectRepository, cloud);
  await store.getState().open("raspberry-pi-pico", user("user-a"));
  expect(store.getState().project?.document.boardIds).toEqual(["raspberry-pi-pico"]);
  expect(store.getState().status).toBe("offline");
  expect((await localProjectRepository.list())[0].cloudDirty).toBe(true);
});
it("uploads every guest build when an account is connected", async () => {
  const cloud = { list: vi.fn(async () => [] as CloudProject[]), save: vi.fn(async (document: KinetableProject) => ({
    id: document.id, owner_id: "user-a", name: document.name, schema_version: 1,
    primary_board_id: document.boardIds[0], document, archived: false,
    created_at: document.metadata.createdAt, updated_at: document.metadata.updatedAt,
  } as CloudProject)) };
  const store = createProjectStore(localProjectRepository, cloud);
  await store.getState().open("esp32-dev-module", null);
  await store.getState().createBuild("esp32-dev-module", "Make a motion alarm", "Motion Alarm");
  await store.getState().createBuild("esp32-dev-module", "Make an LED blink", "LED Blink");
  useAuthStore.setState({ session: user("user-a") });
  await store.getState().open("esp32-dev-module", user("user-a"));
  expect(cloud.save).toHaveBeenCalledTimes(2);
  expect((await localProjectRepository.list()).every(row => row.cloudUserId === "user-a" && !row.cloudDirty)).toBe(true);
});
