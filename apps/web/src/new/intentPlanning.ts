import { getDefinition } from "../component-library/catalog";
import { executeCommands, type ProjectCommand } from "../hardware-core/commands";
import type { BoardId } from "../hardware/boards";
import type { InventoryItem } from "../persistence/inventoryRepository";
import { projectFromIntent, titleFromIntent } from "../projects/schema";
import { bonkCommands } from "../projects/starters";
import { migrateProject, type KinetableProjectV4 } from "../projects/v4";
import { planAssembly, type AssemblyPhase } from "../ai/assembleProject";

export type BuildProposal = { base: KinetableProjectV4; commands: ProjectCommand[]; status: "supported" | "unsupported"; summary: string; reason: string; source: "starter" | "provider" };
// ponytail: exact canonical phrases only; expand with reviewed intents, never keyword guessing.
export function matchesBonk(intent: string) {
  return /^(?:press a button(?: and)? (?:make it )?go bonk|make (?:a |the )?bonk(?: build)?|bonk)$/i.test(intent.replace(/[.!?]/g, " ").trim().replace(/\s+/g, " "));
}
export async function proposeBuild(board: BoardId, intent: string, name: string, inventory: InventoryItem[], useParts: boolean,
  onPhase: (phase: AssemblyPhase) => void): Promise<BuildProposal> {
  const base = migrateProject(projectFromIntent(null, board, intent, matchesBonk(intent) && name === titleFromIntent(intent) ? "BONK" : name));
  if (matchesBonk(intent)) {
    if (board !== "esp32-dev-module") return { base, commands: [], status: "unsupported", summary: "BONK needs ESP32", reason: "The canonical BONK build supports ESP32. Choose ESP32 explicitly, or describe a simpler build for your board.", source: "starter" };
    onPhase("checking");
    const commands = bonkCommands(base);
    executeCommands(base, commands);
    return { base, commands, status: "supported", summary: "Press the button: BONK on the display, LED on, two beeps.", reason: "", source: "starter" };
  }
  const context = useParts ? { mode: "prefer-owned" as const, items: inventory.filter(row => row.quantity > 0 && getDefinition(row.definitionId)?.kind === "component").map(row => ({ definitionId: row.definitionId, quantity: row.quantity })) } : undefined;
  // Unsaved proposals use the existing guest/BYOK boundary; no project is uploaded before approval.
  const plan = await planAssembly(base, onPhase, context);
  return { base, commands: plan.commands, status: plan.status, summary: plan.summary, reason: plan.unsupportedReason, source: "provider" };
}
export function proposalParts(proposal: BuildProposal, inventory: InventoryItem[]) {
  const candidate = executeCommands(proposal.base, proposal.commands);
  const quantities = new Map<string, number>();
  for (const part of candidate.components) quantities.set(part.definitionId, (quantities.get(part.definitionId) ?? 0) + 1);
  return [...quantities].map(([id, need]) => {
    const have = inventory.find(row => row.definitionId === id)?.quantity ?? 0;
    return { id, name: getDefinition(id)!.name, need, have, missing: Math.max(0, need - have) };
  });
}
