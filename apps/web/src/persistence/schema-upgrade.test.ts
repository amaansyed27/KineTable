import "fake-indexeddb/auto";
import Dexie from "dexie";
import { expect, it } from "vitest";
import { db } from "./profileRepository";
import { starterRow } from "../projects/projectCreation";

it("upgrades an existing v4 database without losing projects or inventory", async () => {
  await db.delete();
  const old = new Dexie("kinetable");
  old.version(4).stores({
    profiles: "id", projects: "id, cloudUserId, updatedAt",
    behaviorChats: "id, [ownerId+projectId], updatedAt",
    inventoryItems: "[ownerId+definitionId], ownerId, updatedAt",
  });
  const project = starterRow("esp32-dev-module");
  await old.table("projects").put(project);
  await old.table("inventoryItems").put({
    ownerId: "guest", definitionId: "led-5mm", quantity: 2,
    createdAt: "2026-09-28T00:00:00.000Z", updatedAt: "2026-09-28T00:00:00.000Z", dirty: false,
  });
  old.close();
  await db.open();
  expect(await db.table("projects").get(project.id)).toEqual(project);
  expect((await db.table("inventoryItems").get(["guest", "led-5mm"]))?.quantity).toBe(2);
  expect(await db.table("projectVersions").count()).toBe(0);
  expect(await db.table("projectConflicts").count()).toBe(0);
  await db.delete();
});
