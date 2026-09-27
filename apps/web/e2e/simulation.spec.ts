import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { protectPreview } from "./protectedPreview";
import { pinEndpoint, type KinetableProjectV3 } from "../src/projects/v3";
import { layoutComponents } from "../src/hardware-core/layout";

test.beforeEach(async ({ context }) => protectPreview(context));
type Part = [string, string]; type Link = [string, string, string, string];
const board = "board-main";
const led: Part[] = [["led-1","led-5mm"],["resistor-1","resistor-220r"]];
const ledLinks: Link[] = [[board,"gpio23","resistor-1","a"],["resistor-1","b","led-1","anode"],["led-1","cathode",board,"gnd"]];
const button: Part[] = [["button-1","push-button"]];
const buttonLinks: Link[] = [[board,"gpio18","button-1","a"],["button-1","b",board,"gnd"]];
const buzzer: Part[] = [["buzzer-1","grove-buzzer-v1-1"]];
const buzzerLinks: Link[] = [[board,"3v3","buzzer-1","vcc"],[board,"gnd","buzzer-1","gnd"],[board,"gpio19","buzzer-1","sig"]];
const pir: Part[] = [["pir-1","hc-sr501"]];
const pirLinks: Link[] = [[board,"vin","pir-1","vcc"],[board,"gnd","pir-1","gnd"],[board,"gpio27","pir-1","out"]];
const oled: Part[] = [["oled-1","oled-ssd1306-i2c-3v3"]];
const oledLinks: Link[] = [[board,"3v3","oled-1","vcc"],[board,"gnd","oled-1","gnd"],[board,"gpio21","oled-1","sda"],[board,"gpio22","oled-1","scl"]];
const dht: Part[] = [["dht-1","dht11-module"]];
const dhtLinks: Link[] = [[board,"3v3","dht-1","vcc"],[board,"gnd","dht-1","gnd"],[board,"gpio18","dht-1","data"]];

