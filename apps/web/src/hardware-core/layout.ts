import type { ComponentInstanceV3 } from "../projects/v3.js";
import type { Transform } from "../projects/schema.js";
import { getDefinition } from "../component-library/catalog.js";
const slots: [number,number][] = [[2.9,1.7],[2.9,-1.7],[-2.8,1.7],[-2.8,-1.7],[0,2.1],[0,-2.1],[4.2,0],[-4.2,0]];
// ponytail: bounded shelf placement for the current catalog; use footprint packing for large builds.
export function layoutComponents(components: ComponentInstanceV3[], existing: Record<string, Transform>): Record<string, Transform> {
  const entities = Object.fromEntries(Object.entries(existing).filter(([id,t])=>t && components.some(c=>c.id===id))), breadboard = components.find(c=>c.kind === "breadboard");
  for (const part of components.filter(c=>c.kind === "component")) {
    if (entities[part.id]) continue;
    const model = getDefinition(part.definitionId)!.electricalModel;
    const preferred: [number,number] | undefined = breadboard ? model === "ssd1306-i2c" ? [1.6,2.1] : model === "buzzer" ? [3.5,-1.7] : model === "pir" || model === "dht11" ? [3.6,1] : undefined : undefined;
    const candidates = preferred ? [preferred,...slots] : slots;
    const [x,y] = candidates.find(([x,y]) => Object.entries(entities).every(([id,t]) => {
      const other=components.find(c=>c.id===id);
      const halfX=other?.kind === "breadboard" ? 1.1*t.scale[0] : other?.kind === "board" ? .65*t.scale[0] : .55*t.scale[0];
      const halfY=other?.kind === "breadboard" ? 1.53*t.scale[2] : other?.kind === "board" ? 1.1*t.scale[2] : .45*t.scale[0];
      return Math.abs(x-t.position[0]) > halfX+.6 || Math.abs(y-t.position[1]) > halfY+.5;
    })) ?? [4.2,2.6];
    entities[part.id] = {position:[x,y,.25],rotation:[0,0,0],scale:[1.25,1.25,1.25]};
  }
  return entities;
}
