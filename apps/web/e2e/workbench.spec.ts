import { test, expect, chromium } from "@playwright/test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, sep } from "node:path";

async function start(page: import("@playwright/test").Page) {
  await page.goto("/start");
  await page.getByRole("radio", { name: "ESP32", exact: true }).check();
  await page.getByRole("button", { name: "Set up my table" }).click();
  await expect(page.locator(".workbench-surface canvas")).toBeVisible();
}
async function saved(page: import("@playwright/test").Page) {
  const id = await page.locator("[data-project-id]").getAttribute("data-project-id");
  return page.evaluate(projectId => new Promise<{ components: { id: string; definitionId: string }[]; layout: { entities: Record<string, { position: number[]; rotation: number[] }> }; metadata: { updatedAt: string } }>((resolve, reject) => {
    const request = indexedDB.open("kinetable"); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const tx = request.result.transaction("projects", "readonly"), row = tx.objectStore("projects").get(projectId!); row.onsuccess = () => resolve(row.result.document); row.onerror = () => reject(row.error); };
  }), id);
}

test("guest edits parts and transforms with local persistence, undo and redo", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await start(page);
  await expect(page.getByRole("button", { name: "Simulate · later" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Explain · later" })).toBeDisabled();
  await page.getByRole("button", { name: "+ Add part" }).click();
  await expect(page.getByRole("dialog", { name: "Add part" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "LED", exact: true }).click();
  await expect(page.getByText(/Incomplete ·/)).toBeVisible();
  const led = (await saved(page)).components.find(c => c.definitionId === "led-5mm")!;
  await page.reload();
  await expect(page.getByRole("button", { name: "LED", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "LED", exact: true }).click();
  const beforeMove = (await saved(page)).layout.entities[led.id].position[0];
  await page.evaluate(() => { const input = document.createElement("input"); input.id = "shortcut-probe"; document.body.append(input); input.focus(); });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Control+z");
  expect((await saved(page)).layout.entities[led.id].position[0]).toBe(beforeMove);
  await page.locator("#shortcut-probe").evaluate(element => element.remove());
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await saved(page)).layout.entities[led.id].position[0]).toBeGreaterThan(beforeMove + .29);
  await page.reload();
  expect((await saved(page)).layout.entities[led.id].position[0]).toBeGreaterThan(beforeMove);
  await page.getByRole("button", { name: "LED", exact: true }).click();
  const beforeRotate = (await saved(page)).layout.entities[led.id].rotation[2];
  await page.getByRole("button", { name: "Rotate right 15 degrees" }).click();
  await expect.poll(async () => (await saved(page)).layout.entities[led.id].rotation[2]).toBeGreaterThan(beforeRotate);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await saved(page)).layout.entities[led.id].rotation[2]).toBe(beforeRotate);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => (await saved(page)).layout.entities[led.id].rotation[2]).toBeGreaterThan(beforeRotate);
  await page.getByRole("button", { name: "Focus" }).click();
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.getByRole("button", { name: "Replace" }).click();
  await page.getByRole("dialog", { name: "Replace part" }).getByRole("button", { name: "DHT11 module" }).click();
  await expect(page.getByRole("button", { name: "DHT11 module", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "LED", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "LED", exact: true }).click();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("button", { name: "LED", exact: true })).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "LED", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("canvas drag, keyboard controls and responsive workbench remain usable", async ({ page }) => {
  await start(page);
  mkdirSync("../../output/playwright", { recursive: true });
  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900], [1600, 1000], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator(".workbench-surface canvas")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `../../output/playwright/workbench-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const board = page.locator(".workbench-surface canvas");
  const box = (await board.boundingBox())!;
  const startX = box.x + box.width / 2, startY = box.y + box.height / 2;
  const before = (await saved(page)).layout.entities["board-main"].position[0];
  await page.mouse.move(startX, startY);
  await page.screenshot({ path: "../../output/playwright/workbench-hover.png", fullPage: true });
  await page.mouse.down(); await expect(page.getByLabel("ESP32 Dev Module inspector")).toBeVisible(); await page.mouse.move(startX + 60, startY, { steps: 8 }); await page.mouse.up();
  await expect.poll(async () => (await saved(page)).layout.entities["board-main"].position[0]).toBeGreaterThan(before);
  await page.screenshot({ path: "../../output/playwright/workbench-selected.png", fullPage: true });
  await page.getByRole("button", { name: "+ Add part" }).click();
  await page.screenshot({ path: "../../output/playwright/workbench-add-tray.png", fullPage: true });
  await page.getByRole("dialog").getByRole("button", { name: "Push button" }).click();
  await page.getByRole("button", { name: "Push button", exact: true }).click();
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("f");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Push button inspector")).toHaveCount(0);
  await page.getByRole("button", { name: "Push button", exact: true }).click();
  await page.keyboard.press("Delete");
  await expect(page.getByRole("button", { name: "Push button", exact: true })).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "Push button", exact: true })).toBeVisible();
});

test("touch can select and move hardware without overflow", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: process.env.E2E_STORAGE_STATE });
  try {
    const page = await context.newPage();
    await start(page);
    const box = (await page.locator(".workbench-surface canvas").boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    for (let attempt = 0; attempt < 3 && await page.getByLabel("ESP32 Dev Module inspector").count() === 0; attempt++) {
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(300);
    }
    await expect(page.getByLabel("ESP32 Dev Module inspector")).toBeVisible();
    await page.getByRole("button", { name: "Close inspector" }).click();
    const before = (await saved(page)).layout.entities["board-main"].position[0];
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    for (let step = 1; step <= 6; step++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + step * 9, y, id: 1 }] });
      await page.waitForTimeout(40);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => (await saved(page)).layout.entities["board-main"].position[0]).toBeGreaterThan(before);
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(300);
    const beforePinch = await page.locator(".workbench-surface canvas").screenshot();
    await cdp.send("Input.synthesizePinchGesture", { x, y, scaleFactor: 1.4, relativeSpeed: 700 });
    await page.waitForTimeout(300);
    expect(await page.locator(".workbench-surface canvas").screenshot()).not.toEqual(beforePinch);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: "../../output/playwright/workbench-touch-selected.png", fullPage: true });
  } finally { await context.close(); }
});

test("guest spatial edit survives a real browser restart", async ({}, testInfo) => {
  test.skip(!!process.env.E2E_BASE_URL, "Persistent local browser check");
  const root = resolve("../../output/playwright"); mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(`${root}${sep}workbench-restart-`);
  const launch = () => chromium.launchPersistentContext(directory, { channel: process.env.PLAYWRIGHT_CHANNEL, headless: true });
  let context = await launch();
  try {
    const page = await context.newPage();
    await page.goto(`${testInfo.project.use.baseURL}/start`);
    await page.getByRole("radio", { name: "ESP32", exact: true }).check();
    await page.getByRole("button", { name: "Set up my table" }).click();
    await page.getByRole("button", { name: "+ Add part" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "LED", exact: true }).click();
    const led = (await saved(page)).components.find(c => c.definitionId === "led-5mm")!;
    await page.getByRole("button", { name: "LED", exact: true }).click();
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await saved(page)).layout.entities[led.id].position[0]).toBeGreaterThan(-2.8);
    const position = (await saved(page)).layout.entities[led.id].position;
    const projectId = await page.locator("[data-project-id]").getAttribute("data-project-id");
    await context.close(); context = await launch();
    const restored = await context.newPage();
    await restored.goto(`${testInfo.project.use.baseURL}/table`);
    await expect(restored.locator("[data-project-id]")).toHaveAttribute("data-project-id", projectId!);
    expect((await saved(restored)).layout.entities[led.id].position).toEqual(position);
  } finally {
    await context.close();
    if (resolve(directory).startsWith(`${root}${sep}`)) rmSync(directory, { recursive: true, force: true });
  }
});

test("WebGL failure preserves project access and part names", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type.includes("webgl")) return null;
      return original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await page.goto("/start");
  await page.getByRole("radio", { name: "ESP32", exact: true }).check();
  await page.getByRole("button", { name: "Set up my table" }).click();
  await expect(page.getByText("3D editing is unavailable.")).toBeVisible();
  await expect(page.getByRole("button", { name: "ESP32 Dev Module", exact: true })).toBeVisible();
  await expect(page.getByText("First table", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "New Build" })).toBeVisible();
});
