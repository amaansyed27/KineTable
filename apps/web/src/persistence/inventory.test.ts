import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { db } from "./profileRepository";
import { inventoryRepository, validateInventoryItem } from "./inventoryRepository";
import { validateCloudInventory } from "./cloudInventoryRepository";
beforeEach(async()=>{await db.table("inventoryItems").clear();});
it("persists quantities with separate guest and account namespaces",async()=>{
  await inventoryRepository.setQuantity("guest","led-5mm",2);
  await inventoryRepository.setQuantity("account-a","led-5mm",1);
  await inventoryRepository.setQuantity("account-b","push-button",3);
  expect((await inventoryRepository.list("guest")).map(r=>r.quantity)).toEqual([2]);
  expect((await inventoryRepository.list("account-a")).map(r=>r.quantity)).toEqual([1]);
  expect((await inventoryRepository.list("account-b")).map(r=>r.definitionId)).toEqual(["push-button"]);
  await inventoryRepository.setQuantity("account-a","led-5mm",0);
  expect((await inventoryRepository.list("account-a"))[0].quantity).toBe(0);
  expect((await inventoryRepository.list("guest"))[0].quantity).toBe(2);
});
it("rejects unknown parts and malformed records at storage boundaries",async()=>{
  await expect(inventoryRepository.setQuantity("guest","unmodeled",1)).rejects.toThrow();
  await expect(inventoryRepository.setQuantity("guest","led-5mm",1000)).rejects.toThrow();
  await expect(inventoryRepository.setQuantity("guest","led-5mm",-1)).rejects.toThrow();
  expect(()=>validateInventoryItem({ownerId:"guest",definitionId:"led-5mm",quantity:"2"})).toThrow();
  await db.table("inventoryItems").put({ownerId:"guest",definitionId:"led-5mm",quantity:"bad",createdAt:"2026-01-01",updatedAt:"2026-01-01",dirty:false});
  await expect(inventoryRepository.list("guest")).rejects.toThrow();
  expect(()=>validateCloudInventory({owner_id:"other",definition_id:"led-5mm",quantity:1,created_at:"2026-01-01",updated_at:"2026-01-01"},"mine")).toThrow();
});
