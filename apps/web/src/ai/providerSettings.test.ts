import { afterEach, expect, it, vi } from "vitest";
import { loadProviderSettings, parseProviderSettings, saveProviderSettings, type ProviderSettings } from "./providerSettings";

const key = "kinetable:providers:v1";
const legacy = { profile: { id: "default", name: "Mine", routes: [{ id: "one", providerId: "groq", transport: "REMOTE_API", modelId: "model", credentialIds: ["key"], enabled: true, priority: 0 }] },
  credentials: [{ id: "key", providerId: "groq", label: "Personal", priority: 0, enabled: true, lastFour: "abcd", remembered: false }] } satisfies ProviderSettings;
function storage(raw: string) {
  const items = new Map([[key, raw]]);
  vi.stubGlobal("localStorage", { getItem: (name: string) => items.get(name) ?? null, setItem: (name: string, value: string) => items.set(name, value) });
  return items;
}
afterEach(() => vi.unstubAllGlobals());
it("loads existing settings and stores a validated version", () => {
  const items = storage(JSON.stringify(legacy));
  expect(loadProviderSettings()).toEqual(legacy);
  saveProviderSettings(legacy);
  expect(JSON.parse(items.get(key)!).version).toBe(2);
});
it("fails safely on corrupt JSON, unsupported versions, malformed routes and metadata", () => {
  const items = storage("{");
  expect(loadProviderSettings().profile.routes).toEqual([]);
  for (const bad of [{ ...legacy, version: 99 }, { ...legacy, profile: { ...legacy.profile, routes: [{ ...legacy.profile.routes[0], priority: "first" }] } },
    { ...legacy, credentials: [{ ...legacy.credentials[0], secret: "raw-secret" }] }, { ...legacy, credentials: [{ ...legacy.credentials[0], lastFour: "too-long" }] }]) {
    items.set(key, JSON.stringify(bad));
    expect(loadProviderSettings().profile.routes).toEqual([]);
    expect(() => parseProviderSettings(bad)).toThrow("INVALID_PROVIDER_SETTINGS");
  }
  expect(() => saveProviderSettings({ ...legacy, credentials: [{ ...legacy.credentials[0], secret: "raw-secret" }] } as never)).toThrow();
});
