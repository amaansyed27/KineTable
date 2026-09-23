import { describe, it, expect, vi, afterEach } from "vitest";
import { parseBackendConfig } from "./backendConfig";
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
describe("optional cloud boundary", () => {
  it("stays local for missing, partial, malformed and privileged credentials", () => {
    expect(parseBackendConfig()).toEqual({ cloudConfigured: false, reason: "missing" });
    for (const [url,key] of [["", "sb_publishable_example"], ["bad", "sb_publishable_example"], ["https://example.supabase.co", "sb_secret_do_not_ship"], ["https://example.supabase.co", "eyJ.service_role.jwt"], ["https://name:password@example.com", "sb_publishable_example"], ["http://remote.example", "sb_publishable_example"], ["https://example.com/path", "sb_publishable_example"]]) {
      expect(parseBackendConfig(url,key)).toEqual({ cloudConfigured: false, reason: "invalid" });
    }
  });
  it("accepts publishable HTTPS and local development origins", () => {
    expect(parseBackendConfig("https://example.supabase.co", "sb_publishable_example").cloudConfigured).toBe(true);
    expect(parseBackendConfig("http://127.0.0.1:54321", "sb_publishable_example").cloudConfigured).toBe(true);
  });
  it("does not construct a client without configuration", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", ""); vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    const backend = await import("./supabaseClient");
    expect(backend.cloudConfigured).toBe(false); expect(backend.getSupabaseClient()).toBeNull();
  });
  it("constructs a singleton client with centralized auth configuration", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    const backend = await import("./supabaseClient");
    expect(backend.cloudConfigured).toBe(true);
    expect(backend.getSupabaseClient()).toBe(backend.getSupabaseClient());
    expect(backend.backendConfig).toMatchObject({ url: "https://example.supabase.co" });
  });
});
