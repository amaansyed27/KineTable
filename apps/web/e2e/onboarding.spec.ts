import { test, expect } from "@playwright/test";
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
  await page.goForward(); await expect(page.getByRole("heading", { name: "Your table is ready." })).toBeVisible();
  expect(errors).toEqual([]);
});
test("direct table entry redirects, keyboard-only selection and reduced motion work", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const response = await page.goto("/table"); expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/start$/);
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
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
  for (const [width,height] of [[390,844],[768,1024],[1440,900],[1600,1000],[1920,1080]]) {
    await page.setViewportSize({ width,height });
    await expect(page.getByRole("heading", { name: "Your table is ready." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  await expect(page.getByRole("heading", { name: "Your table is ready." })).toBeVisible();
});
