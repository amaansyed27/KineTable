import { executeCommands, type ProjectCommand } from "../hardware-core/commands.js";
import { pinEndpoint, holeEndpoint } from "./v3.js";
import type { KinetableProjectV4 } from "./v4.js";

/** Explicit supported demo, never inferred from a prompt or from mockup wiring. */
export function bonkProject(project: KinetableProjectV4): KinetableProjectV4 {
  const board = project.components[0].id, breadboard = "breadboard-1";
  const commands: ProjectCommand[] = [{ type: "layout.move", entityId: board, transform: { position: [1.6,-.35,.25], rotation: [Math.PI/2,0,0], scale: [1.4,1.4,1.4] } }, { type: "breadboard.add", id: breadboard }];
  for (const [instanceId, definitionId] of [["led-1","led-5mm"],["resistor-1","resistor-220r"],["button-1","push-button"],["buzzer-1","grove-buzzer-v1-1"],["oled-1","oled-ssd1306-i2c-3v3"]]) commands.push({ type: "component.add", instanceId, definitionId });
  for (const [componentId,pinId,holeId] of [["led-1","anode","C5"],["led-1","cathode","C3"],["resistor-1","a","B5"],["resistor-1","b","I5"],["button-1","a","E18"],["button-1","b","F18"]]) commands.push({ type: "terminal.place", placement: { componentId,pinId,breadboardId:breadboard,holeId } });
  const links = [["gpio23","J5"],["gnd","A3"],["gpio18","J18"],["gnd","A18"]];
  for (const [pin,hole] of links) commands.push({ type: "wire.add", id: `wire-${commands.length}`, from: pinEndpoint(board,pin), to: holeEndpoint(breadboard,hole), color: pin === "gnd" ? "black" : "yellow" });
  for (const [pin,part,target] of [["3v3","buzzer-1","vcc"],["gnd","buzzer-1","gnd"],["gpio19","buzzer-1","sig"],["3v3","oled-1","vcc"],["gnd","oled-1","gnd"],["gpio21","oled-1","sda"],["gpio22","oled-1","scl"]]) commands.push({ type: "wire.add", id: `wire-${commands.length}`, from: pinEndpoint(board,pin), to: pinEndpoint(part,target), color: pin === "3v3" ? "red" : pin === "gnd" ? "black" : "blue" });
  commands.push({ type: "logic.rule.add", rule: { id: "rule-bonk-press", enabled: true, when: { kind:"button",componentId:"button-1",edge:"pressed" }, if: [], do: [{kind:"oled",componentId:"oled-1",operation:"show",text:"BONK!"},{kind:"led",componentId:"led-1",operation:"on"},{kind:"buzzer",componentId:"buzzer-1",count:2,onMs:120,gapMs:100}] } },
    { type: "logic.rule.add", rule: { id: "rule-bonk-release", enabled:true, when:{kind:"button",componentId:"button-1",edge:"released"},if:[],do:[{kind:"oled",componentId:"oled-1",operation:"show",text:"READY"},{kind:"led",componentId:"led-1",operation:"off"}] } });
  return executeCommands(project, commands);
}
