import { test, expect } from "@playwright/test";
import { protectPreview } from "./protectedPreview";

test("direct Parts load uses the persisted board for compatibility", async ({ context, page }) => {
  await protectPreview(context);
  await page.goto("/start");
  await page.getByRole("radio", { name: "Raspberry Pi Pico" }).check();
  await page.getByRole("button", { name: "Continue with Raspberry Pi Pico" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.close();

  const cold = await context.newPage();
  await cold.goto("/parts");
  await expect(cold.getByRole("combobox", { name: "Board" })).toHaveValue("raspberry-pi-pico");
  await cold.getByRole("tab", { name: /Library/ }).click();
  await cold.getByLabel("Search parts").fill("Pico");
  await cold.getByRole("checkbox", { name: "Compatible with board" }).check();
  await expect(cold.getByRole("listitem")).toHaveCount(1);
  await expect(cold.getByRole("listitem")).toContainText("Works with Raspberry Pi Pico");
});
