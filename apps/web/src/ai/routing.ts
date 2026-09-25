import type { KinetableProjectV3 } from "../projects/v3.js";
import { parsePlanResponse, type PlanRequest, type PlanResponse } from "./contract.js";
import { validateGeneratedPlan } from "./planner.js";

export type ProviderTransport = "REMOTE_API" | "CUSTOM_OPENAI_COMPATIBLE" | "LOCAL_HTTP" | "LOCAL_CLI";
export type RouteCandidate = {
  id: string; name?: string; providerId: string; transport: ProviderTransport; modelId: string;
  baseUrl?: string; credentialIds: string[]; enabled: boolean; priority: number;
  authMode?: "bearer" | "x-api-key" | "none";
};
export type RoutingProfile = { id: string; name: string; routes: RouteCandidate[] };
export type CredentialMeta = { id: string; providerId: string; label: string; priority: number; enabled: boolean; lastFour: string; modelRestrictions?: string[]; remembered: boolean };
export type Attempt = { routeId: string; providerId: string; modelId: string; credential: string | null; code: string };
export type RoutedPlan = { plan: PlanResponse; attempts: Attempt[]; route: RouteCandidate };
export class RoutingError extends Error {
  constructor(public code: string, public attempts: Attempt[]) { super(code); }
}
export const maskSecret = (lastFour: string) => lastFour ? `••••${lastFour.toUpperCase()}` : "••••";
const retryable = new Set(["NETWORK_FAILURE", "TIMEOUT", "RATE_LIMIT", "QUOTA_EXHAUSTED", "PROVIDER_UNAVAILABLE", "MODEL_UNAVAILABLE", "CREDENTIAL_REJECTED", "CREDENTIAL_UNAVAILABLE", "INVALID_MODEL_RESPONSE", "LOCAL_BRIDGE_UNAVAILABLE", "LOCAL_RUNTIME_UNAVAILABLE", "CLI_UNAVAILABLE", "CLI_AUTH_REQUIRED", "CLI_PERMISSION_DENIED"]);
export function shouldFallback(code: string): boolean { return retryable.has(code); }

export async function routePlan(
  profile: RoutingProfile, credentials: CredentialMeta[], request: PlanRequest, project: KinetableProjectV3,
  invoke: (route: RouteCandidate, credentialId: string | null) => Promise<unknown>,
): Promise<RoutedPlan> {
  const attempts: Attempt[] = [];
  for (const route of [...profile.routes].filter(r => r.enabled).sort((a, b) => a.priority - b.priority)) {
    const keys = route.transport === "CUSTOM_OPENAI_COMPATIBLE" && route.authMode === "none" ? [null] : route.transport === "REMOTE_API" || route.transport === "CUSTOM_OPENAI_COMPATIBLE"
      ? route.credentialIds.map(id => credentials.find(c => c.id === id && c.providerId === route.providerId && c.enabled && (!c.modelRestrictions?.length || c.modelRestrictions.includes(route.modelId)))).filter((c): c is CredentialMeta => !!c).sort((a, b) => a.priority - b.priority)
      : [null];
    for (const credential of keys) {
      let code = "PROVIDER_UNAVAILABLE";
      try {
        const raw = await invoke(route, credential?.id ?? null);
        const response = parsePlanResponse(raw);
        if (response.revision !== request.revision) throw new Error("STALE_PROJECT");
        validateGeneratedPlan(request, project, { status: response.status, summary: response.summary, unsupportedReason: response.unsupportedReason, commands: response.commands });
        attempts.push({ routeId: route.id, providerId: route.providerId, modelId: route.modelId, credential: credential ? `${credential.label} ${maskSecret(credential.lastFour)}` : null, code: "SUCCEEDED" });
        return { plan: response, attempts, route };
      } catch (error) {
        code = error instanceof Error ? error.message : code;
        if (typeof error === "object" && error && "code" in error && typeof error.code === "string") code = error.code;
        attempts.push({ routeId: route.id, providerId: route.providerId, modelId: route.modelId, credential: credential ? `${credential.label} ${maskSecret(credential.lastFour)}` : null, code });
        if (!shouldFallback(code)) throw new RoutingError(code, attempts);
      }
    }
  }
  throw new RoutingError("PROVIDERS_EXHAUSTED", attempts);
}
