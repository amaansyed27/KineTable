import { test, expect, chromium } from "@playwright/test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, sep } from "node:path";

async function setup(page: import("@playwright/test").Page) {
  await page.goto("/start");
  await page.getByRole("radio", { name: "ESP32", exact: true }).check();
  await page.getByRole("button", { name: /^Continue with/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/table");
  await expect(page.locator("[data-project-id]")).toBeVisible();
  await page.getByText("Parts & connections", {exact:true}).click();
  await expect(page.locator('[data-board-id="esp32-dev-module"]')).toBeVisible();
}

test("guest starter becomes a real build, and a second build keeps the first", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.stack ?? error.message));
  await page.goto("/new"); await expect(page).toHaveURL(/\/start$/);
  await setup(page);
  const firstId = await page.locator("[data-project-id]").getAttribute("data-project-id");
  await page.goto("/projects/new");
  await expect(page).toHaveURL(/\/new$/);
  await page.getByLabel("Describe your idea").fill("Make a motion alarm");
  await expect(page.getByLabel("Project name")).toHaveValue("Motion Alarm");
  await page.getByRole("button", { name: "Preview starting point" }).click();
  await expect(page.getByRole("heading", { name: "Motion Alarm" })).toBeFocused();
  await expect(page.getByText("No parts or connections have been planned yet.")).toBeVisible();
  await page.getByRole("button", { name: "Back to edit" }).click();
  await page.getByLabel("Project name").fill("My Motion Alarm");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", firstId!);
  await expect(page.getByText("My Motion Alarm")).toBeVisible();
  await page.getByRole("button",{name:"✦ Ask Kinetable"}).click(); await expect(page.locator(".ai-sheet")).toContainText("Make a motion alarm");
  await page.reload();
  await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", firstId!);
  await page.goto("/new"); await expect(page.getByRole("heading", { name: "What do you want to make?" })).toBeVisible();
  await page.reload(); await expect(page.getByRole("heading", { name: "What do you want to make?" })).toBeVisible();
  await page.goto("/projects");
  await page.goto("/projects/new");
  await page.getByLabel("Describe your idea").fill("Make an LED blink");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  const secondId = await page.locator("[data-project-id]").getAttribute("data-project-id");
  expect(secondId).toBeTruthy(); expect(secondId).not.toBe(firstId);
  await expect(page.getByText("LED Blink", { exact: true })).toBeVisible();
  const projects = await page.evaluate(async () => new Promise<{ id: string; document: { intent?: { text: string } } }[]>((resolve, reject) => {
    const request = indexedDB.open("kinetable"); request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction("projects", "readonly");
      const all = tx.objectStore("projects").getAll();
      all.onsuccess = () => resolve(all.result);
      all.onerror = () => reject(all.error);
    };
  }));
  expect(projects.map(project => project.id).sort()).toEqual([firstId!, secondId!].sort());
  expect(projects.find(project => project.id === firstId)?.document.intent?.text).toBe("Make a motion alarm");
  await page.reload(); await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", secondId!);
  expect(errors).toEqual([]);
});

