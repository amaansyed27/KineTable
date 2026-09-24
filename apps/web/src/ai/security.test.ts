import { afterAll, expect, it } from "vitest";
import { createServer } from "node:http";
import { createLocalBridge, newBridgeToken } from "../../../../server/localBridge";
import { validateRemoteEndpoint } from "../../../../server/ai/safeEndpoint";
import { normalizeCliOutput, run, validateCliId } from "../../../../server/ai/cliRuntime";
import { localModels, validateLocalConfig } from "../../../../server/ai/localRuntime";
import { remotePresets, remotePreset } from "./remoteCatalog";
import { addRoute, saveProviderSettings } from "./providerSettings";

it("keeps keys out of routing settings and has documented provider presets", () => {
  const settings = addRoute({ profile: { id: "default", name: "Mine", routes: [] }, credentials: [] }, { providerId: "groq", transport: "REMOTE_API", modelId: "model" });
  settings.credentials.push({ id: "key", providerId: "groq", label: "Personal", lastFour: "9f2a", priority: 0, enabled: true, remembered: false });
  const old = globalThis.localStorage;
  const saved = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem: (key: string, value: string) => saved.set(key, value) } });
  try { saveProviderSettings(settings); } finally { Object.defineProperty(globalThis, "localStorage", { configurable: true, value: old }); }
  expect(saved.get("kinetable:providers:v1")).toContain("9f2a");
  expect(saved.get("kinetable:providers:v1")).not.toContain("raw-secret");
  expect(remotePresets.length).toBeGreaterThanOrEqual(30);
  expect(remotePreset("groq")?.docs).toMatch(/^https:\/\//);
});

it("rejects reserved and private remote endpoints and limits local configs", async () => {
  for (const url of ["http://example.com/v1", "https://127.0.0.1/v1", "https://10.0.0.1/v1", "https://169.254.169.254/v1", "https://localhost/v1", "https://example.com:8080/v1", "https://user:pass@example.com/v1"]) {
    await expect(validateRemoteEndpoint(url)).rejects.toThrow("INVALID_ENDPOINT");
  }
  expect(() => validateLocalConfig({ runtime: "ollama", port: 11434, modelId: "qwen" })).not.toThrow();
  expect(() => validateLocalConfig({ runtime: "shell", port: 11434, modelId: "qwen" })).toThrow("INVALID_REQUEST");
  expect(() => validateCliId("powershell")).toThrow("INVALID_REQUEST");
});

const servers: ReturnType<typeof createLocalBridge>[] = [];
afterAll(async () => { await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve())))); });
it("requires bridge token and allowed Origin and exposes no shell action", async () => {
  const token = newBridgeToken();
  const server = createLocalBridge({ token, origins: ["http://127.0.0.1:5173"] }); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No server address");
  const url = `http://127.0.0.1:${address.port}`;
  const request = (origin: string, secret: string, path: string) => fetch(url + path, { method: "POST", headers: { Origin: origin, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: "{}" });
  expect((await request("https://evil.example", token, "/v1/handshake")).status).toBe(403);
  expect((await request("http://127.0.0.1:5173", "bad", "/v1/handshake")).status).toBe(401);
  expect((await request("http://127.0.0.1:5173", token, "/v1/handshake")).status).toBe(200);
  expect((await request("http://127.0.0.1:5173", token, "/shell")).status).toBe(404);
  const malformed = await fetch(url + "/v1/models", { method: "POST", headers: { Origin: "http://127.0.0.1:5173", Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{" });
  expect(malformed.status).toBe(400);
  expect(await malformed.json()).toEqual({ code: "INVALID_REQUEST" });
});

it("bounds spawned process time and output", async () => {
  await expect(run(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], process.cwd(), 100, 4096)).rejects.toThrow("TIMEOUT");
  await expect(run(process.execPath, ["-e", "process.stdout.write('x'.repeat(10000))"], process.cwd(), 5000, 100)).rejects.toThrow("CLI_OUTPUT_LIMIT");
});

it("normalizes documented CLI response shapes without accepting tool refusals", () => {
  const plan = { status: "unsupported", summary: "Probe", unsupportedReason: "Probe only", commands: [] };
  expect(normalizeCliOutput("codex", JSON.stringify(plan))).toEqual(plan);
  expect(normalizeCliOutput("agy", JSON.stringify({ structured_output: plan }))).toEqual(plan);
  expect(normalizeCliOutput("claude", JSON.stringify({ structured_output: plan }))).toEqual(plan);
  expect(normalizeCliOutput("kimi", JSON.stringify({ type: "assistant", content: JSON.stringify(plan) }))).toEqual(plan);
  expect(normalizeCliOutput("opencode", JSON.stringify({ type: "text", part: { text: JSON.stringify(plan) } }))).toEqual(plan);
  expect(normalizeCliOutput("continue", JSON.stringify(plan))).toEqual(plan);
  expect(() => normalizeCliOutput("agy", JSON.stringify({ denied_actions: ["tool"] }))).toThrow("CLI_PERMISSION_DENIED");
  expect(() => normalizeCliOutput("kimi", "not JSON")).toThrow(SyntaxError);
});

it("discovers installed local models through the documented runtime endpoint", async () => {
  const server = createServer((req, res) => {
    if (req.url !== "/api/tags") { res.writeHead(404); return res.end(); }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ models: [{ name: "qwen3.5:9b" }] }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); if (!address || typeof address === "string") throw new Error("No server address");
    expect(await localModels("ollama", address.port)).toEqual(["qwen3.5:9b"]);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
