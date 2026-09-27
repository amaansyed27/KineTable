import { expect, it } from "vitest";
import { Vector3 } from "three";
import { migrateProject } from "../projects/v4";
import { starterProject } from "../projects/schema";
import { pinEndpoint as pin, holeEndpoint } from "../projects/v3";
import { executeCommands } from "../hardware-core/commands";
import { parsePlan } from "../ai/contract";
import { endpointWorld } from "./anchors";
import { jumperColors, jumperCurve, headerDirection } from "./jumpers";

it("colors electrical continuations together and unrelated wires differently, keeping curved jumpers on physical header tips", () => {
  const base = migrateProject(starterProject("esp32-dev-module"));
  const hole = (id: string) => holeEndpoint("breadboard-1", id);
  const project = executeCommands(base, [{type:"breadboard.add",id:"breadboard-1"},
    {type:"component.add",instanceId:"sensor",definitionId:"dht11-module"},
    {type:"wire.add",id:"supply",from:pin("board-main","3v3"),to:hole("L+1")},
    {type:"wire.add",id:"continuation",from:hole("L+2"),to:pin("sensor","vcc")},
    {type:"wire.add",id:"ground",from:pin("board-main","gnd"),to:pin("sensor","gnd")},
    {type:"wire.add",id:"data",from:pin("board-main","gpio18"),to:pin("sensor","data")}
  ], undefined, "editor");
  const colors = jumperColors(project);
  expect(colors.get("supply")).toBe(colors.get("continuation"));
  expect(new Set([colors.get("supply"),colors.get("ground"),colors.get("data")]).size).toBe(3);
  const from = endpointWorld(project, pin("board-main","gpio18")), to = endpointWorld(project,pin("sensor","data"));
  const curve = jumperCurve(from,to,1,headerDirection(project,pin("board-main","gpio18")),headerDirection(project,pin("sensor","data")));
  expect(curve.getPoint(0).equals(from)).toBe(true); expect(curve.getPoint(1).equals(to)).toBe(true);
  expect(curve.getPoint(.5).distanceTo(from.clone().lerp(to,.5))).toBeGreaterThan(.2);
  expect(headerDirection(project,pin("sensor","data"))!.length()).toBeCloseTo(1);
  expect(jumperCurve(new Vector3(),new Vector3()).getPoint(.5).toArray().every(Number.isFinite)).toBe(true);
});

it("renames through validated atomic commands while AI hardware plans cannot rename", () => {
  const project = migrateProject(starterProject("esp32-dev-module"));
  const renamed = executeCommands(project,[{type:"project.rename",name:"My bench"}],undefined,"editor");
  expect(renamed.name).toBe("My bench"); expect(project.name).not.toBe("My bench");
  expect(() => executeCommands(project,[{type:"project.rename",name:"   "}],undefined,"editor")).toThrow();
  expect(() => parsePlan({status:"supported",summary:"Rename",unsupportedReason:"",commands:[{type:"project.rename",name:"My bench"}]})).toThrow("INVALID_MODEL_RESPONSE");
});
