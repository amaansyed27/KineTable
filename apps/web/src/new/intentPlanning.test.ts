import "fake-indexeddb/auto";
import type { Session } from "@supabase/supabase-js";
import { cloudProjectRepository, type CloudProject } from "../persistence/cloudProjectRepository";
import { beforeEach, expect, it, vi } from "vitest";
import { db } from "../persistence/profileRepository";
import { inventoryRepository } from "../persistence/inventoryRepository";
import { localProjectRepository } from "../persistence/localProjectRepository";
import { createProjectStore } from "../state/projectStore";
import { useAuthStore } from "../auth/authStore";
import { getDefinition } from "../component-library/catalog";
import { boards } from "../hardware/boards";
import { executeCommands } from "../hardware-core/commands";
import { bonkProject } from "../projects/starters";
import { projectHistoryRepository } from "../persistence/projectHistoryRepository";
import { parseInventorySnapshot } from "../ai/contract";
import { matchesBonk, proposalParts, proposeBuild } from "./intentPlanning";
import { invokeProvider } from "../ai/providerTransport";
import { loadProviderSettings } from "../ai/providerSettings";
vi.mock("../ai/providerTransport", () => ({ invokeProvider: vi.fn() }));
vi.mock("../ai/providerSettings", () => ({ loadProviderSettings: vi.fn() }));
const provider = { profile: { id: "test", name: "Test", routes: [{ id: "test", providerId: "test", transport: "LOCAL_CLI" as const, modelId: "test", credentialIds: [], enabled: true, priority: 0 }] }, credentials: [] };
beforeEach(async () => {
  vi.resetAllMocks(); vi.mocked(loadProviderSettings).mockReturnValue(provider);
  useAuthStore.setState({ session: null });
  for (const table of ["projects", "projectVersions", "projectConflicts", "inventoryItems"]) await db.table(table).clear();
});
const bonk = () => proposeBuild("esp32-dev-module", "Press a button and make it go BONK.", "BONK", [], true, () => undefined);
it("bounds intent and names before any planning operation", async () => {
  for (const intent of ["", "x".repeat(501), "a\u0000b"]) await expect(proposeBuild("esp32-dev-module", intent, "Build", [], false, () => undefined)).rejects.toThrow();
  await expect(proposeBuild("esp32-dev-module", "Make an LED blink", "", [], false, () => undefined)).rejects.toThrow();
  expect(invokeProvider).not.toHaveBeenCalled();
});
it("matches only narrow BONK phrases, including the trailer's two sentences", () => {
  for (const text of ["BONK", "Make a BONK build", "Press a button. Make it go BONK."]) expect(matchesBonk(text)).toBe(true);
  for (const text of ["Don't make BONK", "BONK with GPS", "Press a button and make a drone go BONK", "Make a button control an LED"]) expect(matchesBonk(text)).toBe(false);
});
it("uses the canonical BONK commands with topology and saved behavior", async () => {
  const proposal = await bonk();
  expect(proposal.status).toBe("supported"); expect(proposal.source).toBe("starter");
  const actual = executeCommands(proposal.base, proposal.commands);
  const canonical = bonkProject(proposal.base);
  expect(actual.wires).toEqual(canonical.wires); expect(actual.terminalPlacements).toEqual(canonical.terminalPlacements); expect(actual.logic).toEqual(canonical.logic);
  expect(invokeProvider).not.toHaveBeenCalled();
  expect(await localProjectRepository.list()).toHaveLength(0);
});
it("keeps Pico and Uno context and explicitly refuses the ESP32-only starter", async () => {
  for (const board of boards.filter(board => board.id !== "esp32-dev-module")) {
    const proposal = await proposeBuild(board.id, "BONK", "BONK", [], true, () => undefined);
    expect(proposal.base.boardIds).toEqual([board.id]); expect(proposal.status).toBe("unsupported"); expect(proposal.commands).toEqual([]);
  }
  expect(invokeProvider).not.toHaveBeenCalled();
});
it("passes each board and optional bounded quantity context through the existing planner", async () => {
  await inventoryRepository.setQuantity("guest", "push-button", 2);
  const inventory = await inventoryRepository.list("guest");
  vi.mocked(invokeProvider).mockImplementation(async (_route, _key, input, project) => {
    expect(input.boardId).toBe(project.boardIds[0]);
    expect(input.inventory).toEqual({ mode: "prefer-owned", items: [{ definitionId: "push-button", quantity: 2 }] });
    return { status: "unsupported", summary: "No supported topology", unsupportedReason: "Fixture", commands: [], revision: input.revision };
  });
  for (const board of boards) await proposeBuild(board.id, "Make a button control an LED", "Button LED", inventory, true, () => undefined);
  expect(invokeProvider).toHaveBeenCalledTimes(3);
  expect(parseInventorySnapshot({ mode: ["prefer-owned"], items: [] })).toBeNull();
  expect(parseInventorySnapshot({ mode: "prefer-owned", items: [{ definitionId: "unknown", quantity: 1 }] })).toBeNull();
  expect(parseInventorySnapshot({ mode: "prefer-owned", items: [{ definitionId: "push-button", quantity: 1000 }] })).toBeNull();
});
it("counts exact quantities without assuming board ownership or consuming inventory", async () => {
  const proposal = await bonk();
  const required = proposalParts(proposal, []);
  expect(required).toHaveLength(7); expect(required.every(part => part.missing === part.need)).toBe(true);
  for (const part of required) await inventoryRepository.setQuantity("guest", part.id, part.id === "push-button" ? 2 : 1);
  let rows = await inventoryRepository.list("guest");
  expect(proposalParts(proposal, rows).every(part => part.missing === 0)).toBe(true);
  await inventoryRepository.setQuantity("guest", "oled-ssd1306-i2c-3v3", 0);
  rows = await inventoryRepository.list("guest");
  expect(proposalParts(proposal, rows).filter(part => part.missing).map(part => part.id)).toEqual(["oled-ssd1306-i2c-3v3"]);
  await createProjectStore().getState().createFromProposal(proposal.base, proposal.commands, "guest");
  expect(await inventoryRepository.list("guest")).toEqual(rows);
});
it("terminates absent provider and malformed response without persisting", async () => {
  vi.mocked(loadProviderSettings).mockReturnValue({ profile: { ...provider.profile, routes: [] }, credentials: [] });
  await expect(proposeBuild("esp32-dev-module", "Make a motion alarm", "Alarm", [], false, () => undefined)).rejects.toThrow("NO_PROVIDER");
  vi.mocked(loadProviderSettings).mockReturnValue(provider);
  vi.mocked(invokeProvider).mockResolvedValue({ html: "<script>unsafe</script>" });
  await expect(proposeBuild("esp32-dev-module", "Make a motion alarm", "Alarm", [], false, () => undefined)).rejects.toThrow();
  expect(invokeProvider).toHaveBeenCalledTimes(1); expect(await localProjectRepository.list()).toHaveLength(0);
});
it("returns a zero-command unsupported proposal and rejects fabricated hardware", async () => {
  vi.mocked(invokeProvider).mockImplementation(async (_route, _key, input) => ({ status: "unsupported", summary: "Kinetable canâ€™t build that complete system yet.", unsupportedReason: "Try motion sensing or an OLED status display.", commands: [], revision: input.revision }));
  const unsupported = await proposeBuild("esp32-dev-module", "Build a drone autopilot with GPS and LiDAR", "Drone", [], false, () => undefined);
  expect(unsupported.status).toBe("unsupported"); expect(unsupported.commands).toEqual([]);
  vi.mocked(invokeProvider).mockImplementation(async (_route, _key, input) => ({ status: "supported", summary: "Unsafe", unsupportedReason: "", commands: [{ type: "component.add", instanceId: "x", definitionId: "invented" }], revision: input.revision }));
  await expect(proposeBuild("esp32-dev-module", "Make an LED blink", "LED", [], false, () => undefined)).rejects.toMatchObject({ code: "UNKNOWN_COMPONENT" });
  expect(await localProjectRepository.list()).toHaveLength(0);
});
it("approves once, records normal history, supports undo/redo and rejects an owner change", async () => {
  const proposal = await bonk(), store = createProjectStore();
  expect(store.getState().project).toBeNull();
  await expect(store.getState().createFromProposal(proposal.base, proposal.commands, "other-user")).rejects.toThrow("AUTH_REQUIRED");
  const [first, second] = await Promise.all([store.getState().createFromProposal(proposal.base, proposal.commands, "guest"), store.getState().createFromProposal(proposal.base, proposal.commands, "guest")]);
  expect(first.id).toBe(second.id); expect(await localProjectRepository.list()).toHaveLength(1);
  expect(await projectHistoryRepository.list("guest", first.id)).toHaveLength(1);
  await store.getState().undo(); expect(store.getState().project?.document.components).toHaveLength(1);
  await store.getState().redo(); expect(store.getState().project?.document.logic).toHaveLength(2);
  expect(getDefinition(store.getState().project!.document.boardIds[0])?.kind).toBe("board");
});

