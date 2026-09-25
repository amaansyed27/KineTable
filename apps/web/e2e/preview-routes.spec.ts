import { test, expect } from "@playwright/test";
import { protectPreview } from "./protectedPreview";

test("Preview direct routes refresh successfully", async ({ page, context }) => {
  test.skip(!process.env.E2E_BASE_URL, "Deployed Preview only");
  await protectPreview(context);
  for (const route of ["/", "/start", "/auth", "/table", "/new", "/settings/providers"]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("body")).not.toBeEmpty();
    await page.reload();
    await expect(page.locator("body")).not.toBeEmpty();
  }
});
