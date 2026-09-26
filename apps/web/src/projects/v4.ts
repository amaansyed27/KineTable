import { isLogic, type LogicRule } from "../logic/schema.js";
import { isProjectV3, migrateProject as migrateV3, type KinetableProjectV3 } from "./v3.js";

export type KinetableProjectV4 = Omit<KinetableProjectV3, "schemaVersion" | "logic"> & { schemaVersion: 4; logic: LogicRule[] };
export type CircuitProject = KinetableProjectV3 | KinetableProjectV4;
export type ProjectDocument = import("./schema.js").KinetableProject | import("./v2.js").KinetableProjectV2 | KinetableProjectV3 | KinetableProjectV4;
export function isProjectV4(value: unknown): value is KinetableProjectV4 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const document = value as Record<string, unknown>;
  return document.schemaVersion === 4 && isLogic(document.logic) && isProjectV3({ ...document, schemaVersion: 3, logic: [] });
}
export function parseProjectV4(value: unknown): KinetableProjectV4 {
  if (!isProjectV4(value)) throw new Error("Unsupported or invalid v4 project document");
  return value;
}
export function migrateProject(value: unknown): KinetableProjectV4 {
  if (isProjectV4(value)) return value;
  const old = migrateV3(value);
  return parseProjectV4({ ...old, schemaVersion: 4, logic: [] });
}
