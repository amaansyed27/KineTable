import type { Database, Json } from "../backend/database.types";
import { getSupabaseClient } from "../backend/supabaseClient";
import { migrateProject, type ProjectDocument } from "../projects/v4";
import { validateElectricalSafety } from "../hardware-core/commands";
import { validateLogic } from "../logic/compile";

export type CloudProject = Database["public"]["Tables"]["projects"]["Row"] & { document: ProjectDocument };
export class ProjectConflictError extends Error {
  constructor(readonly head: CloudProject | null) { super("PROJECT_CONFLICT"); }
}
export function checkpointFailure(error: { code?: string; message: string }) {
  return error.code === "40001" || error.message.includes("PROJECT_CONFLICT") ? new ProjectConflictError(null) : error;
}
export function validateCloudProject(value: unknown, ownerId: string): CloudProject {
  const row = value as Partial<CloudProject> | null;
  const document = migrateProject(row?.document);
  validateElectricalSafety(document);
  validateLogic(document);
  if (!row || row.owner_id !== ownerId || row.id !== document.id || row.name !== document.name ||
    row.schema_version !== (row.document as ProjectDocument).schemaVersion || row.primary_board_id !== document.boardIds[0] || row.archived !== false ||
    !Number.isSafeInteger(row.revision) || row.revision! < 1 || typeof row.created_at !== "string" || typeof row.updated_at !== "string" ||
    !Number.isFinite(Date.parse(row.created_at)) || !Number.isFinite(Date.parse(row.updated_at))) throw new Error("Invalid cloud project");
  return row as CloudProject;
}
export const cloudProjectRepository = {
  async list(token: string, ownerId: string): Promise<CloudProject[]> {
    const client = getSupabaseClient(); if (!client) throw new Error("Cloud is not configured");
    const { data, error } = await client.from("projects").select("*").eq("archived", false).order("updated_at", { ascending: false }).setHeader("Authorization", `Bearer ${token}`).abortSignal(AbortSignal.timeout(10000));
    if (error) throw error;
    return (data ?? []).map(row => validateCloudProject(row, ownerId));
  },
  async save(document: ProjectDocument, token: string, ownerId: string, expectedRevision: number | null, reason = "Updated project"): Promise<CloudProject> {
    const validated = migrateProject(document);
    validateElectricalSafety(validated); validateLogic(validated);
    const client = getSupabaseClient(); if (!client) throw new Error("Cloud is not configured");
    const { data, error } = await client.rpc("checkpoint_project", { p_id: document.id, p_document: document as unknown as Json,
      p_reason: reason, p_expected_revision: expectedRevision }).setHeader("Authorization", `Bearer ${token}`).abortSignal(AbortSignal.timeout(10000));
    if (error) throw checkpointFailure(error);
    if (!data || typeof data !== "object" || Array.isArray(data) || !("status" in data) || !("project" in data)) throw new Error("Invalid checkpoint response");
    if (data.status === "conflict") throw new ProjectConflictError(data.project ? validateCloudProject(data.project, ownerId) : null);
    if (data.status !== "saved") throw new Error("Invalid checkpoint response");
    return validateCloudProject(data.project, ownerId);
  },
  async versions(token: string, ownerId: string, projectId: string) {
    const client = getSupabaseClient(); if (!client) throw new Error("Cloud is not configured");
    const { data, error } = await client.from("project_versions").select("id,project_id,owner_id,revision,document,reason,created_at")
      .eq("project_id", projectId).order("revision", { ascending: false }).limit(100)
      .setHeader("Authorization", `Bearer ${token}`).abortSignal(AbortSignal.timeout(10000));
    if (error) throw error;
    return (data ?? []).map(row => {
      if (row.owner_id !== ownerId || row.project_id !== projectId || !Number.isSafeInteger(row.revision)) throw new Error("Invalid cloud history");
      const document = migrateProject(row.document); validateElectricalSafety(document); validateLogic(document);
      return { id: row.id, ownerId, projectId, document, reason: row.reason, createdAt: row.created_at, revision: row.revision };
    });
  },
};
