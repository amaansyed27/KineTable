import type { CredentialMeta, RouteCandidate, RoutingProfile } from "./routing.js";

export type ProviderSettings = { profile: RoutingProfile; credentials: CredentialMeta[] };
const storageKey = "kinetable:providers:v1";
const empty = (): ProviderSettings => ({ profile: { id: "default", name: "My providers", routes: [] }, credentials: [] });
export function loadProviderSettings(): ProviderSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) ?? "null") as ProviderSettings | null;
    if (raw?.profile?.routes && Array.isArray(raw.profile.routes) && Array.isArray(raw.credentials)) return raw;
  } catch { /* The user can configure providers again if local settings are damaged. */ }
  return empty();
}
export function saveProviderSettings(settings: ProviderSettings): void {
  localStorage.setItem(storageKey, JSON.stringify(settings));
}
export function addRoute(settings: ProviderSettings, route: Omit<RouteCandidate, "id" | "priority" | "enabled" | "credentialIds">): ProviderSettings {
  return { ...settings, profile: { ...settings.profile, routes: [...settings.profile.routes, { ...route, id: crypto.randomUUID(), priority: settings.profile.routes.length, enabled: true, credentialIds: [] }] } };
}
export function reorder<T extends { id: string; priority: number }>(items: T[], id: string, direction: -1 | 1): T[] {
  const ordered = [...items].sort((a, b) => a.priority - b.priority);
  const at = ordered.findIndex(item => item.id === id);
  const next = at + direction;
  if (at < 0 || next < 0 || next >= ordered.length) return ordered;
  [ordered[at], ordered[next]] = [ordered[next], ordered[at]];
  return ordered.map((item, priority) => ({ ...item, priority }));
}
