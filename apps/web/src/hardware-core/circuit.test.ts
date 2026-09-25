import { expect, it } from "vitest";
import { starterProject } from "../projects/schema";
import { migrateProject as migrateV2 } from "../projects/v2";
import { endpointKey, holeEndpoint, migrateProject, pinEndpoint } from "../projects/v3";
import { getHole, holes, connectedHoles } from "./breadboard";
import { executeCommands, validateCompleteCircuit, validateElectricalSafety } from "./commands";
import { netFor, resolveNets } from "./nets";
import { assertAnchorCoverage, endpointWorld } from "../spatial/anchors";
import { inspectComponent, inspectHole, inspectWire } from "../table/inspector";
import { restoreRevision, WorkbenchHistory } from "./history";

const base = () => migrateProject(starterProject("esp32-dev-module"));
const pin = pinEndpoint;
const hole = (id: string) => holeEndpoint("breadboard-1", id);
const wire = (id: string, from: ReturnType<typeof pin> | ReturnType<typeof hole>, to: ReturnType<typeof pin> | ReturnType<typeof hole>) => ({ type: "wire.add" as const, id, from, to });
const edit = (project: ReturnType<typeof base>, commands: Parameters<typeof executeCommands>[1]) => executeCommands(project, commands, undefined, "editor");

it("defines exactly 400 sockets and deterministic isolated strips", () => {
  expect(holes).toHaveLength(400);
  expect(connectedHoles("A12").map(h => h.id)).toEqual(["A12","B12","C12","D12","E12"]);
  expect(connectedHoles("F12").map(h => h.id)).toEqual(["F12","G12","H12","I12","J12"]);
  expect(connectedHoles("L+1")).toHaveLength(25);
  expect(getHole("L+25")?.strip).toBe("L+");
  expect(getHole("L+26")).toBeUndefined();
  expect(getHole("A12")?.strip).not.toBe(getHole("A13")?.strip);
  expect(getHole("E12")?.strip).not.toBe(getHole("F12")?.strip);
});

it("migrates v1 and v2 without losing identity, layout or direct electrical edges", () => {
  const old = migrateV2(starterProject("esp32-dev-module"));
  old.components.push({ id: "led-1", kind: "component", definitionId: "led-5mm" });
  old.layout.entities["led-1"] = { position: [2,1,.2], rotation: [0,0,.4], scale: [1,1,1] };
  old.connections.push({ id: "ground", from: { componentId: "board-main", pinId: "gnd" }, to: { componentId: "led-1", pinId: "cathode" } });
  const migrated = migrateProject(old);
  expect(migrated.schemaVersion).toBe(3);
  expect(migrated.id).toBe(old.id);
  expect(migrated.metadata).toEqual(old.metadata);
  expect(migrated.layout).toEqual(old.layout);
  expect(migrated.wires).toEqual([{ id: "ground", from: pin("board-main","gnd"), to: pin("led-1","cathode") }]);
  expect(migrateProject(migrated)).toBe(migrated);
  expect(migrateProject(starterProject("esp32-dev-module")).schemaVersion).toBe(3);
  expect(() => migrateProject({ ...old, connections: [{ id: "bad", from: old.connections[0].from, to: { componentId: "led-1", pinId: "missing" } }] })).toThrow();
});

it("resolves board pins, jumpers, rails and inserted leads as one net", () => {
  const project = edit(base(), [{ type: "breadboard.add", id: "breadboard-1" }, { type: "component.add", instanceId: "led-1", definitionId: "led-5mm" },
    wire("ground", pin("board-main","gnd"), hole("L-1")),
    { type: "terminal.place", placement: { componentId: "led-1", pinId: "cathode", breadboardId: "breadboard-1", holeId: "L-14" } }]);
  const net = netFor(resolveNets(project), pin("board-main","gnd"))!;
  expect(net.endpoints.map(endpointKey)).toContain(endpointKey(pin("led-1","cathode")));
  expect(net.endpoints.map(endpointKey)).toContain(endpointKey(hole("L-25")));
  expect(net.endpoints.map(endpointKey)).not.toContain(endpointKey(hole("L+1")));
  expect(netFor(resolveNets(project), hole("E12"))?.id).not.toBe(netFor(resolveNets(project), hole("F12"))?.id);
  expect(inspectHole(project,"breadboard-1","L-14")?.connectedPins).toContain("ESP32 Dev Module GND");
  expect(inspectWire(project,"ground")?.to).toContain("Breadboard L-1");
  expect(inspectComponent(project,"led-1")?.pins.find(p => p.id === "cathode")?.connections).toContain("ESP32 Dev Module GND");
});

