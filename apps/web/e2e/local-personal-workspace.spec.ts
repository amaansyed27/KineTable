import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { starterRow } from "../src/projects/projectCreation";
import { protectPreview } from "./protectedPreview";
import { localSupabaseOnly } from "./localSupabaseOnly";

test("hosted revisions, owner RLS, fresh restore and two-device conflict", async ({ page, browser, context }) => {
  test.skip(!localSupabaseOnly(true), "Requires local Supabase fixtures");
  test.setTimeout(300000);
  await protectPreview(context);
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(line => line.includes("=")).map(line => {
    const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1)];
  }));
  const url = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const accounts = [];
  for (let i = 0; i < 2; i++) {
    const email = `kinetable-slice12-${randomUUID()}@gmail.com`, password = randomBytes(24).toString("base64url");
    const response = await fetch(`${url}/auth/v1/signup`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    expect(response.ok).toBe(true);
    const result = await response.json() as { user: { id: string }; access_token: string };
    expect(result.access_token).toBeTruthy();
    accounts.push({ email, password, id: result.user.id, token: result.access_token });
  }
  const [a, b] = accounts;
  const headers = (token: string) => ({ apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
  const request = (path: string, token: string, method = "GET", body?: unknown) => fetch(`${url}/rest/v1/${path}`, {
    method, headers: headers(token), body: body === undefined ? undefined : JSON.stringify(body),
  });
  const first = starterRow("esp32-dev-module", a.id).document;
  const save = async (document: typeof first, expected: number | null, reason: string) => {
    const response = await request("rpc/checkpoint_project", a.token, "POST", {
      p_id: document.id, p_document: document, p_expected_revision: expected, p_reason: reason,
    });
    return { response, value: response.ok ? await response.json() : null };
  };
  const initial = await save(first, null, "Initial QA");
  expect(initial.response.status).toBe(200);
  expect(initial.value).toMatchObject({ status: "saved", project: { revision: 1 } });
  const head = async () => (await (await request(`projects?id=eq.${first.id}&select=*`, a.token)).json())[0];
  const versions = async (token: string) => (await (await request(`project_versions?project_id=eq.${first.id}&select=*`, token)).json());
  expect(await versions(a.token)).toHaveLength(1);
  expect(await versions(b.token)).toHaveLength(0);
  expect((await (await request(`projects?id=eq.${first.id}&select=*`, b.token)).json())).toHaveLength(0);
  expect((await request("rpc/checkpoint_project", b.token, "POST", {
    p_id: first.id, p_document: first, p_expected_revision: 1, p_reason: "Spoofed",
  })).ok).toBe(false);
  expect((await request(`project_versions?id=eq.${(await versions(a.token))[0].id}`, a.token, "PATCH", { reason: "Changed" })).ok).toBe(false);
  expect((await request(`projects?id=eq.${first.id}`, a.token, "PATCH", { name: "Bypassed RPC" })).ok).toBe(false);
  const next = { ...first, name: "Cloud edit", metadata: { ...first.metadata, updatedAt: new Date(Date.now() + 1000).toISOString() } };
  const second = await save(next, 1, "Cloud edit");
  expect(second.response.status).toBe(200);
  expect(second.value).toMatchObject({ status: "saved", project: { revision: 2 } });
  const stale = await save(first, 1, "Stale write");
  expect(stale.response.status).toBe(200);
  expect(stale.value.status).toBe("conflict");
  expect((await head()).name).toBe("Cloud edit");
  expect(await versions(a.token)).toHaveLength(2);

  const signIn = async (target: Page) => {
    await target.goto("/auth");
    await target.getByLabel("Email", { exact: true }).fill(a.email);
    await target.getByLabel("Password", { exact: true }).fill(a.password);
    await target.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(target.getByRole("button", { name: "Account", exact: true })).toBeVisible({ timeout: 45000 });
  };
  await signIn(page);
  await page.goto("/start");
  await page.getByRole("radio", { name: "ESP32", exact: true }).check();
  await page.getByRole("button", { name: /^Continue with/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto(`/projects/${first.id}/history`);
  await expect(page.getByRole("heading", { name: "Cloud edit history" })).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: /Initial QA/ }).click();
  await page.getByRole("button", { name: "Restore this version" }).click();
  await page.getByRole("button", { name: "Confirm restore" }).click();
  await expect.poll(async () => (await head())?.revision, { timeout: 20000 }).toBe(3);
  expect((await head()).name).toBe(first.name);
  expect(await versions(a.token)).toHaveLength(3);
  await page.reload();
  await expect(page.getByRole("heading", { name: `${first.name} history` })).toBeVisible();
  await expect.poll(async () => {
    const profiles = await (await request(`profiles?id=eq.${a.id}&select=setup_completed`, a.token)).json() as { setup_completed: boolean }[];
    return profiles[0]?.setup_completed;
  }, { timeout: 20000 }).toBe(true);

  const secondContext = await browser.newContext({ storageState: process.env.E2E_STORAGE_STATE });
  try {
    await protectPreview(secondContext);
    const device = await secondContext.newPage();
    await signIn(device);
    await device.goto(`/projects/${first.id}`);
    await expect(device.locator("[data-project-id]")).toHaveAttribute("data-project-id", first.id, { timeout: 20000 });
    let checkpointCalls = 0;
    device.on("request", request => { if (request.url().includes("/rpc/checkpoint_project")) checkpointCalls++; });
    await device.route(`${url}/rest/v1/**`, route => route.abort());
    await device.getByRole("button", { name: "Rename project" }).click();
    await device.getByRole("textbox", { name: "Project name" }).fill("This device edit");
    await device.getByRole("textbox", { name: "Project name" }).press("Enter");
    await expect(device.getByRole("heading", { name: "This device edit" })).toBeVisible();
    const cloudEdit = { ...first, name: "Other device edit", metadata: { ...first.metadata, updatedAt: new Date(Date.now() + 2000).toISOString() } };
    expect((await save(cloudEdit, 3, "Other device edit")).response.ok).toBe(true);
    await device.unrouteAll();
    await device.evaluate(() => window.dispatchEvent(new Event("online")));
    await device.goto(`/projects/${first.id}/history`);
    await expect(device.getByRole("heading", { name: "This project changed on another device." })).toBeVisible({ timeout: 20000 });
    await device.reload();
    await expect(device.getByRole("heading", { name: "This project changed on another device." })).toBeVisible();
    const attemptsAtConflict = checkpointCalls;
    await device.waitForTimeout(1500);
    expect(checkpointCalls).toBe(attemptsAtConflict);
    expect(checkpointCalls).toBeLessThanOrEqual(1);
    mkdirSync("../../output/playwright/slice12", { recursive: true });
    await device.screenshot({ path: "../../output/playwright/slice12/conflict-local.png", fullPage: true });
    await device.setViewportSize({ width: 390, height: 844 });
    await device.screenshot({ path: "../../output/playwright/slice12/conflict-local-mobile.png", fullPage: true });
    await device.getByRole("button", { name: "Keep both" }).click();
    await device.getByRole("button", { name: "Confirm choice" }).click();
    await expect(device.getByRole("heading", { name: "This project changed on another device." })).toBeHidden();
    expect((await head()).name).toBe("Other device edit");
    const all = await (await request("projects?select=id,name", a.token)).json() as { id: string; name: string }[];
    expect(all.some(row => row.name === "This device edit — this device")).toBe(true);
    expect((await (await request("projects?select=id,name", b.token)).json())).toHaveLength(0);
  } finally { await secondContext.close(); }
});
