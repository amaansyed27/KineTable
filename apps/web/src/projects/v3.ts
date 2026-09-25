import { getDefinition, getPin } from "../component-library/catalog.js";
import { BREADBOARD_ID, getHole } from "../hardware-core/breadboard.js";
import type { KinetableProjectV2 } from "./v2.js";
import { isProjectV2, migrateProject as migrateV2 } from "./v2.js";

export type PinEndpoint = { kind: "pin"; componentId: string; pinId: string };
export type HoleEndpoint = { kind: "breadboard-hole"; breadboardId: string; holeId: string };
export type ElectricalEndpoint = PinEndpoint | HoleEndpoint;
export type Wire = { id: string; from: ElectricalEndpoint; to: ElectricalEndpoint; color?: "red" | "black" | "blue" | "yellow" | "green" };
export type TerminalPlacement = { componentId: string; pinId: string; breadboardId: string; holeId: string };
export type ComponentInstanceV3 = KinetableProjectV2["components"][number] | { id: string; kind: "breadboard"; definitionId: typeof BREADBOARD_ID };
export type KinetableProjectV3 = Omit<KinetableProjectV2, "schemaVersion" | "components" | "connections"> & {
  schemaVersion: 3; components: ComponentInstanceV3[]; wires: Wire[]; terminalPlacements: TerminalPlacement[];
};
export type ProjectDocument = import("./schema.js").KinetableProject | KinetableProjectV2 | KinetableProjectV3;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const id = (v: unknown) => typeof v === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).sort().join() === keys.sort().join();

export function validEndpoint(v: unknown, components: ComponentInstanceV3[]): v is ElectricalEndpoint {
  if (!obj(v)) return false;
  if (v.kind === "pin" && exact(v, ["kind", "componentId", "pinId"])) {
    const component = components.find(c => c.id === v.componentId && c.kind !== "breadboard");
    return !!component && typeof v.pinId === "string" && !!getPin(component.definitionId, v.pinId);
  }
  return v.kind === "breadboard-hole" && exact(v, ["kind", "breadboardId", "holeId"]) &&
    components.some(c => c.id === v.breadboardId && c.kind === "breadboard") && typeof v.holeId === "string" && !!getHole(v.holeId);
}
export const endpointKey = (endpoint: ElectricalEndpoint) => endpoint.kind === "pin"
  ? `pin:${endpoint.componentId}:${endpoint.pinId}` : `hole:${endpoint.breadboardId}:${endpoint.holeId}`;
export const pinEndpoint = (componentId: string, pinId: string): PinEndpoint => ({ kind: "pin", componentId, pinId });
export const holeEndpoint = (breadboardId: string, holeId: string): HoleEndpoint => ({ kind: "breadboard-hole", breadboardId, holeId });

export function isProjectV3(v: unknown): v is KinetableProjectV3 {
  if (!obj(v) || v.schemaVersion !== 3 || Object.hasOwn(v, "connections") || !Array.isArray(v.components) || !Array.isArray(v.wires) || !Array.isArray(v.terminalPlacements) || !obj(v.layout) || !obj(v.layout.entities)) return false;
  const components = v.components as ComponentInstanceV3[];
  if (components.some(c => !obj(c) || !exact(c, ["id", "kind", "definitionId"]) || !id(c.id) ||
    (c.kind === "breadboard" ? c.definitionId !== BREADBOARD_ID : getDefinition(c.definitionId)?.kind !== c.kind)) ||
    components.filter(c => c.kind === "board").length !== 1 || components.filter(c => c.kind === "breadboard").length > 1 ||
    new Set(components.map(c => c.id)).size !== components.length || Object.keys(v.layout.entities).length !== components.length) return false;
  const baseComponents = components.filter(c => c.kind !== "breadboard");
  const base = { ...v, schemaVersion: 2, components: baseComponents, connections: [],
    layout: { entities: Object.fromEntries(baseComponents.map(c => [c.id, (v.layout as { entities: Record<string, unknown> }).entities[c.id]])) } };
  if (!isProjectV2(base)) return false;
  for (const component of components.filter(c => c.kind === "breadboard")) {
    const t = (v.layout as { entities: Record<string, unknown> }).entities[component.id];
    if (!obj(t) || !Array.isArray(t.position) || !Array.isArray(t.rotation) || !Array.isArray(t.scale) ||
      ![...t.position, ...t.rotation, ...t.scale].every(n => typeof n === "number" && Number.isFinite(n)) ||
      t.position.length !== 3 || t.rotation.length !== 3 || t.scale.length !== 3 || t.scale.some(n => typeof n !== "number" || n <= 0 || n > 10)) return false;
    if (t.rotation[0] !== Math.PI / 2 || t.rotation[1] !== 0 || t.rotation[2] !== 0 || t.scale[0] !== t.scale[1] || t.scale[1] !== t.scale[2]) return false;
  }
  if (!v.wires.every(w => obj(w) && (exact(w, ["id", "from", "to"]) || exact(w, ["id", "from", "to", "color"])) && id(w.id) &&
    (w.color === undefined || ["red", "black", "blue", "yellow", "green"].includes(String(w.color))) &&
    validEndpoint(w.from, components) && validEndpoint(w.to, components) && endpointKey(w.from) !== endpointKey(w.to)) ||
    new Set(v.wires.map(w => (w as Wire).id)).size !== v.wires.length) return false;
  if (!v.terminalPlacements.every(p => obj(p) && exact(p, ["componentId", "pinId", "breadboardId", "holeId"]) &&
    validEndpoint(pinEndpoint(String(p.componentId), String(p.pinId)), components) &&
    validEndpoint(holeEndpoint(String(p.breadboardId), String(p.holeId)), components) &&
    ["led-passive", "resistor", "momentary-switch"].includes(getDefinition(components.find(c => c.id === p.componentId)!.definitionId)!.electricalModel))) return false;
  const placements = v.terminalPlacements as TerminalPlacement[];
  if (new Set(placements.map(p => `${p.componentId}:${p.pinId}`)).size !== placements.length ||
    new Set(placements.map(p => `${p.breadboardId}:${p.holeId}`)).size !== placements.length) return false;
  return true;
}
export function parseProjectV3(v: unknown): KinetableProjectV3 {
  if (!isProjectV3(v)) throw new Error("Unsupported or invalid v3 project document");
  return v;
}
export function migrateProject(v: unknown): KinetableProjectV3 {
  if (isProjectV3(v)) return v;
  const old = migrateV2(v);
  const { connections, ...rest } = old;
  return parseProjectV3({ ...rest, schemaVersion: 3, wires: connections.map(c => ({ id: c.id,
    from: pinEndpoint(c.from.componentId, c.from.pinId), to: pinEndpoint(c.to.componentId, c.to.pinId) })),
    terminalPlacements: [] });
}
