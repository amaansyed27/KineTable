import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { isProject, parseProject, starterProject } from "./schema";
import { db } from "../persistence/profileRepository";
import { localProjectRepository } from "../persistence/localProjectRepository";
import { createProjectStore } from "../state/projectStore";
import { useAuthStore } from "../auth/authStore";
import type { CloudProject } from "../persistence/cloudProjectRepository";

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
