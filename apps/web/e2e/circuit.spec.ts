import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { starterProject } from "../src/projects/schema";
import { migrateProject as migrateV2, type KinetableProjectV2 } from "../src/projects/v2";
import { holeEndpoint, pinEndpoint, type ElectricalEndpoint, type KinetableProjectV3 } from "../src/projects/v3";
import { endpointWorld } from "../src/spatial/anchors";
import { layoutComponents } from "../src/hardware-core/layout";
import { protectPreview } from "./protectedPreview";

test.beforeEach(async ({ context }) => protectPreview(context));

async function start(page: Page) {
  await page.goto("/start");
  await page.getByRole("radio", { name: "ESP32", exact: true }).check();
  await page.getByRole("button", { name: /^Continue with/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/table");
  await expect(page.locator("[data-project-id]")).toBeVisible();
  await page.getByText("Parts & connections", {exact:true}).click();
  await expect(page.locator(".workbench-surface canvas")).toBeVisible();
}
async function saved(page: Page) {
  const id = await page.locator("[data-project-id]").getAttribute("data-project-id");
  return page.evaluate(projectId => new Promise<KinetableProjectV3>((resolve, reject) => {
    const request = indexedDB.open("kinetable"); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const tx = request.result.transaction("projects", "readonly"), row = tx.objectStore("projects").get(projectId!); row.onsuccess = () => resolve(row.result.document); row.onerror = () => reject(row.error); };
  }), id);
}
async function choose(page: Page, label: "From" | "To", key: string) { if(!await page.locator(".workbench-connection-controls").evaluate(el=>(el as HTMLDetailsElement).open))await page.getByText("Accessible connection controls",{exact:true}).click();const [kind,id,pin]=key.split(":");await page.getByLabel(`${label} part`,{exact:true}).selectOption(id);if(kind==="hole")await page.getByLabel(`${label} row or rail`).selectOption(pin.replace(/\d+$/, ""));await page.getByLabel(label, { exact: true }).selectOption(key); }
async function connect(page: Page, from: string, to: string) {
  await choose(page, "From", from); await choose(page, "To", to);
  await page.getByRole("button", { name: "Create wire" }).click();
}
async function screenPoint(page: Page, endpoint: ElectricalEndpoint) {
  const project = await saved(page), box = (await page.locator(".workbench-surface canvas").boundingBox())!;
  const bounds=project.components.reduce((b,c)=>{const t=project.layout.entities[c.id],x=(c.kind==="breadboard"?1.12:c.kind==="board"?.65:.55)*t.scale[0],y=(c.kind==="breadboard"?1.53:c.kind==="board"?1.2:.45)*(c.kind==="component"?t.scale[1]:t.scale[2]);return {left:Math.min(b.left,t.position[0]-x),right:Math.max(b.right,t.position[0]+x),bottom:Math.min(b.bottom,t.position[1]-y),top:Math.max(b.top,t.position[1]+y)};},{left:Infinity,right:-Infinity,bottom:Infinity,top:-Infinity});
  const zoom=Math.max(20,Math.min(160,box.width/(bounds.right-bounds.left+1.4),box.height/(bounds.top-bounds.bottom+1.8)));
  const point = endpointWorld(project, endpoint);
  return { x: box.x+box.width/2+(point.x-(bounds.left+bounds.right)/2)*zoom,y:box.y+box.height/2-(point.y-(bounds.bottom+bounds.top)/2)*zoom };
}

test("a guest builds a physical circuit, inspects its net, undoes a removal and restores it", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await start(page);
  await page.getByRole("button", { name: "+ Breadboard" }).click();
  await expect.poll(async () => (await saved(page)).schemaVersion).toBe(4);
  await expect.poll(async () => (await saved(page)).components.some(c => c.definitionId === "breadboard-half-400")).toBe(true);
  mkdirSync("../../output/playwright", { recursive: true });
  for (const [width, height] of [[390,844],[768,1024],[1440,900],[1600,1000],[1920,1080]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `../../output/playwright/circuit-breadboard-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByText("Accessible connection controls").click();
  await connect(page, "pin:board-main:gnd", "hole:breadboard-1:L-1");
  await expect.poll(async () => (await saved(page)).wires).toHaveLength(1);
  await choose(page, "From", "hole:breadboard-1:L-14");
  await page.getByRole("button", { name: "Inspect from" }).click();
  await expect(page.getByLabel("Breadboard hole inspector")).toContainText("L-25");
  await expect(page.getByLabel("Breadboard hole inspector")).toContainText("ESP32 Dev Module GND");
  await page.screenshot({ path: "../../output/playwright/circuit-connected-hole-1440.png", fullPage: true });

  await page.getByRole("button", { name: "+ Part" }).click();
  await page.getByRole("dialog", { name: "Add part" }).getByRole("button", { name: "LED", exact: true }).click();
  if (!await page.locator(".workbench-object-list").evaluate(el=>(el as HTMLDetailsElement).open)) await page.getByText("Parts & connections",{exact:true}).click();
  await page.getByRole("button", { name: "LED", exact: true }).click();
  await expect(page.getByLabel("LED inspector")).toContainText("series resistor");
  await page.getByLabel("LED inspector").getByRole("listitem").filter({ hasText: "CATHODE" }).getByRole("button", { name: "Insert lead" }).click();
  await choose(page, "To", "hole:breadboard-1:L-14");
  await page.getByRole("button", { name: "Place lead in destination hole" }).click();
  await expect.poll(async () => (await saved(page)).terminalPlacements).toHaveLength(1);

  await page.getByRole("button", { name: "+ Part" }).click();
  await page.getByRole("dialog", { name: "Add part" }).getByRole("button", { name: "220 Ω resistor" }).click();
  const parts = (await saved(page)).components;
  const led = parts.find(c => c.definitionId === "led-5mm")!.id;
  const resistor = parts.find(c => c.definitionId === "resistor-220r")!.id;
  await connect(page, "pin:board-main:gpio23", `pin:${resistor}:a`);
  await connect(page, `pin:${resistor}:b`, `pin:${led}:anode`);
  await expect(page.getByText("Connections complete")).toBeVisible();
  await page.screenshot({ path: "../../output/playwright/circuit-complete-1440.png", fullPage: true });
  if (!await page.locator(".workbench-object-list").evaluate(el=>(el as HTMLDetailsElement).open)) await page.getByText("Parts & connections",{exact:true}).click();
  await page.getByLabel("Wires on this table").getByRole("button").first().click();
  await expect(page.getByLabel("Wire inspector")).toContainText("ESP32 Dev Module GND");
  await page.screenshot({ path: "../../output/playwright/circuit-wire-inspector-1440.png", fullPage: true });
  await page.getByRole("button", { name: "Remove wire" }).click();
  await expect(page.getByText("Connection guidance", {exact:true})).toBeVisible();
  await page.screenshot({ path: "../../output/playwright/circuit-incomplete-1440.png", fullPage: true });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByText("Connections complete")).toBeVisible();
  await page.reload(); await expect(page.locator("[data-project-id]")).toBeVisible(); await page.getByText("Parts & connections",{exact:true}).click();
  await expect.poll(async () => (await saved(page)).wires).toHaveLength(3);
  await expect.poll(async () => (await saved(page)).terminalPlacements).toHaveLength(1);
  await expect(page.getByText("Connections complete")).toBeVisible();
  expect(errors).toEqual([]);
});

test("unsafe wiring is rejected without a persisted wire or history entry", async ({ page }) => {
  await start(page);
  await page.getByText("Accessible connection controls").click();
  const before = await saved(page);
  await connect(page, "pin:board-main:3v3", "pin:board-main:gnd");
  await expect(page.getByRole("alert")).toContainText("Power cannot connect to ground");
  expect((await saved(page)).wires).toEqual(before.wires);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

test("mobile and WebGL fallback keep circuit controls readable", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await protectPreview(context);
    const page = await context.newPage(); await start(page);
    await page.getByRole("button", { name: "+ Breadboard" }).click();
    await page.getByText("Accessible connection controls").click();
    await connect(page, "pin:board-main:gnd", "hole:breadboard-1:L-1");
    await expect.poll(async () => (await saved(page)).wires).toHaveLength(1);
  if (!await page.locator(".workbench-object-list").evaluate(el=>(el as HTMLDetailsElement).open)) await page.getByText("Parts & connections",{exact:true}).click();
    await page.getByLabel("Wires on this table").getByRole("button").click();
    await expect(page.getByLabel("Wire inspector")).toBeVisible();
    await page.getByRole("button", { name: "Close inspector" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.evaluate(() => window.scrollTo(0,0));
    await page.screenshot({ path: "../../output/playwright/circuit-mobile-390.png", fullPage: true });
  } finally { await context.close(); }
});

test("canvas pin and hole clicks create a wire with live preview and strip selection", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "+ Breadboard" }).click();
  await page.getByRole("button", { name: "Wire", exact: true }).click();
  await page.screenshot({ path: "../../output/playwright/circuit-pin-reveal-1440.png", fullPage: true });
  const source = await screenPoint(page, pinEndpoint("board-main","gnd"));
  await page.mouse.click(source.x, source.y);
  await expect(page.locator(".workbench-gesture")).toContainText("Connect ESP32 Dev Module GND");
  await expect(page.getByRole("alert")).toHaveCount(0);
  const destination = await screenPoint(page, holeEndpoint("breadboard-1","L-1"));
  await page.mouse.move(destination.x, destination.y);
  await page.screenshot({ path: "../../output/playwright/circuit-wire-preview-1440.png", fullPage: true });
  await page.mouse.click(destination.x, destination.y);
  await expect.poll(async () => (await saved(page)).wires).toHaveLength(1);
  await page.getByRole("button", { name: "Wire", exact: true }).click();
  const strip = await screenPoint(page, holeEndpoint("breadboard-1","L-14"));
  await page.mouse.click(strip.x, strip.y);
  await expect(page.getByLabel("Breadboard hole inspector")).toContainText("ESP32 Dev Module GND");
  await page.screenshot({ path: "../../output/playwright/circuit-canvas-hole-1440.png", fullPage: true });
});

test("an existing v2 AI assembly gains visible wires, keeps layout and upgrades only on edit", async ({ page }) => {
  await start(page);
  const old: KinetableProjectV2 = migrateV2(starterProject("esp32-dev-module"));
  old.name = "Existing LED assembly";
  old.components.push({ id: "led-1", kind: "component", definitionId: "led-5mm" }, { id: "resistor-1", kind: "component", definitionId: "resistor-220r" });
  old.layout.entities = layoutComponents(old.components, old.layout.entities);
  old.connections = [
    { id: "drive", from: { componentId: "board-main", pinId: "gpio23" }, to: { componentId: "resistor-1", pinId: "a" } },
    { id: "series", from: { componentId: "resistor-1", pinId: "b" }, to: { componentId: "led-1", pinId: "anode" } },
    { id: "ground", from: { componentId: "led-1", pinId: "cathode" }, to: { componentId: "board-main", pinId: "gnd" } },
  ];
  old.metadata.updatedAt = new Date(Date.now() + 1000).toISOString();
  await page.evaluate(document => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("kinetable"); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const tx = request.result.transaction("projects", "readwrite"); tx.objectStore("projects").put({ id: document.id, name: document.name, schemaVersion: 2, document, createdAt: document.metadata.createdAt, updatedAt: document.metadata.updatedAt, cloudDirty: false }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); };
  }), old);
  await page.goto(`/projects/${old.id}`); await expect(page.locator("[data-project-id]")).toBeVisible(); await page.getByText("Parts & connections",{exact:true}).click();
  await expect(page.getByText("Connections complete")).toBeVisible();
  await expect(page.getByLabel("Wires on this table").getByRole("button")).toHaveCount(3);
  expect((await saved(page)).schemaVersion).toBe(2);
  if (!await page.locator(".workbench-object-list").evaluate(el=>(el as HTMLDetailsElement).open)) await page.getByText("Parts & connections",{exact:true}).click();
  await page.getByRole("button", { name: "LED", exact: true }).click();
  const before = await page.locator(".workbench-surface canvas").screenshot();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await saved(page)).schemaVersion).toBe(4);
  expect((await saved(page)).wires).toHaveLength(3);
  expect(await page.locator(".workbench-surface canvas").screenshot()).not.toEqual(before);
  await expect(page.getByText("Connections complete")).toBeVisible();
  if (!await page.locator(".workbench-object-list").evaluate(el=>(el as HTMLDetailsElement).open)) await page.getByText("Parts & connections",{exact:true}).click();
  await page.getByLabel("Wires on this table").getByRole("button").first().click();
  await expect(page.getByLabel("Wire inspector")).toContainText("ESP32 Dev Module GPIO23");
});
