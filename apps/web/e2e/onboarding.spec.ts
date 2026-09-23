import { test, expect, chromium } from "@playwright/test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, sep } from "node:path";
test("landing entries, persisted board switching, table refresh and history", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  const links = page.getByRole("link", { name: /Open Kinetable/ });
  await expect(links).toHaveCount(3);
  for (const link of await links.all()) await expect(link).toHaveAttribute("href", "/start");
  await links.first().click(); await expect(page).toHaveURL(/\/start$/);
  await page.getByRole("radio", { name: "ESP32", exact: true }).check();
  await expect(page.getByRole("status")).toHaveText("ESP32 selected.");
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Set up my table" })).toBeEnabled();
  await page.reload(); await expect(page.getByRole("radio", { name: "ESP32", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: "Raspberry Pi Pico", exact: true }).check();
  await expect(page.getByRole("radio", { name: "ESP32", exact: true })).not.toBeChecked();
  await expect(page.getByRole("status")).toHaveText("Raspberry Pi Pico selected.");
  await page.getByRole("button", { name: "Set up my table" }).click();
  await expect(page).toHaveURL(/\/table$/); await expect(page.getByRole("img", { name: "Raspberry Pi Pico on your table" })).toBeVisible();
  await page.reload(); await expect(page.locator('[data-board-id="raspberry-pi-pico"]')).toBeVisible();
  await page.goBack(); await expect(page).toHaveURL(/\/start$/); await expect(page.getByRole("radio", { name: "Raspberry Pi Pico", exact: true })).toBeChecked();
  await page.goForward(); await expect(page.getByRole("heading", { name: "What do you want to make?" })).toBeVisible();
  expect(errors).toEqual([]);
});
test("direct table entry redirects, keyboard-only selection and reduced motion work", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto("/table"); expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/start$/);
  const firstBoard = page.getByRole("radio", { name: "ESP32", exact: true });
  await expect(firstBoard).toBeVisible();
  for (let i = 0; i < 8 && !await firstBoard.evaluate(el => el === document.activeElement); i++) await page.keyboard.press("Tab");
  await expect(page.getByRole("radio", { name: "ESP32", exact: true })).toBeFocused();
  await page.keyboard.press("Space"); await expect(page.getByRole("radio", { name: "ESP32", exact: true })).toBeChecked();
  await page.keyboard.press("ArrowRight"); await expect(page.getByRole("radio", { name: "Raspberry Pi Pico", exact: true })).toBeChecked();
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  await expect(page.getByRole("radio", { name: "Arduino Uno", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Set up my table" })).toBeEnabled();
  await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
  await expect(page.locator('[data-board-id="arduino-uno"]')).toBeVisible();
  await page.reload(); await expect(page.getByRole("img", { name: "Arduino Uno on your table" })).toBeVisible();
});
test("direct start, ESP32 handoff and responsive layout", async ({ page }) => {
  const response = await page.goto("/start"); expect(response?.status()).toBe(200);
  await page.getByRole("radio", { name: "ESP32", exact: true }).check();
  await page.getByRole("button", { name: "Set up my table" }).click();
  await expect(page.locator('[data-board-id="esp32-dev-module"]')).toBeVisible();
  mkdirSync("../../output/playwright", { recursive: true });
  for (const [width,height] of [[390,844],[768,1024],[1440,900],[1600,1000],[1920,1080]]) {
    await page.setViewportSize({ width,height });
    await expect(page.getByRole("heading", { name: "What do you want to make?" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390 || width === 1440) await page.screenshot({ path: `../../output/playwright/slice04-table-${width}.png`, fullPage: true });
  }
});
test("board selection works when WebGL is unavailable", async ({ page }) => {
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
  await expect(page.getByRole("heading", { name: "What do you want to make?" })).toBeVisible();
});
test("guest project survives browser restart in IndexedDB", async ({}, testInfo) => {
  test.skip(!!process.env.E2E_BASE_URL, "Persistent local browser check");
  const root = resolve("../../output/playwright"); mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(`${root}${sep}restart-`);
  const launch = () => chromium.launchPersistentContext(directory, { channel: process.env.PLAYWRIGHT_CHANNEL, headless: true });
  let context = await launch();
  try {
    const page = await context.newPage();
    await page.goto(`${testInfo.project.use.baseURL}/start`);
    await page.getByRole("radio", { name: "ESP32", exact: true }).check();
    await page.getByRole("button", { name: "Set up my table" }).click();
    const projectId = await page.locator("[data-project-id]").getAttribute("data-project-id");
    expect(projectId).toBeTruthy();
    await context.close();
    context = await launch();
    const restored = await context.newPage();
    await restored.goto(`${testInfo.project.use.baseURL}/table`);
    await expect(restored.locator("[data-project-id]")).toHaveAttribute("data-project-id", projectId!);
    await expect(restored.locator('[data-board-id="esp32-dev-module"]')).toBeVisible();
  } finally {
    await context.close();
    if (resolve(directory).startsWith(`${root}${sep}`)) rmSync(directory, { recursive: true, force: true });
  }
});
