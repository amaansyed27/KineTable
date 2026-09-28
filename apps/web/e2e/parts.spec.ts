import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { protectPreview } from "./protectedPreview";

test.beforeEach(async ({context,page}) => {
  await protectPreview(context);
  await page.goto("/start");
  await page.getByRole("radio",{name:"ESP32",exact:true}).check();
  await page.getByRole("button",{name:/^Continue with/}).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("guest My Parts, Library, persistence, compatibility and workbench remain usable",async({page})=>{
  await page.getByRole("link",{name:"Parts",exact:true}).click();
  await expect(page).toHaveURL(/\/parts$/);
  await expect(page.getByRole("tab",{name:/My Parts/})).toHaveAttribute("aria-selected","true");
  await page.getByRole("tab",{name:/My Parts/}).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab",{name:/Library/})).toHaveAttribute("aria-selected","true");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab",{name:/My Parts/})).toHaveAttribute("aria-selected","true");
  await page.getByRole("button",{name:/Browse Library/}).click();
  await page.getByLabel("Search parts").fill("LED");
  const led=page.locator(".parts-row").filter({has:page.getByRole("button",{name:"Inspect LED"})});
  await expect(led).toBeVisible();
  await led.getByRole("button",{name:"Inspect LED"}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  mkdirSync("../../output/playwright",{recursive:true});
  for(const theme of ["light","dark"]){
    await page.evaluate(value=>document.documentElement.setAttribute("data-theme",value),theme);
    await page.waitForTimeout(250);
    for(const [width,height] of [[390,844],[1440,900]]){
      await page.setViewportSize({width,height});
      await page.screenshot({path:`../../output/playwright/part-detail-${theme}-${width}.png`,fullPage:true});
    }
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await led.getByRole("button",{name:"Add to My Parts"}).click();
  await expect(page.getByRole("status",{name:"1 owned"})).toBeVisible();
  await page.getByRole("button",{name:"Add one LED"}).click();
  await expect(page.getByRole("status",{name:"2 owned"})).toBeVisible();
  await page.getByRole("tab",{name:/My Parts/}).click();
  for(const theme of ["light","dark"]){
    await page.evaluate(value=>document.documentElement.setAttribute("data-theme",value),theme);
    await page.waitForTimeout(250);
    for(const [width,height] of [[390,844],[1440,900]]){
      await page.setViewportSize({width,height});
      await page.screenshot({path:`../../output/playwright/my-parts-${theme}-${width}.png`,fullPage:true});
    }
  }
  await page.reload();
  await page.getByRole("tab",{name:/My Parts/}).click();
  await expect(page.getByRole("status",{name:"2 owned"})).toBeVisible();
  await page.getByRole("button",{name:"Remove one LED"}).click();
  await expect(page.getByRole("status",{name:"1 owned"})).toBeVisible();
  await page.getByRole("tab",{name:/Library/}).click();
  await page.getByLabel("Search parts").fill("OLED");
  await page.getByRole("combobox",{name:"Board"}).selectOption("arduino-uno");
  await expect(page.getByRole("listitem")).toContainText("Needs level shifting");
  await page.getByRole("checkbox",{name:"Compatible with board"}).check();
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await page.goto("/projects/new");
  await page.getByLabel("Describe your idea").fill("Make an LED blink");
  await expect(page.getByRole("checkbox",{name:/Use my parts for AI planning/})).toBeVisible();
  await page.getByRole("checkbox",{name:/Use my parts for AI planning/}).check();
  await page.getByRole("button",{name:"Create project"}).click();
  await page.getByRole("button",{name:"+ Part"}).click();
  await expect(page.getByText("My Parts · 1")).toBeVisible();
  await page.locator(".workbench-tray-items button").filter({hasText:"LED"}).first().click();
  await expect(page.getByText("LED",{exact:true}).first()).toBeVisible();
  await page.goto("/parts");
  await expect(page.getByRole("status",{name:"1 owned"})).toBeVisible();
});

test("Parts layout fits required viewports in light and dark",async({page})=>{
  await page.goto("/parts");
  await page.getByRole("tab",{name:/Library/}).click();
  mkdirSync("../../output/playwright",{recursive:true});
  for(const theme of ["light","dark"]){
    await page.evaluate(value=>document.documentElement.setAttribute("data-theme",value),theme);
    await page.waitForTimeout(250);
    for(const [width,height] of [[390,844],[768,1024],[1440,900],[1600,1000],[1920,1080]]){
      await page.setViewportSize({width,height});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await expect(page.getByRole("heading",{name:"Parts",exact:true})).toBeVisible();
      await page.screenshot({path:`../../output/playwright/parts-${theme}-${width}.png`,fullPage:true});
    }
  }
});

test("owned-only AI accepts owned quantities and rejects an unowned part",async({page})=>{
  await page.goto("/parts");
  await page.getByRole("tab",{name:/Library/}).click();
  for(const name of ["LED","220 Ω resistor"])
    await page.locator(".parts-row").filter({has:page.getByRole("button",{name:`Inspect ${name}`})}).getByRole("button",{name:"Add to My Parts"}).click();
  await page.evaluate(()=>localStorage.setItem("kinetable:providers:v1",JSON.stringify({profile:{id:"qa",name:"QA",routes:[{id:"qa",providerId:"custom",transport:"CUSTOM_OPENAI_COMPATIBLE",modelId:"qa",baseUrl:"https://example.com/v1",authMode:"none",credentialIds:[],enabled:true,priority:0}]},credentials:[]})));
  let allowed=true;
  const e=(componentId:string,pinId:string)=>({componentId,pinId});
  const good=[
    {type:"component.add",instanceId:"led-1",definitionId:"led-5mm"},
    {type:"component.add",instanceId:"resistor-1",definitionId:"resistor-220r"},
    {type:"connection.create",id:"w1",from:e("board-main","gpio23"),to:e("resistor-1","a")},
    {type:"connection.create",id:"w2",from:e("resistor-1","b"),to:e("led-1","anode")},
    {type:"connection.create",id:"w3",from:e("led-1","cathode"),to:e("board-main","gnd")},
  ];
  await page.route("**/api/ai/plan",route=>{
    const request=route.request().postDataJSON();
    expect(request.input.inventory).toEqual({mode:"owned-only",items:expect.arrayContaining([{definitionId:"led-5mm",quantity:1},{definitionId:"resistor-220r",quantity:1}])});
    return route.fulfill({json:{status:"supported",summary:"Proposed circuit",unsupportedReason:"",commands:allowed?good:[{type:"component.add",instanceId:"oled-1",definitionId:"oled-ssd1306-i2c-3v3"}],revision:request.input.revision}});
  });
  async function create(){
    await page.goto("/projects/new");
    await page.getByLabel("Describe your idea").fill("Make an LED blink");
    await page.getByRole("checkbox",{name:/Use my parts for AI planning/}).check();
    await page.getByRole("button",{name:"Create project"}).click();
    await page.getByRole("button",{name:"✦ Ask Kinetable"}).click();
    await expect(page.getByRole("checkbox",{name:"Use my parts only"})).toBeChecked();
    await page.getByRole("button",{name:"Preview assembly"}).click();
  }
  await create();
  await expect(page.getByRole("heading",{name:"I’ll add"})).toBeVisible();
  await page.getByRole("button",{name:"Apply",exact:true}).click();
  await expect(page.getByText("Connections complete")).toBeVisible();
  allowed=false;
  await create();
  await expect(page.getByRole("alert")).toContainText("more parts than you own");
  await page.goto("/parts");
  await expect(page.getByRole("tab",{name:/My Parts 2/})).toBeVisible();
});
