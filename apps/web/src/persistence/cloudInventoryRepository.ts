import { getSupabaseClient } from "../backend/supabaseClient.js";
import { getDefinition } from "../component-library/catalog.js";
import type { InventoryItem } from "./inventoryRepository.js";

type CloudItem = { owner_id: string; definition_id: string; quantity: number; created_at: string; updated_at: string };
export function validateCloudInventory(value: unknown, ownerId: string): CloudItem {
  const row = value as Partial<CloudItem> | null;
  if (!row || row.owner_id !== ownerId || !getDefinition(row.definition_id) || !Number.isInteger(row.quantity) || row.quantity! < 0 || row.quantity! > 999 ||
    typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at)) || typeof row.updated_at !== "string" || !Number.isFinite(Date.parse(row.updated_at))) throw new Error("Invalid cloud inventory");
  return row as CloudItem;
}
export const cloudInventoryRepository = {
  async list(token: string, ownerId: string): Promise<CloudItem[]> {
    const client = getSupabaseClient(); if (!client) throw new Error("Cloud unavailable");
    const {data,error} = await client.from("inventory_items").select("*").setHeader("Authorization",`Bearer ${token}`).abortSignal(AbortSignal.timeout(10000));
    if (error) throw error;
    return (data ?? []).map(row => validateCloudInventory(row,ownerId));
  },
  async save(item: InventoryItem, token: string, exists: boolean): Promise<CloudItem> {
    const client = getSupabaseClient(); if (!client) throw new Error("Cloud unavailable");
    // owner_id is database-owned (default auth.uid), never supplied by the browser.
    const payload = { definition_id: item.definitionId, quantity: item.quantity, updated_at: item.updatedAt };
    const query = exists ? client.from("inventory_items").update({ quantity:item.quantity, updated_at:item.updatedAt }).eq("definition_id",item.definitionId) : client.from("inventory_items").insert(payload);
    const {data,error} = await query.select("*").setHeader("Authorization",`Bearer ${token}`).abortSignal(AbortSignal.timeout(10000)).single();
    if (error) throw error;
    return validateCloudInventory(data,item.ownerId);
  },
};
