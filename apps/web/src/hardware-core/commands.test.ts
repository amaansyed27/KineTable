import { expect, it } from "vitest";
import { starterProject } from "../projects/schema";
import { isProjectV2, migrateProject, parseProjectV2 } from "../projects/v2";
import { executeCommands, parseCommands, validateHardware, type ProjectCommand } from "./commands";
import { layoutComponents } from "./layout";

const e = (componentId: string, pinId: string) => ({ componentId, pinId });
const add = (instanceId: string, definitionId: string): ProjectCommand => ({ type: "component.add", instanceId, definitionId });
const connect = (id: string, a: string, ap: string, b: string, bp: string): ProjectCommand => ({ type: "connection.create", id, from: e(a, ap), to: e(b, bp) });
const base = () => migrateProject(starterProject("esp32-dev-module"));
const led: ProjectCommand[] = [add("led-1", "led-5mm"), add("resistor-1", "resistor-220r"),
  connect("wire-1", "board-main", "gpio23", "resistor-1", "a"), connect("wire-2", "resistor-1", "b", "led-1", "anode"), connect("wire-3", "led-1", "cathode", "board-main", "gnd")];
it("migrates v1 without mutating storage input and round-trips v2", () => {
  const v1 = starterProject("esp32-dev-module");
  const migrated = migrateProject(v1);
  expect(v1.schemaVersion).toBe(1);
  expect(migrated.schemaVersion).toBe(2);
  expect(parseProjectV2(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
  expect(isProjectV2({ ...migrated, components: [] })).toBe(false);
  expect(isProjectV2({ ...migrated, components: [null] })).toBe(false);
  expect(isProjectV2({ ...migrated, connections: [null] })).toBe(false);
});
it("validates commands and applies LED plus series resistor atomically", () => {
  expect(() => parseCommands([{ type: "component.add", instanceId: "x" }])).toThrow();
  expect(() => parseCommands([{ type: "component.add", instanceId: "x", definitionId: "led-5mm", extra: true }])).toThrow();
  const original = base();
  const result = executeCommands(original, led, "2026-09-24T00:00:00.000Z");
  expect(result.components).toHaveLength(3);
  expect(result.connections).toHaveLength(3);
  expect(result.layout.entities["led-1"]).toBeDefined();
  expect(original.components).toHaveLength(1);
  expect(original.connections).toHaveLength(0);
  validateHardware(result);
});
it("rejects duplicate instances, unknown definitions, pins and endpoints without changing input", () => {
  const original = base();
  for (const commands of [
    [add("led-1", "led-5mm"), add("led-1", "led-5mm")],
    [add("unknown-1", "unsupported")],
    [...led.slice(0,2), connect("wire-bad", "board-main", "gpio999", "led-1", "anode")],
    [...led.slice(0,2), connect("wire-bad", "missing", "out", "led-1", "anode")],
    [...led, led[2]],
  ]) expect(() => executeCommands(original, commands)).toThrow();
  expect(original.components).toHaveLength(1);
  expect(original.connections).toHaveLength(0);
});
it("supports button, motion alarm, and DHT11 plus OLED hardware graphs", () => {
  const button = [add("button-1", "push-button"), connect("button-signal", "button-1", "a", "board-main", "gpio18"), connect("button-ground", "button-1", "b", "board-main", "gnd")];
  expect(executeCommands(base(), [...led, ...button]).components).toHaveLength(4);
  const motion = [add("pir-1", "hc-sr501"), add("buzzer-1", "grove-buzzer-v1-1"),
    connect("pir-power", "pir-1", "vcc", "board-main", "vin"), connect("pir-ground", "pir-1", "gnd", "board-main", "gnd"), connect("pir-out", "pir-1", "out", "board-main", "gpio27"),
    connect("buzzer-power", "buzzer-1", "vcc", "board-main", "3v3"), connect("buzzer-signal", "buzzer-1", "sig", "board-main", "gpio19"), connect("buzzer-ground", "buzzer-1", "gnd", "board-main", "gnd")];
  expect(executeCommands(base(), motion).connections).toHaveLength(6);
  const temperature = [add("dht-1", "dht11-module"), add("oled-1", "oled-ssd1306-i2c-3v3"),
    connect("dht-power", "dht-1", "vcc", "board-main", "3v3"), connect("dht-ground", "dht-1", "gnd", "board-main", "gnd"), connect("dht-data", "dht-1", "data", "board-main", "gpio27"),
    connect("oled-power", "oled-1", "vcc", "board-main", "3v3"), connect("oled-ground", "oled-1", "gnd", "board-main", "gnd"), connect("oled-sda", "oled-1", "sda", "board-main", "gpio21"), connect("oled-scl", "oled-1", "scl", "board-main", "gpio22")];
  expect(executeCommands(base(), temperature).connections).toHaveLength(7);
  expect(() => executeCommands(base(), temperature.map(c => c.type === "connection.create" && c.id === "oled-sda" ? { ...c, to: e("board-main", "gpio23") } : c))).toThrow();
  expect(() => executeCommands(base(), motion.map(c => c.type === "connection.create" && c.id === "pir-power" ? { ...c, to: e("board-main", "3v3") } : c))).toThrow();
});
it("rejects pin conflicts and leaves an invalid plan unapplied", () => {
  const original = base();
  const conflicting = [...led, add("button-1", "push-button"), connect("button-signal", "button-1", "a", "board-main", "gpio23"), connect("button-ground", "button-1", "b", "board-main", "gnd")];
  expect(() => executeCommands(original, conflicting)).toThrow();
  expect(original.components).toHaveLength(1);
  expect(original.layout.entities).toHaveProperty("board-main");
});
it("uses stable placement for the same ordered components", () => {
  const project = executeCommands(base(), led);
  expect(layoutComponents(project.components, { "board-main": project.layout.entities["board-main"] })).toEqual(project.layout.entities);
});
