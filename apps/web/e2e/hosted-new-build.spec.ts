import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { localSupabaseOnly } from "./localSupabaseOnly";

test("hosted builds sync, restore newest, enforce RLS, and survive cloud failure locally", async ({ page, browser }) => {
  test.setTimeout(150000);
  test.skip(!localSupabaseOnly(), "Requires local Supabase fixtures");
  const values = Object.fromEntries(readFileSync(".env.local", "utf8").trim().split(/\r?\n/).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
  const accounts = [];
  for (let i = 0; i < 2; i++) {
    const email = `kinetable-qa-build-${randomUUID()}@gmail.com`, password = randomBytes(24).toString("base64url");
    const response = await fetch(`${values.VITE_SUPABASE_URL}/auth/v1/signup`, { method: "POST", headers: { apikey: values.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    expect(response.ok).toBe(true);
    const result = await response.json() as { user: { id: string }; access_token: string };
    accounts.push({ email, password, id: result.user.id, token: result.access_token });
  }
  const [a, b] = accounts;
  const api = async (token: string, path: string, method = "GET", body?: object) => {
    const response = await fetch(`${values.VITE_SUPABASE_URL}/rest/v1/${path}`, { method,
      headers: { apikey: values.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`,
        "Content-Type": "application/json", Prefer: "return=representation" },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    expect(response.ok).toBe(true);
    return response.json();
  };
  await api(a.token, `profiles?id=eq.${a.id}`, "PATCH", { primary_board_id: "esp32-dev-module", setup_completed: true });
    await page.goto("/auth");
    await page.getByLabel("Email",{exact:true}).fill(a.email);
    await page.getByLabel("Password", { exact: true }).fill(a.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/home$/); await page.goto("/table");
    await expect(page.locator('[data-board-id="esp32-dev-module"]')).toBeVisible({ timeout: 20000 });
    const firstId = await page.locator("[data-project-id]").getAttribute("data-project-id");
    await page.goto("/projects/new");
    await page.getByLabel("Describe your idea").fill("Make a motion alarm");
    await page.getByRole("button", { name: "Create blank project" }).click();
    await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", firstId!);
    await expect.poll(async () => (await api(a.token, `projects?id=eq.${firstId}&select=*`))[0]?.document?.intent?.text, { timeout: 20000 }).toBe("Make a motion alarm");
    const first = (await api(a.token, `projects?id=eq.${firstId}&select=*`))[0];
    expect(first).toMatchObject({ id: firstId, name: "Motion Alarm", primary_board_id: "esp32-dev-module", schema_version: 4 });
    expect(first.document).toMatchObject({ id: firstId, name: first.name, schemaVersion: 4, boardIds: [first.primary_board_id], intent: { text: "Make a motion alarm" } });
    const freshContext = await browser.newContext({ storageState: process.env.E2E_STORAGE_STATE });
    try {
      const fresh = await freshContext.newPage();
      await fresh.goto(new URL(`/auth?next=/projects/${firstId}`, page.url()).toString());
      await fresh.getByLabel("Email",{exact:true}).fill(a.email);
      await fresh.getByLabel("Password", { exact: true }).fill(a.password);
      await fresh.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(fresh.locator("[data-project-id]")).toHaveAttribute("data-project-id", firstId!, { timeout: 20000 });
      await fresh.getByRole("button",{name:"✦ Ask Kinetable"}).click(); await expect(fresh.locator(".ai-sheet")).toContainText("Make a motion alarm");
      await fresh.goto(new URL("/projects/new",page.url()).toString());
      await fresh.getByLabel("Describe your idea").fill("Make an LED blink");
      await fresh.getByRole("button", { name: "Create blank project" }).click();
      const secondId = await fresh.locator("[data-project-id]").getAttribute("data-project-id");
      expect(secondId).toBeTruthy(); expect(secondId).not.toBe(firstId);
      await expect.poll(async () => (await api(a.token, `projects?owner_id=eq.${a.id}&select=id,name,document`)).length, { timeout: 20000 }).toBe(2);
      const rows = await api(a.token, `projects?owner_id=eq.${a.id}&select=*`);
      expect(rows.map((row: { id: string }) => row.id).sort()).toEqual([firstId, secondId].sort());
      expect(rows.find((row: { id: string }) => row.id === secondId)?.document?.intent?.text).toBe("Make an LED blink");
      expect(await api(b.token, `projects?id=in.(${firstId},${secondId})&select=*`)).toEqual([]);
      const rejected = await fetch(`${values.VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${firstId}`, { method: "PATCH", headers: { apikey: values.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${b.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: "stolen" }) });
      expect(rejected.ok).toBe(false);
      const anotherContext = await browser.newContext({ storageState: process.env.E2E_STORAGE_STATE });
      try {
        const latest = await anotherContext.newPage();
        await latest.goto(new URL(`/auth?next=/projects/${secondId}`, page.url()).toString());
        await latest.getByLabel("Email",{exact:true}).fill(a.email);
        await latest.getByLabel("Password", { exact: true }).fill(a.password);
        await latest.getByRole("button", { name: "Sign in", exact: true }).click();
        await expect(latest.locator("[data-project-id]")).toHaveAttribute("data-project-id", secondId!, { timeout: 20000 });
      } finally { await anotherContext.close(); }
      await fresh.route("https://*.supabase.co/**", route => route.abort());
      await fresh.goto(new URL("/projects/new",page.url()).toString());
      await fresh.getByLabel("Describe your idea").fill("Make a button beep twice");
      await fresh.getByRole("button", { name: "Create blank project" }).click();
      const offlineId = await fresh.locator("[data-project-id]").getAttribute("data-project-id");
      await fresh.reload();
      await expect(fresh.locator("[data-project-id]")).toHaveAttribute("data-project-id", offlineId!, { timeout: 20000 });
      const localRow = await fresh.evaluate(async id => new Promise<{ cloudDirty: boolean; document: { intent?: { text: string } } }>((resolve, reject) => {
        const request = indexedDB.open("kinetable"); request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const tx = request.result.transaction("projects", "readonly");
          const row = tx.objectStore("projects").get(id);
          row.onsuccess = () => resolve(row.result); row.onerror = () => reject(row.error);
        };
      }), offlineId!);
      expect(localRow.cloudDirty).toBe(true);
      expect(localRow.document.intent?.text).toBe("Make a button beep twice");
    } finally { await freshContext.close(); }
});
