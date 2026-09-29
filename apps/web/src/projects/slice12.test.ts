import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { db } from "../persistence/profileRepository";
import { localProjectRepository } from "../persistence/localProjectRepository";
import { projectHistoryRepository } from "../persistence/projectHistoryRepository";
import { createProjectStore } from "../state/projectStore";
import { useAuthStore } from "../auth/authStore";
import { executeCommands } from "../hardware-core/commands";
import { matchIdea, exploreIdeas, recommendIdeas } from "../explore/catalog";
import { interpretWorkspaceSync } from "../sync/workspaceSyncState";
import { checkpointFailure, ProjectConflictError, type CloudProject } from "../persistence/cloudProjectRepository";
import { migrateProject } from "./v4";

const session = { user:{id:"user-a"},access_token:"test-token" } as Session;
beforeEach(async()=>{ await db.table("projects").clear(); await db.table("projectVersions").clear(); await db.table("projectConflicts").clear(); useAuthStore.setState({session:null}); });

it("keeps local checkpoints by owner and restores as a new head",async()=>{
  const store=createProjectStore(); await store.getState().open("esp32-dev-module",null);
  const id=store.getState().project!.id;
  await store.getState().applyTransaction([{type:"component.add",instanceId:"led",definitionId:"led-5mm"}]);
  const before=await projectHistoryRepository.list("guest",id);
  expect(before).toHaveLength(2);
  expect(new Set(before.map(row=>row.id)).size).toBe(2);
  expect(await projectHistoryRepository.list("user-a",id)).toHaveLength(0);
  await store.getState().restoreVersion(before.find(row=>row.reason==="Created project")!.id);
  expect(store.getState().project?.document.components).toHaveLength(1);
  const after=await projectHistoryRepository.list("guest",id);
  expect(after).toHaveLength(3);
  expect(after.some(row=>row.document.components.length===2)).toBe(true);
});

