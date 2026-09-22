export type BackendConfig = { cloudConfigured: false; reason: "missing" | "invalid" } | { cloudConfigured: true; url: string; publishableKey: string };
export function parseBackendConfig(url?: string, key?: string): BackendConfig {
  if (!url?.trim() && !key?.trim()) return { cloudConfigured: false, reason: "missing" };
  try {
    const parsed = new URL(url?.trim() ?? "");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if ((parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") throw new Error();
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key?.trim() ?? "")) throw new Error();
    return { cloudConfigured: true, url: parsed.origin, publishableKey: key!.trim() };
  } catch { return { cloudConfigured: false, reason: "invalid" }; }
}
