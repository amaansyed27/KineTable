import { expect, it } from "vitest";
import { starterProject } from "../projects/schema";
import { migrateProject } from "../projects/v4";
import { bonkProject } from "../projects/starters";
import { compileLogic } from "../logic/compile";
import { executeCommands } from "../hardware-core/commands";
import { endpointWorld } from "../spatial/anchors";
import { pinEndpoint, holeEndpoint } from "../projects/v3";
import { parseBehaviorPlan, planBehavior, validateBehaviorPlan, parseBehaviorResponse } from "./behaviorPlanner";
import { SimulationRuntime } from "../simulation/runtime";
import { compileCircuit } from "../simulation/compileCircuit";
const fixture=()=>bonkProject(migrateProject(starterProject("esp32-dev-module")));
it("BONK has exact inserted lead anchors and canonical GPIO18/23/19/21/22 bindings",()=>{
  const p=fixture();const program=compileLogic(p);
  expect(program.inputPins["button-1"]).toBe("gpio18");
  expect(program.outputs.leds[0].boardPin).toBe("gpio23");
  expect(program.outputs.buzzers[0].boardPin).toBe("gpio19");
  for(const lead of p.terminalPlacements)expect(endpointWorld(p,pinEndpoint(lead.componentId,lead.pinId)).distanceTo(endpointWorld(p,holeEndpoint(lead.breadboardId,lead.holeId)))).toBeLessThan(.000001);
  expect(program.outputs.oleds[0].component.pins.sda).toBeDefined();
});
it("behavior proposals validate before Apply and cannot mutate hardware, invent IDs or bypass wiring",async()=>{
  const p=fixture(),before=structuredClone(p),request={projectId:p.id,revision:p.metadata.updatedAt,boardId:p.boardIds[0],intent:"Beep three times"};
  const rule=structuredClone(p.logic[0]);if(rule.do[2].kind==="buzzer")rule.do[2].count=3;
  const output={status:"supported",summary:"Change two beeps to three",unsupportedReason:"",commands:[{type:"logic.rule.update",rule}]};
  const proposal=await planBehavior({generate:async(_prompt,schema)=>{expect(schema).toBeDefined();return output;}},request,p);
  expect(p).toEqual(before);const candidate=executeCommands(p,proposal.commands);expect(candidate.logic[0].do[2]).toMatchObject({count:3});
  const runtime=new SimulationRuntime(compileCircuit(candidate),compileLogic(candidate));runtime.setButton("button-1",true);runtime.advanceTo(560);expect(runtime.snapshot().trace.filter(e=>e.code==="buzzer.state" && e.value==="ON").map(e=>e.timeMs)).toEqual([0,220,440]);
  expect(()=>parseBehaviorPlan({...output,code:"alert(1)"})).toThrow();
  expect(()=>parseBehaviorPlan({...output,commands:[{type:"component.remove",instanceId:"led-1"}]})).toThrow();
  const missing=structuredClone(rule);missing.do[0].componentId="invented-1";
  expect(()=>validateBehaviorPlan(request,p,{...output,commands:[{type:"logic.rule.update",rule:missing}]})).toThrow("HARDWARE_VALIDATION");
  expect(()=>validateBehaviorPlan(request,{...p,wires:[]},output)).toThrow("HARDWARE_VALIDATION");
  expect(()=>parseBehaviorResponse(request,p,{...output,revision:"stale"})).toThrow("STALE_PROJECT");
  expect(()=>parseBehaviorPlan({...output,status:"unsupported",unsupportedReason:"Unsupported",commands:output.commands})).toThrow();
  expect(()=>parseBehaviorPlan({...output,summary:"x".repeat(241)})).toThrow();expect(p).toEqual(before);
});

it("rejects bounded-contract violations before commands can run",()=>{
 const p=fixture(),rule=p.logic[0],base={status:"supported",summary:"Change behavior",unsupportedReason:""};
 for(const bad of [{...rule,do:[{kind:"javascript",componentId:"led-1",code:"alert(1)"}]},{...rule,do:Array(9).fill(rule.do[0])},{...rule,do:[{kind:"buzzer",componentId:"buzzer-1",count:3,onMs:0,gapMs:100}]},{...rule,unknown:true}]) expect(()=>parseBehaviorPlan({...base,commands:[{type:"logic.rule.update",rule:bad}]})).toThrow("INVALID_MODEL_RESPONSE");
 expect(()=>parseBehaviorPlan({...base,commands:Array(17).fill({type:"logic.rule.remove",id:rule.id})})).toThrow("INVALID_MODEL_RESPONSE");
});
