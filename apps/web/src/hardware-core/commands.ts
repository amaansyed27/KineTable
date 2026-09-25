import { getDefinition, getPin } from "../component-library/catalog.js";
import { HardwareError, validateCompleteCircuit, validateElectricalSafety } from "./validation.js";
export { HardwareError, validateCompleteCircuit, validateElectricalSafety, analyzeCircuit, validateProjectStructure } from "./validation.js";
import { pinEndpoint, type ElectricalEndpoint, type KinetableProjectV3, type TerminalPlacement } from "../projects/v3.js";
import type { Endpoint } from "../projects/v2.js";
import { BREADBOARD_ID, getHole } from "./breadboard.js";
import { leadAnchors } from "../component-library/leadAnchors.js";
import type { Transform } from "../projects/schema.js";
import { layoutComponents } from "./layout.js";

export type ProjectCommand =
  | { type: "component.add"; instanceId: string; definitionId: string }
  | { type: "component.remove"; instanceId: string }
  | { type: "component.replace"; instanceId: string; replacementId: string; definitionId: string }
  | { type: "connection.create"; id: string; from: Endpoint; to: Endpoint }
  | { type: "connection.remove"; id: string }
  | { type: "breadboard.add"; id: string }
  | { type: "breadboard.remove"; id: string }
  | { type: "wire.add"; id: string; from: ElectricalEndpoint; to: ElectricalEndpoint; color?: "red" | "black" | "blue" | "yellow" | "green" }
  | { type: "wire.remove"; id: string }
  | { type: "terminal.place"; placement: TerminalPlacement }
  | { type: "terminal.unplace"; componentId: string; pinId: string }
  | { type: "layout.move"; entityId: string; transform: Transform };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown) => typeof v === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(v);
