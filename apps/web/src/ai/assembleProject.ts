import { useAuthStore } from "../auth/authStore";
import { executeCommands, HardwareError } from "../hardware-core/commands";
import { migrateProject } from "../projects/v4";
import { useProjectStore } from "../state/projectStore";
import { parsePlanRequest, parsePlanResponse, type PlanResponse, type InventorySnapshot } from "./contract";
import type { KinetableProjectV4 } from "../projects/v4";
import type { Session } from "@supabase/supabase-js";
import { loadProviderSettings } from "./providerSettings";
import { invokeProvider } from "./providerTransport";
import { routePlan, type Attempt } from "./routing";
import { inventoryRepository, inventoryOwner } from "../persistence/inventoryRepository";
import { syncInventory } from "../sync/inventorySync";
import { getDefinition } from "../component-library/catalog";

export type AssemblyPhase = "planning" | "checking" | "placing";
export async function planAssembly(current: KinetableProjectV4, onPhase: (phase: AssemblyPhase) => void,
  inventory?: InventorySnapshot, session: Session | null = null, inventorySynced = true) {
  const settings = loadProviderSettings();
  if (!settings.profile.routes.some(route => route.enabled)) throw new Error("NO_PROVIDER");
  const input = parsePlanRequest({ projectId: current.id, revision: current.metadata.updatedAt, intent: current.intent?.text, boardId: current.boardIds[0], ...(inventory ? { inventory } : {}) });
  onPhase("planning");
  const routed = await routePlan(settings.profile, settings.credentials, input, current, (route, credentialId) => {
    const remote = route.transport === "REMOTE_API" || route.transport === "CUSTOM_OPENAI_COMPATIBLE";
    if (inventory && session && remote && !inventorySynced) throw new Error("INVENTORY_SYNC_REQUIRED");
    return invokeProvider(route, credentialId, input, current, session);
  });
  const plan = parsePlanResponse(routed.plan);
  if (plan.status === "supported") { onPhase("checking"); executeCommands(current, plan.commands); }
  const routeLabel = `${routed.route.transport === "LOCAL_CLI" ? "Local CLI" : routed.route.transport === "LOCAL_HTTP" ? "Local" : "Your key"} · ${routed.route.providerId}`;
  return { ...plan, routeLabel, attempts: routed.attempts };
}
export async function assembleProject(onPhase: (phase: AssemblyPhase) => void, apply = true, ownedOnly = false): Promise<PlanResponse & { routeLabel: string; attempts: Attempt[] }> {
  const session = useAuthStore.getState().session;
  const settings = loadProviderSettings();
  if (!settings.profile.routes.some(route => route.enabled)) throw new Error("NO_PROVIDER");
  if (ownedOnly && session) await useProjectStore.getState().sync();
  let inventorySynced = true;
  if (ownedOnly && session) try { await syncInventory(session); } catch { inventorySynced = false; }
  const store = useProjectStore.getState();
  const starting = store.project;
  if (!starting?.document.intent || starting.document.components.length !== 1) throw new Error("INVALID_PROJECT");
  const current = useProjectStore.getState().project;
  if (!current || !current.document.intent || current.id !== starting.id || current.document.metadata.updatedAt !== starting.document.metadata.updatedAt) throw new Error("STALE_PROJECT");
  onPhase("planning");
  const owned = ownedOnly ? (await inventoryRepository.list(inventoryOwner(session?.user.id))).filter(item => item.quantity > 0 && getDefinition(item.definitionId)?.kind === "component") : [];
  if (ownedOnly && !owned.length) throw new Error("NO_OWNED_PARTS");
  const plan = await planAssembly(migrateProject(current.document), onPhase,
    ownedOnly ? { mode: "owned-only", items: owned.map(item => ({ definitionId: item.definitionId, quantity: item.quantity })) } : undefined,
    session && (ownedOnly || !current.cloudDirty) ? session : null, inventorySynced && !current.cloudDirty);
  if (plan.revision !== current.document.metadata.updatedAt) throw new Error("STALE_PROJECT");
  if (plan.status === "unsupported") return plan;
  onPhase("checking");
  const latest = useProjectStore.getState().project;
  if (!latest || latest.id !== current.id || latest.document.metadata.updatedAt !== current.document.metadata.updatedAt) throw new Error("STALE_PROJECT");
  const timestamp = new Date(Math.max(Date.now(), Date.parse(current.document.metadata.updatedAt) + 1)).toISOString();
  const candidate = executeCommands(migrateProject(latest.document), plan.commands, timestamp);
  if (apply) { onPhase("placing"); await useProjectStore.getState().saveDocument(candidate, current.document.metadata.updatedAt); }
  return plan;
}
export function assemblyError(error: unknown): string {
  const code = error instanceof HardwareError ? error.code === "NOT_OWNED" ? error.code : "HARDWARE_VALIDATION" : error instanceof Error ? error.message : "";
  if (code === "NO_PROVIDER") return "Choose a local model, CLI, or API provider in Provider settings.";
  if (code === "NO_OWNED_PARTS") return "Add a component to My Parts before planning with owned parts.";
  if (code === "INVENTORY_SYNC_REQUIRED") return "Sync My Parts and this project before remote owned-parts planning, or use a local provider.";
  if (code === "NOT_OWNED") return "The plan uses more parts than you own. My Parts was not changed.";
  if (code === "LOCAL_BRIDGE_UNAVAILABLE") return "Kinetable Local Bridge is not running. Start it and reconnect in Provider settings.";
  if (code === "PROVIDERS_EXHAUSTED") return "All configured providers failed. Check their connection status in Provider settings.";
  if (code === "CREDENTIAL_UNAVAILABLE") return "This API key is unavailable on this device. Add it again in Provider settings.";
  if (code === "SAFETY_REFUSAL") return "The provider declined this request. Your project was not changed.";
  if (code === "STALE_PROJECT") return "This project changed while planning. Please try again.";
  if (code === "PROVIDER_UNAVAILABLE") return "Kinetable’s planner is unavailable right now. Please try again later.";
  if (code === "NETWORK_FAILURE" || code === "BACKEND_UNAVAILABLE") return "Connection lost. Your project is safe on this device. Try again when you’re online.";
  if (code === "INVALID_MODEL_RESPONSE") return "The planner returned an invalid plan. Your project was not changed.";
  if (code === "HARDWARE_VALIDATION") return "The proposed connections did not pass Kinetable’s checks. Your project was not changed.";
  return "Kinetable couldn’t complete this build. Your project was not changed.";
}
