import { catalog, type Definition } from "./catalog.js";
import { compatibility } from "./compatibility.js";
export type SearchOptions = { query?: string; category?: string; boardId?: string; compatibleOnly?: boolean; simulatedOnly?: boolean };
export function searchLibrary(options: SearchOptions = {}): Definition[] {
  const q = options.query?.trim().toLocaleLowerCase() ?? "";
  return catalog.filter(d => (!options.category || d.category === options.category) &&
    (!options.compatibleOnly || !options.boardId || compatibility(d.id, options.boardId).status === "supported") &&
    (!options.simulatedOnly || d.simulation !== "not-modeled") &&
    (!q || [d.name, d.description, d.category, d.model, d.manufacturer, d.electricalModel, ...d.aliases].filter(Boolean).join(" ").toLocaleLowerCase().includes(q)));
}
