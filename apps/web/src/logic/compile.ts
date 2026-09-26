import { bindDriver, type DriverBinding } from "../simulation/drivers.js";
import { analyzeSimulationCompatibility, boardPin, compileCircuit, topologyKey, type Binding, type CompiledCircuit } from "../simulation/compileCircuit.js";
import type { KinetableProjectV4 } from "../projects/v4.js";
import { isLogic, type Action, type Condition, type LogicRule, type Trigger } from "./schema.js";

export type CompiledTrigger = Trigger & { boardPin?: string; netId?: string };
export type CompiledCondition = Condition & { boardPin: string; netId: string };
export type CompiledAction = Action & { boardPin?: string; netId: string };
export type CompiledRule = { id: string; enabled: boolean; when: CompiledTrigger; if: CompiledCondition[]; do: CompiledAction[] };
export type CompiledBehaviorProgram = {
  id: "project-logic";
  name: string;
  description: string;
  rules: CompiledRule[];
  inputs: { buttons: Binding[]; pirs: Binding[]; dhts: Binding[] };
  inputPins: Record<string, string>;
  outputs: { leds: DriverBinding[]; buzzers: DriverBinding[]; oleds: DriverBinding[] };
};
type Model = Binding["definition"]["electricalModel"];
const expected: Record<Exclude<Trigger["kind"] | Action["kind"], "timer">, Model> = {
  button: "momentary-switch", pir: "pir", dht11: "dht11", led: "led-passive", oled: "ssd1306-i2c", buzzer: "buzzer",
};
function binding(circuit: CompiledCircuit, id: string, kind: keyof typeof expected): DriverBinding {
  const part = circuit.bindings.find(b => b.id === id);
  if (!part) throw new Error(`Logic references missing component ${id}. Update or remove its rule first.`);
  if (part.definition.electricalModel !== expected[kind]) throw new Error(`${part.definition.name} cannot be used as a ${kind} in Visual Logic.`);
  const result = bindDriver(circuit, expected[kind]).find(b => b.component.id === id);
  if (!result || (kind !== "oled" && !result.boardPin)) throw new Error(`${part.definition.name} needs a supported physical connection before this logic can run.`);
  return result;
}
function compileRule(circuit: CompiledCircuit, rule: LogicRule): CompiledRule {
  const when: CompiledTrigger = rule.when.kind === "timer" ? rule.when : (() => {
    const source = binding(circuit, rule.when.componentId, rule.when.kind);
    return { ...rule.when, boardPin: source.boardPin, netId: source.boardPin ? circuit.board.pins[source.boardPin] : undefined };
  })();
  const conditions = rule.if.map(c => {
    const source = binding(circuit, c.componentId, "dht11");
    return { ...c, boardPin: source.boardPin!, netId: source.component.pins.data };
  });
  const actions = rule.do.map((a): CompiledAction => {
    const target = binding(circuit, a.componentId, a.kind);
    return { ...a, boardPin: target.boardPin, netId: a.kind === "oled" ? target.component.pins.sda : circuit.board.pins[target.boardPin!] };
  });
  return { id: rule.id, enabled: rule.enabled, when, if: conditions, do: actions };
}
export function compileLogic(project: KinetableProjectV4, circuit = compileCircuit(project)): CompiledBehaviorProgram {
  if (!isLogic(project.logic)) throw new Error("Malformed Visual Logic document.");
  if (circuit.topologyKey !== topologyKey(project)) throw new Error("Visual Logic requires the current physical circuit.");
  const compatibility = analyzeSimulationCompatibility(project);
  if (compatibility.status !== "supported") throw new Error(compatibility.diagnostics[0]);
  const rules = project.logic.map(rule => compileRule(circuit, rule));
  const inputs = { buttons: bindDriver(circuit, "momentary-switch").map(b => b.component), pirs: bindDriver(circuit, "pir").map(b => b.component), dhts: bindDriver(circuit, "dht11").map(b => b.component) };
  const outputs = { leds: bindDriver(circuit, "led-passive"), buzzers: bindDriver(circuit, "buzzer"), oleds: bindDriver(circuit, "ssd1306-i2c") };
  const inputPins = Object.fromEntries(["momentary-switch", "pir", "dht11"].flatMap(model => bindDriver(circuit, model as Model).filter(b => b.boardPin).map(b => [b.component.id, b.boardPin!] as const)));
  const roles = [...Object.entries(inputPins).map(([id,pin]) => [pin,id]), ...[...outputs.leds,...outputs.buzzers].map(b => [b.boardPin!,b.component.id]), ...outputs.oleds.flatMap(b => ["sda","scl"].map(pin => [boardPin(circuit,b.component,pin)!,`${b.component.id}:${pin}`]))];
  const occupied = new Map<string,string>();
  for (const [pin,id] of roles) { if (occupied.has(pin) && occupied.get(pin) !== id) throw new Error(`Board pin ${pin} has conflicting behavior roles. Update the wiring first.`); occupied.set(pin,id); }
  return { id: "project-logic", name: "Project Logic", description: "Saved behavior from this project.", rules, inputs, inputPins, outputs };
}
export function validateLogic(project: KinetableProjectV4): void { if (project.logic.length) compileLogic(project); }
