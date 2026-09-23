import type { Database, Json } from "../backend/database.types";
import { getSupabaseClient } from "../backend/supabaseClient";
import { parseProject, type KinetableProject } from "../projects/schema";

export type CloudProject = Database["public"]["Tables"]["projects"]["Row"] & { document: KinetableProject };
export function validateCloudProject(value: unknown, ownerId: string): CloudProject {
  const row = value as Partial<CloudProject> | null;
  const document = parseProject(row?.document);
  if (!row || row.owner_id !== ownerId || row.id !== document.id || row.name !== document.name ||
    row.schema_version !== 1 || row.primary_board_id !== document.boardIds[0] || row.archived !== false ||
    typeof row.created_at !== "string" || typeof row.updated_at !== "string" ||
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
  async save(document: KinetableProject, token: string, ownerId: string, exists: boolean): Promise<CloudProject> {
    const client = getSupabaseClient(); if (!client) throw new Error("Cloud is not configured");
    const payload = { name: document.name, primary_board_id: document.boardIds[0], schema_version: 1, document: document as unknown as Json };
    const query = exists ? client.from("projects").update(payload).eq("id", document.id) : client.from("projects").insert({ id: document.id, ...payload });
    const { data, error } = await query
      .select("*").setHeader("Authorization", `Bearer ${token}`).abortSignal(AbortSignal.timeout(10000)).single();
    if (error) throw error;
    return validateCloudProject(data, ownerId);
  },
};
