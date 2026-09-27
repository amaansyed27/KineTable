import { test, expect } from "@playwright/test";
import { protectPreview } from "./protectedPreview";

test("Preview direct routes refresh successfully", async ({ page, context }) => {
  test.skip(!process.env.E2E_BASE_URL, "Deployed Preview only");
  await protectPreview(context);
  await page.goto("/start");await page.getByRole("radio",{name:"ESP32",exact:true}).check();await page.getByRole("button",{name:"Continue with ESP32"}).click();await expect(page).toHaveURL(/\/home$/);await page.getByRole("button",{name:/Try BONK/}).click();await expect(page.locator("[data-project-id]")).toBeVisible();const id=await page.locator("[data-project-id]").getAttribute("data-project-id");
  for (const route of ["/", "/home", "/projects", "/projects/new", `/projects/${id}`, "/start", "/auth", "/settings/appearance", "/settings/providers", "/table", "/new"]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("body")).not.toBeEmpty();
    await page.reload();
    await expect(page.locator("body")).not.toBeEmpty();
  }
});
