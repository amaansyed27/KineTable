import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { starterProject } from "../src/projects/schema";
import { migrateProject } from "../src/projects/v3";
import { layoutComponents } from "../src/hardware-core/layout";
import type { KinetableProjectV4 } from "../src/projects/v4";
import { protectPreview } from "./protectedPreview";

test("hosted v3 upgrades intentionally, BONK ×3 restores fresh, and offline logic reconnects with owner RLS", async ({ page, browser }) => {
  test.skip(process.env.KINETABLE_HOSTED_LOGIC_QA !== "1", "Requires disposable hosted Supabase accounts");
  test.setTimeout(150000);
  await protectPreview(page.context());
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=")).map(l => { const i=l.indexOf("="); return [l.slice(0,i),l.slice(i+1)]; }));
  const request = async (path: string, method: string, token?: string, body?: unknown) => {
    const response = await fetch(env.VITE_SUPABASE_URL + path, { method, headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json", Prefer: "return=representation", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    expect(response.ok, `Hosted HTTP ${response.status}`).toBe(true); return response.json();
  };
  const account = async () => { const email=`kinetable-qa-logic-${randomUUID()}@gmail.com`, password=randomBytes(24).toString("base64url"); const result=await request("/auth/v1/signup","POST",undefined,{email,password}); return { email,password,token: result.access_token as string,id: result.user.id as string }; };
  const a=await account(), b=await account();
  await request(`/rest/v1/profiles?id=eq.${a.id}`,"PATCH",a.token,{ primary_board_id: "esp32-dev-module", setup_completed: true });
  const old=migrateProject(starterProject("esp32-dev-module"));
  for (const [id,definitionId] of [["button-1","push-button"],["led-1","led-5mm"],["resistor-1","resistor-220r"],["buzzer-1","grove-buzzer-v1-1"],["oled-1","oled-ssd1306-i2c-3v3"]]) old.components.push({id,definitionId,kind:"component"});
  old.layout.entities=layoutComponents(old.components,old.layout.entities);
  const links=[["board-main","gpio18","button-1","a"],["button-1","b","board-main","gnd"],["board-main","gpio23","resistor-1","a"],["resistor-1","b","led-1","anode"],["led-1","cathode","board-main","gnd"],["board-main","3v3","buzzer-1","vcc"],["board-main","gnd","buzzer-1","gnd"],["board-main","gpio19","buzzer-1","sig"],["board-main","3v3","oled-1","vcc"],["board-main","gnd","oled-1","gnd"],["board-main","gpio21","oled-1","sda"],["board-main","gpio22","oled-1","scl"]];
  old.wires=links.map(([a,ap,b,bp],i)=>({id:`wire-${i}`,from:{kind:"pin",componentId:a,pinId:ap},to:{kind:"pin",componentId:b,pinId:bp}}));
  const path=`/rest/v1/projects?id=eq.${old.id}`;
  const cloud=async () => (await request(path+"&select=*","GET",a.token))[0];
  const saved=async (p: Page): Promise<KinetableProjectV4> => p.evaluate(id=>new Promise((resolve,reject)=>{ const open=indexedDB.open("kinetable"); open.onerror=()=>reject(open.error); open.onsuccess=()=>{const row=open.result.transaction("projects","readonly").objectStore("projects").get(id); row.onsuccess=()=>resolve(row.result.document);}; }),old.id);
  const signIn=async (p: Page) => { await p.goto("/auth"); await p.getByLabel("Your email").fill(a.email); await p.getByLabel("Password",{exact:true}).fill(a.password); await p.getByRole("button",{name:"Sign in",exact:true}).click(); await expect(p.locator("[data-project-id]")).toHaveAttribute("data-project-id",old.id,{timeout:20000}); };
  await request("/rest/v1/projects","POST",a.token,{ id:old.id,name:old.name,primary_board_id:old.boardIds[0],schema_version:3,document:old });
  try {
    await signIn(page);
    expect((await cloud()).schema_version).toBe(3);
    expect((await cloud()).document).toEqual(old);
    await page.getByRole("button",{name:"Logic",exact:true}).click(); await page.getByRole("button",{name:"Start from BONK"}).click();
    await expect.poll(async ()=>(await cloud()).schema_version,{timeout:30000}).toBe(4);
    await page.getByLabel("Action 3 beep count").fill("3");
    await expect.poll(async ()=>(await cloud()).document.logic[0].do[2].count,{timeout:30000}).toBe(3);
    const before=await cloud();
    await page.getByRole("button",{name:"Simulate",exact:true}).click(); await page.getByRole("button",{name:"Press button"}).click(); await page.getByRole("button",{name:"Play",exact:true}).click();
    await expect(page.locator(".simulation-outputs > span").filter({hasText:/^3.3 V SSD1306/})).toContainText("BONK!");
    await page.getByRole("button",{name:"Pause",exact:true}).click();
    expect((await cloud()).updated_at).toBe(before.updated_at); expect((await saved(page)).metadata.updatedAt).toBe(before.document.metadata.updatedAt);
    expect(await request(path+"&select=*","GET",b.token)).toEqual([]); expect(await request(path,"PATCH",b.token,{name:"stolen"})).toEqual([]);
    const fresh=await browser.newContext({storageState:process.env.E2E_STORAGE_STATE});
    try { await protectPreview(fresh); const restored=await fresh.newPage(); await signIn(restored); await restored.getByRole("button",{name:"Logic",exact:true}).click(); await expect(restored.getByLabel("Action 3 beep count")).toHaveValue("3"); expect((await saved(restored)).logic).toEqual(before.document.logic); } finally { await fresh.close(); }
    await page.getByRole("button",{name:"Logic",exact:true}).click(); await page.route("https://*.supabase.co/**",r=>r.abort());
    await page.getByLabel("Action 3 on duration").fill("140"); await expect.poll(async ()=>(await saved(page)).logic[0].do[2]).toMatchObject({count:3,onMs:140});
    await page.reload(); await page.getByRole("button",{name:"Logic",exact:true}).click(); await expect(page.getByLabel("Action 3 on duration")).toHaveValue("140"); expect((await cloud()).document.logic[0].do[2].onMs).toBe(120);
    await page.unrouteAll(); await page.evaluate(()=>window.dispatchEvent(new Event("online")));
    await expect.poll(async ()=>(await cloud()).document.logic[0].do[2].onMs,{timeout:30000}).toBe(140);
  } finally { await page.unrouteAll(); await request(path,"DELETE",a.token); }
});
