import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
test("auth entry, validation, guest continuation, callback errors and responsive layout", async ({ page }) => {
 const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
 await page.goto("/"); await page.getByRole("link", { name: "Sign in", exact: true }).click();
 await expect(page).toHaveURL(/\/auth$/);
 await expect(page.getByRole("heading", { name: "Keep your projects with you." })).toBeVisible();
 await page.getByRole("button", { name: "New here? Create an account" }).click();
 await page.getByLabel("Email",{exact:true}).fill("not-an-email");
 await page.getByLabel("Password", { exact: true }).fill("short");
 await page.getByRole("button", { name: "Create account", exact: true }).click();
 await expect(page).toHaveURL(/\/auth$/);
 expect(await page.getByLabel("Email",{exact:true}).evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
 await page.getByLabel("Email",{exact:true}).fill(""); await page.getByLabel("Password", { exact: true }).fill("");
 mkdirSync("../../output/playwright", { recursive: true });
 for (const [width,height] of [[390,844],[768,1024],[1440,900],[1600,1000],[1920,1080]]) {
   await page.setViewportSize({width,height});
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
   await expect(page.getByRole("link", { name: /Continue without/ })).toBeVisible();
   if (width===390 || width===1440) await page.screenshot({path:`../../output/playwright/auth-${width}.png`,fullPage:true});
 }
 await page.getByRole("link", { name: /Continue without/ }).click(); await expect(page).toHaveURL(/\/start$/);
 await page.goto("/auth/callback?error=access_denied");
 await expect(page.getByRole("alert")).toContainText("invalid or has expired");
 await page.getByRole("link", { name: "Back to sign in" }).click(); await expect(page).toHaveURL(/\/auth$/);
 await page.reload(); await expect(page.getByLabel("Email",{exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});
