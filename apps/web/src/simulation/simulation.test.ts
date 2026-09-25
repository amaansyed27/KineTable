import { expect, it, vi } from "vitest";
import { starterProject } from "../projects/schema";
import { migrateProject, pinEndpoint, type KinetableProjectV3 } from "../projects/v3";
import { layoutComponents } from "../hardware-core/layout";
import { analyzeSimulationCompatibility, compileCircuit, topologyKey } from "./compileCircuit";
import { availableRecipes } from "./recipes";
import { SimulationRuntime } from "./runtime";
import { causalChain, latestForComponent, xrayNets } from "./explain";
import { useSimulationStore } from "../state/simulationStore";
import { localProjectRepository } from "../persistence/localProjectRepository";
import { cloudProjectRepository } from "../persistence/cloudProjectRepository";

type Part = [string, string];
type Link = [string, string, string, string];
function project(parts: Part[], links: Link[]): KinetableProjectV3 {
  const p = migrateProject(starterProject("esp32-dev-module"));
  for (const [id, definitionId] of parts) p.components.push({ id, definitionId, kind: "component" });
  p.layout.entities = layoutComponents(p.components, p.layout.entities);
  p.wires = links.map(([a, ap, b, bp], i) => ({ id: `wire-${i}`, from: pinEndpoint(a, ap), to: pinEndpoint(b, bp) }));
  return p;
}
const board = "board-main";
const led: Part[] = [["led-1", "led-5mm"], ["resistor-1", "resistor-220r"]];
const ledLinks: Link[] = [[board,"gpio23","resistor-1","a"],["resistor-1","b","led-1","anode"],["led-1","cathode",board,"gnd"]];
const button: Part[] = [["button-1", "push-button"]];
const buttonLinks: Link[] = [[board,"gpio18","button-1","a"],["button-1","b",board,"gnd"]];
const buzzer: Part[] = [["buzzer-1", "grove-buzzer-v1-1"]];
const buzzerLinks: Link[] = [[board,"3v3","buzzer-1","vcc"],[board,"gnd","buzzer-1","gnd"],[board,"gpio19","buzzer-1","sig"]];
const pir: Part[] = [["pir-1", "hc-sr501"]];
const pirLinks: Link[] = [[board,"vin","pir-1","vcc"],[board,"gnd","pir-1","gnd"],[board,"gpio27","pir-1","out"]];
const oled: Part[] = [["oled-1", "oled-ssd1306-i2c-3v3"]];
const oledLinks: Link[] = [[board,"3v3","oled-1","vcc"],[board,"gnd","oled-1","gnd"],[board,"gpio21","oled-1","sda"],[board,"gpio22","oled-1","scl"]];
const dht: Part[] = [["dht-1", "dht11-module"]];
const dhtLinks: Link[] = [[board,"3v3","dht-1","vcc"],[board,"gnd","dht-1","gnd"],[board,"gpio18","dht-1","data"]];
function runtime(p: KinetableProjectV3, id: string) { const c = compileCircuit(p), recipe = availableRecipes(c).find(r => r.id === id)!; expect(recipe).toBeDefined(); return new SimulationRuntime(c, recipe); }

it("compiles topology once across layout changes and keeps incomplete circuits separate from simulation", () => {
  const p = project(led, ledLinks);
  const first = compileCircuit(p);
  const moved = structuredClone(p); moved.layout.entities["led-1"].position[0] += 1;
  expect(topologyKey(moved)).toBe(topologyKey(p));
  expect(compileCircuit(moved)).toBe(first);
  const anotherProject = structuredClone(p);
  anotherProject.id = "11111111-1111-4111-8111-111111111111";
  expect(topologyKey(anotherProject)).toBe(topologyKey(p));
  expect(compileCircuit(anotherProject)).not.toBe(first);
  expect(compileCircuit(p)).toBe(first);
  expect(first.endpointToNet.get("pin:board-main:gpio23")).toBe(first.endpointToNet.get("pin:resistor-1:a"));
  expect(first.endpointToNet.get("pin:resistor-1:b")).not.toBe(first.endpointToNet.get("pin:resistor-1:a"));
  const incomplete = structuredClone(p); incomplete.wires.pop();
  expect(analyzeSimulationCompatibility(incomplete).status).toBe("unsupported");
  expect(analyzeSimulationCompatibility(p).status).toBe("supported");
  const otherResistor = project([["resistor-1","resistor-220r"]], [[board,"gpio23","resistor-1","a"],["resistor-1","b",board,"gpio19"]]);
  expect(analyzeSimulationCompatibility(otherResistor).diagnostics[0]).toMatch(/no supported simulation topology/);
});