async function openTable(page: Page) {
  await page.goto("/start");
  await page.getByRole("radio", { name: "ESP32", exact: true }).check();
  await page.getByRole("button", { name: /^Continue with/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/table");
  await expect(page.locator("[data-project-id]")).toBeVisible({timeout:20000});
  await page.getByText("Parts & wires", {exact:true}).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/, { timeout: 20000 });
  await expect(page.locator(".workbench-surface canvas")).toBeVisible({ timeout: 15000 });
}
async function stored(page: Page): Promise<KinetableProjectV3> {
  const id = await page.locator("[data-project-id]").getAttribute("data-project-id");
  return page.evaluate(projectId => new Promise((resolve, reject) => { const req = indexedDB.open("kinetable"); req.onerror = () => reject(req.error); req.onsuccess = () => { const tx = req.result.transaction("projects", "readonly"), row = tx.objectStore("projects").get(projectId!); row.onsuccess = () => resolve(row.result.document); row.onerror = () => reject(row.error); }; }), id);
}
async function load(page: Page, parts: Part[], links: Link[]) {
  const current = await stored(page), p = structuredClone(current);
  for (const [id, definitionId] of parts) p.components.push({ id, definitionId, kind: "component" });
  p.layout.entities = layoutComponents(p.components, p.layout.entities);
  p.wires = links.map(([a,ap,b,bp],i) => ({ id: `wire-${i}`, from: pinEndpoint(a,ap), to: pinEndpoint(b,bp) }));
  p.metadata.updatedAt = new Date(Date.now() + 2000).toISOString();
  await page.evaluate(document => new Promise<void>((resolve,reject) => { const req = indexedDB.open("kinetable"); req.onerror = () => reject(req.error); req.onsuccess = () => { const tx = req.result.transaction("projects", "readwrite"); tx.objectStore("projects").put({ id: document.id, name: document.name, schemaVersion: document.schemaVersion, document, createdAt: document.metadata.createdAt, updatedAt: document.metadata.updatedAt, cloudDirty: false }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }; }), p);
  await page.reload(); await expect(page.locator("[data-project-id]")).toBeVisible({timeout:20000}); await page.getByText("Parts & wires",{exact:true}).click();
  await expect(page.getByText("Connections complete")).toBeVisible();
  return p;
}
const simulate = async (page: Page, name: string) => { await page.getByRole("button", { name: "Simulate", exact: true }).click(); await page.getByText("Scenario",{exact:true}).click(); await page.getByLabel("Simulation recipe").selectOption({ label: name }); };

test("button LED responds, explains its cause, and leaves the project unchanged", async ({ page }) => {
  await openTable(page); const original = await load(page, [...button,...led], [...buttonLinks,...ledLinks]);
  await simulate(page,"Button controls LED");
  mkdirSync("../../output/playwright", { recursive: true });
  await page.screenshot({ path: "../../output/playwright/simulation-ready-1440.png", fullPage: true });
  await page.getByRole("button", { name: "Press button" }).click();
  await expect(page.getByText("LED:")).toContainText("ON");
  await page.screenshot({ path: "../../output/playwright/simulation-led-on-1440.png", fullPage: true });
  await page.getByRole("button", { name: "Why?" }).click();
  await expect(page.getByText(/button-led recipe reacted/)).toBeVisible();
  await page.getByRole("button", { name: "Signals", exact: true }).click();
  await page.getByText("Technical paths",{exact:true}).click();
  await expect(page.getByText(/GPIO LOW/)).toBeVisible();
  for (const [width,height] of [[390,844],[768,1024],[1440,900],[1600,1000],[1920,1080]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `../../output/playwright/simulation-explain-${width}.png`, fullPage: true });
  }
  await expect.poll(async () => (await stored(page)).metadata.updatedAt).toBe(original.metadata.updatedAt);
  await page.reload(); await expect(page.locator("[data-project-id]")).toBeVisible({timeout:20000}); await page.getByText("Parts & wires",{exact:true}).click();
  await expect(page.getByRole("button", { name: "Build", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Connections complete")).toBeVisible();
});

test("PIR motion drives buzzer and power X-Ray", async ({ page }) => {
  await openTable(page); await load(page, [...pir,...buzzer], [...pirLinks,...buzzerLinks]);
  await simulate(page,"Motion alarm");
  await page.getByRole("button", { name: "Trigger motion" }).click();
  await expect(page.getByText("Grove Buzzer V1.1:")).toContainText("ON");
  await page.screenshot({ path: "../../output/playwright/simulation-pir-1440.png", fullPage: true });
  await page.getByRole("button", { name: "Explain", exact: true }).click();
  await expect(page.getByText(/HC-SR501 PIR detected simulated motion/)).toBeVisible();
  await page.getByText("Technical paths",{exact:true}).click();
  await expect(page.getByText(/5 V supply/).first()).toBeVisible();
  await page.screenshot({ path: "../../output/playwright/simulation-power-1440.png", fullPage: true });
});

test("DHT11 updates OLED data", async ({ page }) => {
  await openTable(page); await load(page, [...dht,...oled], [...dhtLinks,...oledLinks]);
  await simulate(page,"Temperature display");
  await page.getByLabel("Temperature °C").fill("31");
  await expect(page.getByText("3.3 V SSD1306 I²C OLED:")).toContainText("31°C");
  await page.screenshot({ path: "../../output/playwright/simulation-oled-1440.png", fullPage: true });
  await page.getByRole("button", { name: "Explain", exact: true }).click();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByText("Technical paths",{exact:true}).click();
  await expect(page.getByText(/DHT11 data/).first()).toBeVisible();
  await page.screenshot({ path: "../../output/playwright/simulation-data-1440.png", fullPage: true });
});

test("incomplete builds block simulation while static Power Explain remains available", async ({ page }) => {
  await openTable(page);
  await page.getByRole("button", { name: "+ Part" }).click();
  await page.getByRole("dialog", { name: "Add part" }).getByRole("button", { name: "LED", exact: true }).click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("needs a connection");
  await page.getByRole("button", { name: "Explain", exact: true }).click();
  await page.getByRole("button", { name: "Power", exact: true }).click();
  await page.getByText("Technical paths",{exact:true}).click();
  await expect(page.getByText(/3.3 V supply/).first()).toBeVisible();
});

test("simulation and Why remain usable without WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type.includes("webgl")) return null;
      return original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto("/start");
  await page.getByRole("radio", { name: "ESP32", exact: true }).check();
  await page.getByRole("button", { name: /^Continue with/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/table");
  await expect(page.locator("[data-project-id]")).toBeVisible({timeout:20000});
  await page.getByText("Parts & wires", {exact:true}).click();
  await expect(page.getByText("3D editing is unavailable.")).toBeVisible();
  await load(page, [...button,...led], [...buttonLinks,...ledLinks]);
  await simulate(page,"Button controls LED");
  await page.getByRole("button", { name: "Press button" }).click();
  await expect(page.locator(".simulation-outputs > span").filter({ hasText: /^LED:/ })).toContainText("ON");
  await page.getByRole("button", { name: "Why?" }).click();
  await expect(page.getByText(/button-led recipe reacted/)).toBeVisible();
});

test("BONK, blink, static Explain and mobile controls remain reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openTable(page); await load(page, [...button,...led,...buzzer,...oled], [...buttonLinks,...ledLinks,...buzzerLinks,...oledLinks]);
  await simulate(page,"BONK");
  await expect(page.getByText("3.3 V SSD1306 I²C OLED:")).toContainText("READY");
  await page.getByRole("button", { name: "Press button" }).click();
  await expect(page.getByText("3.3 V SSD1306 I²C OLED:")).toContainText("BONK!");
  await expect(page.locator(".simulation-outputs > span").filter({ hasText: /^LED:/ })).toContainText("ON");
  mkdirSync("../../output/playwright", { recursive: true });
  await page.screenshot({ path: "../../output/playwright/simulation-bonk-mobile-390.png", fullPage: true });
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByText("3.3 V SSD1306 I²C OLED:")).toContainText("READY");
  if (!await page.locator(".simulation-recipe").evaluate(el=>(el as HTMLDetailsElement).open)) await page.getByText("Scenario",{exact:true}).click();
  await page.getByLabel("Simulation recipe").selectOption({ label: "Blink LED" });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".simulation-outputs > span").filter({ hasText: /^LED:/ })).toContainText("ON");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Explain", exact: true }).click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  mkdirSync("../../output/playwright", { recursive: true });
  await page.screenshot({ path: "../../output/playwright/simulation-mobile-390.png", fullPage: true });
});

test("authenticated simulation leaves the hosted project timestamp and document unchanged", async ({ page }) => {
  test.skip(process.env.KINETABLE_HOSTED_V3_BROWSER_QA !== "1", "Requires hosted Supabase QA");
  test.setTimeout(120000);
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(line => line.includes("=")).map(line => { const i = line.indexOf("="); return [line.slice(0,i),line.slice(i+1)]; }));
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const email = `kinetable-qa-sim-${randomUUID()}@gmail.com`, password = randomBytes(24).toString("base64url");
  await openTable(page); const p = await load(page, [...button,...led], [...buttonLinks,...ledLinks]);
  const signup = await fetch(`${url}/auth/v1/signup`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  expect(signup.ok).toBe(true);
  const token = (await signup.json()).access_token as string;
  const cloud = async () => { const response = await fetch(`${url}/rest/v1/projects?id=eq.${p.id}&select=*`, { headers: { apikey: key, Authorization: `Bearer ${token}` } }); expect(response.ok).toBe(true); return (await response.json())[0]; };
  try {
    await page.goto(`/auth?next=/projects/${p.id}`);
    await page.getByLabel("Email",{exact:true}).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", p.id, { timeout: 20000 });
    await expect.poll(async () => (await cloud())?.document?.wires?.length, { timeout: 30000 }).toBe(5);
    await page.getByRole("button",{name:"Account",exact:true}).click();await expect(page.locator(".account-menu [role=status]")).toHaveText("● Synced",{timeout:20000});await page.keyboard.press("Escape");
    const before = await cloud();
    await simulate(page,"Button controls LED");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: "Press button" }).click();
    await page.getByRole("button", { name: "Release button" }).click();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.getByRole("button", { name: "Explain", exact: true }).click();
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.waitForTimeout(1200);
    const after = await cloud();
    expect(after.updated_at).toBe(before.updated_at);
    expect(after.document).toEqual(before.document);
  } finally {
    const cleanup = await fetch(`${url}/rest/v1/projects?id=eq.${p.id}`, { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${token}` } });
    expect(cleanup.ok).toBe(true);
  }
});