test("draft, validation, keyboard creation, offline use and WebGL fallback", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
      if (type.includes("webgl")) return null;
      return original.apply(this, [type, ...args] as Parameters<typeof original>);
    } as typeof original;
  });
  await setup(page);
  await page.route("https://*.supabase.co/**", route => route.abort());
  await page.goto("/projects/new"); await expect(page).toHaveURL(/\/new$/);
  await expect(page.getByLabel("Describe your idea")).toBeFocused();
  await page.keyboard.press("Tab");
  await page.getByLabel("Describe your idea").fill("Make a test build"); await page.getByLabel("Project name").fill("");
  await page.getByRole("button", { name: "Create project" }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Give this build a name");
  await page.getByLabel("Describe your idea").fill("");
  await page.getByLabel("Describe your idea").focus();
  await page.keyboard.type("Make a button beep twice");
  await page.keyboard.press("Enter"); await page.keyboard.type("When pressed");
  await page.getByLabel("Project name").fill("Button beeps twice");
  await expect(page.getByLabel("Describe your idea")).toHaveValue("Make a button beep twice\nWhen pressed");
  await page.goto("/projects");
  await page.goto("/projects/new");
  await expect(page.getByLabel("Describe your idea")).toHaveValue("Make a button beep twice\nWhen pressed");
  await page.getByLabel("Describe your idea").focus(); await page.keyboard.press("Tab");
  await expect(page.getByLabel("Project name")).toBeFocused();
  await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Create project" })).toBeFocused();
  await page.keyboard.press("Enter"); await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  await page.getByRole("button",{name:"✦ Ask Kinetable"}).click(); await expect(page.locator(".ai-sheet")).toContainText("Make a button beep twice");
  const id = await page.locator("[data-project-id]").getAttribute("data-project-id");
  await page.reload(); await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", id!);
});

test("new build survives a real browser restart", async ({}, testInfo) => {
  test.skip(!!process.env.E2E_BASE_URL, "Persistent local browser check");
  const root = resolve("../../output/playwright"); mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(`${root}${sep}new-build-restart-`);
  const launch = () => chromium.launchPersistentContext(directory, { channel: process.env.PLAYWRIGHT_CHANNEL, headless: true });
  let context = await launch();
  try {
    const page = await context.newPage();
    await page.goto(`${testInfo.project.use.baseURL}/start`);
    await page.getByRole("radio", { name: "ESP32", exact: true }).check();
    await page.getByRole("button", { name: /^Continue with/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/table");
  await expect(page.locator("[data-project-id]")).toBeVisible();
  await page.getByText("Parts & connections", {exact:true}).click();
    await page.goto("/projects/new");
    await page.getByLabel("Describe your idea").fill("Make a motion alarm");
    await page.getByRole("button", { name: "Create project" }).click();
    const id = await page.locator("[data-project-id]").getAttribute("data-project-id");
    await context.close(); context = await launch();
    const restored = await context.newPage();
    await restored.goto(`${testInfo.project.use.baseURL}/table`);
    await expect(restored.locator("[data-project-id]")).toHaveAttribute("data-project-id", id!);
    await restored.getByRole("button",{name:"✦ Ask Kinetable"}).click(); await expect(restored.locator(".ai-sheet")).toContainText("Make a motion alarm");
  } finally {
    await context.close();
    if (resolve(directory).startsWith(`${root}${sep}`)) rmSync(directory, { recursive: true, force: true });
  }
});

test("new build states fit all required viewports", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page); await page.goto("/projects/new");
  mkdirSync("../../output/playwright", { recursive: true });
  for (const [width, height] of [[390,844],[768,1024],[1440,900],[1600,1000],[1920,1080]]) {
    await page.setViewportSize({ width, height });
    await page.getByLabel("Describe your idea").fill("");
    const check = async (state: string) => {
      await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${state} at ${width}`).toBe(true);
      await page.screenshot({ path: `../../output/playwright/slice05-${state}-${width}.png`, fullPage: true });
    };
    await check("empty");
    await page.getByLabel("Describe your idea").fill("Make a test build"); await page.getByLabel("Project name").fill("");
    await page.getByRole("button", { name: "Create project" }).click(); await expect(page.getByRole("alert")).toContainText("Give this build a name");
    await check("validation");
    await page.getByLabel("Describe your idea").fill("Make a motion alarm"); await page.getByLabel("Project name").fill("Motion Alarm"); await check("typed");
    await page.getByRole("button", { name: "Preview starting point" }).click(); await check("preview");
    await page.getByRole("button", { name: "Back to edit" }).click();
  }
  await page.getByRole("button", { name: "Create project" }).click(); await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
  for (const [width, height] of [[390,844],[768,1024],[1440,900],[1600,1000],[1920,1080]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `table at ${width}`).toBe(true);
    await page.screenshot({ path: `../../output/playwright/slice05-table-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
