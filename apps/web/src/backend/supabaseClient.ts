import type { Database } from "./database.types";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseBackendConfig, type BackendConfig } from "./backendConfig";
export const backendConfig: BackendConfig = import.meta.env.VITE_BACKEND_CONFIG_INVALID === "true"
  ? { cloudConfigured: false, reason: "invalid" }
  : parseBackendConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
export const cloudConfigured = backendConfig.cloudConfigured;
let client: SupabaseClient<Database> | null = null;
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!backendConfig.cloudConfigured) return null;
  // One browser client owns persisted sessions and token refresh.
  client ??= createClient<Database>(backendConfig.url, backendConfig.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce" },
  });
  return client;
}
