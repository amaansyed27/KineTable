import type { BoardId } from "../hardware/boards";
import { executeCommands, type ProjectCommand } from "../hardware-core/commands";
import { starterProject } from "../projects/schema";
import { migrateProject } from "../projects/v4";
import { bonkProject } from "../projects/starters";
import type { Mission } from "./missions";

export type Roles = Partial<Record<"probeA"|"probeB"|"led"|"resistor"|"button"|"oled"|"buzzer",string>>;
export function missionStarter(mission: Mission, board: BoardId) {
  if (!mission.boards.includes(board)) throw new Error("Choose a supported board for this mission.");
  const base = { ...migrateProject(starterProject(board)), name: `Learn · ${mission.title}` };
  if (mission.id === "bonk") return { document: bonkProject(base), roles: { led:"led-1",resistor:"resistor-1",button:"button-1",oled:"oled-1",buzzer:"buzzer-1" } satisfies Roles };
  const roles: Roles = {}, commands: ProjectCommand[] = [];
  if (mission.parts.includes("breadboard-half-400")) commands.push({type:"breadboard.add",id:"breadboard-1"}, {type:"layout.move",entityId:base.components[0].id,transform:{...base.layout.entities[base.components[0].id],position:[1.9,-.35,.25]}});
  const parts: [keyof Roles,string][] = mission.id === "breadboard" ? [["probeA","resistor-220r"],["probeB","resistor-220r"]] :
    mission.id === "button" ? [["button","push-button"]] : mission.id === "oled" ? [["oled","oled-ssd1306-i2c-3v3"]] : [["led","led-5mm"],["resistor","resistor-220r"]];
  for (const [role,definitionId] of parts) {
    const instanceId = `part-${crypto.randomUUID()}`;
    roles[role] = instanceId;
    commands.push({type:"component.add",instanceId,definitionId});
  }
  return { document: executeCommands(base,commands,base.metadata.updatedAt,"editor"), roles };
}
