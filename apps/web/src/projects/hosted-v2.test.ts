import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { executeCommands } from "../hardware-core/commands";
import { projectFromIntent, starterProject } from "./schema";
import { migrateProject } from "./v2";

it.skipIf(process.env.KINETABLE_HOSTED_V2_QA !== "1")("round-trips validated v2 hardware through hosted Supabase and enforces RLS", async () => {
  const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(line => line.includes("=")).map(line => { const i = line.indexOf("="); return [line.slice(0,i), line.slice(i+1)]; }));
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const request = async (path: string, method: string, token?: string, body?: unknown) => {
    const response = await fetch(url + path, { method, headers: { apikey: key, "Content-Type": "application/json", Prefer: "return=representation", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error(`Hosted QA HTTP ${response.status}`);
    return response.json();
  };
  expect((await request("/auth/v1/settings", "GET")).mailer_autoconfirm).toBe(true);
  const account = async () => {
    const email = `kinetable-qa-v2-${randomUUID()}@gmail.com`, password = randomBytes(24).toString("base64url");
    const data = await request("/auth/v1/signup", "POST", undefined, { email, password });
    return { id: data.user.id as string, token: data.access_token as string, email, password };
  };
  const a = await account(), b = await account();
  const profile = await request(`/rest/v1/profiles?id=eq.${a.id}`, "PATCH", a.token, { primary_board_id: "esp32-dev-module", setup_completed: true });
  expect(profile[0].setup_completed).toBe(true);
  const initial = projectFromIntent(starterProject("esp32-dev-module"), "esp32-dev-module", "Make a motion alarm", "QA Motion Alarm");
  const e = (componentId: string, pinId: string) => ({ componentId, pinId });
  const candidate = executeCommands(migrateProject(initial), [
    { type: "component.add", instanceId: "pir-1", definitionId: "hc-sr501" },
    { type: "component.add", instanceId: "buzzer-1", definitionId: "grove-buzzer-v1-1" },
    { type: "connection.create", id: "pir-vcc", from: e("pir-1", "vcc"), to: e("board-main", "vin") },
    { type: "connection.create", id: "pir-gnd", from: e("pir-1", "gnd"), to: e("board-main", "gnd") },
    { type: "connection.create", id: "pir-out", from: e("pir-1", "out"), to: e("board-main", "gpio27") },
    { type: "connection.create", id: "buzzer-power", from: e("buzzer-1", "vcc"), to: e("board-main", "3v3") },
    { type: "connection.create", id: "buzzer-signal", from: e("buzzer-1", "sig"), to: e("board-main", "gpio19") },
    { type: "connection.create", id: "buzzer-gnd", from: e("buzzer-1", "gnd"), to: e("board-main", "gnd") },
  ]);
  const created = await request("/rest/v1/projects", "POST", a.token, { id: candidate.id, name: candidate.name, primary_board_id: candidate.boardIds[0], schema_version: 2, document: candidate });
  expect(created[0].owner_id).toBe(a.id);
  expect(created[0].schema_version).toBe(2);
  expect(created[0].document).toEqual(candidate);
  const restored = await request(`/rest/v1/projects?id=eq.${candidate.id}&select=*`, "GET", a.token);
  expect(restored[0].document).toEqual(candidate);
  expect(await request(`/rest/v1/projects?id=eq.${candidate.id}&select=*`, "GET", b.token)).toEqual([]);
  expect(await request(`/rest/v1/projects?id=eq.${candidate.id}`, "PATCH", b.token, { name: "stolen" })).toEqual([]);
  const incomplete = executeCommands(migrateProject(starterProject("esp32-dev-module")), [{ type: "component.add", instanceId: "led-1", definitionId: "led-5mm" }], undefined, "editor");
  const draft = await request("/rest/v1/projects", "POST", a.token, { id: incomplete.id, name: incomplete.name, primary_board_id: incomplete.boardIds[0], schema_version: 2, document: incomplete });
  expect(draft[0].document.components).toHaveLength(2);
  expect((await request(`/rest/v1/projects?id=eq.${incomplete.id}&select=*`, "GET", a.token))[0].document).toEqual(incomplete);
  expect(await request(`/rest/v1/projects?id=eq.${incomplete.id}&select=*`, "GET", b.token)).toEqual([]);
  expect(await request(`/rest/v1/projects?id=eq.${incomplete.id}`, "PATCH", b.token, { name: "stolen" })).toEqual([]);
  expect(await request(`/rest/v1/projects?id=eq.${incomplete.id}`, "DELETE", a.token)).toHaveLength(1);
  mkdirSync("../../output", { recursive: true });
  writeFileSync("../../output/slice-06-hosted-v2.json", JSON.stringify({ a, b, projectId: candidate.id }));
}, 60000);
