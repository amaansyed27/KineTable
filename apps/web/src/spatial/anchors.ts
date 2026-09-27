import { Euler, Vector3 } from "three";
import { catalog } from "../component-library/catalog.js";
import { leadAnchors } from "../component-library/leadAnchors.js";
import { getHole } from "../hardware-core/breadboard.js";
import type { ElectricalEndpoint } from "../projects/v3.js";
import type { CircuitProject } from "../projects/v4.js";

/** Coordinates are presentation data, keyed by stable electrical pin IDs. */
export const pinAnchors: Record<string, Record<string, [number, number, number]>> = {
  "esp32-dev-module": { gpio18: [-.53,.205,-.755], gpio19: [-.53,.205,-.63], gpio21: [-.53,.205,-.505], gpio22: [-.53,.205,-.38], gpio23: [-.53,.205,-.255], gpio27: [-.53,.205,-.13], "3v3": [.53,.205,-.755], vin: [.53,.205,-.63], gnd: [.53,.205,-.505] },
  "raspberry-pi-pico": { gpio16: [-.36,.205,-.755], gpio17: [-.36,.205,-.63], gpio18: [-.36,.205,-.505], gpio19: [-.36,.205,-.38], gpio20: [-.36,.205,-.255], gpio21: [-.36,.205,-.13], "3v3": [.36,.205,-.755], vbus: [.36,.205,-.63], gnd: [.36,.205,-.505] },
  "arduino-uno": Object.fromEntries(["d2","d3","d4","d5","d6","d7","d8","d9","d10","d11","d12","d13","a4","a5"].map((pin, i) => [pin, [.97 * .82,.26 * .82,(-.87 + i * .14) * .82]])),
  ...leadAnchors,
  "grove-buzzer-v1-1": { vcc: [-.2,-.3,0], gnd: [0,-.3,0], sig: [.2,-.3,0] },
  "hc-sr501": { vcc: [-.15,-.38,0], gnd: [0,-.38,0], out: [.15,-.38,0] },
  "oled-ssd1306-i2c-3v3": { vcc: [-.21,-.32,.02], gnd: [-.07,-.32,.02], sda: [.07,-.32,.02], scl: [.21,-.32,.02] },
  "dht11-module": { vcc: [-.16,-.48,.02], gnd: [0,-.48,.02], data: [.16,-.48,.02] },
};
Object.assign(pinAnchors["arduino-uno"], { "5v": [-.97*.82,.26*.82,-.87*.82], "3v3": [-.97*.82,.26*.82,-.73*.82], gnd: [-.97*.82,.26*.82,-.59*.82] });
export function endpointLocal(project: CircuitProject, endpoint: ElectricalEndpoint): [number, number, number] {
  if (endpoint.kind === "breadboard-hole") {
    const hole = getHole(endpoint.holeId);
    if (!hole) throw new Error(`Missing breadboard hole ${endpoint.holeId}`);
    return [hole.x, .122, hole.y];
  }
  const definition = project.components.find(c => c.id === endpoint.componentId)?.definitionId;
  const anchor = definition && pinAnchors[definition]?.[endpoint.pinId];
  if (!anchor) throw new Error(`Missing visual pin anchor ${definition ?? endpoint.componentId}:${endpoint.pinId}`);
  return anchor;
}
export function endpointWorld(project: CircuitProject, endpoint: ElectricalEndpoint): Vector3 {
  const id = endpoint.kind === "pin" ? endpoint.componentId : endpoint.breadboardId;
  const transform = project.layout.entities[id];
  if (!transform) throw new Error(`Missing layout for ${id}`);
  return new Vector3(...endpointLocal(project, endpoint)).multiply(new Vector3(...transform.scale))
    .applyEuler(new Euler(...transform.rotation)).add(new Vector3(...transform.position));
}
export function assertAnchorCoverage() {
  for (const definition of catalog) for (const pin of definition.pins)
    if (!pinAnchors[definition.id]?.[pin.id]) throw new Error(`Missing anchor ${definition.id}:${pin.id}`);
}
