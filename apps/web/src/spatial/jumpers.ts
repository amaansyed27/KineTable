import { CubicBezierCurve3, Euler, Vector3 } from "three";
import { netFor, resolveNets } from "../hardware-core/nets";
import type { CircuitProject } from "../projects/v4";
import type { ElectricalEndpoint } from "../projects/v3";

/** Presentation follows electrical continuity, including breadboard strips. */
export function jumperColors(project: CircuitProject): Map<string, string> {
  const nets = resolveNets(project), colors = new Map<string, string>(), wires = new Map<string, string>();
  const palette = ["#e36f59", "#60afd1", "#e5c35b", "#8fc779", "#b68cda", "#57c8b3", "#ec93ba", "#df9d53"];
  for (const wire of project.wires) {
    const net = netFor(nets, wire.from)!.id;
    if (!colors.has(net)) colors.set(net, palette[colors.size] ?? `hsl(${(colors.size * 137.508) % 360}, 65%, 62%)`);
    wires.set(wire.id, colors.get(net)!);
  }
  return wires;
}

/** Mating direction of a visible header; passive leads have no jumper housing. */
export function headerDirection(project: CircuitProject, endpoint: ElectricalEndpoint): Vector3 | undefined {
  const id = endpoint.kind === "pin" ? endpoint.componentId : endpoint.breadboardId;
  const part = project.components.find(c => c.id === id)!;
  const axis = part.kind === "board" || part.kind === "breadboard" ? new Vector3(0, 1, 0)
    : part.definitionId === "dht11-module" ? new Vector3(0, -1, 0) : undefined;
  return axis?.applyEuler(new Euler(...project.layout.entities[id].rotation)).normalize();
}

export function jumperCurve(from: Vector3, to: Vector3, lane = 0, start?: Vector3, end?: Vector3): CubicBezierCurve3 {
  const distance = from.distanceTo(to), lift = Math.min(.9, .24 + distance * .12);
  const bow = new Vector3(to.y - from.y, from.x - to.x, 0).normalize().multiplyScalar((lane % 2 ? -1 : 1) * Math.min(.75, .2 + distance * .1 + lane % 4 * .07));
  const a = from.clone().lerp(to, .22).add(bow), b = from.clone().lerp(to, .78).add(bow);
  a.z = b.z = Math.max(from.z, to.z) + lift;
  if (start) a.addScaledVector(start, .35);
  if (end) b.addScaledVector(end, .35);
  return new CubicBezierCurve3(from.clone(), a, b, to.clone());
}
