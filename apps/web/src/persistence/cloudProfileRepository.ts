import { getSupabaseClient } from "../backend/supabaseClient";
import { getBoard } from "../hardware/boards";
import { isProfile, type HardwareProfile } from "./profileRepository";
import type { Database } from "../backend/database.types";
export type CloudProfile = Database["public"]["Tables"]["profiles"]["Row"];
export function validateCloudProfile(value: unknown): CloudProfile {
  const p = value as Partial<CloudProfile> | null;
  if (!p || typeof p.id !== "string" || (p.primary_board_id !== null && !getBoard(p.primary_board_id)) ||
    typeof p.setup_completed !== "boolean" || (p.setup_completed && !p.primary_board_id) ||
    (p.display_name !== null && typeof p.display_name !== "string") ||
    typeof p.created_at !== "string" || !Number.isFinite(Date.parse(p.created_at)) ||
    typeof p.updated_at !== "string" || !Number.isFinite(Date.parse(p.updated_at))) throw new Error("Invalid cloud profile");
  return p as CloudProfile;
}
export function reconcileProfile(local: HardwareProfile | null, cloud: CloudProfile | null, userId: string) {
  const eligible = local && isProfile(local) && (!local.cloudUserId || local.cloudUserId === userId) ? local : null;
  const board = getBoard(cloud?.primary_board_id) ?? getBoard(eligible?.primaryBoardId);
  return { primary_board_id: board?.id ?? null, setup_completed: !!board && (!!cloud?.setup_completed || !!eligible?.setupCompleted) };
}
export const cloudProfileRepository = {
  async load(accessToken: string): Promise<CloudProfile | null> {
    const client = getSupabaseClient(); if (!client) throw new Error("Cloud is not configured");
    const { data, error } = await client.from("profiles").select("*").setHeader("Authorization", `Bearer ${accessToken}`).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
    if (error) throw error;
    return data ? validateCloudProfile(data) : null;
  },
  async save(profile: { primary_board_id: string | null; setup_completed: boolean }, accessToken: string): Promise<CloudProfile> {
    const client = getSupabaseClient(); if (!client) throw new Error("Cloud is not configured");
    // id is assigned by auth.uid() in Postgres, never by a caller or form field.
    const { data, error } = await client.from("profiles").upsert(profile).select("*").setHeader("Authorization", `Bearer ${accessToken}`).abortSignal(AbortSignal.timeout(10000)).single();
    if (error) throw error;
    return validateCloudProfile(data);
  },
};