it("does not offer behavior recipes when their semantic roles share one board GPIO", () => {
  const bonkProject = project([...button, ...led, ...buzzer, ...oled], [...buttonLinks, ...ledLinks, ...buzzerLinks, ...oledLinks]);
  const bonkCircuit = compileCircuit(bonkProject);
  const sharedBonkPin = {
    ...bonkCircuit,
    bindings: bonkCircuit.bindings.map(binding => binding.id === "buzzer-1" ? { ...binding, pins: { ...binding.pins, sig: bonkCircuit.board.pins.gpio23 } } : binding),
  };
  expect(availableRecipes(sharedBonkPin).map(recipe => recipe.id)).not.toContain("bonk");

  const alarmProject = project([...pir, ...buzzer], [...pirLinks, ...buzzerLinks]);
  const alarmCircuit = compileCircuit(alarmProject);
  const sharedAlarmPin = {
    ...alarmCircuit,
    bindings: alarmCircuit.bindings.map(binding => binding.id === "buzzer-1" ? { ...binding, pins: { ...binding.pins, sig: alarmCircuit.board.pins.gpio27 } } : binding),
  };
  expect(availableRecipes(sharedAlarmPin).map(recipe => recipe.id)).not.toContain("motion-alarm");

  const displayProject = project([...dht, ...oled], [...dhtLinks, ...oledLinks]);
  const displayCircuit = compileCircuit(displayProject);
  const sharedDataPin = {
    ...displayCircuit,
    bindings: displayCircuit.bindings.map(binding => binding.id === "dht-1" ? { ...binding, pins: { ...binding.pins, data: displayCircuit.board.pins.gpio21 } } : binding),
  };
  expect(availableRecipes(sharedDataPin).map(recipe => recipe.id)).not.toContain("dht11-oled");
});

it("uses logical time for blink and reports the driven resistor/LED path", () => {
  const p = project(led, ledLinks), a = runtime(p, "blink-led"), b = runtime(p, "blink-led");
  a.advanceTo(500); b.advanceBy(120); b.advanceBy(380);
  expect(a.snapshot()).toEqual(b.snapshot());
  expect(a.snapshot().outputs["led-1"].on).toBe(true);
  expect(a.snapshot().signals[compileCircuit(p).bindings.find(c => c.id === "led-1")!.pins.anode]).toEqual({ kind: "digital", value: 1 });
  a.advanceTo(1000); expect(a.snapshot().outputs["led-1"].on).toBe(false);
  a.advanceTo(-1); expect(a.snapshot().error).toMatch(/forward/);
});

it("derives pull-up button state and a causal LED chain from actual nets", () => {
  const p = project([...button, ...led], [...buttonLinks, ...ledLinks]);
  const r = runtime(p, "button-led"), c = compileCircuit(p);
  expect(r.snapshot().signals[c.board.pins.gpio18]).toEqual({ kind: "digital", value: 1 });
  r.setButton("button-1", true);
  const snap = r.snapshot();
  expect(snap.signals[c.board.pins.gpio18]).toEqual({ kind: "digital", value: 0 });
  expect(snap.outputs["led-1"].on).toBe(true);
  expect(causalChain(snap.trace, latestForComponent(snap,"led-1")!.id).map(e => e.code)).toEqual(["button.press","gpio.input","recipe.button-led","gpio.output","led.state"]);
  expect(xrayNets(c, snap, "signals").some(n => n.label === "GPIO LOW" && n.id === c.board.pins.gpio18)).toBe(true);
  expect(xrayNets(c, snap, "power").some(n => n.label === "Ground")).toBe(true);
  expect(xrayNets(c, snap, "all").length).toBeGreaterThan(xrayNets(c, snap, "signals").length);
  r.setButton("button-1", false); expect(r.snapshot().outputs["led-1"].on).toBe(false);
});

