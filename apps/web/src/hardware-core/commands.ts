import { getDefinition, getPin } from "../component-library/catalog.js";
import { HardwareError, validateCompleteCircuit, validateElectricalSafety } from "./validation.js";
export { HardwareError, validateCompleteCircuit, validateElectricalSafety, analyzeCircuit, validateProjectStructure } from "./validation.js";
import { type Connection, type Endpoint, type KinetableProjectV2 } from "../projects/v2.js";
import type { Transform } from "../projects/schema.js";
import { layoutComponents } from "./layout.js";

export type ProjectCommand =
  | { type: "component.add"; instanceId: string; definitionId: string }
  | { type: "component.remove"; instanceId: string }
  | { type: "component.replace"; instanceId: string; replacementId: string; definitionId: string }
  | { type: "connection.create"; id: string; from: Endpoint; to: Endpoint }
  | { type: "connection.remove"; id: string }
  | { type: "layout.move"; entityId: string; transform: Transform };
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
      case "component.replace": if (keys(v, ["type", "instanceId", "replacementId", "definitionId"]) && id(v.instanceId) && id(v.replacementId) && id(v.definitionId)) return v as ProjectCommand; break;
      case "connection.create": if (keys(v, ["type", "id", "from", "to"]) && id(v.id) && endpoint(v.from) && endpoint(v.to)) return v as ProjectCommand; break;
      case "connection.remove": if (keys(v, ["type", "id"]) && id(v.id)) return v as ProjectCommand; break;
      case "layout.move": if (keys(v, ["type", "entityId", "transform"]) && id(v.entityId) && transform(v.transform)) return v as ProjectCommand; break;
    }
    throw new HardwareError("COMMAND_SCHEMA", "Invalid project command.");
  });
}
const same = (a: Endpoint, b: Endpoint) => a.componentId === b.componentId && a.pinId === b.pinId;
const connected = (connections: Connection[], a: Endpoint, b: Endpoint) => connections.some(c => (same(c.from, a) && same(c.to, b)) || (same(c.from, b) && same(c.to, a)));
export const validateHardware = validateCompleteCircuit;
export function executeCommands(current: KinetableProjectV2, input: unknown, updatedAt = new Date().toISOString(), mode: "complete" | "editor" = "complete"): KinetableProjectV2 {
  validateElectricalSafety(current);
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
      case "component.replace": {
        const target = candidate.components.find(c => c.id === command.instanceId);
        const definition = getDefinition(command.definitionId);
        if (!target || target.kind === "board") throw new HardwareError("COMPONENT_MISSING", "Cannot replace this component.");
        if (!definition || definition.kind !== "component") throw new HardwareError("UNKNOWN_COMPONENT", "Unsupported component definition.");
        if (candidate.components.some(c => c.id === command.replacementId)) throw new HardwareError("DUPLICATE_INSTANCE", "Replacement instance ID already exists.");
        target.id = command.replacementId;
        target.definitionId = command.definitionId;
        candidate.connections = candidate.connections.filter(c => c.from.componentId !== command.instanceId && c.to.componentId !== command.instanceId);
        candidate.layout.entities[command.replacementId] = candidate.layout.entities[command.instanceId];
        delete candidate.layout.entities[command.instanceId];
        break;
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
        if (Math.abs(command.transform.position[0]) > 4.5 || Math.abs(command.transform.position[1]) > 2.8) throw new HardwareError("LAYOUT_BOUNDS", "Keep parts on the work surface.");
        candidate.layout.entities[command.entityId] = command.transform; break;
      }
    }
  }
  candidate.layout.entities = layoutComponents(candidate.components, candidate.layout.entities);
  candidate.metadata.updatedAt = updatedAt;
  validateElectricalSafety(candidate);
  if (mode === "complete") validateCompleteCircuit(candidate);
  return candidate;
}
