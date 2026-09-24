import { expect, it } from "vitest";
import { starterProject } from "../projects/schema";
import { migrateProject } from "../projects/v2";
import { executeCommands, type ProjectCommand } from "./commands";
import { restoreRevision, WorkbenchHistory } from "./history";

const base = () => migrateProject(starterProject("esp32-dev-module"));
const edit = (project: ReturnType<typeof base>, commands: ProjectCommand[]) => executeCommands(project, commands, new Date(Date.parse(project.metadata.updatedAt) + 1).toISOString(), "editor");
it("undoes and redoes move, rotation, add, remove and replacement as new revisions", () => {
  const history = new WorkbenchHistory();
  let current = base(); history.ensure(current.id);
  const original = current.layout.entities["board-main"];
  const steps: ProjectCommand[][] = [
    [{ type: "layout.move", entityId: "board-main", transform: { ...original, position: [1, 1, 0] } }],
    [{ type: "layout.move", entityId: "board-main", transform: { ...original, position: [1, 1, 0], rotation: [original.rotation[0], original.rotation[1], 1] } }],
    [{ type: "component.add", instanceId: "led-1", definitionId: "led-5mm" }],
    [{ type: "component.remove", instanceId: "led-1" }],
    [{ type: "component.add", instanceId: "led-2", definitionId: "led-5mm" }, { type: "component.replace", instanceId: "led-2", replacementId: "pir-1", definitionId: "hc-sr501" }],
  ];
  const snapshots = [current];
  for (const commands of steps) { const next = edit(current, commands); history.record(current); current = next; snapshots.push(current); }
  for (let i = steps.length; i > 0; i--) {
    const target = history.undoTarget()!;
    const restored = restoreRevision(target, current);
    expect(restored.metadata.updatedAt > current.metadata.updatedAt).toBe(true);
    expect(restored.components).toEqual(snapshots[i - 1].components);
    expect(restored.layout).toEqual(snapshots[i - 1].layout);
    history.finishUndo(current); current = restored;
  }
  expect(history.canUndo).toBe(false);
  for (let i = 1; i <= steps.length; i++) {
    const restored = restoreRevision(history.redoTarget()!, current);
    expect(restored.components).toEqual(snapshots[i].components);
    history.finishRedo(current); current = restored;
  }
  expect(history.canRedo).toBe(false);
  history.finishUndo(current);
  history.record(current);
  expect(history.canRedo).toBe(false);
});
it("caps history and isolates project switches", () => {
  const history = new WorkbenchHistory(2);
  const first = base(); history.record(first); history.record(first); history.record(first);
  expect(history.size).toBe(2);
  history.ensure(base().id);
  expect(history.canUndo).toBe(false);
});
