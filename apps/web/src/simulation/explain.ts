import { powerNet, type CompiledCircuit } from "./compileCircuit.js";
import type { Snapshot, TraceEvent } from "./runtime.js";

export type XRayMode = "power" | "signals" | "data" | "all";
export type XRayNet = { id: string; kind: "power" | "signals" | "data"; label: string; wires: string[]; endpoints: string[] };
export function xrayNets(circuit: CompiledCircuit, snapshot: Snapshot | null, mode: XRayMode): XRayNet[] {
  const result: XRayNet[] = [];
  for (const net of circuit.nets) {
    const supply = powerNet(circuit, net.id);
    const pins = net.endpoints.filter(e => e.kind === "pin").map(e => {
      const binding = circuit.bindings.find(b => b.id === e.componentId)!;
      return binding.definition.pins.find(p => p.id === e.pinId)!;
    });
    const kind = supply !== undefined ? "power" : pins.some(p => p.role === "i2c-sda" || p.role === "i2c-scl" || p.id === "data") ? "data" : pins.some(p => p.role.startsWith("digital")) ? "signals" : null;
    if (!kind || (mode !== "all" && kind !== mode)) continue;
    if (kind !== "power" && net.endpoints.length < 2) continue;
    const signal = snapshot?.signals[net.id];
    const label = kind === "power" ? supply === "ground" ? "Ground" : `${supply} V supply` : kind === "data" ? signal?.kind === "data" ? `${signal.protocol.toUpperCase()} data: ${signal.value}` : "Semantic data path" : signal?.kind === "digital" ? `GPIO ${signal.value ? "HIGH" : "LOW"}` : "Signal path (inactive)";
    result.push({ id: net.id, kind, label, wires: circuit.wiresByNet.get(net.id) ?? [], endpoints: net.endpoints.map(e => e.kind === "pin" ? `pin:${e.componentId}:${e.pinId}` : `hole:${e.breadboardId}:${e.holeId}`) });
  }
  return result;
}

export function causalChain(trace: TraceEvent[], eventId: number): TraceEvent[] {
  const byId = new Map(trace.map(event => [event.id, event]));
  const chain: TraceEvent[] = [];
  const seen = new Set<number>();
  let event = byId.get(eventId);
  while (event && !seen.has(event.id)) { chain.unshift(event); seen.add(event.id); event = event.causedBy ? byId.get(event.causedBy) : undefined; }
  return chain;
}
export function latestForComponent(snapshot: Snapshot, componentId: string): TraceEvent | undefined {
  return [...snapshot.trace].reverse().find(event => event.componentId === componentId && ["led.state", "buzzer.state", "oled.text", "button.press", "button.release", "pir.trigger", "pir.clear", "dht.environment"].includes(event.code));
}
export function describeTrace(event: TraceEvent, circuit: CompiledCircuit): string {
  const name = circuit.bindings.find(b => b.id === event.componentId)?.definition.name ?? "Circuit";
  const value = event.value ? ` ${event.value}` : "";
  switch (event.code) {
    case "button.press": return `${name} pressed.`;
    case "button.release": return `${name} released.`;
    case "pir.trigger": return `${name} detected simulated motion.`;
    case "pir.clear": return `${name} motion interval ended.`;
    case "gpio.input": return `${name} ${event.pinId?.toUpperCase()} input became${value}.`;
    case "gpio.output": return `${name} ${event.pinId?.toUpperCase()} output became${value}.`;
    case "led.state": return `${name} became${value} in this simulation.`;
    case "buzzer.state": return `${name} became${value} in this simulation.`;
    case "oled.text": return `${name} displayed “${event.value}”.`;
    case "dht.environment": return `${name} virtual environment changed to${value}.`;
    case "dht.read": return `${name} read DHT11 data:${value}.`;
    case "i2c.text": return `${name} sent OLED text over semantic I²C.`;
    case "logic.rule.match": return `Project rule ${event.ruleId} matched.`;
    case "logic.condition.false": return `Project rule ${event.ruleId} did not run: ${event.value}.`;
    case "logic.condition.true": return `Project rule ${event.ruleId} passed its condition: ${event.value}.`;
    case "logic.action": return `Project rule ${event.ruleId} applied ${event.value} to ${name}.`;
    case "logic.beep": return `${name} continued its saved beep sequence.`;
    case "timer.tick": return `Timer for project rule ${event.ruleId} fired.`;
    default: return event.code.startsWith("recipe.") ? `The ${event.code.slice(7)} recipe reacted.` : `${name}: ${event.code}${value}.`;
  }
}
