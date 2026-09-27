import { useAuthStore } from "../auth/authStore";
import { executeCommands } from "../hardware-core/commands";
import { migrateProject } from "../projects/v4";
import { useProjectStore } from "../state/projectStore";
import { parsePlanResponse, type PlanResponse } from "./contract";
import { loadProviderSettings } from "./providerSettings";
import { invokeProvider } from "./providerTransport";
import { routePlan, type Attempt } from "./routing";

export type AssemblyPhase = "planning" | "checking" | "placing";
export async function assembleProject(onPhase: (phase: AssemblyPhase) => void, apply = true): Promise<PlanResponse & { routeLabel: string; attempts: Attempt[] }> {
  const session = useAuthStore.getState().session;
  const settings = loadProviderSettings();
  if (!settings.profile.routes.some(route => route.enabled)) throw new Error("NO_PROVIDER");
  const store = useProjectStore.getState();
  const starting = store.project;
  if (!starting?.document.intent || starting.document.components.length !== 1) throw new Error("INVALID_PROJECT");
  const current = useProjectStore.getState().project;
  if (!current || !current.document.intent || current.id !== starting.id || current.document.metadata.updatedAt !== starting.document.metadata.updatedAt) throw new Error("STALE_PROJECT");
  onPhase("planning");
  const input = { projectId: current.id, revision: current.document.metadata.updatedAt, intent: current.document.intent.text, boardId: current.document.boardIds[0] };
  const routed = await routePlan(settings.profile, settings.credentials, input, migrateProject(current.document),
    (route, credentialId) => invokeProvider(route, credentialId, input, migrateProject(current.document), session && !current.cloudDirty ? session : null));
  const plan = parsePlanResponse(routed.plan);
  if (plan.revision !== current.document.metadata.updatedAt) throw new Error("STALE_PROJECT");
  const routeLabel = `${routed.route.transport === "LOCAL_CLI" ? "Local CLI" : routed.route.transport === "LOCAL_HTTP" ? "Local" : "Your key"} · ${routed.route.providerId}`;
  if (plan.status === "unsupported") return { ...plan, routeLabel, attempts: routed.attempts };
  onPhase("checking");
  const latest = useProjectStore.getState().project;
  if (!latest || latest.id !== current.id || latest.document.metadata.updatedAt !== current.document.metadata.updatedAt) throw new Error("STALE_PROJECT");
  const timestamp = new Date(Math.max(Date.now(), Date.parse(current.document.metadata.updatedAt) + 1)).toISOString();
  const candidate = executeCommands(migrateProject(latest.document), plan.commands, timestamp);
  if (apply) { onPhase("placing"); await useProjectStore.getState().saveDocument(candidate, current.document.metadata.updatedAt); }
  return { ...plan, routeLabel, attempts: routed.attempts };
}
export function assemblyError(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "NO_PROVIDER") return "Choose a local model, CLI, or API provider in Provider settings.";
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
