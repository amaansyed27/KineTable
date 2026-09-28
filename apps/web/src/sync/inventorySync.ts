import type { Session } from "@supabase/supabase-js";
import { useAuthStore } from "../auth/authStore.js";
import { cloudInventoryRepository } from "../persistence/cloudInventoryRepository.js";
import { inventoryRepository } from "../persistence/inventoryRepository.js";
const running = new Map<string,Promise<void>>();
const queued = new Set<string>();
// ponytail: client-clock row timestamps can misorder concurrent devices; add server versions and conflict UI in Slice 12 if this becomes material.
export function syncInventory(session: Session): Promise<void> {
  const ownerId = session.user.id;
  const pending = running.get(ownerId);
  if (pending) { queued.add(ownerId); return pending; }
  const task = (async () => {
    const remote = await cloudInventoryRepository.list(session.access_token, ownerId);
    if (useAuthStore.getState().session?.user.id !== ownerId) return;
    const local = await inventoryRepository.list(ownerId);
    for (const row of remote) {
      const cached = local.find(item => item.definitionId === row.definition_id);
      if (cached?.dirty && cached.updatedAt >= row.updated_at) continue;
      if (!cached || row.updated_at > cached.updatedAt) await inventoryRepository.save({ ownerId, definitionId: row.definition_id, quantity: row.quantity, createdAt: row.created_at, updatedAt: row.updated_at, dirty: false });
    }
    for (const item of local) if (!item.dirty && !remote.some(row => row.definition_id === item.definitionId))
      await inventoryRepository.save({ ...item, quantity:0, updatedAt:new Date().toISOString(), dirty:false });
    for (const item of local) {
      if (useAuthStore.getState().session?.user.id !== ownerId) return;
      const counterpart = remote.find(row => row.definition_id === item.definitionId);
      if (!item.dirty || counterpart && counterpart.updated_at > item.updatedAt) continue;
      const saved = await cloudInventoryRepository.save(item,session.access_token,!!counterpart);
      const latest = (await inventoryRepository.list(ownerId)).find(row => row.definitionId === item.definitionId);
      if (latest?.updatedAt === item.updatedAt) await inventoryRepository.save({ ...item, updatedAt: saved.updated_at, dirty: false });
    }
  })().finally(() => { running.delete(ownerId); if (queued.delete(ownerId) && useAuthStore.getState().session?.user.id === ownerId) void syncInventory(session).catch(() => undefined); });
  running.set(ownerId,task);
  return task;
}
export async function setOwnedQuantity(session: Session | null, definitionId: string, quantity: number) {
  const item = await inventoryRepository.setQuantity(session?.user.id ?? "guest",definitionId,quantity);
  if (session) void syncInventory(session).catch(() => undefined);
  return item;
}
