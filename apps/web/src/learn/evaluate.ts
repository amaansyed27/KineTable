import { getHole } from "../hardware-core/breadboard";
import { analyzeCircuit } from "../hardware-core/validation";
import type { KinetableProjectV4 } from "../projects/v4";
import { compileCircuit, sameNet } from "../simulation/compileCircuit";
import { bindDriver } from "../simulation/drivers";
import { causalChain, describeTrace } from "../simulation/explain";
import type { Snapshot } from "../simulation/runtime";
import type { Goal } from "./missions";
import type { Roles } from "./starters";

export type Evidence = { pass: boolean; feedback: string; facts: string[]; answer: string };
export function evaluate(goal: Goal, project: KinetableProjectV4, roles: Roles, snapshot: Snapshot | null = null): Evidence {
  const circuit = compileCircuit(project);
  const board = circuit.board.definition;
  const binding = (role: keyof Roles) => circuit.bindings.find(b => b.id === roles[role]);
  const driver = (role: keyof Roles, model: Parameters<typeof bindDriver>[1]) => bindDriver(circuit,model).find(b => b.component.id === roles[role]);
  const gpio = board.pins.find(p => p.role === "digital-io" && !board.i2cPins?.includes(p.id))?.id;
  const supply = board.pins.find(p => p.role === "power" && p.volts === binding("oled")?.definition.supply)?.id;
  let pass = false, answer = "", feedback = "Keep building. Inspect the actual connections.";
  const facts: string[] = [];
  if (["row","gap","rail"].includes(goal)) {
    const a = project.terminalPlacements.find(p => p.componentId === roles.probeA && p.pinId === "a");
    const b = project.terminalPlacements.find(p => p.componentId === roles.probeB && p.pinId === "a");
    const left = a && getHole(a.holeId), right = b && getHole(b.holeId);
    const first = binding("probeA"), second = binding("probeB");
    const shared = !!first && !!second && sameNet(first,"a",second,"a");
    // Hole classification stays in canonical hardware-core; nets include actual learner wires.
    if (left && right && a?.breadboardId === b?.breadboardId) {
      const terminal = /^[A-J]\d+$/.test(left.id) && /^[A-J]\d+$/.test(right.id);
      pass = goal === "row" ? terminal && left.strip === right.strip && shared : goal === "gap" ? terminal && left.id.slice(1) === right.id.slice(1) && left.strip !== right.strip && !shared : !terminal && left.strip === right.strip && shared;
      facts.push(`${left.id} and ${right.id} are on ${shared ? "one derived net" : "separate derived nets"}.`);
    }
    feedback = pass ? "Connected as expected." : "Insert the A lead from each teaching resistor into the requested holes. Remove a lead before moving it.";
    answer = goal === "row" ? "First resistor A → A12; second resistor A → E12." : goal === "gap" ? "First resistor A → A12; second resistor A → F12. Remove any jumper joining the two strips." : "First resistor A → L+1; second resistor A → L+5. This rail remains unpowered.";
  } else {
    const led = driver("led","led-passive"), button = driver("button","momentary-switch"), oled = driver("oled","ssd1306-i2c");
    answer = goal.startsWith("led") ? `${gpio?.toUpperCase()} → resistor A; resistor B → LED ANODE; LED CATHODE → GND. Any equivalent valid net path also works.` :
      goal.startsWith("button") ? `${gpio?.toUpperCase()} → button A; button B → GND. Then Simulate → Press / Release button.` :
      goal.startsWith("oled") ? `${supply?.toUpperCase()} → OLED VCC; GND → OLED GND; ${board.i2cPins?.[0].toUpperCase()} → SDA; ${board.i2cPins?.[1].toUpperCase()} → SCL. Logic: Timer → OLED show HELLO; Simulate → Play.` : "Inspect the canonical BONK Button pressed rule, then simulate a press.";
    const diagnostics = analyzeCircuit(project);
    facts.push(...diagnostics.slice(0,3).map(d => d.message));
    if (led) facts.push(`LED has a series resistor from ${led.boardPin?.toUpperCase()} and a ground return.`);
    if (button) facts.push(`Button input is ${button.boardPin?.toUpperCase()} with the other contact grounded.`);
    if (oled) facts.push(`OLED supply, ground and canonical I²C pins are connected.`);
    if (goal === "led-path") pass = !!led;
    if (goal === "button-path") pass = !!button;
    if (goal === "oled-path") pass = !!oled;
    if (goal === "led-on" || goal === "led-off") pass = !!led && !!snapshot?.trace.some(t => t.componentId === roles.led && t.code === "led.state" && t.value === (goal === "led-on" ? "ON" : "OFF"));
    if (goal === "button-pressed" || goal === "button-released") {
      const edge = goal === "button-pressed" ? "button.press" : "button.release";
      pass = !!button && !!snapshot?.trace.some(t => t.code === "gpio.input" && t.pinId === button.boardPin && t.value === (goal === "button-pressed" ? "LOW" : "HIGH") && causalChain(snapshot.trace,t.id).some(c => c.code === edge && c.componentId === roles.button));
    }
    if (goal === "oled-text") pass = !!oled && snapshot?.outputs[roles.oled!]?.text === "HELLO" && !!snapshot.trace.some(t => t.code === "i2c.text" && t.netId === oled.component.pins.sda && t.value === "HELLO");
    const bonkRule = project.logic.find(r => r.enabled && r.when.kind === "button" && r.when.componentId === roles.button && r.when.edge === "pressed" && !r.if.length &&
      r.do.some(a => a.kind === "led" && a.componentId === roles.led && a.operation === "on") && r.do.some(a => a.kind === "oled" && a.componentId === roles.oled && a.operation === "show" && a.text === "BONK!") && r.do.some(a => a.kind === "buzzer" && a.componentId === roles.buzzer && a.count === 2));
    if (goal === "bonk-logic") pass = !!bonkRule && !diagnostics.length;
    if (goal === "bonk-output") pass = !!bonkRule && !!button && !!led && !!oled && snapshot?.outputs[roles.oled!]?.text === "BONK!" && snapshot.outputs[roles.led!]?.on === true && snapshot.trace.filter(t => t.componentId === roles.buzzer && t.code === "buzzer.state" && t.value === "ON").length >= 2;
    feedback = pass ? "Goal verified from your circuit." : diagnostics[0]?.message ?? "The topology is ready. Use the requested simulation or saved Logic behavior to produce evidence.";
    if (snapshot) facts.push(...snapshot.trace.slice(-4).map(t => describeTrace(t,circuit)));
  }
  return {pass,feedback,facts,answer};
}
