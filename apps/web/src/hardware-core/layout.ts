import type { ComponentInstanceV3 } from "../projects/v3.js";
import type { Transform } from "../projects/schema.js";
// ponytail: five fixed slots cover this catalog; use footprint packing when builds exceed five parts.
export function layoutComponents(components: ComponentInstanceV3[], existing: Record<string, Transform>): Record<string, Transform> {
  const entities = { ...existing };
  const parts = components.filter(c => c.kind === "component");
  const slots: [number, number][] = components.some(c => c.kind === "breadboard")
    ? [[2.8,.25],[2.8,-1.65],[0,2],[0,-2],[-2.7,-1.8]]
    : [[-2.8,.25],[2.8,.25],[-2.7,-1.65],[2.7,-1.65],[0,2]];
  parts.forEach((part, index) => {
    if (entities[part.id]) return;
    const [x,y] = slots[index] ?? [0,0];
    entities[part.id] = { position: [x, y, .2], rotation: [0, 0, 0], scale: [1.6, 1.6, 1.6] };
  });
  return entities;
}
