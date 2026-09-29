import { existsSync, readFileSync } from "node:fs";

export function localSupabaseOnly(allowProcessOverride = false) {
  if (process.env.KINETABLE_LOCAL_SUPABASE_QA !== "1" || !existsSync(".env.local")) return false;
  const configured = readFileSync(".env.local", "utf8").match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
  const url = allowProcessOverride ? process.env.VITE_SUPABASE_URL ?? configured : configured;
  if (!url) return false;
  try { return ["127.0.0.1", "localhost"].includes(new URL(url).hostname); }
  catch { return false; }
}
