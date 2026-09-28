import { randomUUID, randomBytes } from "node:crypto";
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
// Opt-in: uses disposable accounts from the hosted API verification, never personal credentials.
test("hosted password login, cloud restore, offline table and sign-out", async ({ page, browser }) => {
 test.setTimeout(120000);
 test.skip(!process.env.KINETABLE_HOSTED_QA, "Requires hosted verification accounts");

 const values = Object.fromEntries(readFileSync(".env.local", "utf8").trim().split(/\r?\n/).map(line => { const i=line.indexOf("="); return [line.slice(0,i),line.slice(i+1)]; }));
 const accounts=[];
 for(let i=0;i<2;i++){const email=`kinetable-qa-correction-${randomUUID()}@gmail.com`,password=randomBytes(24).toString("base64url");const r=await fetch(`${values.VITE_SUPABASE_URL}/auth/v1/signup`,{method:"POST",headers:{apikey:values.VITE_SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password})});expect(r.ok).toBe(true);const a=await r.json();accounts.push({email,password,id:a.user.id,token:a.access_token});}
 writeFileSync("../../output/hosted-qa-accounts.json",JSON.stringify(accounts));const [account]=accounts;
 const response = await fetch(`${values.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:values.VITE_SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:account.email,password:account.password})});
 expect(response.ok).toBe(true); const session = await response.json();
 const reset = await fetch(`${values.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${account.id}`,{method:"PATCH",headers:{apikey:values.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({primary_board_id:"esp32-dev-module",setup_completed:true})});
 expect(reset.ok).toBe(true);
 const resetProjects=await fetch(`${values.VITE_SUPABASE_URL}/rest/v1/projects?owner_id=eq.${account.id}`,{method:"DELETE",headers:{apikey:values.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}}); expect(resetProjects.ok).toBe(true);
 const errors: string[]=[]; page.on("pageerror", error => errors.push(error.message));
 await page.goto("/auth");
 await expect(page.locator('[data-cloud-configured="true"]')).toBeVisible();
 await page.getByLabel("Email",{exact:true}).fill(account.email);
 await page.getByLabel("Password", { exact: true }).fill(account.password);
 await page.getByRole("button", { name: "Sign in", exact: true }).click();
 await expect(page).toHaveURL(/\/home$/,{timeout:20000}); await page.goto("/table");
 await expect(page.locator('[data-board-id="esp32-dev-module"]')).toBeVisible({timeout:20000});
 const projectId=await page.locator('[data-project-id]').getAttribute('data-project-id'); expect(projectId).toBeTruthy();
 await page.reload(); await expect(page.locator('[data-board-id="esp32-dev-module"]')).toBeVisible();
 await page.goto("/start");
 await page.getByRole("radio", { name: "Raspberry Pi Pico", exact:true }).check();

 await page.getByRole("button",{name:/^Continue with/}).click(); await expect(page).toHaveURL(/\/home$/); await page.goto("/table");
 await expect(page.locator('[data-board-id="raspberry-pi-pico"]')).toBeVisible();
 await page.getByRole("button",{name:"Account",exact:true}).click(); await expect(page.locator(".account-menu [role=status]")).toHaveText("● Synced",{timeout:20000});
 await expect.poll(async()=>{const r=await fetch(`${values.VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}&select=*`,{headers:{apikey:values.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}});const rows=await r.json();return rows[0]?.document?.boardIds?.[0];}).toBe('raspberry-pi-pico');
 await page.keyboard.press("Escape");
 await page.getByRole("button",{name:"Rename project"}).click();await page.getByLabel("Project name",{exact:true}).fill("Hosted renamed bench");await page.keyboard.press("Enter");
 await expect.poll(async()=>{const r=await fetch(`${values.VITE_SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}&select=name,document`,{headers:{apikey:values.VITE_SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}});const rows=await r.json();return [rows[0]?.name,rows[0]?.document?.name];}).toEqual(["Hosted renamed bench","Hosted renamed bench"]);
 await page.goto("/settings/account");await expect(page.getByRole("heading",{name:"Account",exact:true})).toBeVisible();await expect(page.getByText(account.email,{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Sign out",exact:true}).click();
 await expect(page.getByRole("button",{name:"Guest account"})).toBeVisible();
 await page.goto(`/projects/${projectId}`);await expect(page.getByRole("heading",{name:"This project isn’t here."})).toBeVisible();
 const context = await browser.newContext({storageState:process.env.E2E_STORAGE_STATE});
 const fresh = await context.newPage();
 await fresh.goto(new URL(`/auth?next=/projects/${projectId}`,page.url()).toString());
 await fresh.getByLabel("Email",{exact:true}).fill(account.email); await fresh.getByLabel("Password",{exact:true}).fill(account.password);
 await fresh.getByRole("button",{name:"Sign in",exact:true}).click();
 await expect(fresh.locator('[data-board-id="raspberry-pi-pico"]')).toBeVisible({timeout:20000});
 await expect(fresh.locator('[data-project-id]')).toHaveAttribute('data-project-id',projectId!);
 await expect(fresh.getByRole("button",{name:"Rename project"})).toContainText("Hosted renamed bench");
 await fresh.route('https://*.supabase.co/**', route=>route.abort());
 await fresh.reload(); await expect(fresh.locator('[data-board-id="raspberry-pi-pico"]')).toBeVisible();
 await fresh.goto(new URL("/start",page.url()).toString());
 await fresh.getByRole("radio",{name:"Arduino Uno",exact:true}).check();
 await fresh.getByRole("button",{name:/^Continue with/}).click(); await expect(fresh).toHaveURL(/\/home$/); await fresh.goto(new URL("/table",page.url()).toString());
 await expect(fresh.locator('[data-board-id="arduino-uno"]')).toBeVisible({timeout:20000});
 await fresh.reload(); await expect(fresh.locator('[data-board-id="arduino-uno"]')).toBeVisible({timeout:20000});
 await context.close(); expect(errors).toEqual([]);
});

test("guest setup survives real password signup and is restored from cloud", async ({page,browser}) => {
 test.setTimeout(120000);
 test.skip(!process.env.KINETABLE_HOSTED_QA, "Creates a disposable hosted QA account");
 const email=`kinetable-qa-${randomUUID()}@gmail.com`, password=randomBytes(24).toString("base64url");
 await page.goto("/start"); await page.getByRole("radio",{name:"Arduino Uno",exact:true}).check();
 await page.getByRole("button",{name:/^Continue with/}).click(); await expect(page).toHaveURL(/\/home$/); await page.goto("/table"); await expect(page.locator('[data-board-id="arduino-uno"]')).toBeVisible();
 const guestProjectId=await page.locator('[data-project-id]').getAttribute('data-project-id'); expect(guestProjectId).toBeTruthy();
 await page.goto(`/auth?next=/projects/${guestProjectId}`); await page.getByRole("button",{name:"New here? Create an account"}).click();
 await page.getByLabel("Email",{exact:true}).fill(email); await page.getByLabel("Password",{exact:true}).fill(password);
 await page.getByRole("button",{name:"Create account",exact:true}).click();
 await expect(page.locator('[data-board-id="arduino-uno"]')).toBeVisible({timeout:20000});
 await expect(page.locator('[data-project-id]')).toHaveAttribute('data-project-id',guestProjectId!);
 writeFileSync("../../output/hosted-ui-account.json",JSON.stringify({email,password}));
 const context=await browser.newContext({storageState:process.env.E2E_STORAGE_STATE}); const fresh=await context.newPage();
 await fresh.goto(new URL(`/auth?next=/projects/${guestProjectId}`,page.url()).toString()); await fresh.getByLabel("Email",{exact:true}).fill(email); await fresh.getByLabel("Password",{exact:true}).fill(password);
 await fresh.getByRole("button",{name:"Sign in",exact:true}).click(); await expect(fresh.locator('[data-board-id="arduino-uno"]')).toBeVisible({timeout:20000});
 await expect(fresh.locator('[data-project-id]')).toHaveAttribute('data-project-id',guestProjectId!);
 await context.close();
});
