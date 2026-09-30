import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { getDefinition } from "../src/component-library/catalog";
import { bonkProject } from "../src/projects/starters";
import type { KinetableProjectV4 } from "../src/projects/v4";
import { protectPreview } from "./protectedPreview";
test.beforeEach(async ({ context }) => protectPreview(context));
const intent = "Press a button and make it go BONK.";
const captureRoot = "../../output/playwright/prompt-to-project";
async function setup(page: Page, board = "ESP32") {
  await page.goto("/start"); await page.getByRole("radio", { name: board, exact: true }).check();
  await page.getByRole("button", { name: /^Continue with/ }).click(); await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByLabel("Describe your idea")).toBeVisible();
}
async function rows(page: Page): Promise<{ id: string; document: KinetableProjectV4 }[]> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("kinetable"); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const all = request.result.transaction("projects").objectStore("projects").getAll(); all.onsuccess = () => { request.result.close(); resolve(all.result); }; all.onerror = () => reject(all.error); };
  }));
}
async function provider(page: Page) {
  await page.evaluate(() => localStorage.setItem("kinetable:providers:v1", JSON.stringify({ profile: { id: "qa", name: "QA", routes: [{ id: "qa", providerId: "custom", transport: "CUSTOM_OPENAI_COMPATIBLE", modelId: "qa", baseUrl: "https://example.com/v1", authMode: "none", credentialIds: [], enabled: true, priority: 0 }] }, credentials: [] })));
}
test("Home intent → canonical proposal → one real project → normal Workbench and refresh", async ({ page }) => {
  let requests = 0; page.on("request", request => { if (request.url().includes("/api/ai/plan")) requests++; });
  await setup(page); const before = await rows(page);
  await page.getByLabel("Describe your idea").fill(intent);
  await page.getByLabel("Describe your idea").press("Enter");
  await expect(page.locator(".intent-proposal").getByRole("heading", { name: "BONK", exact: true })).toBeFocused();
  expect(await rows(page)).toEqual(before); expect(requests).toBe(0);
  await expect(page.getByText("You have 0 of 7 parts.")).toBeVisible();
  await page.getByRole("button", { name: "Back to edit" }).click();
  await expect(page.getByLabel("Describe your idea")).toBeFocused();
  await page.getByLabel("Describe your idea").press("Enter");
  await page.getByRole("button", { name: "Build virtually anyway" }).dblclick();
  await expect(page.locator("[data-project-id]")).toBeVisible();
  const id = await page.locator("[data-project-id]").getAttribute("data-project-id");
  const saved = (await rows(page)).find(row => row.id === id)!.document;
  const canonical = bonkProject({ ...saved, components: [saved.components[0]], wires: [], terminalPlacements: [], logic: [], layout: { entities: { [saved.components[0].id]: saved.layout.entities[saved.components[0].id] } } });
  expect(saved.wires).toEqual(canonical.wires); expect(saved.terminalPlacements).toEqual(canonical.terminalPlacements); expect(saved.logic).toEqual(canonical.logic);
  expect((await rows(page)).filter(row => row.document.intent?.text === intent)).toHaveLength(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await rows(page)).find(row => row.id === id)!.document.components.length).toBe(1);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => (await rows(page)).find(row => row.id === id)!.document.logic.length).toBe(2);
  for (const mode of ["Logic", "Simulate", "Explain", "Build"]) { await page.getByRole("button", { name: mode, exact: true }).click(); await expect(page.locator(".workbench")).toHaveAttribute("data-mode", mode.toLowerCase()); }
  await page.getByRole("button", { name: "✦ Ask Kinetable" }).click(); await expect(page.locator(".ai-sheet")).toBeVisible();
  await page.getByRole("button", { name: "Close AI assistance" }).click(); await expect(page.locator(".ai-sheet")).toHaveCount(0);
  await page.reload(); await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", id!);
  mkdirSync(captureRoot, { recursive: true }); await page.screenshot({ path: `${captureRoot}/acceptance-workbench.png`, fullPage: true });
  await page.goto(`/projects/${id}/history`); await expect(page.getByText("Created project", { exact: true }).first()).toBeVisible();
});
test("inventory complete and missing proposals use quantities and never consume parts", async ({ page }) => {
  await setup(page); await page.goto("/parts"); await page.getByRole("tab", { name: /Library/ }).click();
  for (const id of ["esp32-dev-module", "breadboard-half-400", "push-button", "led-5mm", "resistor-220r", "grove-buzzer-v1-1", "oled-ssd1306-i2c-3v3"]) {
    await page.locator(".parts-row").filter({ has: page.getByRole("button", { name: `Inspect ${getDefinition(id)!.name}`, exact: true }) }).getByRole("button", { name: "Add to My Parts" }).click();
  }
  await page.getByRole("button", { name: "Add one Push button" }).click();
  await expect(page.getByRole("status", { name: "2 owned" })).toBeVisible();
  await page.goto("/home"); await page.getByLabel("Describe your idea").fill(intent); await page.getByRole("button", { name: "See proposal" }).click();
  await expect(page.getByText("You already have everything.")).toBeVisible();
  mkdirSync(captureRoot, { recursive: true }); await page.screenshot({ path: `${captureRoot}/inventory-complete.png`, fullPage: true });
  await page.getByRole("button", { name: "Back to edit" }).click(); await page.goto("/parts");
  await page.locator(".parts-row").filter({ has: page.getByRole("button", { name: `Inspect ${getDefinition("oled-ssd1306-i2c-3v3")!.name}`, exact: true }) }).getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("button", { name: "Inspect 3.3 V SSD1306 I²C OLED", exact: true })).toHaveCount(0);
  await page.goto("/projects/new"); await page.getByLabel("Describe your idea").fill(intent); await page.getByRole("button", { name: "See proposal" }).click();
  await expect(page.getByText("You have 6 of 7 parts.")).toBeVisible(); await expect(page.getByText(/^Missing:/)).toContainText("OLED");
  await expect(page.locator(".new-build-board canvas")).toBeVisible();
  await page.screenshot({ path: `${captureRoot}/missing-parts.png`, fullPage: true });
  await page.getByRole("button", { name: "Build virtually anyway" }).click(); await expect(page.locator("[data-project-id]")).toBeVisible();
  await page.goto("/parts"); await expect(page.getByRole("status", { name: "2 owned" })).toBeVisible();
});
test("one planning operation survives double Enter, rerender and cancel; provider absence is safe", async ({ page }) => {
  await setup(page); await page.getByLabel("Describe your idea").fill("Make a motion alarm"); await page.getByRole("button", { name: "See proposal" }).click();
  await expect(page.getByRole("alert")).toContainText("Choose a local model");
  const before = await rows(page); await page.getByRole("link", { name: "set up AI providers →" }).click(); await expect(page).toHaveURL(/\/settings\/providers$/);
  await page.goto("/home"); await expect(page.getByLabel("Describe your idea")).toHaveValue("Make a motion alarm"); await provider(page);
  let requests = 0; let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/ai/plan", async route => { requests++; const body = route.request().postDataJSON(); await pending; await route.fulfill({ json: { status: "unsupported", summary: "Kinetable can’t build that complete system yet.", unsupportedReason: "Start with motion sensing or an OLED status display.", commands: [], revision: body.input.revision } }); });
  await page.getByLabel("Describe your idea").fill("Build a drone autopilot with GPS and LiDAR");
  await page.getByLabel("Describe your idea").press("Enter"); await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Planning your build");
  expect(requests).toBe(1); await page.setViewportSize({ width: 390, height: 844 }); expect(requests).toBe(1);
  release(); await expect(page.getByRole("heading", { name: "Not supported yet" })).toBeFocused(); expect(await rows(page)).toEqual(before);
  mkdirSync(captureRoot, { recursive: true }); await page.screenshot({ path: `${captureRoot}/unsupported-mobile.png`, fullPage: true });
  await page.getByRole("button", { name: "Back to edit" }).click(); await page.goto("/projects/new");
  await page.getByRole("link", { name: "← Projects" }).click(); expect(await rows(page)).toEqual(before);
});
for (const board of ["ESP32", "Raspberry Pi Pico", "Arduino Uno"]) test(`persisted ${board} context reaches the planner and standard project`, async ({ page }) => {
  await setup(page, board); await provider(page); await page.reload();
  let requests = 0;
  await page.route("**/api/ai/plan", route => {
    requests++; const body = route.request().postDataJSON(); const definition = getDefinition(body.input.boardId)!;
    expect(definition.name).toBe(board === "ESP32" ? "ESP32 Dev Module" : board);
    const signal = definition.pins.find(pin => pin.role === "digital-io")!.id;
    const ground = definition.pins.find(pin => pin.role === "ground")!.id;
    const e = (componentId: string, pinId: string) => ({ componentId, pinId });
    const commands = [{ type: "component.add", instanceId: "led", definitionId: "led-5mm" }, { type: "component.add", instanceId: "resistor", definitionId: "resistor-220r" },
      { type: "connection.create", id: "one", from: e("board-main", signal), to: e("resistor", "a") }, { type: "connection.create", id: "two", from: e("resistor", "b"), to: e("led", "anode") }, { type: "connection.create", id: "three", from: e("led", "cathode"), to: e("board-main", ground) }];
    return route.fulfill({ json: { status: "supported", summary: "Protected LED circuit", unsupportedReason: "", commands, revision: body.input.revision } });
  });
  await page.getByLabel("Describe your idea").fill("Make an LED blink"); await page.getByRole("button", { name: "See proposal" }).click();
  await expect(page.locator(".intent-parts")).toContainText(board === "ESP32" ? "ESP32 Dev Module" : board);
  await page.getByRole("button", { name: "Build virtually anyway" }).click(); await expect(page.locator("[data-board-id]")).toHaveAttribute("data-board-id", getDefinition(board === "ESP32" ? "esp32-dev-module" : board === "Arduino Uno" ? "arduino-uno" : "raspberry-pi-pico")!.id);
  expect(requests).toBe(1);
});
test("Home, focused prompt, content, proposal, errors, handoff and trailer fit five sizes and both themes", async ({ page }) => {
  test.setTimeout(120000); const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await setup(page); mkdirSync(captureRoot, { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    await page.goto("/settings/appearance"); await page.getByRole("button", { name: theme === "light" ? "Light" : "Dark", exact: true }).click();
    for (const [width, height] of [[390,844], [768,1024], [1440,900], [1600,1000], [1920,1080]]) {
      await page.setViewportSize({ width, height }); await page.goto("/home");
      const capture = async (state: string) => { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.screenshot({ path: `${captureRoot}/${theme}-${width}-${state}.png`, fullPage: true }); };
      await expect(page.locator(".home-hardware canvas")).toBeVisible();
      await page.getByLabel("Describe your idea").fill(""); await page.getByRole("heading", { name: "What do you want to make?" }).click(); await capture("home");
      await page.getByLabel("Describe your idea").focus(); await capture("focused");
      await page.getByLabel("Describe your idea").fill(intent); await capture("content");
      await page.getByRole("button", { name: "See proposal" }).click(); await expect(page.locator(".intent-parts")).toBeVisible(); await capture("proposal");
      await page.getByRole("button", { name: "Back to edit" }).click(); await page.getByLabel("Describe your idea").fill("Make a motion alarm"); await page.getByRole("button", { name: "See proposal" }).click(); await expect(page.getByRole("alert")).toContainText("Choose a local model"); await capture("provider-absent");
    }
  }
  await page.goto("/home"); await page.getByLabel("Describe your idea").fill(intent); await page.getByRole("button", { name: "See proposal" }).click();
  await page.getByRole("button", { name: "Build virtually anyway" }).click(); await expect(page.locator("[data-project-id]")).toBeVisible();
  for (const [width, height] of [[390,844], [768,1024], [1440,900], [1600,1000], [1920,1080]]) { await page.setViewportSize({ width, height }); await page.screenshot({ path: `${captureRoot}/handoff-${width}.png`, fullPage: true }); }
  let mediaRequests = 0; page.on("request", request => { if (request.url().endsWith("kinetable-trailer.mp4")) mediaRequests++; });
  await page.goto("/"); await page.locator(".landing-trailer").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Play Kinetable trailer" })).toBeVisible(); expect(mediaRequests).toBe(0);
  await expect.poll(async () => page.locator(".trailer-play img").evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: `${captureRoot}/trailer-desktop.png`, fullPage: true }); await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${captureRoot}/trailer-mobile.png`, fullPage: true });
  await page.getByRole("button", { name: "Play Kinetable trailer" }).click(); await expect(page.locator(".trailer-frame video")).toHaveAttribute("preload", "none");
  await expect.poll(async () => page.locator(".trailer-frame video").evaluate(video => (video as HTMLVideoElement).readyState)).toBeGreaterThan(1);
  expect(mediaRequests).toBeGreaterThan(0); expect(errors).toEqual([]);
});
