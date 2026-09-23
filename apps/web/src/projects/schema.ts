import { getBoard, type BoardId } from "../hardware/boards";

export type Transform = { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] };
export type ComponentInstance = { id: string; kind: "board"; definitionId: BoardId };
export type KinetableProject = {
  schemaVersion: 1; id: string; name: string; boardIds: BoardId[];
  components: ComponentInstance[]; connections: []; logic: [];
  layout: { entities: Record<string, Transform> };
  intent?: { text: string };
  metadata: { createdAt: string; updatedAt: string };
};
export const MAX_INTENT_LENGTH = 500;
const starterTransform: Transform = { position: [0, 0.15, 0], rotation: [0.94, -0.3, 0.07], scale: [1.5, 1.5, 1.5] };
const hasControl = (value: string, multiline = false) => [...value].some(char => {
  const code = char.codePointAt(0)!;
  return code === 127 || (code < 32 && !(multiline && (code === 9 || code === 10)));
});
export function validIntentText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_INTENT_LENGTH && value === value.trim() && !hasControl(value, true);
}
export function validProjectName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 120 && !!value.trim() && !hasControl(value);
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const date = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
const vector = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === "number" && Number.isFinite(n));
export function isProject(value: unknown): value is KinetableProject {
  if (!record(value) || value.schemaVersion !== 1 || !uuid(value.id) || !validProjectName(value.name) ||
    !Array.isArray(value.boardIds) || !Array.isArray(value.components) || !Array.isArray(value.connections) || value.connections.length ||
    !Array.isArray(value.logic) || value.logic.length || !record(value.layout) || !record(value.layout.entities) ||
    !record(value.metadata) || !date(value.metadata.createdAt) || !date(value.metadata.updatedAt) ||
    (value.intent !== undefined && (!record(value.intent) || Object.keys(value.intent).length !== 1 || !validIntentText(value.intent.text)))) return false;
  const components = value.components;
  const boardIds = value.boardIds;
  if (components.length !== 1 || boardIds.length !== 1) return false;
  if (!components.every(c => record(c) && typeof c.id === "string" && c.id.length > 0 && c.kind === "board" && !!getBoard(c.definitionId) && boardIds.includes(c.definitionId)) ||
    boardIds.some(id => components.filter(c => c.definitionId === id).length !== 1)) return false;
  const entities = value.layout.entities;
  if (Object.keys(entities).length !== components.length || components.some(c => !Object.hasOwn(entities, c.id))) return false;
  return Object.values(entities).every(t => record(t) && vector(t.position) && vector(t.rotation) && vector(t.scale) && t.scale.every(n => n > 0));
}
export function parseProject(value: unknown): KinetableProject {
  if (!isProject(value)) throw new Error("Unsupported or invalid project document");
  return value;
}
export function starterProject(boardId: BoardId, id = crypto.randomUUID()): KinetableProject {
  const now = new Date().toISOString();
  return { schemaVersion: 1, id, name: "First table", boardIds: [boardId],
    components: [{ id: "board-main", kind: "board", definitionId: boardId }], connections: [], logic: [],
    layout: { entities: { "board-main": structuredClone(starterTransform) } },
    metadata: { createdAt: now, updatedAt: now } };
}
export function isPristineStarter(project: KinetableProject): boolean {
  const transform = project.layout.entities["board-main"];
  return isProject(project) && project.name === "First table" && project.intent === undefined &&
    project.components[0].id === "board-main" && !!transform &&
    (["position", "rotation", "scale"] as const).every(key => transform[key].every((value, index) => value === starterTransform[key][index]));
}
export function titleFromIntent(text: string): string {
  const first = text.trim().split(/[\n.!?]/, 1)[0]
    .replace(/^(?:make|build|create|show|display)\s+/i, "").replace(/^(?:a|an|the)\s+/i, "")
    .replace(/\s+/g, " ").trim();
  const words = /^temperature on an? oled$/i.test(first) ? "OLED temperature" : first;
  const title = words.split(" ").map(word => /^(led|oled|esp32|gpio|i2c)$/i.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
  return (title || "New build").slice(0, 60).trim();
}
export function validateBuildInput(text: string, name: string) {
  const intent = text.trim();
  const projectName = name.trim();
  if (!validIntentText(intent)) throw new Error(`Describe your idea in 1–${MAX_INTENT_LENGTH} characters.`);
  if (!validProjectName(projectName)) throw new Error("Give this build a name of 1–120 characters.");
  return { intent, projectName };
}
export function projectFromIntent(current: KinetableProject | null, boardId: BoardId, text: string, name: string, now = new Date().toISOString()): KinetableProject {
  const { intent, projectName } = validateBuildInput(text, name);
  const base = current && isPristineStarter(current) ? current : starterProject(boardId);
  return parseProject({ ...base, name: projectName, intent: { text: intent }, metadata: { createdAt: base === current ? base.metadata.createdAt : now, updatedAt: now } });
}
export function withPrimaryBoard(project: KinetableProject, boardId: BoardId): KinetableProject {
  if (project.boardIds[0] === boardId) return project;
  return { ...project, boardIds: [boardId], components: [{ ...project.components[0], definitionId: boardId }],
    metadata: { ...project.metadata, updatedAt: new Date().toISOString() } };
}
