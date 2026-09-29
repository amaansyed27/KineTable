import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { db } from "../persistence/profileRepository";
import { useAuthStore } from "../auth/authStore";
import { useProfileStore } from "../state/profileStore";
import { useProjectStore } from "../state/projectStore";
import { useInventorySyncState } from "./inventorySync";

export type WorkspaceSync = "Synced" | "Syncing" | "Saved on this device" | "Needs attention" | "Conflict";
export function interpretWorkspaceSync(input: { signedIn:boolean; profile:string; project:string; inventory:string; dirty:boolean; conflicts:boolean; error:boolean }): WorkspaceSync {
  if (input.conflicts || input.project === "conflict") return "Conflict";
  if (input.error) return "Needs attention";
  if (!input.signedIn || input.dirty || input.profile === "offline" || input.project === "offline" || input.inventory === "offline") return "Saved on this device";
  if (input.profile === "syncing" || input.project === "syncing" || input.inventory === "syncing") return "Syncing";
  return input.profile === "synced" && input.project === "synced" && input.inventory === "synced" ? "Synced" : "Saved on this device";
}
export function useWorkspaceSync() {
  const session = useAuthStore(s=>s.session), profileStatus = useAuthStore(s=>s.syncStatus);
  const profile = useProfileStore(s=>s.profile), profileError = useProfileStore(s=>s.error);
  const projectStatus = useProjectStore(s=>s.status), projectError = useProjectStore(s=>s.error);
  const inventory = useInventorySyncState(s=>s);
  const ownerId = session?.user.id;
  const [local,setLocal] = useState<{ownerId:string;dirty:boolean;conflicts:boolean;error:boolean}>({ownerId:ownerId??"guest",dirty:false,conflicts:false,error:false});
  useEffect(()=>{
    if (!ownerId) return;
    const sub = liveQuery(async()=>{
      const [projects,parts,conflicts] = await Promise.all([
        db.table("projects").where("cloudUserId").equals(ownerId).toArray(),
        db.table("inventoryItems").where("ownerId").equals(ownerId).toArray(),
        db.table("projectConflicts").where("ownerId").equals(ownerId).toArray(),
      ]);
      return { ownerId,dirty:projects.some(row=>row.cloudDirty) || parts.some(row=>row.dirty),conflicts:conflicts.length>0,error:false };
    }).subscribe({next:setLocal,error:()=>setLocal({ownerId,dirty:true,conflicts:false,error:true})});
    return ()=>sub.unsubscribe();
  },[ownerId]);
  return interpretWorkspaceSync({signedIn:!!session,profile:profileStatus,project:projectStatus,
    inventory:inventory.ownerId===ownerId?inventory.status:"idle", dirty:!!profile?.cloudDirty || local.ownerId!==ownerId || local.dirty,
    conflicts:local.ownerId===ownerId && local.conflicts,error:!!profileError || !!projectError && projectStatus!=="offline" || local.error});
}
