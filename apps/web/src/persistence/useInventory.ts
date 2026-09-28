import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { inventoryRepository, inventoryOwner, type InventoryItem } from "./inventoryRepository";
import { useAuthStore } from "../auth/authStore";

export function useInventory() {
  const ownerId = useAuthStore(s => inventoryOwner(s.session?.user.id));
  const [state,setState] = useState<{ownerId:string;rows:InventoryItem[];loaded:boolean;error:string|null}>({ownerId,rows:[],loaded:false,error:null});
  useEffect(() => {
    setState({ownerId,rows:[],loaded:false,error:null});
    const sub = liveQuery(() => inventoryRepository.list(ownerId)).subscribe({
      next: rows => setState({ownerId,rows,loaded:true,error:null}),
      error: () => setState({ownerId,rows:[],loaded:true,error:"My Parts could not open on this device."}),
    });
    return () => sub.unsubscribe();
  },[ownerId]);
  return state.ownerId === ownerId ? state : {ownerId,rows:[],loaded:false,error:null};
}
