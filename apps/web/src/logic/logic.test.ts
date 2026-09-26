import { expect, it } from "vitest";
import { starterProject } from "../projects/schema";
import { migrateProject as migrateV2 } from "../projects/v2";
import { isProjectV3, migrateProject as migrateV3 } from "../projects/v3";
import { isProjectV4, migrateProject, type KinetableProjectV4 } from "../projects/v4";
import { layoutComponents } from "../hardware-core/layout";
import { executeCommands } from "../hardware-core/commands";
import { WorkbenchHistory, restoreRevision } from "../hardware-core/history";
import { compileCircuit, topologyKey } from "../simulation/compileCircuit";
import { SimulationRuntime } from "../simulation/runtime";
import { causalChain, latestForComponent } from "../simulation/explain";
import { compileLogic } from "./compile";
import { isLogic, type LogicRule, type Condition } from "./schema";
import { useSimulationStore } from "../state/simulationStore";
import { BREADBOARD_ID } from "../hardware-core/breadboard";

type Part = [string, string]; type Link = [string, string, string, string];
const board = "board-main";
const led: Part[] = [["led-1", "led-5mm"], ["resistor-1", "resistor-220r"]];
const ledLinks: Link[] = [[board,"gpio23","resistor-1","a"],["resistor-1","b","led-1","anode"],["led-1","cathode",board,"gnd"]];
const button: Part[] = [["button-1", "push-button"]];
const buttonLinks: Link[] = [[board,"gpio18","button-1","a"],["button-1","b",board,"gnd"]];
const buzzer: Part[] = [["buzzer-1", "grove-buzzer-v1-1"]];
const buzzerLinks: Link[] = [[board,"3v3","buzzer-1","vcc"],[board,"gnd","buzzer-1","gnd"],[board,"gpio19","buzzer-1","sig"]];
const oled: Part[] = [["oled-1", "oled-ssd1306-i2c-3v3"]];
const oledLinks: Link[] = [[board,"3v3","oled-1","vcc"],[board,"gnd","oled-1","gnd"],[board,"gpio21","oled-1","sda"],[board,"gpio22","oled-1","scl"]];
const dht: Part[] = [["dht-1", "dht11-module"]];
const dhtLinks: Link[] = [[board,"3v3","dht-1","vcc"],[board,"gnd","dht-1","gnd"],[board,"gpio18","dht-1","data"]];
const pir: Part[] = [["pir-1", "hc-sr501"]];
const pirLinks: Link[] = [[board,"vin","pir-1","vcc"],[board,"gnd","pir-1","gnd"],[board,"gpio27","pir-1","out"]];
function fixture(parts: Part[], links: Link[]): KinetableProjectV4 {
  const project = migrateProject(starterProject("esp32-dev-module"));
  for (const [id, definitionId] of parts) project.components.push({ id, definitionId, kind: "component" });
  project.layout.entities = layoutComponents(project.components, project.layout.entities);
  project.wires = links.map(([a, ap, b, bp], index) => ({ id: `wire-${index}`, from: { kind: "pin", componentId: a, pinId: ap }, to: { kind: "pin", componentId: b, pinId: bp } }));
  return project;
}
const press: LogicRule = { id: "rule-bonk-press", enabled: true, when: { kind: "button", componentId: "button-1", edge: "pressed" }, if: [], do: [
  { kind: "oled", componentId: "oled-1", operation: "show", text: "BONK!" }, { kind: "led", componentId: "led-1", operation: "on" }, { kind: "buzzer", componentId: "buzzer-1", count: 2, onMs: 120, gapMs: 100 }] };
const release: LogicRule = { id: "rule-bonk-release", enabled: true, when: { kind: "button", componentId: "button-1", edge: "released" }, if: [], do: [
  { kind: "oled", componentId: "oled-1", operation: "show", text: "READY" }, { kind: "led", componentId: "led-1", operation: "off" }] };
const bonk = () => fixture([...button,...led,...buzzer,...oled], [...buttonLinks,...ledLinks,...buzzerLinks,...oledLinks]);
const run = (project: KinetableProjectV4) => new SimulationRuntime(compileCircuit(project), compileLogic(project));

