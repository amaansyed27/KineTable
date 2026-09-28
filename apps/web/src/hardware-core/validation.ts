import { getDefinition, getPin, type Pin } from "../component-library/catalog.js";
import { compatibility } from "../component-library/compatibility.js";
import { endpointKey, pinEndpoint, parseProjectV3, type ElectricalEndpoint } from "../projects/v3.js";
import { parseProjectV4, type CircuitProject } from "../projects/v4.js";
import { resolveNets, netFor, type Net } from "./nets.js";

export type Diagnostic = { severity: "error" | "incomplete"; code: string; message: string; componentId?: string; pinId?: string };
export class HardwareError extends Error { constructor(public code: string, message: string) { super(message); } }
export function validateProjectStructure(project: unknown): asserts project is CircuitProject { if ((project as { schemaVersion?: number })?.schemaVersion === 4) parseProjectV4(project); else parseProjectV3(project); }
const pinsOn = (net: Net) => net.endpoints.filter((e): e is Extract<ElectricalEndpoint, { kind: "pin" }> => e.kind === "pin");

export function validateElectricalSafety(project: CircuitProject): void {
  validateProjectStructure(project);
  if (project.components.filter(c => c.kind === "component").length > 5) throw new HardwareError("PART_LIMIT", "This workbench supports up to five additional parts.");
  const component = (id: string) => project.components.find(c => c.id === id)!;
  const pin = (e: { componentId: string; pinId: string }): Pin => getPin(component(e.componentId).definitionId, e.pinId)!;
  const occupied = new Set<string>();
  const pinUse = new Set<string>();
  for (const wire of project.wires) {
    const pair = [endpointKey(wire.from), endpointKey(wire.to)].sort().join("|");
    if (occupied.has(`pair:${pair}`)) throw new HardwareError("DUPLICATE_WIRE", "This wire already exists.");
    occupied.add(`pair:${pair}`);
    for (const e of [wire.from, wire.to]) if (e.kind === "pin" && !(component(e.componentId).kind === "board" && ["power","ground"].includes(getPin(component(e.componentId).definitionId, e.pinId)!.role))) {
      const key = endpointKey(e);
      if (pinUse.has(key)) throw new HardwareError("PIN_CONFLICT", `${e.pinId} already holds a jumper wire.`);
      pinUse.add(key);
    }
    for (const e of [wire.from, wire.to]) if (e.kind === "breadboard-hole") {
      const key = endpointKey(e);
      if (occupied.has(key)) throw new HardwareError("HOLE_OCCUPIED", `${e.holeId} already has a lead or wire.`);
      occupied.add(key);
    }
  }
  for (const placement of project.terminalPlacements) {
    const key = `hole:${placement.breadboardId}:${placement.holeId}`;
    if (occupied.has(key)) throw new HardwareError("HOLE_OCCUPIED", `${placement.holeId} already has a lead or wire.`);
    occupied.add(key);
    if (project.wires.some(w => [w.from, w.to].some(e => e.kind === "pin" && e.componentId === placement.componentId && e.pinId === placement.pinId)))
      throw new HardwareError("PIN_OCCUPIED", "An inserted lead cannot also hold a jumper wire.");
  }
  const board = project.components.find(c => c.kind === "board")!;
  for (const part of project.components.filter(c => c.kind === "component")) {
    const def = getDefinition(part.definitionId)!;
    const result = compatibility(def.id, board.definitionId);
    if (result.status !== "supported") throw new HardwareError("VOLTAGE", result.reason);
  }
  for (const net of resolveNets(project)) {
    const pins = pinsOn(net).map(e => ({ endpoint: e, pin: pin(e) }));
    const powers = pins.filter(p => p.pin.role === "power");
    const grounds = pins.filter(p => p.pin.role === "ground");
    if (powers.length && grounds.length) throw new HardwareError("POWER_SHORT", "Power cannot connect to ground.");
    const boardSupplies = powers.filter(p => component(p.endpoint.componentId).kind === "board");
    if (new Set(boardSupplies.map(p => p.pin.volts)).size > 1) throw new HardwareError("VOLTAGE", "Different supply rails cannot be connected.");
    if (powers.length && pins.some(p => !["power", "passive"].includes(p.pin.role))) throw new HardwareError("PIN_ROLE", "Power cannot connect to a signal pin.");
    if (grounds.length && pins.some(p => !["ground", "passive"].includes(p.pin.role))) throw new HardwareError("PIN_ROLE", "Ground cannot connect to a signal pin.");
    if (pins.filter(p => p.pin.role === "digital-out").length > 1) throw new HardwareError("OUTPUT_CONFLICT", "Two signal outputs cannot be connected.");
    for (const p of powers.filter(p => component(p.endpoint.componentId).kind === "component")) {
      const required = getDefinition(component(p.endpoint.componentId).definitionId)!.supply;
      if (boardSupplies.some(s => s.pin.volts !== required)) throw new HardwareError("VOLTAGE", `${getDefinition(component(p.endpoint.componentId).definitionId)!.name} needs a ${required} V supply.`);
    }
    if (pins.filter(p => component(p.endpoint.componentId).kind === "board" && p.pin.role === "digital-io").length > 1)
      throw new HardwareError("PIN_CONFLICT", "Two board GPIO pins cannot share one net.");
  }
}

