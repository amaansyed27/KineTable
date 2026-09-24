import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { protectPreview } from "./protectedPreview";

test.beforeEach(async ({ context }) => protectPreview(context));
test("manual layout checkpoints locally, survives offline reload, and restores from hosted cloud", async ({ page, browser }) => {
  test.skip(process.env.KINETABLE_HOSTED_V2_BROWSER_QA !== "1", "Requires disposable hosted v2 account");
  test.setTimeout(120000);
  const { a, projectId } = JSON.parse(readFileSync("../../output/slice-06-hosted-v2.json", "utf8"));
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(line => line.includes("=")).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
  await page.goto("/auth");
  await page.getByLabel("Your email").fill(a.email);
  await page.getByLabel("Password", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", projectId, { timeout: 20000 });
  const readLocal = () => page.evaluate(id => new Promise<{ position: number[]; rotation: number[] }>((resolve, reject) => {
    const open = indexedDB.open("kinetable"); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const row = open.result.transaction("projects", "readonly").objectStore("projects").get(id);
      row.onsuccess = () => resolve(row.result.document.layout.entities["pir-1"]); row.onerror = () => reject(row.error); };
  }), projectId);
  const token = await page.evaluate(() => { const key = Object.keys(localStorage).find(key => key.startsWith("sb-") && key.endsWith("-auth-token")); return key ? JSON.parse(localStorage.getItem(key)!).access_token as string : ""; });
  const cloud = async () => (await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}&select=*`, { headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } })).json())[0];
  const before = (await readLocal()).position[0];
  await page.route("https://*.supabase.co/**", route => route.abort());
  await page.getByRole("button", { name: "HC-SR501 PIR", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await readLocal()).position[0]).toBeGreaterThan(before);
  const moved = await readLocal();
  await page.reload();
  await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", projectId);
  expect((await readLocal()).position).toEqual(moved.position);
  await page.unrouteAll();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(async () => (await cloud())?.document?.layout?.entities?.["pir-1"]?.position?.[0], { timeout: 20000 }).toBe(moved.position[0]);
  const fresh = await browser.newContext({ storageState: process.env.E2E_STORAGE_STATE });
  try {
    await protectPreview(fresh);
    const restored = await fresh.newPage();
    await restored.goto(new URL("/auth", page.url()).toString());
    await restored.getByLabel("Your email").fill(a.email);
    await restored.getByLabel("Password", { exact: true }).fill(a.password);
    await restored.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(restored.locator("[data-project-id]")).toHaveAttribute("data-project-id", projectId, { timeout: 20000 });
    await expect.poll(async () => restored.evaluate(id => new Promise<number>((resolve, reject) => {
      const open = indexedDB.open("kinetable"); open.onerror = () => reject(open.error);
      open.onsuccess = () => { const row = open.result.transaction("projects", "readonly").objectStore("projects").get(id);
        row.onsuccess = () => resolve(row.result.document.layout.entities["pir-1"].position[0]); row.onerror = () => reject(row.error); };
    }), projectId)).toBe(moved.position[0]);
  } finally { await fresh.close(); }
});
