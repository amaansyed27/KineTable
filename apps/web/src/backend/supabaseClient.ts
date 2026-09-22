import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseBackendConfig, type BackendConfig } from "./backendConfig";
export const backendConfig: BackendConfig = import.meta.env.VITE_BACKEND_CONFIG_INVALID === "true"
  ? { cloudConfigured: false, reason: "invalid" }
  : parseBackendConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
export const cloudConfigured = backendConfig.cloudConfigured;
let client: SupabaseClient | null = null;
export function getSupabaseClient(): SupabaseClient | null {
  if (!backendConfig.cloudConfigured) return null;
  // No sessions or auth callbacks in Slice 02. Auth is introduced explicitly in Slice 03.
  client ??= createClient(backendConfig.url, backendConfig.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
