import { getDefinition, type Definition } from "../component-library/catalog.js";
import { resolveNets, type Net } from "../hardware-core/nets.js";
import { analyzeCircuit, validateElectricalSafety } from "../hardware-core/validation.js";
import { endpointKey, pinEndpoint, type KinetableProjectV3 } from "../projects/v3.js";
import { bindDriver, driverRegistry } from "./drivers.js";

export type Binding = { id: string; definition: Definition; pins: Record<string, string> };
export type CompiledCircuit = {
  topologyKey: string; nets: Net[]; endpointToNet: Map<string, string>; bindings: Binding[];
  board: Binding; wiresByNet: Map<string, string[]>;
};

export function topologyKey(project: KinetableProjectV3): string {
  return JSON.stringify({
    components: project.components.map(c => [c.id, c.definitionId]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))),
    wires: project.wires.map(w => `${w.id}:${[endpointKey(w.from), endpointKey(w.to)].sort().join("|")}`).sort(),
    placements: project.terminalPlacements.map(p => `${p.componentId}:${p.pinId}:${p.breadboardId}:${p.holeId}`).sort(),
  });
}

const MAX_COMPILED_CACHE = 16;
const compiledCache = new Map<string, CompiledCircuit>();
function cacheCompiled(key: string, circuit: CompiledCircuit): CompiledCircuit {
  compiledCache.set(key, circuit);
  if (compiledCache.size > MAX_COMPILED_CACHE) {
    const oldest = compiledCache.keys().next().value as string | undefined;
    if (oldest) compiledCache.delete(oldest);
  }
  return circuit;
}

export function compileCircuit(project: KinetableProjectV3): CompiledCircuit {
  const key = topologyKey(project);
  const cacheKey = `${project.id}:${key}`;
  const cached = compiledCache.get(cacheKey);
  if (cached) {
    compiledCache.delete(cacheKey);
    compiledCache.set(cacheKey, cached);
    return cached;
  }
  validateElectricalSafety(project);
  const nets = resolveNets(project);
  const endpointToNet = new Map(nets.flatMap(net => net.endpoints.map(e => [endpointKey(e), net.id] as const)));
  const bindings = project.components.map(c => {
    const definition = getDefinition(c.definitionId)!;
    return { id: c.id, definition, pins: Object.fromEntries(definition.pins.map(p => [p.id, endpointToNet.get(endpointKey(pinEndpoint(c.id, p.id)))!])) };
  });
  const wiresByNet = new Map<string, string[]>();
  for (const wire of project.wires) {
    const net = endpointToNet.get(endpointKey(wire.from))!;
    wiresByNet.set(net, [...(wiresByNet.get(net) ?? []), wire.id]);
  }
  return cacheCompiled(cacheKey, { topologyKey: key, nets, endpointToNet, bindings, board: bindings.find(b => b.definition.kind === "board")!, wiresByNet });
}

export function sameNet(a: Binding, aPin: string, b: Binding, bPin: string): boolean {
  return !!a.pins[aPin] && a.pins[aPin] === b.pins[bPin];
}
export function boardPin(circuit: CompiledCircuit, binding: Binding, pin: string): string | undefined {
  return circuit.board.definition.pins.find(p => p.role === "digital-io" && sameNet(binding, pin, circuit.board, p.id))?.id;
}
export function byModel(circuit: CompiledCircuit, model: Definition["electricalModel"]): Binding[] {
  return circuit.bindings.filter(b => b.definition.electricalModel === model);
}
export function powerNet(circuit: CompiledCircuit, netId: string): number | "ground" | undefined {
  const pins = circuit.nets.find(n => n.id === netId)?.endpoints ?? [];
  for (const e of pins) if (e.kind === "pin") {
    const binding = circuit.bindings.find(b => b.id === e.componentId)!;
    if (binding.definition.kind !== "board") continue;
    const p = binding.definition.pins.find(p => p.id === e.pinId)!;
    if (p.role === "ground") return "ground";
    if (p.role === "power") return p.volts;
  }
}

export type Compatibility = { status: "supported" | "unsupported"; diagnostics: string[]; circuit?: CompiledCircuit };
export function analyzeSimulationCompatibility(project: KinetableProjectV3): Compatibility {
  try {
    const incomplete = analyzeCircuit(project);
    if (incomplete.length) return { status: "unsupported", diagnostics: [incomplete[0].message] };
    const circuit = compileCircuit(project);
    const missing = circuit.bindings.filter(b => !driverRegistry[b.definition.electricalModel]);
    if (missing.length) return { status: "unsupported", diagnostics: missing.map(b => `Kinetable can’t simulate ${b.definition.name} yet.`) };
    const supportedResistors = new Set(bindDriver(circuit,"led-passive").map(b => b.resistor?.id));
    const unbound = circuit.bindings.find(b => b.definition.kind === "component" && (b.definition.electricalModel === "resistor" ? !supportedResistors.has(b.id) : !bindDriver(circuit,b.definition.electricalModel).some(match => match.component.id === b.id)));
    if (unbound) return { status: "unsupported", diagnostics: [`${unbound.definition.name} has no supported simulation topology yet.`] };
    return { status: "supported", diagnostics: [], circuit };
  } catch (error) {
    return { status: "unsupported", diagnostics: [error instanceof Error ? error.message : "Couldn’t compile this circuit."] };
  }
}
