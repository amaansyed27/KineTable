import { test, expect, chromium, type Page } from "@playwright/test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, sep } from "node:path";
import { pinEndpoint } from "../src/projects/v3";
import type { KinetableProjectV4 } from "../src/projects/v4";
import { layoutComponents } from "../src/hardware-core/layout";
import { protectPreview } from "./protectedPreview";

test.beforeEach(async ({ context }) => protectPreview(context));
type Part = [string,string]; type Link = [string,string,string,string];
const board = "board-main";
const led: Part[] = [["led-1","led-5mm"],["resistor-1","resistor-220r"]];
const ledLinks: Link[] = [[board,"gpio23","resistor-1","a"],["resistor-1","b","led-1","anode"],["led-1","cathode",board,"gnd"]];
const button: Part[] = [["button-1","push-button"]];
const buttonLinks: Link[] = [[board,"gpio18","button-1","a"],["button-1","b",board,"gnd"]];
const buzzer: Part[] = [["buzzer-1","grove-buzzer-v1-1"]];
const buzzerLinks: Link[] = [[board,"3v3","buzzer-1","vcc"],[board,"gnd","buzzer-1","gnd"],[board,"gpio19","buzzer-1","sig"]];
const oled: Part[] = [["oled-1","oled-ssd1306-i2c-3v3"]];
const oledLinks: Link[] = [[board,"3v3","oled-1","vcc"],[board,"gnd","oled-1","gnd"],[board,"gpio21","oled-1","sda"],[board,"gpio22","oled-1","scl"]];
const dht: Part[] = [["dht-1","dht11-module"]];
const dhtLinks: Link[] = [[board,"3v3","dht-1","vcc"],[board,"gnd","dht-1","gnd"],[board,"gpio18","dht-1","data"]];
async function start(page: Page) {
  await page.goto("/start"); await page.getByRole("radio", { name: "ESP32", exact: true }).check(); await page.getByRole("button", { name: "Set up my table" }).click();
  await expect(page.locator("[data-project-id]")).toBeVisible();
}
async function saved(page: Page): Promise<KinetableProjectV4> {
  const id = await page.locator("[data-project-id]").getAttribute("data-project-id");
  return page.evaluate(projectId => new Promise((resolve,reject) => { const req = indexedDB.open("kinetable"); req.onerror = () => reject(req.error); req.onsuccess = () => { const row = req.result.transaction("projects","readonly").objectStore("projects").get(projectId!); row.onsuccess = () => resolve(row.result.document); row.onerror = () => reject(row.error); }; }), id);
}
async function load(page: Page, parts: Part[], links: Link[]) {
  const p = structuredClone(await saved(page));
  for (const [id,definitionId] of parts) p.components.push({ id, definitionId, kind: "component" });
  p.layout.entities = layoutComponents(p.components,p.layout.entities);
  p.wires = links.map(([a,ap,b,bp],i) => ({ id: `wire-${i}`, from: pinEndpoint(a,ap), to: pinEndpoint(b,bp) }));
  p.metadata.updatedAt = new Date(Date.now()+2000).toISOString();
  await page.evaluate(document => new Promise<void>((resolve,reject) => { const req = indexedDB.open("kinetable"); req.onerror = () => reject(req.error); req.onsuccess = () => { const tx = req.result.transaction("projects","readwrite"); tx.objectStore("projects").put({ id: document.id, name: document.name, schemaVersion: 4, document, createdAt: document.metadata.createdAt, updatedAt: document.metadata.updatedAt, cloudDirty: false }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }; }), p);
  await page.reload(); await expect(page.getByText("Circuit ready")).toBeVisible();
}
async function pulses(page: Page, count: number) {
  const output = page.locator(".simulation-outputs > span").filter({ hasText: /^Grove Buzzer V1.1:/ });
  await expect(output).toContainText("ON");
  const observed = await output.evaluate(async element => {
    const values = [element.querySelector("strong")?.textContent];
    const observer = new MutationObserver(() => { const value = element.querySelector("strong")?.textContent; if (value !== values.at(-1)) values.push(value); });
    observer.observe(element, { childList: true, subtree: true, characterData: true });
    (document.querySelector('.simulation-buttons button') as HTMLButtonElement).click();
    await new Promise(resolve => setTimeout(resolve, 750)); observer.disconnect(); return values;
  });
  expect(observed.filter(value => value === "ON")).toHaveLength(count);
}
test("BONK rules persist, edit ×2 to ×3, and execute the saved behavior", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await start(page); await load(page, [...button,...led,...buzzer,...oled], [...buttonLinks,...ledLinks,...buzzerLinks,...oledLinks]);
  await page.getByRole("button", { name: "Logic", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tell the circuit what should happen." })).toBeVisible();
  await page.getByRole("button", { name: "Start from BONK" }).click();
  await expect.poll(async () => (await saved(page)).logic.length).toBe(2);
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await expect(page.getByText("Project Logic · saved behavior")).toBeVisible();
  await expect(page.locator(".simulation-outputs > span").filter({ hasText: /^3.3 V SSD1306 I²C OLED:/ })).toContainText("READY");
  await page.getByRole("button", { name: "Press button" }).click();
  await expect(page.locator(".simulation-outputs > span").filter({ hasText: /^LED:/ })).toContainText("ON");
  await pulses(page,2); await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Release button" }).click();
  await expect(page.locator(".simulation-outputs > span").filter({ hasText: /^3.3 V SSD1306 I²C OLED:/ })).toContainText("READY");
  await page.getByRole("button", { name: "Logic", exact: true }).click();
  await page.getByLabel("Action 3 beep count").fill("3");
  await expect.poll(async () => (await saved(page)).logic[0].do[2]).toMatchObject({ count: 3 });
  const authoredAt = (await saved(page)).metadata.updatedAt;
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page.getByRole("button", { name: "Press button" }).click();
  await pulses(page,3); expect((await saved(page)).metadata.updatedAt).toBe(authoredAt); await page.reload();
  await page.getByRole("button", { name: "Logic", exact: true }).click();
  await expect(page.getByLabel("Action 3 beep count")).toHaveValue("3");
  await page.getByLabel("Action 3 beep count").fill("9");
  await expect(page.locator(".logic-rule").first().getByRole("alert")).toBeVisible();
  expect((await saved(page)).logic[0].do[2]).toMatchObject({ count: 3 });
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByLabel("Parts on this table").getByRole("button", { name: "LED", exact: true }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("behavior");
  expect((await saved(page)).components.some(c => c.id === "led-1")).toBe(true);
  await page.getByRole("button", { name: "Logic", exact: true }).click();
  expect(errors).toEqual([]);
  mkdirSync("../../output/playwright", { recursive: true });
  for (const [width,height] of [[390,844],[768,1024],[1440,900],[1600,1000],[1920,1080]]) { await page.setViewportSize({ width,height }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true); await page.screenshot({ path: `../../output/playwright/logic-bonk-${width}.png`, fullPage: true }); }
});
test("logic controls stay usable with keyboard and without WebGL", async ({ page }) => {
  await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type: string,...args: unknown[]) { return type.includes("webgl") ? null : original.apply(this,[type,...args] as Parameters<typeof original>); } as typeof original; });
  await start(page); await load(page, [...button,...led], [...buttonLinks,...ledLinks]);
  await expect(page.getByText("3D editing is unavailable.")).toBeVisible();
  await page.getByRole("button", { name: "Logic", exact: true }).click(); await page.getByRole("button", { name: "Add behavior" }).focus(); await page.keyboard.press("Enter");
  await expect.poll(async () => (await saved(page)).logic.length).toBe(1);
  await page.getByRole("button", { name: "Undo logic edit" }).click(); await expect.poll(async () => (await saved(page)).logic.length).toBe(0);
  await page.getByRole("button", { name: "Redo logic edit" }).click(); await expect.poll(async () => (await saved(page)).logic.length).toBe(1);
  await page.getByRole("checkbox", { name: "Enabled" }).focus(); await page.keyboard.press("Space");
  await expect.poll(async () => (await saved(page)).logic[0].enabled).toBe(false);
  await page.keyboard.press("Space"); await expect.poll(async () => (await saved(page)).logic[0].enabled).toBe(true);
  await page.getByLabel("Behavior 1 trigger").focus(); await page.keyboard.press("End"); await page.keyboard.press("Enter");
  await page.getByLabel("Timer interval milliseconds").fill("500");
  await page.getByLabel("Action 1 LED state").selectOption("toggle");
  await expect.poll(async () => (await saved(page)).logic[0].when).toMatchObject({ kind: "timer", intervalMs: 500 });
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".simulation-outputs > span").filter({ hasText: /^LED:/ })).toContainText("ON", { timeout: 3000 });
  await page.getByRole("button", { name: "Logic", exact: true }).click();
  await page.getByRole("button", { name: "Delete behavior 1" }).click(); await expect.poll(async () => (await saved(page)).logic.length).toBe(0);
});
test("DHT IF and timer Blink edit through the visible controls", async ({ page }) => {
  await start(page); await load(page,[...dht,...oled],[...dhtLinks,...oledLinks]);
  await page.getByRole("button", { name: "Logic", exact: true }).click(); await page.getByRole("button", { name: "Add behavior" }).click();
  await page.getByRole("button", { name: "+ Condition" }).click();
  await page.getByLabel("Action 1 OLED text").fill("HOT");
  await expect.poll(async () => (await saved(page)).logic[0].if.length).toBe(1);
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  await page.getByLabel("Temperature °C").fill("29");
  await expect(page.locator(".simulation-outputs > span").filter({ hasText: /^3.3 V SSD1306 I²C OLED:/ })).not.toContainText("HOT");
  await page.getByLabel("Temperature °C").fill("30");
  await expect(page.locator(".simulation-outputs > span").filter({ hasText: /^3.3 V SSD1306 I²C OLED:/ })).toContainText("HOT");
  await page.getByRole("button", { name: "Logic", exact: true }).click();
  await page.getByLabel("Condition 1 operator").selectOption("==");
  await expect.poll(async () => (await saved(page)).logic[0].if[0].operator).toBe("==");
  await page.getByRole("button", { name: "Remove condition 1" }).click();
  await expect.poll(async () => (await saved(page)).logic[0].if.length).toBe(0);
  await page.getByRole("button", { name: "Delete behavior 1" }).click();
  await expect.poll(async () => (await saved(page)).logic.length).toBe(0);
});
test("touch editing can add, reorder and remove rules and actions", async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,storageState:process.env.E2E_STORAGE_STATE});
  try {
    await protectPreview(context); const page=await context.newPage(); await start(page); await load(page,[...button,...led],[...buttonLinks,...ledLinks]);
    await page.getByRole("button",{name:"Logic",exact:true}).tap(); await page.getByRole("button",{name:"Add behavior",exact:true}).tap();
    await expect.poll(async ()=>(await saved(page)).logic.length).toBe(1);
    await page.getByRole("button",{name:"+ Action",exact:true}).tap(); await expect.poll(async ()=>(await saved(page)).logic[0].do.length).toBe(2);
    await page.getByLabel("Action 2 LED state").selectOption("off"); await expect.poll(async ()=>(await saved(page)).logic[0].do[1]).toMatchObject({operation:"off"});
    await page.getByRole("button",{name:"Move action 2 up",exact:true}).tap(); await expect.poll(async ()=>(await saved(page)).logic[0].do[0]).toMatchObject({operation:"off"});
    await page.getByRole("button",{name:"Remove action 2",exact:true}).tap(); await expect.poll(async ()=>(await saved(page)).logic[0].do.length).toBe(1);
    const firstId=(await saved(page)).logic[0].id;
    await page.getByRole("button",{name:"+ Add behavior",exact:true}).tap(); await expect.poll(async ()=>(await saved(page)).logic.length).toBe(2);
    await page.getByRole("button",{name:"Move behavior 2 up",exact:true}).tap(); await expect.poll(async ()=>(await saved(page)).logic[1].id).toBe(firstId);
    await page.getByRole("button",{name:"Delete behavior 1",exact:true}).tap(); await expect.poll(async ()=>(await saved(page)).logic.length).toBe(1);
    await expect(page.getByRole("button",{name:"Select behavior 1",exact:true})).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  } finally { await context.close(); }
});
test("BONK ×3 survives a full local browser restart", async ({}, testInfo) => {
  test.skip(!!process.env.E2E_BASE_URL,"Persistent local browser check");
  const root=resolve("../../output/playwright"); mkdirSync(root,{recursive:true}); const directory=mkdtempSync(`${root}${sep}logic-restart-`);
  const launch=()=>chromium.launchPersistentContext(directory,{channel:process.env.PLAYWRIGHT_CHANNEL,headless:true,baseURL:testInfo.project.use.baseURL});
  let context=await launch();
  try {
    const page=await context.newPage(); await start(page); await load(page,[...button,...led,...buzzer,...oled],[...buttonLinks,...ledLinks,...buzzerLinks,...oledLinks]);
    await page.getByRole("button",{name:"Logic",exact:true}).click(); await page.getByRole("button",{name:"Start from BONK"}).click();
    await page.getByLabel("Action 3 beep count").fill("3"); await expect.poll(async ()=>(await saved(page)).logic[0].do[2]).toMatchObject({count:3});
    const id=(await saved(page)).id; await context.close(); context=await launch();
    const restored=await context.newPage(); await restored.goto("/table"); await expect(restored.locator("[data-project-id]")).toHaveAttribute("data-project-id",id);
    await restored.getByRole("button",{name:"Logic",exact:true}).click(); await expect(restored.getByLabel("Action 3 beep count")).toHaveValue("3");
    expect((await saved(restored)).logic[0].do[2]).toMatchObject({count:3});
    await restored.getByRole("button",{name:"Simulate",exact:true}).click(); await restored.getByRole("button",{name:"Press button"}).click();
    await expect(restored.locator(".simulation-outputs > span").filter({hasText:/^3.3 V SSD1306/})).toContainText("BONK!");
  } finally { await context.close(); if(resolve(directory).startsWith(`${root}${sep}`)) rmSync(directory,{recursive:true,force:true}); }
});