async function conflictedStore() {
  const rows=new Map<string,CloudProject>();
  const cloud={
    list:vi.fn(async()=>[...rows.values()]),
    save:vi.fn(async(document: CloudProject["document"],_token:string,_owner:string,expected:number|null)=>{
      const previous=rows.get(document.id);
      if ((previous?.revision??null)!==expected) throw new Error("PROJECT_CONFLICT");
      const saved={id:document.id,owner_id:"user-a",name:document.name,primary_board_id:document.boardIds[0],schema_version:document.schemaVersion,
        document,archived:false,revision:(previous?.revision??0)+1,created_at:document.metadata.createdAt,updated_at:document.metadata.updatedAt} as CloudProject;
      rows.set(saved.id,saved); return saved;
    }),
  };
  useAuthStore.setState({session});
  const store=createProjectStore(localProjectRepository,cloud);
  await store.getState().open("esp32-dev-module",session);
  const id=store.getState().project!.id;
  expect(rows.get(id)?.revision).toBe(1);
  await store.getState().applyTransaction([{type:"component.add",instanceId:"led",definitionId:"led-5mm"}]);
  const local=store.getState().project!.document;
  const concurrent=executeCommands(migrateProject(rows.get(id)!.document),[{type:"component.add",instanceId:"pir",definitionId:"hc-sr501"}],undefined,"editor");
  rows.set(id,{...rows.get(id)!,document:concurrent,revision:2,updated_at:concurrent.metadata.updatedAt});
  await store.getState().sync();
  expect(store.getState().status).toBe("conflict");
  expect(rows.get(id)?.document.components.some(c=>c.id==="led")).toBe(false);
  expect((await projectHistoryRepository.conflict("user-a",id))?.local).toEqual(local);
  return {store,rows,id,cloud};
}
it("detects a stale device and persists both snapshots through reload",async()=>{
  const {store,id,cloud}=await conflictedStore();
  const reopened=createProjectStore(localProjectRepository,cloud);
  expect(await reopened.getState().openById(id,"esp32-dev-module",session)).toBe(true);
  await reopened.getState().sync();
  expect(reopened.getState().status).toBe("conflict");
  expect(store.getState().project?.document.components.some(c=>c.id==="led")).toBe(true);
});
it.each(["device","cloud","both"] as const)("resolves a two-device conflict with %s",async(choice)=>{
  const {store,rows,id}=await conflictedStore();
  await store.getState().resolveConflict(choice);
  expect(await projectHistoryRepository.conflict("user-a",id)).toBeUndefined();
  expect(store.getState().status).toBe("synced");
  expect(rows.get(id)?.document.components.some(c=>c.id==="led")).toBe(choice==="device");
  expect(rows.get(id)?.document.components.some(c=>c.id==="pir")).toBe(choice!=="device");
  if(choice==="both") expect([...rows.values()].some(row=>row.id!==id && row.document.components.some(c=>c.id==="led"))).toBe(true);
  if(choice==="cloud") expect((await projectHistoryRepository.list("user-a",id)).some(row=>row.reason==="This device before cloud restore")).toBe(true);
});
it("matches exact quantities and explicit board ownership",()=>{
  const idea=exploreIdeas.find(item=>item.id==="blink-led")!;
  const items=[{definitionId:"esp32-dev-module",quantity:1},{definitionId:"led-5mm",quantity:1},{definitionId:"resistor-220r",quantity:1}].map(row=>({...row,ownerId:"guest",createdAt:"2026-01-01",updatedAt:"2026-01-01",dirty:false}));
  expect(matchIdea(idea,"esp32-dev-module",items).status).toBe("ready");
  expect(matchIdea(idea,"esp32-dev-module",items.filter(item=>item.definitionId!=="esp32-dev-module")).missing).toMatchObject([{id:"esp32-dev-module",missing:1}]);
  expect(matchIdea({...idea,required:{...idea.required,"led-5mm":2}},"esp32-dev-module",items).missing).toMatchObject([{id:"led-5mm",missing:1}]);
  expect(recommendIdeas("esp32-dev-module",items)[0].idea.id).toBe("blink-led");
});
it("never calls dirty inventory synced",()=>{
  const base={signedIn:true,profile:"synced",project:"synced",inventory:"synced",dirty:false,conflicts:false,error:false};
  expect(interpretWorkspaceSync(base)).toBe("Synced");
  expect(interpretWorkspaceSync({...base,dirty:true})).toBe("Saved on this device");
  expect(interpretWorkspaceSync({...base,conflicts:true})).toBe("Conflict");
  expect(interpretWorkspaceSync({...base,inventory:"offline"})).toBe("Saved on this device");
});

it("treats SQLSTATE 40001 as a terminal project conflict",()=>{
  expect(checkpointFailure({code:"40001",message:"serialization failure"})).toBeInstanceOf(ProjectConflictError);
  expect(checkpointFailure({code:"23514",message:"INVALID_PROJECT"})).not.toBeInstanceOf(ProjectConflictError);
});