it("keeps PIR HIGH for exactly 1000 ms and drives a buzzer through its GPIO", () => {
  const p = project([...pir, ...buzzer], [...pirLinks, ...buzzerLinks]);
  const r = runtime(p,"motion-alarm");
  r.triggerPir("pir-1"); expect(r.snapshot().outputs["buzzer-1"].on).toBe(true);
  r.advanceTo(999); expect(r.snapshot().outputs["buzzer-1"].on).toBe(true);
  r.advanceTo(1000); expect(r.snapshot().outputs["buzzer-1"].on).toBe(false);
  expect(causalChain(r.snapshot().trace, latestForComponent(r.snapshot(),"buzzer-1")!.id)[0].code).toBe("pir.trigger");
});

it("moves DHT11 data through the wired pin and displays semantic I²C text", () => {
  const p = project([...dht, ...oled], [...dhtLinks, ...oledLinks]);
  const r = runtime(p,"dht11-oled"), c = compileCircuit(p);
  r.setEnvironment(31, 64);
  expect(r.snapshot().outputs["oled-1"].text).toBe("31°C  64%");
  expect(r.snapshot().signals[c.board.pins.gpio18]).toEqual({ kind: "data", protocol: "dht11", value: "31 °C · 64%" });
  expect(xrayNets(c, r.snapshot(), "data").some(n => n.id === c.board.pins.gpio18)).toBe(true);
  r.setEnvironment(100, 64); expect(r.snapshot().error).toMatch(/0–50/);
});

it("BONK starts READY and records two 120 ms beep pulses", () => {
  const p = project([...button, ...led, ...buzzer, ...oled], [...buttonLinks, ...ledLinks, ...buzzerLinks, ...oledLinks]);
  const r = runtime(p,"bonk");
  expect(r.snapshot().outputs["oled-1"].text).toBe("READY");
  r.setButton("button-1", true);
  expect(r.snapshot().outputs["oled-1"].text).toBe("BONK!");
  expect(r.snapshot().outputs["led-1"].on).toBe(true);
  expect(r.snapshot().outputs["buzzer-1"].on).toBe(true);
  r.advanceTo(120); expect(r.snapshot().outputs["buzzer-1"].on).toBe(false);
  r.advanceTo(220); expect(r.snapshot().outputs["buzzer-1"].on).toBe(true);
  r.advanceTo(340); expect(r.snapshot().outputs["buzzer-1"].on).toBe(false);
  r.setButton("button-1", false);
  expect(r.snapshot().outputs["oled-1"].text).toBe("READY");
  expect(r.snapshot().outputs["led-1"].on).toBe(false);
});

it("bounds long-running traces and stops a runaway advance safely", () => {
  const r = runtime(project(led,ledLinks),"blink-led");
  r.advanceTo(3_000_000);
  expect(r.snapshot().error).toMatch(/event limit/);
  expect(r.snapshot().trace.length).toBeLessThanOrEqual(1000);
});

it("keeps playback, inputs and Explain out of project persistence", () => {
  const p = project([...button,...led], [...buttonLinks,...ledLinks]);
  const original = JSON.stringify(p);
  const local = vi.spyOn(localProjectRepository,"save");
  const cloud = vi.spyOn(cloudProjectRepository,"save");
  try {
    const actions = useSimulationStore.getState();
    actions.enter(p,"simulate"); actions.selectRecipe("button-led"); actions.play(); actions.advanceBy(120); actions.pause();
    actions.button("button-1",true); actions.reset(); actions.explain(); actions.setXray("all"); actions.selectTrace(null); actions.build();
    expect(JSON.stringify(p)).toBe(original);
    expect(local).not.toHaveBeenCalled();
    expect(cloud).not.toHaveBeenCalled();
  } finally { local.mockRestore(); cloud.mockRestore(); }
});

it("invalidates an active session when topology changes", () => {
  const p = project([...button,...led], [...buttonLinks,...ledLinks]);
  useSimulationStore.getState().enter(p,"simulate");
  const changed = structuredClone(p); changed.wires.pop();
  useSimulationStore.getState().ensure(changed);
  expect(useSimulationStore.getState().mode).toBe("build");
  expect(useSimulationStore.getState().runtime).toBeNull();
});
