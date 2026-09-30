import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { localSupabaseOnly } from "./localSupabaseOnly";

test("local account Learn progress stays separate from guest and survives sign-out and sign-in", async ({ page }) => {
  test.skip(!localSupabaseOnly(true), "Requires local Supabase; never creates production users");
  test.setTimeout(120000);
  const env=Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(line=>line.includes("=")).map(line=>{const at=line.indexOf("=");return [line.slice(0,at),line.slice(at+1)];}));
  const url=process.env.VITE_SUPABASE_URL??env.VITE_SUPABASE_URL, key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY??env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const email=`kinetable-learn-${randomUUID()}@gmail.com`, password=randomBytes(24).toString("base64url");
  const response=await fetch(`${url}/auth/v1/signup`,{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
  expect(response.ok).toBe(true);
  const signIn=async()=>{await page.goto("/auth");await page.getByLabel("Email",{exact:true}).fill(email);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page.getByRole("button",{name:"Account",exact:true})).toBeVisible({timeout:45000});};
  await page.goto("/learn/button");await page.getByRole("button",{name:"Start mission"}).click();await page.getByRole("button",{name:"Hint",exact:true}).click();
  const guestId=await page.locator("[data-project-id]").getAttribute("data-project-id");
  await signIn();await page.goto("/learn/button");await page.getByRole("button",{name:"Start mission"}).click();
  const accountId=await page.locator("[data-project-id]").getAttribute("data-project-id");expect(accountId).not.toBe(guestId);
  await page.getByRole("button",{name:"Hint",exact:true}).click();await page.getByRole("button",{name:"Another hint"}).click();await page.reload();await expect(page.getByText("HINT 2",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Account",exact:true}).click();await page.getByRole("button",{name:"Sign out",exact:true}).click();await expect(page.getByRole("button",{name:"Guest account"})).toBeVisible();
  await page.goto("/learn/button");await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id",guestId!);await expect(page.getByText("HINT 1",{exact:true})).toBeVisible();await expect(page.getByText("HINT 2",{exact:true})).toHaveCount(0);
  await signIn();await page.goto("/learn/button");await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id",accountId!);await expect(page.getByText("HINT 2",{exact:true})).toBeVisible();
});
