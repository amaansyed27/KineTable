import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { starterRow } from "../src/projects/projectCreation";
import { protectPreview } from "./protectedPreview";

test.use({ trace: "off" });
test("one reusable account restores History, My Parts and a two-device conflict", async ({ page, browser, context }) => {
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(line => line.includes("=")).map(line => {
    const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)];
  }));
  test.skip(process.env.KINETABLE_HOSTED_QA !== "1" || !env.KINETABLE_QA_EMAIL || !env.KINETABLE_QA_PASSWORD,
    "Requires the one reusable production QA account");
  test.setTimeout(240000);
  await protectPreview(context);
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: env.KINETABLE_QA_EMAIL, password: env.KINETABLE_QA_PASSWORD }) });
  expect(login.status).toBe(200);
  const session = await login.json() as { access_token: string; refresh_token: string; expires_in: number; user: { id: string } };
  const headers = { apikey: key, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };
  const api = (path: string, method = "GET", body?: unknown) => fetch(`${url}/rest/v1/${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const profile = await api(`profiles?id=eq.${session.user.id}`, "PATCH", { primary_board_id: "esp32-dev-module", setup_completed: true });
  expect(profile.ok).toBe(true);
  const existing = await (await api("projects?select=*")).json() as { id: string; name: string; revision: number; document: ReturnType<typeof starterRow>["document"] }[];
  expect(existing.length).toBeLessThanOrEqual(1);
  let project = existing[0];
  if (!project) {
    const document = starterRow("esp32-dev-module", session.user.id).document;
    const response = await api("rpc/checkpoint_project", "POST", {
      p_id: document.id, p_document: document, p_reason: "Created QA project", p_expected_revision: null,
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.status).toBe("saved");
    project = result.project;
  }
  const id = project.id;
  const head = async () => (await (await api(`projects?id=eq.${id}&select=*`)).json())[0] as typeof project;
  const versions = async () => (await (await api(`project_versions?project_id=eq.${id}&select=id,revision,reason`)).json()) as { id:string;revision:number;reason:string }[];
  const inventory = await (await api("inventory_items?definition_id=eq.led-5mm&select=quantity")).json() as {quantity:number}[];
  if (!inventory.length) expect((await api("inventory_items", "POST", { definition_id:"led-5mm",quantity:1 })).status).toBe(201);
  const beforeVersions = (await versions()).length;
  expect((await api(`projects?id=eq.${id}`, "PATCH", { name:"Bypassed RPC" })).ok).toBe(false);
  expect((await api(`project_versions?id=eq.${(await versions())[0].id}`, "PATCH", { reason:"Changed" })).ok).toBe(false);

  const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const savedSession = { ...session, expires_at: Math.floor(Date.now()/1000)+session.expires_in };
  const installSession = async (target: typeof context) => {
    await protectPreview(target);
    await target.addInitScript(({ storageKey, savedSession }) => localStorage.setItem(storageKey, JSON.stringify(savedSession)),
      { storageKey, savedSession });
  };
  await installSession(context);
  await page.goto(`/projects/${id}/history`);
  await expect(page.getByRole("heading", { name: `${project.name} history` })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: "Account", exact:true })).toBeVisible();
  const second = await browser.newContext({ storageState: process.env.E2E_STORAGE_STATE });
  try {
    await installSession(second);
    const device = await second.newPage();
    await device.goto("/parts");
    await expect(device.getByRole("tab", { name: /My Parts 1/ })).toBeVisible({ timeout: 20000 });
    await device.goto("/explore");
    await expect(device.getByRole("heading", { name:"Built around your parts." })).toBeVisible();
    await device.goto(`/projects/${id}`);
    await expect(device.locator("[data-project-id]")).toHaveAttribute("data-project-id",id);
    const base = (await head()).revision;
    await page.goto(`/projects/${id}`);
    await page.getByRole("button", { name:"Rename project" }).click();
    await page.getByRole("textbox", { name:"Project name" }).fill("QA cloud edit");
    await page.getByRole("textbox", { name:"Project name" }).press("Enter");
    await expect.poll(async () => (await head()).revision, { timeout:20000 }).toBe(base+1);
    const stale = await api("rpc/checkpoint_project", "POST", {
      p_id:id, p_document:project.document, p_reason:"Stale QA check", p_expected_revision:base,
    });
    expect(stale.status).toBe(200);
    expect((await stale.json()).status).toBe("conflict");
    expect((await head()).revision).toBe(base+1);
    let checkpointCalls=0;
    device.on("request", request => { if (request.url().includes("/rpc/checkpoint_project")) checkpointCalls++; });
    await device.route(`${url}/rest/v1/**`, route => route.abort());
    await device.getByRole("button", { name:"Rename project" }).click();
    await device.getByRole("textbox", { name:"Project name" }).fill("QA device edit");
    await device.getByRole("textbox", { name:"Project name" }).press("Enter");
    await expect(device.getByRole("heading", { name:"QA device edit" })).toBeVisible();
    await device.unrouteAll();
    await device.evaluate(() => window.dispatchEvent(new Event("online")));
    await device.goto(`/projects/${id}/history`);
    await expect(device.getByRole("heading", { name:"This project changed on another device." })).toBeVisible({ timeout:20000 });
    const attemptsAtConflict=checkpointCalls;
    await device.reload();
    await expect(device.getByRole("heading", { name:"This project changed on another device." })).toBeVisible();
    await device.waitForTimeout(1500);
    expect(checkpointCalls).toBe(attemptsAtConflict);
    expect(checkpointCalls).toBeLessThanOrEqual(1);
    await device.getByRole("button", { name:"Use cloud version" }).click();
    await device.getByRole("button", { name:"Confirm choice" }).click();
    await expect(device.getByRole("heading", { name:"This project changed on another device." })).toBeHidden();
    expect((await head()).name).toBe("QA cloud edit");
    expect((await versions()).length).toBe(beforeVersions+1);
  } finally { await second.close(); }
});