it("migrates v1, v2 and v3 without inventing authored logic", () => {
  const v1 = starterProject("esp32-dev-module"), v2 = migrateV2(v1), v3 = migrateV3(v2);
  expect(isProjectV3(v3)).toBe(true);
  for (const old of [v1,v2,v3]) { const current = migrateProject(old); expect(isProjectV4(current)).toBe(true); expect(current.logic).toEqual([]); expect(current.id).toBe(v1.id); }
  expect(isProjectV3(migrateProject(v3))).toBe(false);
});
it("rejects malformed rules, duplicate IDs and bounded values", () => {
  const p = bonk(); p.logic = [press,release]; expect(isProjectV4(p)).toBe(true);
  expect(isLogic([press,press])).toBe(false);
  expect(isLogic([{ ...press, do: [{ ...press.do[2], count: 9 }] }])).toBe(false);
  expect(isLogic([{ ...press, when: { kind: "timer", intervalMs: 0 } }])).toBe(false);
  expect(isProjectV4({ ...p, logic: [{ ...press, do: [{ kind: "oled", componentId: "oled-1", operation: "show", text: "a".repeat(33) }] }] })).toBe(false);
});
it("binds BONK to real nets and blocks stale or incorrect capability references", () => {
  const p = bonk(); p.logic = [press,release];
  const circuit = compileCircuit(p), program = compileLogic(p, circuit);
  expect(program.rules[0].when.boardPin).toBe("gpio18");
  expect(program.rules[0].do.map(action => action.boardPin)).toEqual([undefined,"gpio23","gpio19"]);
  expect(program.rules[0].do[0].netId).toBe(circuit.bindings.find(b => b.id === "oled-1")!.pins.sda);
  const moved = structuredClone(p); moved.layout.entities["led-1"].position[0] += .2;
  expect(topologyKey(moved)).toBe(topologyKey(p)); expect(compileLogic(moved).rules).toEqual(program.rules);
  expect(() => executeCommands(p, [{ type: "component.remove", instanceId: "button-1" }], undefined, "editor")).toThrow(/behavior/);
  expect(() => executeCommands(p, [{ type: "wire.remove", id: "wire-0" }], undefined, "editor")).toThrow();
  expect(() => compileLogic({ ...p, logic: [{ ...press, when: { kind: "button", componentId: "missing", edge: "pressed" } }] })).toThrow(/missing component/);
  expect(() => compileLogic({ ...p, logic: [{ ...press, when: { kind: "button", componentId: "led-1", edge: "pressed" } }] })).toThrow(/cannot be used/);
});
it("runs saved BONK ×2 then only the edited ×3, including initial and release states", () => {
  const p = bonk(); p.logic = [press,release];
  const r = run(p);
  expect([r.snapshot().outputs["oled-1"].text, r.snapshot().outputs["led-1"].on, r.snapshot().outputs["buzzer-1"].on]).toEqual(["READY",false,false]);
  r.setButton("button-1",true);
  expect([r.snapshot().outputs["oled-1"].text,r.snapshot().outputs["led-1"].on]).toEqual(["BONK!",true]);
  r.advanceTo(340);
  expect(r.snapshot().trace.filter(e => e.code === "buzzer.state" && e.value === "ON").map(e => e.timeMs)).toEqual([0,220]);
  expect(r.snapshot().trace.filter(e => e.code === "buzzer.state" && e.value === "OFF").map(e => e.timeMs)).toEqual([120,340]);
  const chain = causalChain(r.snapshot().trace, latestForComponent(r.snapshot(),"oled-1")!.id);
  expect(chain.map(e => e.code)).toEqual(["button.press","gpio.input","logic.rule.match","logic.action","i2c.text","oled.text"]);
  r.setButton("button-1",false); expect([r.snapshot().outputs["oled-1"].text,r.snapshot().outputs["led-1"].on]).toEqual(["READY",false]);
  const edited = executeCommands(p, [{ type: "logic.rule.update", rule: { ...press, do: [{ ...press.do[0] }, { ...press.do[1] }, { kind: "buzzer", componentId: "buzzer-1", count: 3, onMs: 120, gapMs: 100 }] } }], undefined, "editor");
  const second = run(edited); second.setButton("button-1",true); second.advanceTo(560);
  expect(second.snapshot().trace.filter(e => e.code === "buzzer.state" && e.value === "ON").map(e => e.timeMs)).toEqual([0,220,440]);
  expect(second.snapshot().trace.filter(e => e.code === "buzzer.state" && e.value === "OFF").map(e => e.timeMs)).toEqual([120,340,560]);
  expect(migrateProject(JSON.parse(JSON.stringify(edited))).logic[0].do[2]).toEqual(edited.logic[0].do[2]);
});
it("initializes authored inputs once instead of leaking legacy recipe setup into the causal trace", () => {
  const p = bonk(); p.logic = [press,release];
  const initial = run(p).snapshot().trace;
  const buttonInputs = initial.filter(event => event.code === "gpio.input" && event.pinId === "gpio18");
  expect(initial.filter(event => event.code === "button.release" && event.componentId === "button-1")).toHaveLength(1);
  expect(buttonInputs).toHaveLength(1);
  expect(buttonInputs[0].causedBy).toBeDefined();

  const alarm = fixture([...pir,...buzzer],[...pirLinks,...buzzerLinks]);
  alarm.logic = [{ id: "motion", enabled: true, when: { kind: "pir", componentId: "pir-1" }, if: [], do: [{ kind: "buzzer", componentId: "buzzer-1", count: 1, onMs: 120, gapMs: 100 }] }];
  const pirInputs = run(alarm).snapshot().trace.filter(event => event.code === "gpio.input" && event.pinId === "gpio27");
  expect(pirInputs).toHaveLength(1);
});
it("runs timer, PIR and DHT conditions on the same logical clock and physical bindings", () => {
  const blink = fixture(led,ledLinks); blink.logic = [{ id: "blink", enabled: true, when: { kind: "timer", intervalMs: 500 }, if: [], do: [{ kind: "led", componentId: "led-1", operation: "toggle" }] }];
  const a = run(blink), b = run(blink); a.advanceTo(1500); b.advanceBy(200); b.advanceBy(1300);
  expect(a.snapshot()).toEqual(b.snapshot()); expect(a.snapshot().outputs["led-1"].on).toBe(true);
  const alarm = fixture([...pir,...buzzer],[...pirLinks,...buzzerLinks]); alarm.logic = [{ id: "motion", enabled: true, when: { kind: "pir", componentId: "pir-1" }, if: [], do: [{ kind: "buzzer", componentId: "buzzer-1", count: 1, onMs: 120, gapMs: 100 }] }];
  const motion = run(alarm); motion.triggerPir("pir-1"); expect(motion.snapshot().outputs["buzzer-1"].on).toBe(true); motion.advanceTo(120); expect(motion.snapshot().outputs["buzzer-1"].on).toBe(false);
  const sensor = fixture([...dht,...oled],[...dhtLinks,...oledLinks]); sensor.logic = [{ id: "hot", enabled: true, when: { kind: "dht11", componentId: "dht-1" }, if: [{ kind: "dht11", componentId: "dht-1", property: "temperatureC", operator: ">=", value: 30 }], do: [{ kind: "oled", componentId: "oled-1", operation: "show", text: "HOT" }] }];
  const temperature = run(sensor); temperature.setEnvironment(29,50); expect(temperature.snapshot().outputs["oled-1"].text).toBe("");
  expect(temperature.snapshot().trace.some(e => e.code === "logic.condition.false")).toBe(true);
  temperature.setEnvironment(30,50); expect(temperature.snapshot().outputs["oled-1"].text).toBe("HOT");
});
it("keeps undo and redo snapshots of authored logic", () => {
  const p = bonk(), history = new WorkbenchHistory<KinetableProjectV4>();
  const added = executeCommands(p, [{ type: "logic.rule.add", rule: press }], undefined, "editor"); history.record(p);
  const edited = executeCommands(added, [{ type: "logic.rule.enable", id: press.id, enabled: false }], undefined, "editor"); history.record(added);
  const restored = restoreRevision(history.undoTarget()!, edited); expect(restored.logic[0].enabled).toBe(true);
  history.finishUndo(edited); expect(restoreRevision(history.redoTarget()!, restored).logic[0].enabled).toBe(false);
});
it("rejects every language limit, scripts and invalid sensor values", () => {
  const condition = { kind: "dht11", componentId: "dht-1", property: "temperatureC", operator: ">=", value: 30 };
  for (const invalid of [
    Array.from({length:17},(_,i)=>({...press,id:`rule-${i}`})),
    [{...press,do:Array(9).fill(press.do[0])}], [{...press,if:Array(5).fill(condition)}],
    [{...press,when:{kind:"timer",intervalMs:60001}}],
    [{...press,do:[{...press.do[2],onMs:0}]}], [{...press,do:[{...press.do[2],gapMs:2001}]}],
    [{...press,if:[{...condition,value:Infinity}]}], [{...press,if:[{...condition,property:"humidityPct",value:19}]}],
    [{...press,do:[{kind:"javascript",source:"eval()"}]}], [{...press,script:"anything"}],
  ]) expect(isLogic(invalid)).toBe(false);
});
it("reorders rules deterministically, keeps disabled project behavior primary, and bounds scheduling", () => {
  const p=bonk(); p.logic=[press,release];
  const reordered=executeCommands(p,[{type:"logic.rule.reorder",id:release.id,index:0}],undefined,"editor");
  expect(reordered.logic.map(r=>r.id)).toEqual([release.id,press.id]);
  const disabled=executeCommands(reordered,reordered.logic.map(r=>({type:"logic.rule.enable",id:r.id,enabled:false})),undefined,"editor");
  const store=useSimulationStore.getState(); store.enter(disabled,"simulate");
  expect(useSimulationStore.getState().recipe?.id).toBe("project-logic"); expect(useSimulationStore.getState().recipes).toEqual([]);
  store.button("button-1",true); expect(useSimulationStore.getState().snapshot?.outputs["led-1"].on).toBe(false); store.build();
  const blink=fixture(led,ledLinks); blink.logic=[{id:"bounded-timer",enabled:true,when:{kind:"timer",intervalMs:100},if:[],do:[{kind:"led",componentId:"led-1",operation:"toggle"}]}];
  const runtime=run(blink); runtime.advanceTo(1000000); expect(runtime.error).toMatch(/event limit/); expect(runtime.snapshot().trace.length).toBeLessThanOrEqual(1000);
});
it("binds DHT comparisons with AND semantics and rejects incompatible circuit reuse or GPIO roles", () => {
  const p=fixture([...dht,...oled],[...dhtLinks,...oledLinks]);
  for (const [operator,value,expected] of [["<",31,true],["<=",30,true],["==",30,true],[">=",30,true],[">",30,false]] as const) {
    p.logic=[{id:"hot",enabled:true,when:{kind:"dht11",componentId:"dht-1"},if:[{kind:"dht11",componentId:"dht-1",property:"temperatureC",operator,value},{kind:"dht11",componentId:"dht-1",property:"humidityPct",operator:">=",value:50}],do:[{kind:"oled",componentId:"oled-1",operation:"show",text:"HOT"}]}];
    const runtime=run(p); runtime.setEnvironment(30,50); expect(runtime.snapshot().outputs["oled-1"].text).toBe(expected?"HOT":"");
    if(expected) expect(causalChain(runtime.snapshot().trace,latestForComponent(runtime.snapshot(),"oled-1")!.id).filter(e=>e.code==="logic.condition.true")).toHaveLength(2);
    const before=runtime.snapshot(); runtime.setEnvironment(30,50); expect(runtime.snapshot()).toEqual(before);
  }
  p.logic[0].if[0]={...p.logic[0].if[0],componentId:"oled-1"} as Condition; expect(()=>compileLogic(p)).toThrow(/cannot be used/);
  const conflict=bonk(); conflict.logic=[press]; conflict.components.push({id:"breadboard-1",kind:"breadboard",definitionId:BREADBOARD_ID});
  conflict.layout.entities=layoutComponents(conflict.components,conflict.layout.entities);
  conflict.layout.entities["breadboard-1"]={position:[-3.5,0,.12],rotation:[Math.PI/2,0,0],scale:[1.8,1.8,1.8]};
  conflict.wires[0].to={kind:"breadboard-hole",breadboardId:"breadboard-1",holeId:"A1"};
  conflict.wires[7].from={kind:"breadboard-hole",breadboardId:"breadboard-1",holeId:"B1"};
  conflict.wires.push({id:"shared-button",from:{kind:"pin",componentId:"button-1",pinId:"a"},to:{kind:"breadboard-hole",breadboardId:"breadboard-1",holeId:"C1"}});
  expect(()=>compileLogic(conflict)).toThrow(/conflicting/);
  expect(()=>compileLogic(conflict,compileCircuit(bonk()))).toThrow(/current physical/);
});
