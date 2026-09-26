import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { protectPreview } from "./protectedPreview";

test.beforeEach(async ({ context }) => protectPreview(context));
test("hosted v3 circuit restores fresh, survives offline edit and reconnects", async ({ page, browser }) => {
  test.skip(process.env.KINETABLE_HOSTED_V3_BROWSER_QA !== "1", "Requires hosted Supabase QA");
  test.setTimeout(150000);
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(line => line.includes("=")).map(line => { const i = line.indexOf("="); return [line.slice(0,i),line.slice(i+1)]; }));
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const email = `kinetable-qa-circuit-${randomUUID()}@gmail.com`, password = randomBytes(24).toString("base64url");
  const signup = await fetch(`${url}/auth/v1/signup`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  expect(signup.ok).toBe(true);
  const token = (await signup.json()).access_token as string;
  const cloud = async (id: string) => {
    const response = await fetch(`${url}/rest/v1/projects?id=eq.${id}&select=*`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    expect(response.ok).toBe(true);
    return (await response.json())[0];
  };
  const saved = async (current: Page, id: string) => current.evaluate(projectId => new Promise<{schemaVersion: number; wires: unknown[]; terminalPlacements: unknown[]}>((resolve, reject) => {
    const open = indexedDB.open("kinetable"); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const row = open.result.transaction("projects", "readonly").objectStore("projects").get(projectId);
      row.onsuccess = () => resolve(row.result.document); row.onerror = () => reject(row.error); };
  }), id);
  const signIn = async (current: Page) => {
    await current.goto("/auth");
    await current.getByLabel("Your email").fill(email);
    await current.getByLabel("Password", { exact: true }).fill(password);
    await current.getByRole("button", { name: "Sign in", exact: true }).click();
  };
  await page.goto("/start");
  await page.getByRole("radio", { name: "ESP32", exact: true }).check();
  await page.getByRole("button", { name: "Set up my table" }).click();
  const id = (await page.locator("[data-project-id]").getAttribute("data-project-id"))!;
  await page.getByRole("button", { name: "+ Breadboard" }).click();
  await page.getByText("Accessible connection controls").click();
  await page.getByLabel("From", { exact: true }).selectOption("pin:board-main:gnd");
  await page.getByLabel("To", { exact: true }).selectOption("hole:breadboard-1:L-1");
  await page.getByRole("button", { name: "Create wire" }).click();
  await page.getByRole("button", { name: "+ Add part" }).click();
  await page.getByRole("dialog", { name: "Add part" }).getByRole("button", { name: "LED", exact: true }).click();
  await page.getByRole("button", { name: "LED", exact: true }).click();
  await page.getByLabel("LED inspector").getByRole("listitem").filter({ hasText: "CATHODE" }).getByRole("button", { name: "Insert lead" }).click();
  await page.getByLabel("To", { exact: true }).selectOption("hole:breadboard-1:L-14");
  await page.getByRole("button", { name: "Place lead in destination hole" }).click();
  expect((await saved(page,id)).terminalPlacements).toHaveLength(1);
  await signIn(page);
  await expect(page.locator("[data-project-id]")).toHaveAttribute("data-project-id", id, { timeout: 20000 });
  await expect.poll(async () => (await cloud(id))?.document?.wires?.length, { timeout: 30000 }).toBe(1);
  const row = await cloud(id);
  expect(row.schema_version).toBe(4);
  expect(row.document.schemaVersion).toBe(4);
  expect(row.document.wires[0].to).toEqual({ kind: "breadboard-hole", breadboardId: "breadboard-1", holeId: "L-1" });
  expect(row.document.terminalPlacements).toHaveLength(1);
  expect(row.primary_board_id).toBe(row.document.boardIds[0]);
  expect(row.name).toBe(row.document.name);
  const fresh = await browser.newContext({ storageState: process.env.E2E_STORAGE_STATE });
  try {
    await protectPreview(fresh);
    const restored = await fresh.newPage();
    await signIn(restored);
    await expect(restored.locator("[data-project-id]")).toHaveAttribute("data-project-id", id, { timeout: 20000 });
    await expect.poll(async () => (await saved(restored,id)).wires.length).toBe(1);
    expect((await saved(restored,id)).terminalPlacements).toHaveLength(1);
  } finally { await fresh.close(); }
  await page.route("https://*.supabase.co/**", route => route.abort());
  await page.getByLabel("Wires on this table").getByRole("button").click();
  await page.getByRole("button", { name: "Remove wire" }).click();
  await expect.poll(async () => (await saved(page,id)).wires.length).toBe(0);
  await page.reload();
  expect((await saved(page,id)).wires).toHaveLength(0);
  await page.unrouteAll();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(async () => (await cloud(id))?.document?.wires?.length, { timeout: 30000 }).toBe(0);
  const freshAgain = await browser.newContext({ storageState: process.env.E2E_STORAGE_STATE });
  try {
    await protectPreview(freshAgain);
    const restored = await freshAgain.newPage();
    await signIn(restored);
    await expect(restored.locator("[data-project-id]")).toHaveAttribute("data-project-id", id, { timeout: 20000 });
    await expect.poll(async () => (await saved(restored,id)).wires.length).toBe(0);
    expect((await saved(restored,id)).terminalPlacements).toHaveLength(1);
  } finally { await freshAgain.close(); }
  const cleanup = await fetch(`${url}/rest/v1/projects?id=eq.${id}`, { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${token}`, Prefer: "return=representation" } });
  expect(cleanup.ok).toBe(true);
});
