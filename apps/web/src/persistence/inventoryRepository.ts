import type { Table } from "dexie";
import { db } from "./profileRepository.js";
import { getDefinition } from "../component-library/catalog.js";

export type InventoryItem = { ownerId: string; definitionId: string; quantity: number; createdAt: string; updatedAt: string; dirty: boolean };
const items: Table<InventoryItem, [string,string]> = db.table("inventoryItems");
export const inventoryOwner = (userId?: string) => userId ?? "guest";
export function validateInventoryItem(value: unknown): InventoryItem {
  const item = value as Partial<InventoryItem> | null;
  if (!item || typeof item.ownerId !== "string" || !item.ownerId || getDefinition(item.definitionId)?.kind === undefined ||
    !Number.isInteger(item.quantity) || item.quantity! < 0 || item.quantity! > 999 ||
    typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt)) ||
    typeof item.updatedAt !== "string" || !Number.isFinite(Date.parse(item.updatedAt)) || typeof item.dirty !== "boolean") throw new Error("Invalid inventory item");
  return item as InventoryItem;
}
export const inventoryRepository = {
  async list(ownerId: string): Promise<InventoryItem[]> { return (await items.where("ownerId").equals(ownerId).toArray()).map(validateInventoryItem); },
  async save(item: InventoryItem): Promise<void> { validateInventoryItem(item); await items.put(item); },
  async setQuantity(ownerId: string, definitionId: string, quantity: number): Promise<InventoryItem> {
    if (!getDefinition(definitionId) || !Number.isInteger(quantity) || quantity < 0 || quantity > 999) throw new Error("Invalid quantity or part");
    const previous = await items.get([ownerId,definitionId]);
    const now = new Date(Math.max(Date.now(), previous ? Date.parse(previous.updatedAt)+1 : 0)).toISOString();
    const item = { ownerId, definitionId, quantity, createdAt: previous?.createdAt ?? now, updatedAt: now, dirty: ownerId !== "guest" };
    await inventoryRepository.save(item);
    return item;
  },
};