it("approved account projects use the existing revision-checkpoint path, with no cloud call before approval", async () => {
  const session = { user: { id: "owner" }, access_token: "fixture-token" } as Session;
  useAuthStore.setState({ session });
  const cloud = { list: vi.fn<typeof cloudProjectRepository.list>().mockResolvedValue([]),
    save: vi.fn<typeof cloudProjectRepository.save>().mockImplementation(async document => ({
      id: document.id, owner_id: "owner", name: document.name, document, primary_board_id: document.boardIds[0],
      schema_version: 4, revision: 1, archived: false, created_at: document.metadata.createdAt, updated_at: document.metadata.updatedAt,
    }) as CloudProject) };
  const proposal = await bonk(), store = createProjectStore(localProjectRepository, cloud);
  expect(cloud.list).not.toHaveBeenCalled(); expect(cloud.save).not.toHaveBeenCalled();
  const saved = await store.getState().createFromProposal(proposal.base, proposal.commands, "owner");
  await store.getState().sync();
  expect(cloud.save).toHaveBeenCalledExactlyOnceWith(saved, session.access_token, "owner", null, "Created project");
  expect(store.getState().project).toMatchObject({ id: saved.id, cloudUserId: "owner", cloudDirty: false, cloudRevision: 1 });
  expect(store.getState().canUndo).toBe(true);
  useAuthStore.setState({ session: null }); store.getState().cancelPending();
});
