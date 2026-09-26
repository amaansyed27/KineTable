import { getDefinition } from "../component-library/catalog.js";
import { connectedHoles, getHole } from "../hardware-core/breadboard.js";
import { netFor, resolveNets } from "../hardware-core/nets.js";
import { endpointKey, pinEndpoint, type ElectricalEndpoint } from "../projects/v3.js";
import type { CircuitProject } from "../projects/v4.js";

export function endpointLabel(project: CircuitProject, endpoint: ElectricalEndpoint): string {
  if (endpoint.kind === "breadboard-hole") {
    const strip = getHole(endpoint.holeId)?.strip ?? endpoint.holeId;
    return `Breadboard ${endpoint.holeId} (${strip.startsWith("left") ? "A–E" : strip.startsWith("right") ? "F–J" : strip} strip)`;
  }
  const part = project.components.find(c => c.id === endpoint.componentId);
  return `${part ? getDefinition(part.definitionId)?.name : endpoint.componentId} ${endpoint.pinId.toUpperCase()}`;
}
export function inspectComponent(project: CircuitProject, id: string) {
  const component = project.components.find(c => c.id === id);
  if (!component) return null;
  const definition = getDefinition(component.definitionId)!;
  if (component.kind === "breadboard") return { name: definition.name, description: definition.description, category: definition.category,
    supply: undefined, model: definition.electricalModel, pins: [],
    explanation: "A–E and F–J each share numbered strips. The center gap separates them. Each marked power rail is continuous in this model." };
  const nets = resolveNets(project);
  const pins = definition.pins.map(pin => {
    const own = pinEndpoint(id, pin.id);
    const peers = (netFor(nets, own)?.endpoints ?? []).filter(e => e.kind === "pin" && endpointKey(e) !== endpointKey(own));
    return { id: pin.id, role: pin.role, connections: peers.map(e => endpointLabel(project, e)) };
  });
  return { name: definition.name, description: definition.description, category: definition.category,
    supply: definition.supply, model: definition.electricalModel, pins, explanation: undefined };
}
export function inspectWire(project: CircuitProject, id: string) {
  const wire = project.wires.find(w => w.id === id);
  if (!wire) return null;
  const net = netFor(resolveNets(project), wire.from);
  return { from: endpointLabel(project, wire.from), to: endpointLabel(project, wire.to), netPins: net?.endpoints.filter(e => e.kind === "pin").map(e => endpointLabel(project, e)) ?? [] };
}
export function inspectHole(project: CircuitProject, breadboardId: string, holeId: string) {
  const hole = getHole(holeId);
  if (!hole || !project.components.some(c => c.id === breadboardId && c.kind === "breadboard")) return null;
  const endpoint: ElectricalEndpoint = { kind: "breadboard-hole", breadboardId, holeId };
  const net = netFor(resolveNets(project), endpoint);
  return { holeId, strip: hole.strip, connectedHoles: connectedHoles(holeId).map(h => h.id),
    connectedPins: net?.endpoints.filter(e => e.kind === "pin").map(e => endpointLabel(project, e)) ?? [] };
}
