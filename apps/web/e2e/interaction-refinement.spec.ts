import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { protectPreview } from "./protectedPreview";
test.beforeEach(async ({context})=>protectPreview(context));
async function build(page:Page) {
  await page.goto("/start"); await page.getByRole("radio",{name:"ESP32",exact:true}).check();
  await page.getByRole("button",{name:"Continue with ESP32"}).click();
  await page.goto("/projects/new"); await page.getByRole("button",{name:"Create project",exact:true}).click();
  await expect(page.locator("[data-project-id]")).toBeVisible();
  if (await page.getByRole("button",{name:"Skip guidance"}).count()) await page.getByRole("button",{name:"Skip guidance"}).click();
}
async function row(page:Page) {
  const id=await page.locator("[data-project-id]").getAttribute("data-project-id");
  return page.evaluate(id=>new Promise<{name:string;document:{name:string};id:string}>(resolve=>{const r=indexedDB.open("kinetable");r.onsuccess=()=>{const q=r.result.transaction("projects").objectStore("projects").get(id!);q.onsuccess=()=>resolve(q.result);};}),id);
}
test("click-to-rename cancels, saves, undoes, redoes and survives refresh and project retrieval",async({page})=>{
  await build(page); const original=await row(page);
  await page.getByRole("button",{name:"Rename project"}).click();await page.getByLabel("Project name",{exact:true}).fill("Cancelled name");await page.keyboard.press("Escape");
  await expect(page.getByRole("button",{name:"Rename project"})).toContainText(original.name);expect((await row(page)).name).toBe(original.name);
  await page.getByRole("button",{name:"Rename project"}).click();await page.getByLabel("Project name",{exact:true}).fill("My sensor table");await page.keyboard.press("Enter");
  await expect(page.getByRole("button",{name:"Rename project"})).toContainText("My sensor table");expect((await row(page)).document.name).toBe("My sensor table");
  await page.getByRole("button",{name:"Undo",exact:true}).click();await expect(page.getByRole("button",{name:"Rename project"})).toContainText(original.name);
  await page.getByRole("button",{name:"Redo",exact:true}).click();await expect(page.getByRole("button",{name:"Rename project"})).toContainText("My sensor table");
  await page.reload();await expect(page.getByRole("button",{name:"Rename project"})).toContainText("My sensor table");
  await page.goto("/projects");await expect(page.getByRole("link",{name:/My sensor table circuit preview/})).toBeVisible();
});
test("settings navigation, aligned actions, bounded native menus and dark page background",async({page})=>{
  mkdirSync("../../output/playwright/refinement",{recursive:true});
  for(const width of [390,768,1440]) {
    await page.setViewportSize({width,height:900});await page.goto("/settings/account");await expect(page.getByRole("heading",{name:"Account",exact:true})).toBeVisible();
    if(width<=800) { const nav=await page.getByRole("navigation",{name:"Settings"}).boundingBox(), heading=await page.getByRole("heading",{name:"Account",exact:true}).boundingBox();expect(heading!.y-nav!.y-nav!.height).toBeLessThan(70); }
    await page.waitForTimeout(220);await page.screenshot({path:`../../output/playwright/refinement/account-${width}.png`,fullPage:true});
    await page.getByRole("navigation",{name:"Settings"}).getByRole("link",{name:/Appearance/}).click();await page.getByRole("button",{name:"Dark",exact:true}).click();
    await page.getByRole("navigation",{name:"Settings"}).getByRole("link",{name:/AI providers/}).click();
    await expect(page.getByLabel("Add provider")).toBeVisible();
    const select=await page.getByLabel("Add provider").boundingBox(), action=await page.getByRole("button",{name:"Add route"}).boundingBox();
    expect(Math.abs(select!.y+select!.height-action!.y-action!.height)).toBeLessThan(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    expect(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor===getComputedStyle(document.documentElement).backgroundColor)).toBe(true);
    await page.getByLabel("Add provider").click();await page.waitForTimeout(220);await page.screenshot({path:`../../output/playwright/refinement/provider-picker-${width}.png`,fullPage:true});await page.keyboard.press("Escape");await page.waitForTimeout(220);
    await page.getByLabel("Find a provider").fill("OpenAI");expect((await page.getByLabel("Add provider").locator("option").allTextContents()).every(name=>name.toLowerCase().includes("openai"))).toBe(true);
    await page.waitForTimeout(220);await page.screenshot({path:`../../output/playwright/refinement/providers-${width}.png`,fullPage:true});
  }
});
test("workbench panels replace inspectors and support keyboard tooltips at desktop and mobile widths",async({page})=>{
  await build(page);
  await page.getByRole("button",{name:"+ Part",exact:true}).click();await page.getByRole("button",{name:"DHT11 module",exact:true}).click();await page.getByRole("button",{name:"Close inspector"}).click();
  await page.getByText("Connect pins",{exact:true}).click();
  const sensor=await page.getByLabel("To part").locator("option").filter({hasText:"DHT11 module"}).getAttribute("value");
  for(const [from,to] of [["3v3","vcc"],["gnd","gnd"],["gpio18","data"]]) {
    await page.getByLabel("From part").selectOption("board-main");await page.getByLabel("From",{exact:true}).selectOption(`pin:board-main:${from}`);
    await page.getByLabel("To part").selectOption(sensor!);await page.getByLabel("To",{exact:true}).selectOption(`pin:${sensor}:${to}`);await page.getByRole("button",{name:"Create wire",exact:true}).click();
  }
  await page.getByText("Connect pins",{exact:true}).click();await page.waitForTimeout(300);await page.screenshot({path:"../../output/playwright/refinement/dht11-jumpers.png",fullPage:true});
  for(const width of [1440,768,390]) {
    await page.setViewportSize({width,height:900});await page.getByText("Parts & wires",{exact:true}).click();await page.getByRole("button",{name:"ESP32 Dev Module",exact:true}).click();
    await expect(page.getByLabel("ESP32 Dev Module inspector")).toBeVisible();
    const panel=await page.getByLabel("ESP32 Dev Module inspector").boundingBox(), dock=await page.locator(".workbench-tool-dock").boundingBox();
    expect(panel!.y+panel!.height).toBeLessThanOrEqual(dock!.y);
    await page.getByText("Connect pins",{exact:true}).click();await expect(page.getByLabel("ESP32 Dev Module inspector")).toHaveCount(0);
    await page.getByLabel("From part").selectOption("board-main");await page.getByLabel("From",{exact:true}).selectOption("pin:board-main:gpio18");const fromPart=await page.getByLabel("From part").boundingBox(), toPart=await page.getByLabel("To part").boundingBox();expect(Math.abs(fromPart!.height-toPart!.height)).toBeLessThan(2);
    const form=await page.locator(".workbench-connection-controls > .workbench-tool-body").boundingBox();expect(form!.x).toBeGreaterThanOrEqual(0);expect(form!.x+form!.width).toBeLessThanOrEqual(width);expect(form!.y).toBeGreaterThanOrEqual(0);
    await page.waitForTimeout(250);await page.screenshot({path:`../../output/playwright/refinement/connect-pins-${width}.png`,fullPage:true});
    await page.getByRole("button",{name:"Inspect from"}).click();
    await expect(page.getByLabel("Pin inspector")).toBeVisible();await expect(page.getByLabel("From part")).not.toBeVisible();
    await page.waitForTimeout(250);await page.screenshot({path:`../../output/playwright/refinement/inspector-${width}.png`,fullPage:true});await page.getByRole("button",{name:"Close inspector"}).click();
  }
  await page.getByRole("button",{name:"Rename project"}).focus();await expect(page.getByRole("tooltip")).toContainText("Click to rename");await page.keyboard.press("Escape");await expect(page.getByRole("tooltip")).toHaveCount(0);
});
