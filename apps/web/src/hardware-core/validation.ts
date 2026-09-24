import { getDefinition, getPin } from "../component-library/catalog.js";
import { parseProjectV2, type Connection, type Endpoint, type KinetableProjectV2 } from "../projects/v2.js";

export type Diagnostic = { severity: "error" | "incomplete"; code: string; message: string; componentId?: string; pinId?: string };
export class HardwareError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
const same = (a: Endpoint, b: Endpoint) => a.componentId === b.componentId && a.pinId === b.pinId;
const peersOf = (links: Connection[], endpoint: Endpoint) => links.flatMap(link => same(link.from, endpoint) ? [link.to] : same(link.to, endpoint) ? [link.from] : []);

export function validateProjectStructure(project: unknown): asserts project is KinetableProjectV2 { parseProjectV2(project); }

export function validateElectricalSafety(project: KinetableProjectV2): void {
  validateProjectStructure(project);
  if (project.components.length > 6) throw new HardwareError("PART_LIMIT", "This workbench supports up to five additional parts.");
  const board = project.components.find(c => c.kind === "board")!;
  const pin = (e: Endpoint) => getPin(project.components.find(c => c.id === e.componentId)!.definitionId, e.pinId)!;
  for (const link of project.connections) {
    const a = pin(link.from), b = pin(link.to);
    if (a.role === "power" && b.role === "ground" || a.role === "ground" && b.role === "power") throw new HardwareError("POWER_SHORT", "Power cannot connect to ground.");
    if (a.role === "power" && b.role === "power" && a.volts !== undefined && b.volts !== undefined && a.volts !== b.volts) throw new HardwareError("VOLTAGE", "Different supply rails cannot be connected.");
    if ((a.role === "power" || b.role === "power") && !([a.role, b.role].includes("power") && [a.role, b.role].includes("power"))) throw new HardwareError("PIN_ROLE", "Power must connect to a power input.");
    if ((a.role === "ground" || b.role === "ground") && !([a.role, b.role].includes("ground") && [a.role, b.role].includes("ground")) && !([a.role, b.role].includes("passive"))) throw new HardwareError("PIN_ROLE", "Ground cannot connect to a signal pin.");
    if (a.role === "digital-out" && b.role === "digital-out") throw new HardwareError("OUTPUT_CONFLICT", "Two signal outputs cannot be connected.");
  }
  for (const component of project.components.filter(c => c.kind === "component")) {
    const definition = getDefinition(component.definitionId)!;
    if (board.definitionId === "arduino-uno" && definition.requiresLevelShiftOnUno) throw new HardwareError("VOLTAGE", `${definition.name} needs a level-shifted variant for this board.`);
    for (const p of definition.pins) {
      const peers = peersOf(project.connections, { componentId: component.id, pinId: p.id });
      if (peers.length > 1) throw new HardwareError("PIN_CONFLICT", `${definition.name} ${p.id} has conflicting connections.`);
      if (!peers.length) continue;
      const other = peers[0], otherPin = pin(other);
      if (p.role === "power" && (other.componentId !== board.id || otherPin.role !== "power" || otherPin.volts !== definition.supply)) throw new HardwareError("VOLTAGE", `${definition.name} needs a ${definition.supply} V board supply.`);
      if (p.role === "ground" && (other.componentId !== board.id || otherPin.role !== "ground")) throw new HardwareError("GROUND", `${definition.name} needs board ground.`);
      if ((p.role === "digital-out" || p.role === "digital-in") && (other.componentId !== board.id || otherPin.role !== "digital-io")) throw new HardwareError("SIGNAL", `${definition.name} ${p.id} needs a supported board GPIO.`);
    }
  }
  for (const p of getDefinition(board.definitionId)!.pins.filter(p => p.role === "digital-io")) {
    if (peersOf(project.connections, { componentId: board.id, pinId: p.id }).length > 1) throw new HardwareError("PIN_CONFLICT", `Board pin ${p.id} has conflicting connections.`);
  }
}

export function analyzeCircuit(project: KinetableProjectV2): Diagnostic[] {
  validateElectricalSafety(project);
  const diagnostics: Diagnostic[] = [];
  const board = project.components.find(c => c.kind === "board")!;
  const pin = (e: Endpoint) => getPin(project.components.find(c => c.id === e.componentId)!.definitionId, e.pinId)!;
  const peer = (e: Endpoint) => peersOf(project.connections, e);
  const add = (code: string, message: string, componentId: string, pinId?: string) => diagnostics.push({ severity: "incomplete", code, message, componentId, ...(pinId ? { pinId } : {}) });
  for (const component of project.components.filter(c => c.kind === "component")) {
    const definition = getDefinition(component.definitionId)!;
    for (const p of definition.pins) if (!peer({ componentId: component.id, pinId: p.id }).length) add("UNCONNECTED_PIN", `${definition.name} ${p.id} needs a connection.`, component.id, p.id);
    if (definition.electricalModel === "ssd1306-i2c") {
      const pins = board.definitionId === "esp32-dev-module" ? ["gpio21", "gpio22"] : board.definitionId === "raspberry-pi-pico" ? ["gpio20", "gpio21"] : ["a4", "a5"];
      if (!["sda", "scl"].every((p, i) => peer({ componentId: component.id, pinId: p })[0]?.pinId === pins[i])) add("I2C_PIN", "OLED SDA/SCL need the supported I²C pins for this board.", component.id);
    }
    if (definition.electricalModel === "led-passive") {
      const cathode = peer({ componentId: component.id, pinId: "cathode" })[0];
      const anode = peer({ componentId: component.id, pinId: "anode" })[0];
      const resistor = anode && project.components.find(c => c.id === anode.componentId && getDefinition(c.definitionId)?.electricalModel === "resistor");
      const otherEnd = anode?.pinId === "a" ? "b" : "a";
      if (!resistor || cathode?.componentId !== board.id || cathode?.pinId !== "gnd" || !peer({ componentId: resistor.id, pinId: otherEnd }).some(e => e.componentId === board.id && pin(e).role === "digital-io")) add("LED_RESISTOR", "LED needs a 220 Ω series resistor and board ground.", component.id);
    }
    if (definition.electricalModel === "momentary-switch" && !["a", "b"].some(p => peer({ componentId: component.id, pinId: p })[0]?.componentId === board.id && peer({ componentId: component.id, pinId: p })[0]?.pinId === "gnd")) add("BUTTON_GROUND", "Button needs a ground connection and input pull-up semantics.", component.id);
  }
  return diagnostics;
}

export function validateCompleteCircuit(project: KinetableProjectV2): void {
  const first = analyzeCircuit(project)[0];
  if (first) throw new HardwareError(first.code, first.message);
}
