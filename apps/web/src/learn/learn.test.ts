import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import { db } from "../persistence/profileRepository";
import { missions, getMission } from "./missions";
import { missionStarter } from "./starters";
import { evaluate } from "./evaluate";
import { completeStage, newProgress, parseProgress, progressRepository, missionComplete } from "./progress";
import { getDefinition } from "../component-library/catalog";
import { getBoard, type BoardId } from "../hardware/boards";
import { executeCommands, type ProjectCommand } from "../hardware-core/commands";
import { holeEndpoint, pinEndpoint, type ElectricalEndpoint } from "../projects/v3";
import { isProjectV4 } from "../projects/v4";
import { compileCircuit } from "../simulation/compileCircuit";
import { availableRecipes } from "../simulation/recipes";
import { SimulationRuntime } from "../simulation/runtime";
import { compileLogic } from "../logic/compile";
import { createProjectStore } from "../state/projectStore";
import { useAuthStore } from "../auth/authStore";
import { localProjectRepository } from "../persistence/localProjectRepository";
import { projectHistoryRepository } from "../persistence/projectHistoryRepository";

beforeEach(async()=>{await db.table("learningProgress").clear();await db.table("projects").clear();await db.table("projectVersions").clear();useAuthStore.setState({session:null});});
const setup=(id:string,board:BoardId="esp32-dev-module")=>missionStarter(getMission(id)!,board);
function wire(from:ElectricalEndpoint,to:ElectricalEndpoint):ProjectCommand{return {type:"wire.add",id:`wire-${crypto.randomUUID()}`,from,to};}
function led(board:BoardId="esp32-dev-module") {
  const {document,roles}=setup("led",board), output=getDefinition(board)!.pins.find(p=>p.role==="digital-io" && !getDefinition(board)!.i2cPins?.includes(p.id))!.id;
  return {roles,document:executeCommands(document,[wire(pinEndpoint("board-main",output),pinEndpoint(roles.resistor!,"a")),wire(pinEndpoint(roles.resistor!,"b"),pinEndpoint(roles.led!,"anode")),wire(pinEndpoint(roles.led!,"cathode"),pinEndpoint("board-main","gnd"))],undefined,"editor")};
}
it("validates mission identities, stages, prerequisites and canonical supported starters",()=>{
  expect(new Set(missions.map(m=>m.id)).size).toBe(missions.length);
  for(const mission of missions){expect(mission.version).toBe(1);expect(mission.stages.length).toBeGreaterThan(0);expect(new Set(mission.stages.map(s=>s.id)).size).toBe(mission.stages.length);for(const id of mission.prerequisites)expect(getMission(id)).toBeDefined();for(const id of mission.parts)expect(getDefinition(id)).toBeDefined();for(const board of mission.boards){expect(getBoard(board)).toBeDefined();expect(isProjectV4(missionStarter(mission,board).document)).toBe(true);}}
  expect(()=>setup("oled","arduino-uno")).toThrow("supported board");
});
it.each(["esp32-dev-module","raspberry-pi-pico","arduino-uno"] as const)("accepts protected LED paths on %s and rejects direct or reversed LED",board=>{
  const valid=led(board);expect(evaluate("led-path",valid.document,valid.roles).pass).toBe(true);
  const {document,roles}=setup("led",board),gpio=getDefinition(board)!.pins.find(p=>p.role==="digital-io")!.id;
  const direct=executeCommands(document,[wire(pinEndpoint("board-main",gpio),pinEndpoint(roles.led!,"anode")),wire(pinEndpoint("board-main","gnd"),pinEndpoint(roles.led!,"cathode"))],undefined,"editor");
  expect(evaluate("led-path",direct,roles).pass).toBe(false);
  const reversed=structuredClone(valid.document);reversed.wires.forEach(w=>{for(const endpoint of [w.from,w.to])if(endpoint.kind==="pin" && endpoint.componentId===roles.led)endpoint.pinId=endpoint.pinId==="anode"?"cathode":"anode";});
  expect(evaluate("led-path",reversed,roles).pass).toBe(false);
});
it("accepts equivalent resistor and LED connections through derived breadboard strips",()=>{
  const {document,roles}=setup("led"),b="breadboard-1";
  const placed=executeCommands(document,[{type:"terminal.place",placement:{componentId:roles.led!,pinId:"anode",breadboardId:b,holeId:"C5"}},{type:"terminal.place",placement:{componentId:roles.led!,pinId:"cathode",breadboardId:b,holeId:"C3"}},{type:"terminal.place",placement:{componentId:roles.resistor!,pinId:"a",breadboardId:b,holeId:"B5"}},{type:"terminal.place",placement:{componentId:roles.resistor!,pinId:"b",breadboardId:b,holeId:"I5"}},wire(pinEndpoint("board-main","gpio23"),holeEndpoint(b,"J5")),wire(pinEndpoint("board-main","gnd"),holeEndpoint(b,"A3"))],undefined,"editor");
  expect(evaluate("led-path",placed,roles).pass).toBe(true);
  const wrong=structuredClone(placed);wrong.wires[0].to=holeEndpoint(b,"J6");expect(evaluate("led-path",wrong,roles).pass).toBe(false);
});
it("observes canonical rows, center gap, different rows, rails and lead movement",()=>{
  const {document,roles}=setup("breadboard");
  const place=(a:string,b:string)=>executeCommands(document,[{type:"terminal.place",placement:{componentId:roles.probeA!,pinId:"a",breadboardId:"breadboard-1",holeId:a}},{type:"terminal.place",placement:{componentId:roles.probeB!,pinId:"a",breadboardId:"breadboard-1",holeId:b}}],undefined,"editor");
  expect(evaluate("row",place("A12","E12"),roles).pass).toBe(true);
  expect(evaluate("row",place("A12","F12"),roles).pass).toBe(false);
  expect(evaluate("gap",place("A12","F12"),roles).pass).toBe(true);
  expect(evaluate("row",place("A12","E13"),roles).pass).toBe(false);
  expect(evaluate("rail",place("L+1","L+25"),roles).pass).toBe(true);
  expect(evaluate("rail",place("L+1","R+1"),roles).pass).toBe(false);
  const moved=executeCommands(place("A12","E12"),[{type:"terminal.unplace",componentId:roles.probeB!,pinId:"a"},{type:"terminal.place",placement:{componentId:roles.probeB!,pinId:"a",breadboardId:"breadboard-1",holeId:"F12"}}],undefined,"editor");
  expect(evaluate("row",moved,roles).pass).toBe(false);
  expect(evaluate("gap",moved,roles).pass).toBe(true);
});
it("requires actual runtime LED transitions rather than navigation or static topology",()=>{
  const {document,roles}=led(),circuit=compileCircuit(document),runtime=new SimulationRuntime(circuit,availableRecipes(circuit).find(r=>r.id==="blink-led")!);
  expect(evaluate("led-on",document,roles).pass).toBe(false);runtime.advanceBy(500);expect(evaluate("led-on",document,roles,runtime.snapshot()).pass).toBe(true);expect(evaluate("led-off",document,roles,runtime.snapshot()).pass).toBe(false);runtime.advanceBy(500);expect(evaluate("led-off",document,roles,runtime.snapshot()).pass).toBe(true);
});
it("requires grounded button contacts and traces LOW press and HIGH release",()=>{
  const {document,roles}=setup("button");
  const valid=executeCommands(document,[wire(pinEndpoint("board-main","gpio18"),pinEndpoint(roles.button!,"a")),wire(pinEndpoint("board-main","gnd"),pinEndpoint(roles.button!,"b"))],undefined,"editor");
  expect(evaluate("button-path",valid,roles).pass).toBe(true);expect(evaluate("button-path",document,roles).pass).toBe(false);
  const circuit=compileCircuit(valid),runtime=new SimulationRuntime(circuit,availableRecipes(circuit).find(r=>r.id==="explore")!);
  expect(evaluate("button-released",valid,roles,runtime.snapshot()).pass).toBe(false);runtime.setButton(roles.button!,true);expect(evaluate("button-pressed",valid,roles,runtime.snapshot()).pass).toBe(true);runtime.setButton(roles.button!,false);expect(evaluate("button-released",valid,roles,runtime.snapshot()).pass).toBe(true);
});
it.each(["esp32-dev-module","raspberry-pi-pico"] as const)("uses canonical OLED I²C pins on %s; swapped signals fail",board=>{
  const {document,roles}=setup("oled",board),pins=getDefinition(board)!.i2cPins!;
  let valid=executeCommands(document,[wire(pinEndpoint("board-main","3v3"),pinEndpoint(roles.oled!,"vcc")),wire(pinEndpoint("board-main","gnd"),pinEndpoint(roles.oled!,"gnd")),wire(pinEndpoint("board-main",pins[0]),pinEndpoint(roles.oled!,"sda")),wire(pinEndpoint("board-main",pins[1]),pinEndpoint(roles.oled!,"scl"))],undefined,"editor");
  expect(evaluate("oled-path",valid,roles).pass).toBe(true);
  const swapped=structuredClone(valid);swapped.wires[2].from=pinEndpoint("board-main",pins[1]);swapped.wires[3].from=pinEndpoint("board-main",pins[0]);expect(evaluate("oled-path",swapped,roles).pass).toBe(false);
  valid=executeCommands(valid,[{type:"logic.rule.add",rule:{id:"hello",enabled:true,when:{kind:"timer",intervalMs:100},if:[],do:[{kind:"oled",componentId:roles.oled!,operation:"show",text:"HELLO"}]}}],undefined,"editor");
  const circuit=compileCircuit(valid),runtime=new SimulationRuntime(circuit,compileLogic(valid,circuit));runtime.advanceBy(100);expect(evaluate("oled-text",valid,roles,runtime.snapshot()).pass).toBe(true);
});
it("reuses canonical BONK authored behavior and requires runtime outputs",()=>{
  const {document,roles}=setup("bonk"),circuit=compileCircuit(document),runtime=new SimulationRuntime(circuit,compileLogic(document,circuit));
  expect(evaluate("bonk-logic",document,roles).pass).toBe(true);expect(evaluate("bonk-output",document,roles,runtime.snapshot()).pass).toBe(false);runtime.setButton(roles.button!,true);runtime.advanceBy(300);expect(evaluate("bonk-output",document,roles,runtime.snapshot()).pass).toBe(true);
});
it("persists exact owner namespaces, idempotent completion, hints and backward inspection",async()=>{
  const mission=getMission("breadboard")!,{document,roles}=setup("breadboard"),p=newProgress(mission,"guest",document.id,roles);
  const failed=evaluate("row",document,roles);expect(completeStage(p,mission,failed)).toBe(p);
  const placed=executeCommands(document,[{type:"terminal.place",placement:{componentId:roles.probeA!,pinId:"a",breadboardId:"breadboard-1",holeId:"A12"}},{type:"terminal.place",placement:{componentId:roles.probeB!,pinId:"a",breadboardId:"breadboard-1",holeId:"E12"}}],undefined,"editor");
  const completed=completeStage(p,mission,evaluate("row",placed,roles));expect(completeStage(completed,mission,evaluate("row",placed,roles))).toBe(completed);
  await progressRepository.save({...completed,hints:{row:2}});expect((await progressRepository.load("guest",mission))?.completed).toEqual(["row"]);expect((await progressRepository.load("guest",mission))?.hints.row).toBe(2);expect(await progressRepository.load("user-a",mission)).toBeNull();
  await progressRepository.save({...p,ownerId:"user-a"});expect(await progressRepository.list("user-b")).toEqual([]);expect((await progressRepository.list("guest"))[0].completed).toEqual(["row"]);
  const done={...completed,stageId:"rail",completed:mission.stages.map(s=>s.id)};await progressRepository.save(done);expect(missionComplete((await progressRepository.load("guest",mission))!,mission)).toBe(true);
  await progressRepository.save({...done,stageId:"row"});expect(missionComplete((await progressRepository.load("guest",mission))!,mission)).toBe(true);
});
it("rejects version mismatches, skipped stages and malformed untrusted progress",()=>{
  const mission=getMission("led")!,{document,roles}=setup("led"),p=newProgress(mission,"guest",document.id,roles);
  for(const patch of [{missionVersion:2},{stageId:"led-off"},{completed:["led-off"]},{hints:{"led-path":99}},{ownerId:"other"},{roles:{led:"<script>"}},{projectId:"bad"}])expect(()=>parseProgress({...p,...patch},mission,"guest")).toThrow();
});
it("mission transactions reuse project undo, redo and restore; progress and simulation add no checkpoints",async()=>{
  const {document,roles}=led(),mission=getMission("led")!;
  await localProjectRepository.save({id:document.id,name:document.name,schemaVersion:4,document,createdAt:document.metadata.createdAt,updatedAt:document.metadata.updatedAt,cloudDirty:false},"Created learning project");
  const store=createProjectStore();await store.getState().openById(document.id,"esp32-dev-module",null);
  await store.getState().applyTransaction([{type:"wire.remove",id:document.wires[0].id}]);expect(evaluate("led-path",store.getState().project!.document as typeof document,roles).pass).toBe(false);
  await store.getState().undo();expect(evaluate("led-path",store.getState().project!.document as typeof document,roles).pass).toBe(true);await store.getState().redo();expect(evaluate("led-path",store.getState().project!.document as typeof document,roles).pass).toBe(false);
  const versions=await projectHistoryRepository.list("guest",document.id);await store.getState().restoreVersion(versions.find(v=>v.reason==="Created learning project")!.id);expect(evaluate("led-path",store.getState().project!.document as typeof document,roles).pass).toBe(true);
  const count=(await projectHistoryRepository.list("guest",document.id)).length;await progressRepository.save(newProgress(mission,"guest",document.id,roles));const circuit=compileCircuit(document),runtime=new SimulationRuntime(circuit,availableRecipes(circuit)[0]);runtime.advanceBy(1000);expect((await projectHistoryRepository.list("guest",document.id)).length).toBe(count);expect(store.getState().project?.cloudDirty).toBe(false);
});