const keys = (v: Record<string, unknown>, expected: string[]) => Object.keys(v).sort().join() === expected.sort().join();
const endpoint = (v: unknown): v is Endpoint => obj(v) && keys(v, ["componentId", "pinId"]) && id(v.componentId) && typeof v.pinId === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(v.pinId);
const electricalEndpoint = (v: unknown): v is ElectricalEndpoint => obj(v) && (v.kind === "pin" ? keys(v, ["kind", "componentId", "pinId"]) && endpoint({ componentId: v.componentId, pinId: v.pinId }) : v.kind === "breadboard-hole" && keys(v, ["kind", "breadboardId", "holeId"]) && id(v.breadboardId) && typeof v.holeId === "string");
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
      case "breadboard.add": case "breadboard.remove": case "wire.remove": if (keys(v, ["type", "id"]) && id(v.id)) return v as ProjectCommand; break;
      case "wire.add": if ((keys(v, ["type", "id", "from", "to"]) || keys(v, ["type", "id", "from", "to", "color"])) && id(v.id) && electricalEndpoint(v.from) && electricalEndpoint(v.to) && (v.color === undefined || ["red", "black", "blue", "yellow", "green"].includes(String(v.color)))) return v as ProjectCommand; break;
      case "terminal.place": if (keys(v, ["type", "placement"]) && obj(v.placement) && keys(v.placement, ["componentId", "pinId", "breadboardId", "holeId"]) && id(v.placement.componentId) && id(v.placement.breadboardId) && typeof v.placement.pinId === "string" && typeof v.placement.holeId === "string") return v as ProjectCommand; break;
      case "terminal.unplace": if (keys(v, ["type", "componentId", "pinId"]) && id(v.componentId) && typeof v.pinId === "string") return v as ProjectCommand; break;
      case "layout.move": if (keys(v, ["type", "entityId", "transform"]) && id(v.entityId) && transform(v.transform)) return v as ProjectCommand; break;
    }
    throw new HardwareError("COMMAND_SCHEMA", "Invalid project command.");
  });
}
const refersTo = (e: ElectricalEndpoint, id: string) => e.kind === "pin" ? e.componentId === id : e.breadboardId === id;
function holePosition(project: KinetableProjectV3, breadboardId: string, holeId: string): [number, number, number] {
  const hole = getHole(holeId)!;
  const t = project.layout.entities[breadboardId];
  return [t.position[0] + hole.x * t.scale[0], t.position[1] - hole.y * t.scale[2], t.position[2] + .122 * t.scale[1]];
}
export const validateHardware = validateCompleteCircuit;
export function executeCommands(current: KinetableProjectV3, input: unknown, updatedAt = new Date().toISOString(), mode: "complete" | "editor" = "complete"): KinetableProjectV3 {
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
        candidate.wires = candidate.wires.filter(w => !refersTo(w.from, target.id) && !refersTo(w.to, target.id));
        candidate.terminalPlacements = candidate.terminalPlacements.filter(p => p.componentId !== target.id);
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
        candidate.wires = candidate.wires.filter(w => !refersTo(w.from, command.instanceId) && !refersTo(w.to, command.instanceId));
        candidate.terminalPlacements = candidate.terminalPlacements.filter(p => p.componentId !== command.instanceId);
        candidate.layout.entities[command.replacementId] = candidate.layout.entities[command.instanceId];
        delete candidate.layout.entities[command.instanceId];
        break;
      }
      case "connection.create": {
        for (const e of [command.from, command.to]) {
          const component = candidate.components.find(c => c.id === e.componentId);
          if (!component || component.kind === "breadboard") throw new HardwareError("INVALID_ENDPOINT", "Connection component does not exist.");
          if (!getPin(component.definitionId, e.pinId)) throw new HardwareError("UNKNOWN_PIN", "Connection pin does not exist.");
        }
        candidate.wires.push({ id: command.id, from: pinEndpoint(command.from.componentId, command.from.pinId), to: pinEndpoint(command.to.componentId, command.to.pinId) }); break;
      }
      case "connection.remove": {
        if (!candidate.wires.some(c => c.id === command.id)) throw new HardwareError("CONNECTION_MISSING", "Connection does not exist.");
        candidate.wires = candidate.wires.filter(c => c.id !== command.id); break;
      }
      case "breadboard.add": {
        if (candidate.components.some(c => c.id === command.id || c.kind === "breadboard")) throw new HardwareError("DUPLICATE_INSTANCE", "This table already has a breadboard.");
        candidate.components.push({ id: command.id, kind: "breadboard", definitionId: BREADBOARD_ID });
        candidate.layout.entities[command.id] = { position: [-3.5, 0, .12], rotation: [Math.PI / 2, 0, 0], scale: [1.8, 1.8, 1.8] }; break;
      }
      case "breadboard.remove": {
        if (!candidate.components.some(c => c.id === command.id && c.kind === "breadboard")) throw new HardwareError("COMPONENT_MISSING", "Breadboard does not exist.");
        candidate.components = candidate.components.filter(c => c.id !== command.id);
        candidate.wires = candidate.wires.filter(w => !refersTo(w.from, command.id) && !refersTo(w.to, command.id));
        candidate.terminalPlacements = candidate.terminalPlacements.filter(p => p.breadboardId !== command.id);
        delete candidate.layout.entities[command.id]; break;
      }
      case "wire.add": {
        for (const e of [command.from, command.to]) {
          const component = candidate.components.find(c => c.id === (e.kind === "pin" ? e.componentId : e.breadboardId));
          if (!component) throw new HardwareError("INVALID_ENDPOINT", "Wire endpoint does not exist.");
          if (e.kind === "pin" && !getPin(component.definitionId, e.pinId)) throw new HardwareError("UNKNOWN_PIN", "Wire pin does not exist.");
          if (e.kind === "breadboard-hole" && (component.kind !== "breadboard" || !getHole(e.holeId))) throw new HardwareError("INVALID_HOLE", "Breadboard hole does not exist.");
        }
        candidate.wires.push({ id: command.id, from: command.from, to: command.to, ...(command.color ? { color: command.color } : {}) }); break;
      }
      case "wire.remove": {
        if (!candidate.wires.some(w => w.id === command.id)) throw new HardwareError("CONNECTION_MISSING", "Wire does not exist.");
        candidate.wires = candidate.wires.filter(w => w.id !== command.id); break;
      }
      case "terminal.place": {
        const part = candidate.components.find(c => c.id === command.placement.componentId);
        if (!part || part.kind !== "component" || !["led-passive", "resistor", "momentary-switch"].includes(getDefinition(part.definitionId)!.electricalModel)) throw new HardwareError("INVALID_PLACEMENT", "Only supported through-hole leads can be inserted.");
        if (!candidate.components.some(c => c.id === command.placement.breadboardId && c.kind === "breadboard") || !getHole(command.placement.holeId)) throw new HardwareError("INVALID_HOLE", "Breadboard hole does not exist.");
        const previous = candidate.terminalPlacements.find(p => p.componentId === part.id);
        const b = holePosition(candidate, command.placement.breadboardId, command.placement.holeId);
        const localB = leadAnchors[part.definitionId][command.placement.pinId];
        if (!localB) throw new HardwareError("INVALID_PLACEMENT", "This lead does not exist.");
        if (previous) {
          if (previous.breadboardId !== command.placement.breadboardId) throw new HardwareError("INVALID_PLACEMENT", "Both leads must use one breadboard.");
          const a = getHole(previous.holeId), b = getHole(command.placement.holeId);
          if (a && b) {
            const aWorld = holePosition(candidate, previous.breadboardId, previous.holeId);
            const bWorld = holePosition(candidate, command.placement.breadboardId, command.placement.holeId);
            const localA = leadAnchors[part.definitionId][previous.pinId];
            const span = Math.hypot(bWorld[0] - aWorld[0], bWorld[1] - aWorld[1]);
            const localSpan = Math.hypot(localB[0] - localA[0], localB[1] - localA[1]);
            const scale = span / localSpan;
            if (scale < .7 || scale > 1.5 || a.strip === b.strip) throw new HardwareError("LEAD_SPACING", "Choose a separate strip that matches this part’s lead spacing.");
            const angle = Math.atan2(bWorld[1] - aWorld[1], bWorld[0] - aWorld[0]) - Math.atan2(localB[1] - localA[1], localB[0] - localA[0]);
            const cos = Math.cos(angle), sin = Math.sin(angle);
            candidate.layout.entities[part.id] = { position: [aWorld[0] - scale * (localA[0] * cos - localA[1] * sin), aWorld[1] - scale * (localA[0] * sin + localA[1] * cos), aWorld[2] - localA[2] * scale],
              rotation: [0,0,angle], scale: [scale,scale,scale] };
          }
        } else candidate.layout.entities[part.id] = { position: [b[0] - localB[0], b[1] - localB[1], b[2] - localB[2]], rotation: [0,0,0], scale: [1,1,1] };
        candidate.terminalPlacements.push(command.placement); break;
      }
      case "terminal.unplace": {
        if (!candidate.terminalPlacements.some(p => p.componentId === command.componentId && p.pinId === command.pinId)) throw new HardwareError("PLACEMENT_MISSING", "Lead is not inserted.");
        candidate.terminalPlacements = candidate.terminalPlacements.filter(p => p.componentId !== command.componentId || p.pinId !== command.pinId);
        const remaining = candidate.terminalPlacements.find(p => p.componentId === command.componentId);
        if (remaining) {
          const hole = holePosition(candidate, remaining.breadboardId, remaining.holeId);
          const lead = leadAnchors[candidate.components.find(c => c.id === command.componentId)!.definitionId][remaining.pinId];
          candidate.layout.entities[command.componentId] = { position: [hole[0] - lead[0], hole[1] - lead[1], hole[2] - lead[2]], rotation: [0,0,0], scale: [1,1,1] };
        } else delete candidate.layout.entities[command.componentId];
        break;
      }
      case "layout.move": {
        if (!candidate.components.some(c => c.id === command.entityId)) throw new HardwareError("COMPONENT_MISSING", "Layout entity does not exist.");
        if (Math.abs(command.transform.position[0]) > 4.5 || Math.abs(command.transform.position[1]) > 2.8) throw new HardwareError("LAYOUT_BOUNDS", "Keep parts on the work surface.");
        const old = candidate.layout.entities[command.entityId];
        if (candidate.components.find(c => c.id === command.entityId)?.kind === "breadboard") {
          if (command.transform.rotation.some((v,i) => v !== old.rotation[i]) || command.transform.scale.some((v,i) => v !== old.scale[i])) throw new HardwareError("LAYOUT_BOUNDS", "Move the breadboard without rotating or resizing it.");
          const dx = command.transform.position[0] - old.position[0], dy = command.transform.position[1] - old.position[1], dz = command.transform.position[2] - old.position[2];
          for (const partId of new Set(candidate.terminalPlacements.filter(p => p.breadboardId === command.entityId).map(p => p.componentId))) {
            const transform = candidate.layout.entities[partId];
            candidate.layout.entities[partId] = { ...transform, position: [transform.position[0] + dx, transform.position[1] + dy, transform.position[2] + dz] };
          }
        } else if (candidate.terminalPlacements.some(p => p.componentId === command.entityId)) candidate.terminalPlacements = candidate.terminalPlacements.filter(p => p.componentId !== command.entityId);
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
