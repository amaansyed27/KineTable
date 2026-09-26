import { getDefinition } from "../component-library/catalog.js";
import { holes } from "./breadboard.js";
import { endpointKey, holeEndpoint, pinEndpoint, type ElectricalEndpoint } from "../projects/v3.js";
import type { CircuitProject } from "../projects/v4.js";

export type Net = { id: string; endpoints: ElectricalEndpoint[] };
/** Conductors join endpoints; component internals (including LED/resistor/button) do not. */
export function resolveNets(project: CircuitProject): Net[] {
  const parent = new Map<string, string>();
  const endpoints = new Map<string, ElectricalEndpoint>();
  const add = (e: ElectricalEndpoint) => { const k = endpointKey(e); parent.set(k, k); endpoints.set(k, e); };
  const root = (key: string): string => {
    const p = parent.get(key)!;
    if (p === key) return key;
    const r = root(p); parent.set(key, r); return r;
  };
  const join = (a: ElectricalEndpoint, b: ElectricalEndpoint) => {
    const ra = root(endpointKey(a)), rb = root(endpointKey(b));
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  };
  for (const component of project.components) {
    if (component.kind === "breadboard") for (const hole of holes) add(holeEndpoint(component.id, hole.id));
    else for (const pin of getDefinition(component.definitionId)!.pins) add(pinEndpoint(component.id, pin.id));
  }
  for (const component of project.components.filter(c => c.kind === "breadboard")) {
    const first = new Map<string, ElectricalEndpoint>();
    for (const hole of holes) {
      const endpoint = holeEndpoint(component.id, hole.id);
      const previous = first.get(hole.strip);
      if (previous) join(previous, endpoint); else first.set(hole.strip, endpoint);
    }
  }
  for (const wire of project.wires) join(wire.from, wire.to);
  for (const placement of project.terminalPlacements) join(pinEndpoint(placement.componentId, placement.pinId), holeEndpoint(placement.breadboardId, placement.holeId));
  const groups = new Map<string, ElectricalEndpoint[]>();
  for (const [key, endpoint] of endpoints) {
    const r = root(key);
    groups.set(r, [...(groups.get(r) ?? []), endpoint]);
  }
  return [...groups.values()].map(group => ({ id: group.map(endpointKey).sort()[0], endpoints: group.sort((a,b) => endpointKey(a).localeCompare(endpointKey(b))) })).sort((a,b) => a.id.localeCompare(b.id));
}
export function netFor(nets: Net[], endpoint: ElectricalEndpoint): Net | undefined {
  const key = endpointKey(endpoint);
  return nets.find(net => net.endpoints.some(e => endpointKey(e) === key));
}
