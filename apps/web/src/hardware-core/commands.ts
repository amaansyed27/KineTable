import { getDefinition, getPin } from "../component-library/catalog.js";
import { parseProjectV2, type Connection, type Endpoint, type KinetableProjectV2 } from "../projects/v2.js";
import type { Transform } from "../projects/schema.js";
import { layoutComponents } from "./layout.js";

export type ProjectCommand =
  | { type: "component.add"; instanceId: string; definitionId: string }
  | { type: "component.remove"; instanceId: string }
  | { type: "connection.create"; id: string; from: Endpoint; to: Endpoint }
  | { type: "connection.remove"; id: string }
  | { type: "layout.move"; entityId: string; transform: Transform };
export class HardwareError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown) => typeof v === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(v);
const keys = (v: Record<string, unknown>, expected: string[]) => Object.keys(v).sort().join() === expected.sort().join();
const endpoint = (v: unknown): v is Endpoint => obj(v) && keys(v, ["componentId", "pinId"]) && id(v.componentId) && typeof v.pinId === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(v.pinId);
const transform = (v: unknown): v is Transform => obj(v) && keys(v, ["position", "rotation", "scale"]) && [v.position, v.rotation, v.scale].every(a => Array.isArray(a) && a.length === 3 && a.every(n => typeof n === "number" && Number.isFinite(n))) && (v.scale as number[]).every(n => n > 0);
export function parseCommands(value: unknown): ProjectCommand[] {
  if (!Array.isArray(value) || value.length > 40) throw new HardwareError("COMMAND_SCHEMA", "A plan must contain at most 40 commands.");
  return value.map((v: unknown) => {
    if (!obj(v)) throw new HardwareError("COMMAND_SCHEMA", "Invalid project command.");
    switch (v.type) {
      case "component.add": if (keys(v, ["type", "instanceId", "definitionId"]) && id(v.instanceId) && id(v.definitionId)) return v as ProjectCommand; break;
      case "component.remove": if (keys(v, ["type", "instanceId"]) && id(v.instanceId)) return v as ProjectCommand; break;
      case "connection.create": if (keys(v, ["type", "id", "from", "to"]) && id(v.id) && endpoint(v.from) && endpoint(v.to)) return v as ProjectCommand; break;
      case "connection.remove": if (keys(v, ["type", "id"]) && id(v.id)) return v as ProjectCommand; break;
      case "layout.move": if (keys(v, ["type", "entityId", "transform"]) && id(v.entityId) && transform(v.transform)) return v as ProjectCommand; break;
    }
    throw new HardwareError("COMMAND_SCHEMA", "Invalid project command.");
  });
}
const same = (a: Endpoint, b: Endpoint) => a.componentId === b.componentId && a.pinId === b.pinId;
const connected = (connections: Connection[], a: Endpoint, b: Endpoint) => connections.some(c => (same(c.from, a) && same(c.to, b)) || (same(c.from, b) && same(c.to, a)));
export function validateHardware(project: KinetableProjectV2): void {
  parseProjectV2(project);
  if (project.components.length > 6) throw new HardwareError("PART_LIMIT", "This workbench supports up to five additional parts.");
  const board = project.components.find(c => c.kind === "board")!;
  const links = project.connections;
  const pin = (e: Endpoint) => getPin(project.components.find(c => c.id === e.componentId)!.definitionId, e.pinId)!;
  const peer = (e: Endpoint) => links.flatMap(c => same(c.from, e) ? [c.to] : same(c.to, e) ? [c.from] : []);
  for (const c of links) {
    const a = pin(c.from), b = pin(c.to);
    if (a.role === "power" && b.role === "ground" || a.role === "ground" && b.role === "power") throw new HardwareError("POWER_SHORT", "Power cannot connect to ground.");
    if (a.role === "power" && b.role === "power" && a.volts !== undefined && b.volts !== undefined && a.volts !== b.volts) throw new HardwareError("VOLTAGE", "Different supply rails cannot be connected.");
    if ((a.role === "power" || b.role === "power") && !([a.role, b.role].includes("power") && [a.role, b.role].includes("power"))) throw new HardwareError("PIN_ROLE", "Power must connect to a power input.");
    if ((a.role === "ground" || b.role === "ground") && !([a.role, b.role].includes("ground") && [a.role, b.role].includes("ground")) && !([a.role, b.role].includes("passive"))) throw new HardwareError("PIN_ROLE", "Ground cannot connect to a signal pin.");
    if ([a.role, b.role].every(role => role === "digital-out")) throw new HardwareError("OUTPUT_CONFLICT", "Two signal outputs cannot be connected.");
  }
  for (const component of project.components.filter(c => c.kind === "component")) {
    const definition = getDefinition(component.definitionId)!;
    if (board.definitionId === "arduino-uno" && (definition.visualId === "oled" || definition.visualId === "buzzer")) throw new HardwareError("VOLTAGE", `${definition.name} needs 3.3 V signal levels; this board requires a level-shifted variant.`);
    for (const p of definition.pins) {
      const e = { componentId: component.id, pinId: p.id };
      const peers = peer(e);
      if (peers.length !== 1) throw new HardwareError("UNCONNECTED_PIN", `${definition.name} ${p.id} needs exactly one connection.`);
      const other = peers[0], otherPin = pin(other);
      if (p.role === "power" && (other.componentId !== board.id || otherPin.role !== "power" || otherPin.volts !== definition.supply)) throw new HardwareError("VOLTAGE", `${definition.name} needs a ${definition.supply} V board supply.`);
      if (p.role === "ground" && (other.componentId !== board.id || otherPin.role !== "ground")) throw new HardwareError("GROUND", `${definition.name} needs board ground.`);
      if ((p.role === "digital-out" || p.role === "digital-in") && (other.componentId !== board.id || otherPin.role !== "digital-io")) throw new HardwareError("SIGNAL", `${definition.name} ${p.id} needs a supported board GPIO.`);
    }
    if (definition.visualId === "oled") {
      const pins = board.definitionId === "esp32-dev-module" ? ["gpio21", "gpio22"] : board.definitionId === "raspberry-pi-pico" ? ["gpio20", "gpio21"] : ["a4", "a5"];
      if (!["sda", "scl"].every((p, i) => peer({ componentId: component.id, pinId: p })[0]?.pinId === pins[i])) throw new HardwareError("I2C_PIN", "OLED SDA/SCL need the supported I²C pins for this board.");
    }
    if (definition.visualId === "led") {
      const cathode = peer({ componentId: component.id, pinId: "cathode" })[0];
      const anode = peer({ componentId: component.id, pinId: "anode" })[0];
      const resistor = project.components.find(c => c.id === anode.componentId && c.definitionId === "resistor-220r");
      const otherEnd = anode.pinId === "a" ? "b" : "a";
      if (!resistor || cathode.componentId !== board.id || cathode.pinId !== "gnd" || !peer({ componentId: resistor.id, pinId: otherEnd }).some(e => e.componentId === board.id && pin(e).role === "digital-io")) throw new HardwareError("LED_RESISTOR", "LED needs a 220 Ω series resistor and board ground.");
    }
    if (definition.visualId === "button" && !["a", "b"].some(p => peer({ componentId: component.id, pinId: p })[0]?.componentId === board.id && peer({ componentId: component.id, pinId: p })[0]?.pinId === "gnd")) throw new HardwareError("BUTTON_GROUND", "Button needs a ground connection and input pull-up semantics.");
  }
  for (const p of getDefinition(board.definitionId)!.pins.filter(p => p.role === "digital-io")) {
    if (peer({ componentId: board.id, pinId: p.id }).length > 1) throw new HardwareError("PIN_CONFLICT", `Board pin ${p.id} has conflicting connections.`);
  }
}
export function executeCommands(current: KinetableProjectV2, input: unknown, updatedAt = new Date().toISOString()): KinetableProjectV2 {
  validateHardware(current);
  const candidate = structuredClone(current);
  for (const command of parseCommands(input)) {
    switch (command.type) {
      case "component.add": {
        const definition = getDefinition(command.definitionId);
        if (!definition || definition.kind !== "component") throw new HardwareError("UNKNOWN_COMPONENT", "Unsupported component definition.");
        if (candidate.components.some(c => c.id === command.instanceId)) throw new HardwareError("DUPLICATE_INSTANCE", "Component instance ID already exists.");
        candidate.components.push({ id: command.instanceId, kind: "component", definitionId: command.definitionId }); break;
      }
      case "component.remove": {
        const target = candidate.components.find(c => c.id === command.instanceId);
        if (!target || target.kind === "board") throw new HardwareError("COMPONENT_MISSING", "Cannot remove this component.");
        candidate.components = candidate.components.filter(c => c !== target);
        candidate.connections = candidate.connections.filter(c => c.from.componentId !== target.id && c.to.componentId !== target.id);
        delete candidate.layout.entities[target.id]; break;
      }
      case "connection.create": {
        if (candidate.connections.some(c => c.id === command.id || connected([c], command.from, command.to))) throw new HardwareError("DUPLICATE_CONNECTION", "Connection already exists.");
        for (const e of [command.from, command.to]) {
          const component = candidate.components.find(c => c.id === e.componentId);
          if (!component) throw new HardwareError("INVALID_ENDPOINT", "Connection component does not exist.");
          if (!getPin(component.definitionId, e.pinId)) throw new HardwareError("UNKNOWN_PIN", "Connection pin does not exist.");
        }
        candidate.connections.push({ id: command.id, from: command.from, to: command.to }); break;
      }
      case "connection.remove": {
        if (!candidate.connections.some(c => c.id === command.id)) throw new HardwareError("CONNECTION_MISSING", "Connection does not exist.");
        candidate.connections = candidate.connections.filter(c => c.id !== command.id); break;
      }
      case "layout.move": {
        if (!candidate.components.some(c => c.id === command.entityId)) throw new HardwareError("COMPONENT_MISSING", "Layout entity does not exist.");
        candidate.layout.entities[command.entityId] = command.transform; break;
      }
    }
  }
  candidate.layout.entities = layoutComponents(candidate.components, candidate.layout.entities);
  candidate.metadata.updatedAt = updatedAt;
  validateHardware(candidate);
  return candidate;
}
