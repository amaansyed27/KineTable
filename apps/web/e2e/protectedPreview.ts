import type { BrowserContext } from "@playwright/test";

export async function protectPreview(context: BrowserContext): Promise<void> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const base = process.env.E2E_BASE_URL;
  if (!secret || !base) return;
  const origin = new URL(base).origin;
  await context.route(`${origin}/**`, route => route.continue({ headers: { ...route.request().headers(), "x-vercel-protection-bypass": secret } }));
}
