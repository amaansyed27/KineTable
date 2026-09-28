import { afterEach, expect, it, vi } from "vitest";
import { projectFromIntent, starterProject } from "../projects/schema";
import { migrateProject } from "../projects/v4";

const commands=[
  {type:"component.add",instanceId:"led-1",definitionId:"led-5mm"},
  {type:"component.add",instanceId:"resistor-1",definitionId:"resistor-220r"},
  {type:"connection.create",id:"c1",from:{componentId:"board-main",pinId:"gpio23"},to:{componentId:"resistor-1",pinId:"a"}},
  {type:"connection.create",id:"c2",from:{componentId:"resistor-1",pinId:"b"},to:{componentId:"led-1",pinId:"anode"}},
  {type:"connection.create",id:"c3",from:{componentId:"led-1",pinId:"cathode"},to:{componentId:"board-main",pinId:"gnd"}},
];
vi.mock("../../../../server/ai/remoteProvider",()=>({validateRemoteConfig:()=>({}),remoteModelProvider:()=>({generate:async()=>({status:"supported",summary:"LED connected",unsupportedReason:"",commands})})}));
import handler from "../../../../api/ai/plan";

afterEach(()=>{vi.unstubAllGlobals();delete process.env.VITE_SUPABASE_URL;delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;});
it("replaces forged browser inventory with the authenticated owner's RLS rows",async()=>{
  process.env.VITE_SUPABASE_URL="https://example.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY="public-test-key";
  const project=migrateProject(projectFromIntent(starterProject("esp32-dev-module"),"esp32-dev-module","Make an LED blink","LED Blink"));
  const input={projectId:project.id,revision:project.metadata.updatedAt,intent:project.intent!.text,boardId:project.boardIds[0],inventory:{mode:"owned-only",items:[{definitionId:"led-5mm",quantity:1},{definitionId:"resistor-220r",quantity:1}]}};
  const cloudProject={id:project.id,owner_id:"account-a",name:project.name,primary_board_id:project.boardIds[0],schema_version:project.schemaVersion,document:project,archived:false};
  const fetchMock=vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes("/auth/v1/user")?{id:"account-a"}:url.includes("/rest/v1/projects")?[cloudProject]:[{owner_id:"account-a",definition_id:"resistor-220r",quantity:1}]}));
  vi.stubGlobal("fetch",fetchMock);
  const response=()=>{let status=0,body:Record<string,unknown>={};return {res:{writeHead:(code:number)=>{status=code;},end:(value:string)=>{body=JSON.parse(value);}},result:()=>({status,body})};};
  const remote=response();
  await handler({method:"POST",headers:{authorization:"Bearer account-token"},body:{input,provider:{}}} as never,remote.res as never);
  expect(remote.result()).toMatchObject({status:422,body:{code:"NOT_OWNED"}});
  expect(fetchMock).toHaveBeenCalledTimes(3);
  const guest=response();
  await handler({method:"POST",headers:{},body:{input,project,provider:{}}} as never,guest.res as never);
  expect(guest.result()).toMatchObject({status:200,body:{status:"supported"}});
});
