import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { protectPreview } from "./protectedPreview";

test("hosted My Parts sync, restore and owner RLS",async({page,browser,context})=>{
  test.skip(process.env.KINETABLE_HOSTED_QA!=="1","Requires disposable Supabase accounts");
  test.setTimeout(120000);
  await protectPreview(context);
  const env=Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(line=>line.includes("=")).map(line=>{const at=line.indexOf("=");return [line.slice(0,at),line.slice(at+1)];}));
  const url=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const accounts=[];
  for(let i=0;i<2;i++){
    const email=`kinetable-parts-${randomUUID()}@gmail.com`,password=randomBytes(24).toString("base64url");
    const signup=await fetch(`${url}/auth/v1/signup`,{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
    expect(signup.ok).toBe(true);
    const data=await signup.json() as {user:{id:string};access_token:string};
    expect(data.access_token).toBeTruthy();
    accounts.push({email,password,id:data.user.id,token:data.access_token});
  }
  const [a,b]=accounts;
  const headers=(token:string)=>({apikey:key,Authorization:`Bearer ${token}`,"Content-Type":"application/json",Prefer:"return=representation"});
  const itemUrl=`${url}/rest/v1/inventory_items?definition_id=eq.led-5mm&select=*`;
  const insert=await fetch(`${url}/rest/v1/inventory_items?select=*`,{method:"POST",headers:headers(a.token),body:JSON.stringify({definition_id:"led-5mm",quantity:2})});
  expect(insert.status).toBe(201);
  expect((await insert.json())[0]).toMatchObject({owner_id:a.id,quantity:2});
  const readA=await fetch(itemUrl,{headers:headers(a.token)});expect((await readA.json())).toHaveLength(1);
  const readB=await fetch(itemUrl,{headers:headers(b.token)});expect((await readB.json())).toHaveLength(0);
  const spoof=await fetch(`${url}/rest/v1/inventory_items`,{method:"POST",headers:headers(b.token),body:JSON.stringify({owner_id:a.id,definition_id:"push-button",quantity:1})});
  expect(spoof.ok).toBe(false);
  const unknown=await fetch(`${url}/rest/v1/inventory_items`,{method:"POST",headers:headers(a.token),body:JSON.stringify({definition_id:"unmodeled-part",quantity:1})});
  expect(unknown.status).toBe(400);
  const updateB=await fetch(itemUrl,{method:"PATCH",headers:headers(b.token),body:JSON.stringify({quantity:9})});
  expect((await updateB.json())).toHaveLength(0);
  const deleteB=await fetch(itemUrl,{method:"DELETE",headers:headers(b.token)});expect((await deleteB.json())).toHaveLength(0);
  const updateA=await fetch(itemUrl,{method:"PATCH",headers:headers(a.token),body:JSON.stringify({quantity:3})});
  expect((await updateA.json())[0]).toMatchObject({quantity:3});

  await page.goto("/parts");
  await page.getByRole("tab",{name:/Library/}).click();
  await page.locator(".parts-row").filter({has:page.getByRole("button",{name:"Inspect Push button"})}).getByRole("button",{name:"Add to My Parts"}).click();
  await page.getByRole("button",{name:"Add one Push button"}).click();
  await expect(page.getByRole("status",{name:"2 owned"})).toBeVisible();
  await page.goto("/auth");
  await page.getByLabel("Email",{exact:true}).fill(a.email);
  await page.getByLabel("Password",{exact:true}).fill(a.password);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page.getByText(a.email,{exact:true})).toBeVisible();
  await page.goto("/parts");
  await expect(page.getByRole("status",{name:"3 owned"})).toBeVisible({timeout:20000});
  await expect(page.getByRole("button",{name:"Import local parts"})).toBeVisible();
  await page.getByRole("button",{name:"Import local parts"}).click();
  await expect(page.getByRole("button",{name:"Import local parts"})).toBeHidden();
  await expect(page.getByRole("tab",{name:/My Parts 2/})).toBeVisible();
  await expect(page.getByRole("status",{name:"3 owned"})).toBeVisible();
  await page.getByRole("button",{name:"Add one LED"}).click();
  await expect(page.getByRole("status",{name:"4 owned"})).toBeVisible();
  await expect.poll(async()=>{const response=await fetch(itemUrl,{headers:headers(a.token)});return (await response.json())[0]?.quantity;},{timeout:20000}).toBe(4);

  const freshContext=await browser.newContext({storageState:process.env.E2E_STORAGE_STATE});
  try{
    await protectPreview(freshContext);
    const fresh=await freshContext.newPage();
    await fresh.goto(new URL("/auth",page.url()).toString());
    await fresh.getByLabel("Email",{exact:true}).fill(a.email);
    await fresh.getByLabel("Password",{exact:true}).fill(a.password);
    await fresh.getByRole("button",{name:"Sign in",exact:true}).click();
    await expect(fresh.getByText(a.email,{exact:true})).toBeVisible();
    await fresh.goto(new URL("/parts",page.url()).toString());
    await expect(fresh.getByRole("status",{name:"4 owned"})).toBeVisible({timeout:20000});
    await fresh.route(`${url}/rest/v1/**`,route=>route.abort());
    await fresh.getByRole("button",{name:"Add one LED"}).click();
    await expect(fresh.getByRole("status",{name:"5 owned"})).toBeVisible();
    await fresh.reload();
    await expect(fresh.getByRole("status",{name:"5 owned"})).toBeVisible();
    await fresh.unrouteAll();
    await fresh.reload();
    await expect.poll(async()=>{const response=await fetch(itemUrl,{headers:headers(a.token)});return (await response.json())[0]?.quantity;},{timeout:20000}).toBe(5);
  }finally{await freshContext.close();}

  await page.goto("/settings/account");
  await page.getByRole("button",{name:"Sign out",exact:true}).click();
  await page.goto("/parts");
  await expect(page.getByRole("tab",{name:/My Parts 1/})).toBeVisible();
  await expect(page.getByRole("status",{name:"2 owned"})).toBeVisible();
  await page.goto("/auth");
  await page.getByLabel("Email",{exact:true}).fill(b.email);
  await page.getByLabel("Password",{exact:true}).fill(b.password);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page.getByText(b.email,{exact:true})).toBeVisible();
  await page.goto("/parts");
  await expect(page.getByRole("tab",{name:/My Parts 0/})).toBeVisible();
  const cleanup=await fetch(`${url}/rest/v1/inventory_items?owner_id=eq.${a.id}`,{method:"DELETE",headers:headers(a.token)});
  expect(cleanup.ok).toBe(true);
});
