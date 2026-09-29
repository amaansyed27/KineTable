import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { protectPreview } from "./protectedPreview";

test.beforeEach(async({context,page})=>{
  await protectPreview(context);
  await page.goto("/start");
  await page.getByRole("radio",{name:"ESP32",exact:true}).check();
  await page.getByRole("button",{name:/^Continue with/}).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("Explore creates real BONK and History survives reload",async({page})=>{
  await page.goto("/explore");
  await expect(page.getByRole("heading",{name:"Built around your parts."})).toBeVisible();
  await expect(page.getByText("Your shelf is empty.")).toBeVisible();
  await page.getByRole("link",{name:"View build →"}).last().click();
  await expect(page.getByRole("heading",{name:"BONK",exact:true})).toBeVisible();
  await expect(page.getByText("1 missing",{exact:false}).first()).toBeVisible();
  await page.getByRole("button",{name:/Start project/}).click();
  await expect(page.locator("[data-project-id]")).toBeVisible();
  const id=await page.locator("[data-project-id]").getAttribute("data-project-id");
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  await page.getByRole("link",{name:"History"}).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${id}/history$`));
  await expect(page.getByRole("heading",{name:"BONK history"})).toBeVisible();
  await expect(page.getByRole("button",{name:/Created project/})).toBeVisible();
  await page.getByRole("button",{name:"Save checkpoint"}).click();
  await expect(page.getByRole("button",{name:/Manual checkpoint/})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button",{name:/Manual checkpoint/})).toBeVisible();
  await page.getByRole("button",{name:/Created project/}).click();
  await page.getByRole("button",{name:"Restore this version"}).click();
  await page.getByRole("button",{name:"Confirm restore"}).click();
  await expect(page.getByRole("button",{name:/Restored version/})).toBeVisible();
  await page.goto(`/projects/${id}`);
  await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id",id!);
});

test("Explore and History fit five widths in both themes",async({page})=>{
  test.setTimeout(180000);
  await page.goto("/explore/bonk");
  await page.getByRole("button",{name:/Start project/}).click();
  const id=await page.locator("[data-project-id]").getAttribute("data-project-id");
  mkdirSync("../../output/playwright/slice12",{recursive:true});
  for(const theme of ["light","dark"]){
    await page.goto("/settings/appearance");
    await page.getByRole("button",{name:theme==="light"?"Light":"Dark",exact:true}).click();
    for(const [width,height] of [[390,844],[768,1024],[1440,900],[1600,1000],[1920,1080]]){
      await page.setViewportSize({width,height});
      for(const [name,url] of [["explore","/explore"],["detail","/explore/bonk"],["history",`/projects/${id}/history`]]){
        await page.goto(url);
        await expect(page.locator("#app-main")).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} ${theme} ${width}`).toBe(true);
        await page.screenshot({path:`../../output/playwright/slice12/${name}-${theme}-${width}.png`,fullPage:true});
      }
    }
  }
});
