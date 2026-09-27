import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { protectPreview } from "./protectedPreview";

test.beforeEach(async ({ context }) => protectPreview(context));

test("signed-out users keep their intent and can configure a provider", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("radio", { name: "ESP32", exact: true }).check();
  await page.getByRole("button", { name: /^Continue with/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/table");
  await expect(page.locator("[data-project-id]")).toBeVisible();
  await page.getByText("Parts & wires", {exact:true}).click();
  await page.goto("/projects/new");
  await page.getByLabel("Describe your idea").fill("Make a motion alarm");
  await page.getByRole("button", { name: "Create project" }).click();
  const id = await page.locator("[data-project-id]").getAttribute("data-project-id");
  await expect(page.getByRole("button", { name: "✦ Ask Kinetable" })).toBeVisible();
  await page.getByRole("button", { name: "✦ Ask Kinetable" }).click(); await page.getByRole("button", { name: "Preview assembly" }).click();
  await expect(page.getByRole("alert")).toContainText("Choose a local model, CLI, or API provider");
  await page.getByRole("link", { name: "Set up AI providers →" }).click();
  await expect(page).toHaveURL(/\/settings\/providers/);
  await page.goto(`/projects/${id}`); await page.getByRole("button",{name:"✦ Ask Kinetable"}).click();
  await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", id!);
  await expect(page.locator(".ai-sheet")).toContainText("Make a motion alarm");
});

test("fresh account browser restores hosted v2, applies validated commands, and keeps failure paths safe", async ({ page, browser }) => {
  test.skip(process.env.KINETABLE_HOSTED_V2_BROWSER_QA !== "1", "Requires disposable hosted v2 account");
  test.setTimeout(120000);
  const { a, projectId } = JSON.parse(readFileSync("../../output/slice-06-hosted-v2.json", "utf8"));
  await page.goto(`/auth?next=/projects/${projectId}`);
  await page.evaluate(() => localStorage.setItem("kinetable:providers:v1", JSON.stringify({ profile: { id: "qa", name: "QA", routes: [{ id: "custom", providerId: "custom", transport: "CUSTOM_OPENAI_COMPATIBLE", modelId: "qa-model", baseUrl: "https://example.com/v1", authMode: "none", credentialIds: [], enabled: true, priority: 0 }] }, credentials: [] })));
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/auth?next=/projects/${projectId}`);
  await page.getByLabel("Email",{exact:true}).fill(a.email);
  await page.getByLabel("Password", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", projectId, { timeout: 20000 });
  await expect(page.getByText("Connections complete")).toBeVisible();
  await page.getByText("Parts & wires",{exact:true}).click(); await expect(page.getByRole("button",{name:"HC-SR501 PIR",exact:true})).toBeVisible(); await expect(page.getByRole("button",{name:"Grove Buzzer V1.1",exact:true})).toBeVisible();
  await expect(page.locator(".workbench-surface canvas")).toBeVisible();
  await page.waitForTimeout(800); // Capture the settled arrival animation.
  mkdirSync("../../output/playwright", { recursive: true });
  for (const [width, height] of [[390,844],[768,1024],[1440,900],[1600,1000],[1920,1080]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `../../output/playwright/assembly-complete-${width}.png`, fullPage: true });
  }
  await page.reload();
  await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", projectId);
  await page.route("https://*.supabase.co/**", route => route.abort());
  await page.reload();
  await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", projectId);
  await expect(page.getByText("Connections complete")).toBeVisible();
  await page.unrouteAll();
  await page.goto("/projects/new");
  await page.getByLabel("Describe your idea").fill("Make an LED blink");
  await page.getByRole("button", { name: "Create project" }).click();
  const ledId = await page.locator("[data-project-id]").getAttribute("data-project-id");
  const e = (componentId: string, pinId: string) => ({ componentId, pinId });
  const commands = [
    { type: "component.add", instanceId: "led-1", definitionId: "led-5mm" },
    { type: "component.add", instanceId: "resistor-1", definitionId: "resistor-220r" },
    { type: "connection.create", id: "wire-1", from: e("board-main", "gpio23"), to: e("resistor-1", "a") },
    { type: "connection.create", id: "wire-2", from: e("resistor-1", "b"), to: e("led-1", "anode") },
    { type: "connection.create", id: "wire-3", from: e("led-1", "cathode"), to: e("board-main", "gnd") },
  ];
  let releasePlan!: () => void;
  const planGate = new Promise<void>(resolve => { releasePlan = resolve; });
  await page.route("**/api/ai/plan", async route => { const request = JSON.parse(route.request().postData()!); await planGate; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "supported", summary: "LED and resistor connected.", unsupportedReason: "", commands, revision: request.input.revision }) }); });
  await page.getByRole("button", { name: "✦ Ask Kinetable" }).click(); await page.getByRole("button", { name: "Preview assembly" }).click();
  await expect(page.getByRole("button",{name:"Checking your build…"})).toBeVisible();
  await page.screenshot({ path: "../../output/playwright/assembly-planning.png", fullPage: true });
  releasePlan();
  await expect(page.getByRole("heading",{name:"I’ll add"})).toBeVisible({timeout:20000}); await page.getByRole("button",{name:"Apply",exact:true}).click(); await expect(page.getByText("Connections complete")).toBeVisible();
  const local = await page.evaluate(async id => new Promise<{ schemaVersion: number; document: { wires: unknown[] } }>((resolve, reject) => {
    const request = indexedDB.open("kinetable"); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const tx = request.result.transaction("projects", "readonly"), row = tx.objectStore("projects").get(id); row.onsuccess = () => resolve(row.result); row.onerror = () => reject(row.error); };
  }), ledId!);
  expect(local.schemaVersion).toBe(4);
  expect(local.document.wires).toHaveLength(3);
  await page.unroute("**/api/ai/plan");
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(line => line.includes("=")).map(line => { const i = line.indexOf("="); return [line.slice(0,i), line.slice(i+1)]; }));
  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith("sb-") && key.endsWith("-auth-token"));
    return key ? JSON.parse(localStorage.getItem(key)!).access_token as string : "";
  });
  expect(token).toBeTruthy();
  const cloudRow = async (id: string) => (await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${id}&select=*`, { headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } })).json())[0];
  await expect.poll(async () => (await cloudRow(ledId!))?.schema_version, { timeout: 20000 }).toBe(4);
  const freshContext = await browser.newContext({ storageState: process.env.E2E_STORAGE_STATE });
  try {
    await protectPreview(freshContext);
    const fresh = await freshContext.newPage();
    await fresh.goto(new URL(`/auth?next=/projects/${ledId}`, page.url()).toString());
    await fresh.getByLabel("Email",{exact:true}).fill(a.email);
    await fresh.getByLabel("Password", { exact: true }).fill(a.password);
    await fresh.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(fresh.locator("[data-project-id]")).toHaveAttribute("data-project-id", ledId!, { timeout: 20000 });
    await expect(fresh.getByText("Connections complete")).toBeVisible();
  } finally { await freshContext.close(); }
  await page.goto("/projects/new");
  await page.getByLabel("Describe your idea").fill("Build me a drone flight controller");
  await page.getByRole("button", { name: "Create project" }).click();
  const unsupportedId = await page.locator("[data-project-id]").getAttribute("data-project-id");
  await page.route("**/api/ai/plan", route => { const request = JSON.parse(route.request().postData()!); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "unsupported", summary: "Unsupported build", unsupportedReason: "Flight-control hardware is outside the supported catalog.", commands: [], revision: request.input.revision }) }); });
  await page.getByRole("button", { name: "✦ Ask Kinetable" }).click(); await page.getByRole("button", { name: "Preview assembly" }).click();
  await expect(page.getByRole("heading",{name:"Not supported yet"})).toBeVisible({timeout:20000});await expect(page.locator(".ai-change-preview")).toContainText("Flight-control hardware is outside the supported catalog.");
  await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", unsupportedId!);
  await page.screenshot({ path: "../../output/playwright/assembly-unsupported.png", fullPage: true });
  await page.unroute("**/api/ai/plan");
  await page.goto("/projects/new");
  await page.getByLabel("Describe your idea").fill("Make a button control an LED");
  await page.getByRole("button", { name: "Create project" }).click();
  const newId = await page.locator("[data-project-id]").getAttribute("data-project-id");
  await page.route("**/api/ai/plan", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "PROVIDER_UNAVAILABLE" }) }));
  await page.getByRole("button", { name: "✦ Ask Kinetable" }).click(); await page.getByRole("button", { name: "Preview assembly" }).click();
  await expect(page.getByRole("alert")).toContainText("All configured providers failed", { timeout: 20000 });
  await page.screenshot({ path: "../../output/playwright/assembly-provider-failure.png", fullPage: true });
  await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", newId!);
  await expect(page.getByRole("button", { name: "✦ Ask Kinetable" })).toBeVisible();
  await page.reload();
  await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", newId!);
  for (const id of [ledId, unsupportedId, newId]) {
    const cleaned = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${id}`, { method: "DELETE", headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
    expect(cleaned.ok).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("table assembly controls fit required viewports", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("radio", { name: "ESP32", exact: true }).check();
  await page.getByRole("button", { name: /^Continue with/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/table");
  await expect(page.locator("[data-project-id]")).toBeVisible();
  await page.getByText("Parts & wires", {exact:true}).click();
  await page.goto("/projects/new");
  await page.getByLabel("Describe your idea").fill("Make a motion alarm");
  await page.getByRole("button", { name: "Create project" }).click();
  mkdirSync("../../output/playwright", { recursive: true });
  for (const [width, height] of [[390,844],[768,1024],[1440,900],[1600,1000],[1920,1080]]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole("button", { name: "✦ Ask Kinetable" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `../../output/playwright/assembly-signed-out-${width}.png`, fullPage: true });
  }
});
