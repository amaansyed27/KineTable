import { expect, test } from "@playwright/test";

test("page changes keep the application shell and loaded projects in place", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => { (window as Window & { navigationMarker?: string }).navigationMarker = "same-document"; });
  await page.getByRole("link", { name: /Open Kinetable/ }).first().click();
  expect(await page.evaluate(() => (window as Window & { navigationMarker?: string }).navigationMarker)).toBe("same-document");
  await page.getByRole("radio", { name: "ESP32", exact: true }).check();
  await page.getByRole("button", { name: "Continue with ESP32" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.evaluate(() => {
    (window as Window & { navigationMarker?: string }).navigationMarker = "same-document";
    document.querySelector(".route-scene")!.setAttribute("data-navigation-marker", "same-shell");
  });
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator(".route-scene")).toHaveAttribute("data-navigation-marker", "same-shell");
  expect(await page.evaluate(() => (window as Window & { navigationMarker?: string }).navigationMarker)).toBe("same-document");
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByText("Opening your projects…")).toHaveCount(0);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.locator(".route-scene")).toHaveAttribute("data-navigation-marker", "same-shell");
  await page.evaluate(() => {
    (window as Window & { loadingHits?: string[] }).loadingHits = [];
    new MutationObserver(() => {
      if (document.querySelector(".route-loading")) (window as Window & { loadingHits?: string[] }).loadingHits!.push("route");
      if ([...document.querySelectorAll('[role="status"]')].some(node => node.textContent?.includes("Opening your projects"))) (window as Window & { loadingHits?: string[] }).loadingHits!.push("projects");
    }).observe(document.getElementById("root")!, { childList: true, subtree: true });
  });
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { loadingHits?: string[] }).loadingHits)).toEqual([]);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: /Try BONK/ }).click();
  await expect(page.locator("[data-project-id]")).toBeVisible();
  await page.evaluate(() => { (window as Window & { loadingHits?: string[] }).loadingHits = []; });
  await page.getByRole("link", { name: /Projects/ }).first().click();
  await expect(page.getByRole("link", { name: /BONK circuit preview/ })).toBeVisible();
  await page.getByRole("link", { name: /BONK circuit preview/ }).click();
  await expect(page.locator("[data-project-id]")).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { loadingHits?: string[] }).loadingHits)).toEqual([]);
});
