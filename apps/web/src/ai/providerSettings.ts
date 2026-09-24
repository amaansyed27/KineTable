import type { CredentialMeta, RouteCandidate, RoutingProfile } from "./routing.js";

export type ProviderSettings = { profile: RoutingProfile; credentials: CredentialMeta[] };
const storageKey = "kinetable:providers:v1";
const empty = (): ProviderSettings => ({ profile: { id: "default", name: "My providers", routes: [] }, credentials: [] });
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const fields = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(key => allowed.includes(key));
const string = (v: unknown, max = 256): v is string => typeof v === "string" && v.length <= max && ![...v].some(char => char.codePointAt(0)! < 32 || char.codePointAt(0) === 127);
const text = (v: unknown, max = 256): v is string => string(v, max) && v.length > 0;
const priority = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
const strings = (v: unknown) => Array.isArray(v) && v.every(item => text(item));
function route(v: unknown): v is RouteCandidate {
  if (!record(v) || !fields(v, ["id", "name", "providerId", "transport", "modelId", "baseUrl", "credentialIds", "enabled", "priority", "authMode"]) ||
    !text(v.id) || !text(v.providerId) || !string(v.modelId) || !["REMOTE_API", "CUSTOM_OPENAI_COMPATIBLE", "LOCAL_HTTP", "LOCAL_CLI"].includes(String(v.transport)) ||
    !strings(v.credentialIds) || typeof v.enabled !== "boolean" || !priority(v.priority) || (v.name !== undefined && !string(v.name, 60)) ||
    (v.authMode !== undefined && !["bearer", "x-api-key", "none"].includes(String(v.authMode)))) return false;
  if (v.baseUrl !== undefined) {
    if (!string(v.baseUrl, 2048)) return false;
    if (v.baseUrl) {
      try {
        const url = new URL(v.baseUrl);
        if (url.username || url.password || url.search || url.hash || (v.transport === "LOCAL_HTTP" ? url.protocol !== "http:" || url.hostname !== "127.0.0.1" : url.protocol !== "https:")) return false;
      } catch { return false; }
    }
  }
  return true;
}
function credential(v: unknown): v is CredentialMeta {
  return record(v) && fields(v, ["id", "providerId", "label", "priority", "enabled", "lastFour", "modelRestrictions", "remembered"]) &&
    text(v.id) && text(v.providerId) && text(v.label, 40) && priority(v.priority) && typeof v.enabled === "boolean" &&
    string(v.lastFour, 4) && (v.modelRestrictions === undefined || strings(v.modelRestrictions)) && typeof v.remembered === "boolean";
}
export function parseProviderSettings(v: unknown): ProviderSettings {
  if (!record(v) || !fields(v, ["version", "profile", "credentials"]) || (v.version !== undefined && v.version !== 2) ||
    !record(v.profile) || !fields(v.profile, ["id", "name", "routes"]) || !text(v.profile.id) || !text(v.profile.name) ||
    !Array.isArray(v.profile.routes) || !v.profile.routes.every(route) || !Array.isArray(v.credentials) || !v.credentials.every(credential)) throw new Error("INVALID_PROVIDER_SETTINGS");
  return { profile: v.profile as RoutingProfile, credentials: v.credentials as CredentialMeta[] };
}
export function loadProviderSettings(): ProviderSettings {
  try {
    return parseProviderSettings(JSON.parse(localStorage.getItem(storageKey) ?? "null"));
  } catch { /* The user can configure providers again if local settings are damaged. */ }
  return empty();
}
export function saveProviderSettings(settings: ProviderSettings): void {
  const valid = parseProviderSettings(settings);
  localStorage.setItem(storageKey, JSON.stringify({ version: 2, ...valid }));
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