it("rejects power and output conflicts formed through topology without saving a partial edit", () => {
  const board = edit(base(), [{ type: "breadboard.add", id: "breadboard-1" }]);
  const supply = edit(board, [wire("supply", pin("board-main","3v3"), hole("L+1"))]);
  expect(() => edit(supply, [wire("short", pin("board-main","gnd"), hole("L+2"))])).toThrow();
  expect(() => edit(supply, [wire("voltage", pin("board-main","vin"), hole("L+2"))])).toThrow();
  expect(supply.wires).toHaveLength(1);
  const outputs = edit(board, [{ type: "component.add", instanceId: "pir-1", definitionId: "hc-sr501" }, { type: "component.add", instanceId: "dht-1", definitionId: "dht11-module" },
    wire("a", pin("pir-1","out"), hole("A10"))]);
  expect(() => edit(outputs, [wire("b", pin("dht-1","data"), hole("E10"))])).toThrow();
});

it("accepts a complete PIR circuit through rails, then reports an incomplete draft after removal", () => {
  const project = edit(base(), [{ type: "breadboard.add", id: "breadboard-1" }, { type: "component.add", instanceId: "pir-1", definitionId: "hc-sr501" },
    wire("vin", pin("board-main","vin"), hole("L+1")), wire("vcc", pin("pir-1","vcc"), hole("L+2")),
    wire("gnd", pin("board-main","gnd"), hole("L-1")), wire("ground", pin("pir-1","gnd"), hole("L-2")),
    wire("signal", pin("pir-1","out"), pin("board-main","gpio27"))]);
  expect(() => validateCompleteCircuit(project)).not.toThrow();
  const incomplete = edit(project, [{ type: "wire.remove", id: "ground" }]);
  expect(() => validateElectricalSafety(incomplete)).not.toThrow();
  expect(() => validateCompleteCircuit(incomplete)).toThrow();
});

it("validates an LED series resistor through strips and OLED and DHT through rails", () => {
  const placement = (componentId: string, pinId: string, holeId: string) => ({ type: "terminal.place" as const, placement: { componentId, pinId, breadboardId: "breadboard-1", holeId } });
  const led = edit(base(), [{ type: "breadboard.add", id: "breadboard-1" },
    { type: "component.add", instanceId: "led-1", definitionId: "led-5mm" }, { type: "component.add", instanceId: "resistor-1", definitionId: "resistor-220r" },
    placement("led-1","anode","A12"), placement("led-1","cathode","B13"),
    placement("resistor-1","a","B12"), placement("resistor-1","b","G12"),
    wire("ground",pin("board-main","gnd"),hole("L-1")), wire("rail-to-led",hole("L-14"),hole("E13")),
    wire("drive",pin("board-main","gpio23"),hole("H12"))]);
  expect(() => validateCompleteCircuit(led)).not.toThrow();
  expect(() => validateCompleteCircuit(edit(led, [{ type: "wire.remove", id: "drive" }]))).toThrow();

  const modules = edit(base(), [{ type: "breadboard.add", id: "breadboard-1" },
    { type: "component.add", instanceId: "oled-1", definitionId: "oled-ssd1306-i2c-3v3" },
    { type: "component.add", instanceId: "dht-1", definitionId: "dht11-module" },
    wire("power",pin("board-main","3v3"),hole("L+1")),
    wire("oled-vcc",pin("oled-1","vcc"),hole("L+2")), wire("dht-vcc",pin("dht-1","vcc"),hole("L+3")),
    wire("ground",pin("board-main","gnd"),hole("L-1")),
    wire("oled-gnd",pin("oled-1","gnd"),hole("L-2")), wire("dht-gnd",pin("dht-1","gnd"),hole("L-3")),
    wire("sda-board",pin("board-main","gpio21"),hole("A10")), wire("sda-oled",pin("oled-1","sda"),hole("E10")),
    wire("scl-board",pin("board-main","gpio22"),hole("A11")), wire("scl-oled",pin("oled-1","scl"),hole("E11")),
    wire("dht-data",pin("dht-1","data"),pin("board-main","gpio18"))]);
  expect(() => validateCompleteCircuit(modules)).not.toThrow();
  expect(() => validateCompleteCircuit(edit(modules, [{ type: "wire.remove", id: "scl-board" }]))).toThrow();
});