export function analyzeCircuit(project: CircuitProject): Diagnostic[] {
  validateElectricalSafety(project);
  const diagnostics: Diagnostic[] = [];
  const board = project.components.find(c => c.kind === "board")!;
  const nets = resolveNets(project);
  const net = (componentId: string, pinId: string) => netFor(nets, pinEndpoint(componentId, pinId))!;
  const shares = (a: { componentId: string; pinId: string }, b: { componentId: string; pinId: string }) => net(a.componentId, a.pinId).id === net(b.componentId, b.pinId).id;
  const boardPins = getDefinition(board.definitionId)!.pins;
  const linkedBoardPin = (componentId: string, pinId: string, role: Pin["role"]) => boardPins.find(p => p.role === role && shares({ componentId, pinId }, { componentId: board.id, pinId: p.id }));
  const add = (code: string, message: string, componentId: string, pinId?: string) => diagnostics.push({ severity: "incomplete", code, message, componentId, ...(pinId ? { pinId } : {}) });
  for (const part of project.components.filter(c => c.kind === "component")) {
    const def = getDefinition(part.definitionId)!;
    for (const p of def.pins) {
      const connectedPins = pinsOn(net(part.id, p.id)).filter(e => e.componentId !== part.id || e.pinId !== p.id);
      if (!connectedPins.length) add("UNCONNECTED_PIN", `${def.name} ${p.id} needs a connection.`, part.id, p.id);
      if (p.role === "power" && !boardPins.some(b => b.role === "power" && b.volts === def.supply && shares({ componentId: part.id, pinId: p.id }, { componentId: board.id, pinId: b.id }))) add("SUPPLY", `${def.name} needs a ${def.supply} V board supply.`, part.id, p.id);
      if (p.role === "ground" && !linkedBoardPin(part.id, p.id, "ground")) add("GROUND", `${def.name} needs board ground.`, part.id, p.id);
      if ((p.role === "digital-in" || p.role === "digital-out") && !linkedBoardPin(part.id, p.id, "digital-io")) add("SIGNAL", `${def.name} ${p.id} needs a supported board GPIO.`, part.id, p.id);
    }
    if (def.electricalModel === "ssd1306-i2c") {
      const expected = getDefinition(board.definitionId)!.i2cPins!;
      if (!["sda", "scl"].every((p, i) => shares({ componentId: part.id, pinId: p }, { componentId: board.id, pinId: expected[i] }))) add("I2C_PIN", "OLED SDA/SCL need the supported I²C pins for this board.", part.id);
    }
    if (def.electricalModel === "led-passive") {
      const grounded = linkedBoardPin(part.id, "cathode", "ground");
      const resistor = project.components.filter(c => c.kind === "component" && getDefinition(c.definitionId)?.electricalModel === "resistor")
        .find(c => ["a", "b"].some(p => shares({ componentId: part.id, pinId: "anode" }, { componentId: c.id, pinId: p }) &&
          boardPins.some(b => b.role === "digital-io" && shares({ componentId: c.id, pinId: p === "a" ? "b" : "a" }, { componentId: board.id, pinId: b.id }))));
      if (!grounded || !resistor) add("LED_RESISTOR", "LED needs a 220 Ω series resistor and board ground.", part.id);
    }
    if (def.electricalModel === "momentary-switch" && !["a", "b"].some(p => linkedBoardPin(part.id, p, "ground"))) add("BUTTON_GROUND", "Button needs a ground connection and input pull-up semantics.", part.id);
  }
  return diagnostics;
}
export function validateCompleteCircuit(project: CircuitProject): void {
  const first = analyzeCircuit(project)[0];
  if (first) throw new HardwareError(first.code, first.message);
}
