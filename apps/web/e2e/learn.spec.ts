import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import type { KinetableProjectV4 } from "../src/projects/v4";

const output="../../output/playwright/slice13";
test.beforeEach(()=>mkdirSync(output,{recursive:true}));
async function saved(page:Page) {
  const id=await page.locator("[data-project-id]").getAttribute("data-project-id");
  return page.evaluate(id=>new Promise<KinetableProjectV4>((resolve,reject)=>{const request=indexedDB.open("kinetable");request.onerror=()=>reject(request.error);request.onsuccess=()=>{const database=request.result;const row=database.transaction("projects").objectStore("projects").get(id!);row.onsuccess=()=>{resolve(row.result.document);database.close();};row.onerror=()=>reject(row.error);};}),id);
}
async function start(page:Page,id:string) {await page.goto(`/learn/${id}`);await page.getByRole("button",{name:"Start mission"}).click();await expect(page.locator("[data-project-id]")).toBeVisible();}
async function choose(page:Page,label:"From"|"To",key:string) {
  if(!await page.locator(".workbench-connection-controls").evaluate(el=>(el as HTMLDetailsElement).open))await page.getByText("Connect pins",{exact:true}).click();
  const [kind,id,pin]=key.split(":");await page.getByLabel(`${label} part`,{exact:true}).selectOption(id);if(kind==="hole")await page.getByLabel(`${label} row or rail`).selectOption(pin.replace(/\d+$/,""));await page.getByLabel(label,{exact:true}).selectOption(key);
}
async function wire(page:Page,from:string,to:string){await choose(page,"From",from);await choose(page,"To",to);await page.getByRole("button",{name:"Create wire"}).click();}
async function insert(page:Page,index:number,hole:string) {
  if(!await page.locator(".workbench-object-list").evaluate(el=>(el as HTMLDetailsElement).open))await page.getByText("Parts & wires",{exact:true}).click();
  await page.getByLabel("Parts on this table").getByRole("button",{name:"220 Ω resistor",exact:true}).nth(index).click();
  await page.getByLabel("220 Ω resistor inspector").getByRole("listitem").filter({has:page.getByRole("button",{name:"A",exact:true})}).getByRole("button",{name:"Insert lead"}).click();
  await choose(page,"To",`hole:breadboard-1:${hole}`);await page.getByRole("button",{name:"Place lead in destination hole"}).click();
}
async function lift(page:Page,index:number) {
  if(!await page.locator(".workbench-object-list").evaluate(el=>(el as HTMLDetailsElement).open))await page.getByText("Parts & wires",{exact:true}).click();
  await page.getByLabel("Parts on this table").getByRole("button",{name:"220 Ω resistor",exact:true}).nth(index).click();
  await page.getByLabel("220 Ω resistor inspector").getByRole("listitem").filter({has:page.getByRole("button",{name:"A",exact:true})}).getByRole("button",{name:"Lift lead"}).click();
}
test("fresh guest learns a breadboard row, persists hints and earned stages, and keeps work offline",async({page,context})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/learn");await expect(page.getByRole("heading",{name:/Hardware makes sense/})).toBeVisible();
  await page.getByRole("link",{name:/Breadboards: rows and rails/}).click();await page.getByRole("button",{name:"Start mission"}).click();
  await expect(page.getByRole("button",{name:"Check goal"})).toBeDisabled();await page.getByRole("button",{name:"Hint",exact:true}).click();
  await insert(page,0,"A12");await insert(page,1,"E12");await expect(page.getByRole("button",{name:"Check goal"})).toBeEnabled();
  await page.getByRole("button",{name:"Check goal"}).click();await expect(page.getByRole("button",{name:"Stage complete"})).toBeVisible();
  const before=await saved(page);await page.reload();await expect(page.getByRole("button",{name:"Stage complete"})).toBeVisible();await expect(page.getByText("HINT 1",{exact:true})).toBeVisible();expect((await saved(page)).id).toBe(before.id);
  await page.getByRole("button",{name:"Next task"}).click();await expect(page.getByRole("heading",{name:/Move the second/})).toBeVisible();await expect(page.getByRole("button",{name:"Check goal"})).toBeDisabled();
  await page.getByRole("button",{name:"Previous"}).click();await expect(page.getByRole("button",{name:"Stage complete"})).toBeVisible();
  await context.setOffline(true);await page.getByRole("button",{name:"Another hint"}).click();await expect(page.getByText("HINT 2",{exact:true})).toBeVisible();await context.setOffline(false);
  await page.getByRole("button",{name:"Next task"}).click();await lift(page,1);await insert(page,1,"F12");await page.getByRole("button",{name:"Check goal"}).click();await page.getByRole("button",{name:"Next task"}).click();await lift(page,0);await lift(page,1);await insert(page,0,"L+1");await insert(page,1,"L+5");await page.getByRole("button",{name:"Check goal"}).click();await expect(page.getByText("Mission complete ✓",{exact:true})).toBeVisible();await page.reload();await expect(page.getByText("Mission complete ✓",{exact:true})).toBeVisible();
  await expect(page.locator(".workbench-surface canvas")).toBeVisible();await page.screenshot({path:`${output}/breadboard-success.png`,fullPage:true});expect(errors).toEqual([]);
});
test("LED wrong net cannot advance; hints explain, normal wiring solves and undo recalculates",async({page})=>{
  await start(page,"led");const doc=await saved(page),led=doc.components.find(c=>c.definitionId==="led-5mm")!.id,resistor=doc.components.find(c=>c.definitionId==="resistor-220r")!.id;
  await wire(page,"pin:board-main:gpio23",`pin:${led}:anode`);await wire(page,"pin:board-main:gnd",`pin:${led}:cathode`);await expect(page.getByRole("button",{name:"Check goal"})).toBeDisabled();
  await page.getByRole("button",{name:"Hint",exact:true}).click();await page.getByRole("button",{name:"Another hint"}).click();await page.getByRole("button",{name:"Show answer"}).click();await expect(page.locator(".mission-hint")).toContainText("resistor");
  await page.getByRole("button",{name:"Why? · Ask Kinetable"}).click();await expect(page.locator(".mission-explanation")).toContainText("Observed in your project");await expect(page.getByRole("button",{name:"Check goal"})).toBeDisabled();
  await page.getByText("Parts & wires",{exact:true}).click();await page.getByLabel("Wires on this table").getByRole("button").first().click();await page.getByRole("button",{name:"Remove wire",exact:true}).click();
  await wire(page,"pin:board-main:gpio23",`pin:${resistor}:a`);await wire(page,`pin:${resistor}:b`,`pin:${led}:anode`);await expect(page.getByRole("button",{name:"Check goal"})).toBeEnabled();
  await page.getByRole("button",{name:"Undo",exact:true}).click();await expect(page.getByRole("button",{name:"Check goal"})).toBeDisabled();await page.getByRole("button",{name:"Redo",exact:true}).click();await expect(page.getByRole("button",{name:"Check goal"})).toBeEnabled();
  await page.getByRole("button",{name:"Check goal"}).click();await page.getByRole("button",{name:"Next task"}).click();await page.getByRole("button",{name:"Simulate",exact:true}).click();await page.getByRole("button",{name:"Play",exact:true}).click();await expect(page.getByRole("button",{name:"Check goal"})).toBeEnabled();await page.getByRole("button",{name:"Check goal"}).click();await page.getByRole("button",{name:"Next task"}).click();await expect(page.getByRole("button",{name:"Check goal"})).toBeEnabled();await page.getByRole("button",{name:"Check goal"}).click();await expect(page.getByText("Mission complete ✓",{exact:true})).toBeVisible();await page.screenshot({path:`${output}/led-complete.png`,fullPage:true});
});
test("button input uses actual press and release traces",async({page})=>{
  await start(page,"button");const button=(await saved(page)).components.find(c=>c.definitionId==="push-button")!.id;
  await wire(page,"pin:board-main:gpio18",`pin:${button}:a`);await wire(page,"pin:board-main:gnd",`pin:${button}:b`);await page.getByRole("button",{name:"Check goal"}).click();await page.getByRole("button",{name:"Next task"}).click();await page.getByRole("button",{name:"Simulate",exact:true}).click();await expect(page.getByRole("button",{name:"Check goal"})).toBeDisabled();await page.getByRole("button",{name:"Press button",exact:true}).click();await page.getByRole("button",{name:"Check goal"}).click();await page.getByRole("button",{name:"Next task"}).click();await expect(page.getByRole("button",{name:"Check goal"})).toBeDisabled();await page.getByRole("button",{name:"Release button",exact:true}).click();await page.getByRole("button",{name:"Check goal"}).click();await page.screenshot({path:`${output}/button-complete.png`,fullPage:true});
});
test("OLED learner wires power and I²C and authors real HELLO Logic",async({page})=>{
  await start(page,"oled");const oled=(await saved(page)).components.find(c=>c.definitionId==="oled-ssd1306-i2c-3v3")!.id;
  for(const [pin,target] of [["3v3","vcc"],["gnd","gnd"],["gpio21","sda"],["gpio22","scl"]])await wire(page,`pin:board-main:${pin}`,`pin:${oled}:${target}`);
  await page.getByRole("button",{name:"Check goal"}).click();await page.getByRole("button",{name:"Next task"}).click();await page.getByRole("button",{name:"Logic",exact:true}).click();await page.getByRole("tab",{name:"Manual",exact:true}).click();await page.getByRole("button",{name:/Add.*behavior/i}).click();await page.getByLabel("Action 1 OLED text").fill("HELLO");await expect.poll(async()=>(await saved(page)).logic[0]?.do[0]).toMatchObject({kind:"oled",text:"HELLO"});await page.getByRole("button",{name:"Simulate",exact:true}).click();await page.getByRole("button",{name:"Play",exact:true}).click();await expect(page.getByRole("button",{name:"Check goal"})).toBeEnabled();await page.getByRole("button",{name:"Check goal"}).click();await page.getByRole("button",{name:"Why? · Ask Kinetable"}).click();await page.screenshot({path:`${output}/oled-complete-explain.png`,fullPage:true});
});
test("BONK capstone reuses authored behavior and brightness states its limits",async({page})=>{
  await start(page,"brightness");await expect(page.locator(".mission-limit")).toContainText("does not calculate current, PWM or precise brightness");
  await start(page,"bonk");for(let i=0;i<4;i++){await page.getByRole("button",{name:"Check goal"}).click();await page.getByRole("button",{name:"Next task"}).click();}
  await page.getByRole("button",{name:"Simulate",exact:true}).click();await page.getByRole("button",{name:"Press button",exact:true}).click();await page.getByRole("button",{name:"Play",exact:true}).click();await expect(page.getByRole("button",{name:"Check goal"})).toBeEnabled();await page.getByRole("button",{name:"Check goal"}).click();await expect(page.getByText("Mission complete ✓",{exact:true})).toBeVisible();
});
test("cold mission respects persisted Pico and all navigation remains client-side",async({page,context})=>{
  await page.goto("/start");await page.getByRole("radio",{name:"Raspberry Pi Pico",exact:true}).check();await page.getByRole("button",{name:"Continue with Raspberry Pi Pico"}).click();await expect(page).toHaveURL(/\/home$/);await page.close();
  const cold=await context.newPage();await cold.goto("/learn/led");await expect(cold.getByLabel("Mission board")).toHaveValue("raspberry-pi-pico");await cold.reload();await expect(cold.getByLabel("Mission board")).toHaveValue("raspberry-pi-pico");await cold.getByRole("button",{name:"Start mission"}).click();await expect(cold.locator("[data-board-id]")).toHaveAttribute("data-board-id","raspberry-pi-pico");
  const time=await cold.evaluate(()=>performance.timeOrigin);for(const name of ["Home","Projects","Parts","Explore","Learn"]){await cold.getByRole("navigation",{name:"Application",exact:true}).getByRole("link",{name,exact:true}).click();await expect(cold.locator("#app-main")).toBeVisible();expect(await cold.evaluate(()=>performance.timeOrigin)).toBe(time);}
});
test("Learn desktop/mobile layouts, dark/light, keyboard hints and reduced motion remain usable",async({page})=>{
  await start(page,"breadboard");await page.getByRole("button",{name:"Hint",exact:true}).focus();await page.keyboard.press("Enter");await expect(page.getByText("HINT 1",{exact:true})).toBeVisible();
  for(const theme of ["light","dark"]){await page.evaluate(t=>{localStorage.setItem("kinetable.appearance",t);document.documentElement.dataset.theme=t;},theme);for(const [width,height] of [[390,844],[768,1024],[1440,900],[1600,1000],[1920,1080]]){await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await expect(page.getByLabel("Mission guidance")).toBeVisible();await page.screenshot({path:`${output}/mission-${theme}-${width}.png`,fullPage:true});}}
  await page.emulateMedia({reducedMotion:"reduce"});await page.getByRole("link",{name:"Learn",exact:true}).first().click();await page.screenshot({path:`${output}/learn-dark.png`,fullPage:true});await page.goto("/learn/not-a-mission");await expect(page.getByRole("heading",{name:"This mission isn’t here."})).toBeVisible();
});
test("external theme bootstrap works under production CSP for System, Light and Dark",async({page})=>{
  const errors:string[]=[];page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
  const config=JSON.parse(readFileSync("../../vercel.json","utf8"));const csp=config.headers.find((entry:{source:string})=>entry.source==="/(.*)").headers.find((entry:{key:string})=>entry.key==="Content-Security-Policy").value;
  await page.route("**/*",async route=>{if(route.request().resourceType()!=="document")return route.continue();const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),"content-security-policy":csp}});});
  await page.goto("/learn");for(const [preference,system,expected] of [["system","dark","dark"],["light","dark","light"],["dark","light","dark"]] as const){await page.evaluate(t=>localStorage.setItem("kinetable.appearance",t),preference);await page.emulateMedia({colorScheme:system});await page.reload();await expect(page.locator("html")).toHaveAttribute("data-theme",expected);await expect(page.getByRole("heading",{name:/Hardware makes sense/})).toBeVisible();}
  expect(errors.filter(e=>/Content Security Policy|inline script|theme-bootstrap/.test(e))).toEqual([]);
});