it("makes one stale checkpoint and blocks repeat saves until explicit resolution",async()=>{
  useAuthStore.setState({session});
  let head:CloudProject|undefined;
  let race=false;
  const cloud={
    list:vi.fn(async()=>head?[head]:[]),
    save:vi.fn(async(document:CloudProject["document"],_token:string,_owner:string,expected:number|null)=>{
      if(race && head) {
        race=false;
        const other=executeCommands(migrateProject(head.document),[{type:"component.add",instanceId:"pir",definitionId:"hc-sr501"}],undefined,"editor");
        head={...head,document:other,name:other.name,revision:head.revision+1,updated_at:other.metadata.updatedAt};
        throw new ProjectConflictError(head);
      }
      if((head?.revision??null)!==expected) throw new ProjectConflictError(head??null);
      head={id:document.id,owner_id:"user-a",name:document.name,primary_board_id:document.boardIds[0],schema_version:document.schemaVersion,
        document,archived:false,revision:(head?.revision??0)+1,created_at:document.metadata.createdAt,updated_at:document.metadata.updatedAt} as CloudProject;
      return head;
    }),
  };
  const store=createProjectStore(localProjectRepository,cloud);
  await store.getState().open("esp32-dev-module",session);
  expect(cloud.save).toHaveBeenCalledTimes(1);
  await store.getState().applyTransaction([{type:"component.add",instanceId:"led",definitionId:"led-5mm"}]);
  race=true;
  await store.getState().sync();
  expect(store.getState().status).toBe("conflict");
  expect(cloud.save).toHaveBeenCalledTimes(2);
  for(let i=0;i<100;i++) {
    store.setState({canUndo:i%2===0});
    await store.getState().sync();
  }
  expect(cloud.save).toHaveBeenCalledTimes(2);
  await store.getState().applyTransaction([{type:"component.add",instanceId:"resistor",definitionId:"resistor-220r"}]);
  await store.getState().sync();
  expect(cloud.save).toHaveBeenCalledTimes(2);
  await store.getState().resolveConflict("device");
  expect(cloud.save).toHaveBeenCalledTimes(3);
  expect(await projectHistoryRepository.conflict("user-a",head!.id)).toBeUndefined();
  store.getState().cancelPending();
});

it("keeps network failure retries explicit and cancels pending checkpoint timers",async()=>{
  useAuthStore.setState({session});
  const cloud={list:vi.fn(async()=>{throw new TypeError("Network offline");}),save:vi.fn()};
  const store=createProjectStore(localProjectRepository,cloud);
  await store.getState().open("esp32-dev-module",session);
  expect(store.getState().status).toBe("offline");
  expect(cloud.list).toHaveBeenCalledTimes(1);
  await new Promise(resolve=>setTimeout(resolve,650));
  expect(cloud.list).toHaveBeenCalledTimes(1);
  await store.getState().sync();
  expect(cloud.list).toHaveBeenCalledTimes(2);
  store.getState().cancelPending();
  expect(cloud.save).not.toHaveBeenCalled();
});

it("cancels a delayed checkpoint when the account changes",async()=>{
  useAuthStore.setState({session});
  let head:CloudProject|undefined;
  const cloud={
    list:vi.fn(async()=>head?[head]:[]),
    save:vi.fn(async(document:CloudProject["document"])=>{
      head={id:document.id,owner_id:"user-a",name:document.name,primary_board_id:document.boardIds[0],schema_version:document.schemaVersion,
        document,archived:false,revision:(head?.revision??0)+1,created_at:document.metadata.createdAt,updated_at:document.metadata.updatedAt} as CloudProject;
      return head;
    }),
  };
  const store=createProjectStore(localProjectRepository,cloud);
  await store.getState().open("esp32-dev-module",session);
  await store.getState().applyTransaction([{type:"component.add",instanceId:"led",definitionId:"led-5mm"}]);
  useAuthStore.setState({session:null});
  store.getState().cancelPending();
  await new Promise(resolve=>setTimeout(resolve,650));
  expect(cloud.save).toHaveBeenCalledTimes(1);
});

it("allows only one in-flight sync despite 100 callers",async()=>{
  useAuthStore.setState({session});
  let release!: (rows:CloudProject[])=>void;
  const pending=new Promise<CloudProject[]>(resolve=>{release=resolve;});
  const cloud={list:vi.fn(async()=>pending),save:vi.fn(async()=>{throw new Error("Unexpected write");})};
  const store=createProjectStore(localProjectRepository,cloud);
  const opening=store.getState().open("esp32-dev-module",session);
  await vi.waitFor(()=>expect(cloud.list).toHaveBeenCalledTimes(1));
  const joins=Array.from({length:100},()=>store.getState().sync());
  release([]);
  await Promise.all(joins);
  await opening;
  expect(cloud.list).toHaveBeenCalledTimes(1);
  store.getState().cancelPending();
});
