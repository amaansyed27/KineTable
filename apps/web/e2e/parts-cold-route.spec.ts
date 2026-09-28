import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { protectPreview } from "./protectedPreview";

for (const board of [
  { name: "ESP32", label: "ESP32 Dev Module", id: "esp32-dev-module" },
  { name: "Raspberry Pi Pico", label: "Raspberry Pi Pico", id: "raspberry-pi-pico" },
  { name: "Arduino Uno", label: "Arduino Uno", id: "arduino-uno" },
]) test(`direct Parts load and reload use persisted ${board.name} compatibility`, async ({ context, page }) => {
  await protectPreview(context);
  await page.goto("/start");
  await page.getByRole("radio", { name: board.name, exact: true }).check();
  await page.getByRole("button", { name: `Continue with ${board.name}` }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.close();

  const cold = await context.newPage();
  await cold.goto("/parts");
  await expect(cold.getByRole("combobox", { name: "Board" })).toHaveValue(board.id);
  await cold.reload();
  await expect(cold.getByRole("combobox", { name: "Board" })).toHaveValue(board.id);
  await cold.getByRole("tab", { name: /Library/ }).click();
  await cold.getByLabel("Search parts").fill(board.label);
  await cold.getByRole("checkbox", { name: "Compatible with board" }).check();
  const result = cold.getByRole("listitem").filter({ has: cold.getByRole("button", { name: `Inspect ${board.label}` }) });
  await expect(result).toBeVisible();
  await expect(result).toContainText(`Works with ${board.label}`);
  mkdirSync("../../output/playwright", { recursive: true });
  await cold.screenshot({ path: `../../output/playwright/cold-parts-${board.id}.png` });
});
