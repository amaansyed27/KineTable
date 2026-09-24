import { getDefinition, getPin } from "../component-library/catalog.js";
import { isProject, type KinetableProject, type Transform, validIntentText, validProjectName } from "./schema.js";

export type ComponentInstanceV2 = { id: string; kind: "board" | "component"; definitionId: string };
export type Endpoint = { componentId: string; pinId: string };
export type Connection = { id: string; from: Endpoint; to: Endpoint };
export type KinetableProjectV2 = Omit<KinetableProject, "schemaVersion" | "components" | "connections"> & {
  schemaVersion: 2; components: ComponentInstanceV2[]; connections: Connection[];
};
export type ProjectDocument = KinetableProject | KinetableProjectV2;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const vec = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === "number" && Number.isFinite(n));
const transform = (v: unknown): v is Transform => obj(v) && Object.keys(v).sort().join() === "position,rotation,scale" && vec(v.position) && vec(v.rotation) && vec(v.scale) && v.scale.every(n => n > 0 && n <= 10) && Math.abs(v.position[0]) <= 10 && Math.abs(v.position[1]) <= 10 && Math.abs(v.position[2]) <= 5;
const endpoint = (v: unknown, components: ComponentInstanceV2[]) => obj(v) && typeof v.componentId === "string" && typeof v.pinId === "string" && !!components.find(c => c.id === v.componentId && getPin(c.definitionId, v.pinId as string));
export function isProjectV2(v: unknown): v is KinetableProjectV2 {
  if (!obj(v) || v.schemaVersion !== 2 || typeof v.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.id) || !validProjectName(v.name) || !Array.isArray(v.boardIds) || !Array.isArray(v.components) || !Array.isArray(v.connections) || !Array.isArray(v.logic) || v.logic.length || !obj(v.layout) || !obj(v.layout.entities) || !obj(v.metadata) || !Number.isFinite(Date.parse(String(v.metadata.createdAt))) || !Number.isFinite(Date.parse(String(v.metadata.updatedAt))) || (v.intent !== undefined && (!obj(v.intent) || Object.keys(v.intent).length !== 1 || !validIntentText(v.intent.text)))) return false;
  const components = v.components as ComponentInstanceV2[];
  if (components.length < 1 || v.boardIds.length !== 1 || components.some(c => !obj(c) || Object.keys(c).sort().join() !== "definitionId,id,kind" || typeof c.id !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(c.id) || getDefinition(c.definitionId)?.kind !== c.kind) || components.filter(c => c.kind === "board").length !== 1 || new Set(components.map(c => c.id)).size !== components.length || components.find(c => c.kind === "board")?.definitionId !== v.boardIds[0]) return false;
  if (Object.keys(v.layout.entities).length !== components.length || components.some(c => !transform((v.layout as { entities: Record<string, unknown> }).entities[c.id]))) return false;
  const connections = v.connections as Connection[];
  return connections.every(c => obj(c) && Object.keys(c).sort().join() === "from,id,to" && typeof c.id === "string" && /^[a-z][a-z0-9-]{0,63}$/.test(c.id) && endpoint(c.from, components) && endpoint(c.to, components) && !(c.from.componentId === c.to.componentId && c.from.pinId === c.to.pinId)) && new Set(connections.map(c => c.id)).size === connections.length;
}
export function parseProjectV2(v: unknown): KinetableProjectV2 {
  if (!isProjectV2(v)) throw new Error("Unsupported or invalid v2 project document");
  return v;
}
export function migrateProject(v: unknown): KinetableProjectV2 {
  if (isProjectV2(v)) return v;
  if (!isProject(v)) throw new Error("Unsupported or invalid project document");
  return parseProjectV2({ ...v, schemaVersion: 2, components: v.components.map(c => ({ ...c })), connections: [] });
}