it("places leads only in distinct reachable strips and removes dependent data atomically", () => {
  const board = edit(base(), [{ type: "breadboard.add", id: "breadboard-1" }, { type: "component.add", instanceId: "led-1", definitionId: "led-5mm" }]);
  const first = edit(board, [{ type: "terminal.place", placement: { componentId: "led-1", pinId: "anode", breadboardId: "breadboard-1", holeId: "A12" } }]);
  expect(() => edit(first, [{ type: "terminal.place", placement: { componentId: "led-1", pinId: "cathode", breadboardId: "breadboard-1", holeId: "B12" } }])).toThrow();
  const placed = edit(first, [{ type: "terminal.place", placement: { componentId: "led-1", pinId: "cathode", breadboardId: "breadboard-1", holeId: "B13" } }]);
  expect(placed.terminalPlacements).toHaveLength(2);
  expect(endpointWorld(placed, pin("led-1","anode")).distanceTo(endpointWorld(placed, hole("A12")))).toBeLessThan(.001);
  expect(endpointWorld(placed, pin("led-1","cathode")).distanceTo(endpointWorld(placed, hole("B13")))).toBeLessThan(.001);
  const oneLead = edit(placed, [{ type: "terminal.unplace", componentId: "led-1", pinId: "cathode" }]);
  expect(endpointWorld(oneLead, pin("led-1","anode")).distanceTo(endpointWorld(oneLead, hole("A12")))).toBeLessThan(.001);
  const loose = edit(oneLead, [{ type: "terminal.unplace", componentId: "led-1", pinId: "anode" }]);
  expect(loose.terminalPlacements).toEqual([]);
  expect(endpointWorld(loose, pin("led-1","anode")).distanceTo(endpointWorld(loose, hole("A12")))).toBeGreaterThan(.2);
  const movedBoard = edit(placed, [{ type: "layout.move", entityId: "breadboard-1", transform: { ...placed.layout.entities["breadboard-1"], position: [-3.3,.1,.2] } }]);
  expect(endpointWorld(movedBoard, pin("led-1","anode")).distanceTo(endpointWorld(movedBoard, hole("A12")))).toBeLessThan(.001);
  const removed = edit(placed, [{ type: "breadboard.remove", id: "breadboard-1" }]);
  expect(removed.terminalPlacements).toEqual([]);
  expect(removed.components.some(c => c.kind === "breadboard")).toBe(false);
  const history = new WorkbenchHistory(); history.record(placed);
  expect(restoreRevision(history.undoTarget()!, removed).terminalPlacements).toHaveLength(2);
});

it("covers every modeled electrical pin with a stable visual anchor", () => {
  expect(assertAnchorCoverage()).toBeUndefined();
  const project = edit(base(), [{ type: "breadboard.add", id: "breadboard-1" }]);
  expect(endpointWorld(project, hole("A1")).toArray()).toEqual(endpointWorld(project, hole("A1")).toArray());
  expect(endpointWorld(project, hole("A1")).distanceTo(endpointWorld(project, hole("A2")))).toBeGreaterThan(0);
});
