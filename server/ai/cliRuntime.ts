import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planJsonSchema } from "../../apps/web/src/ai/prompt.js";
import type { ModelProvider } from "../../apps/web/src/ai/planner.js";

export type CliId = "codex" | "agy" | "claude" | "kimi" | "opencode" | "continue";
export type CliResult = { structuredOutput: unknown; provider: CliId; model?: string; latency: number };
const executable: Record<CliId, string> = { codex: "codex", agy: "agy", claude: "claude", kimi: "kimi", opencode: "opencode", continue: "cn" };
const supported = new Set(Object.keys(executable));
export function validateCliId(value: unknown): CliId {
  if (typeof value !== "string" || !supported.has(value)) throw new Error("INVALID_REQUEST");
  return value as CliId;
}
async function binary(id: CliId): Promise<string> {
  if (process.platform !== "win32") return executable[id];
  const found = await run("where.exe", [executable[id]], process.cwd(), 5000, 8192).catch(() => null);
  const paths = found?.stdout.split(/\r?\n/).map(s => s.trim()) ?? [];
  const exe = paths.find(path => path.toLowerCase().endsWith(".exe"));
  if (!exe) throw new Error("CLI_UNAVAILABLE");
  return exe;
}
export function run(file: string, args: string[], cwd: string, timeout: number, limit: number, env?: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, env: env ? { ...process.env, ...env } : undefined, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", finished = false;
    const fail = (code: string) => { if (!finished) { finished = true; child.kill(); reject(new Error(code)); } };
    const timer = setTimeout(() => fail("TIMEOUT"), timeout);
    child.stdout.on("data", chunk => { stdout += chunk.toString(); if (stdout.length > limit) fail("CLI_OUTPUT_LIMIT"); });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); if (stderr.length > limit) fail("CLI_OUTPUT_LIMIT"); });
    child.on("error", () => fail("CLI_UNAVAILABLE"));
    child.on("close", code => { clearTimeout(timer); if (finished) return; finished = true; code === 0 ? resolve({ stdout, stderr }) : reject(new Error(/not logged in|authentication required|please run \/login/i.test(stdout + stderr) ? "CLI_AUTH_REQUIRED" : "PROVIDER_UNAVAILABLE")); });
  });
}
export async function cliStatus(id: CliId): Promise<{ available: boolean; version?: string }> {
  try {
    const result = await run(await binary(id), ["--version"], process.cwd(), 5000, 4096);
    return { available: true, version: result.stdout.trim().slice(0, 100) };
  } catch { return { available: false }; }
}
export function normalizeCliOutput(id: CliId, content: string): unknown {
  const parsed = id === "continue" ? { result: content.trim() } : id === "kimi" || id === "opencode"
    ? { result: content.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>).filter(event => id === "kimi" ? event.role === "assistant" || event.type === "assistant" : event.type === "text").map(event => id === "kimi" ? event.content ?? event.text : (event.part as { text?: unknown } | undefined)?.text).filter(value => typeof value === "string").at(-1) }
    : JSON.parse(content) as Record<string, unknown>;
  if (parsed.is_error || parsed.status === "ERROR") throw new Error(/not logged in|authentication required|please run \/login/i.test(String(parsed.result ?? parsed.error ?? "")) ? "CLI_AUTH_REQUIRED" : "PROVIDER_UNAVAILABLE");
  if (Array.isArray(parsed.denied_actions) && parsed.denied_actions.length) throw new Error("CLI_PERMISSION_DENIED");
  return id === "codex" ? parsed : parsed.structured_output ?? parsed.structuredOutput ?? (typeof parsed.result === "string" ? JSON.parse(parsed.result) as unknown : parsed);
}
export function cliModelProvider(id: CliId, modelId?: string): ModelProvider {
  return { async generate(prompt) {
    const started = Date.now();
    const cwd = await mkdtemp(join(tmpdir(), "kinetable-plan-"));
    try {
      const schema = join(cwd, "schema.json"), output = join(cwd, "output.json");
      await writeFile(schema, JSON.stringify(planJsonSchema));
      const file = await binary(id);
      if (modelId && !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/.test(modelId)) throw new Error("INVALID_REQUEST");
      let args: string[];
      let env: NodeJS.ProcessEnv | undefined;
      if (id === "codex") args = ["exec", "--ephemeral", "--ignore-user-config", "-s", "read-only", "-C", cwd, "--skip-git-repo-check", "--output-schema", schema, "-o", output, ...(modelId ? ["-m", modelId] : []), prompt];
      else if (id === "agy") args = ["-p", prompt, "--output-format", "json", "--json-schema", schema, "--mode", "plan", "--sandbox", ...(modelId ? ["--model", modelId] : [])];
      else if (id === "claude") args = ["-p", prompt, "--output-format", "json", "--json-schema", schema, "--permission-mode", "plan", "--disallowedTools", "Bash", "Edit", "Write", "NotebookEdit", "Read", "Glob", "Grep", "WebFetch", "WebSearch", "Task", ...(modelId ? ["--model", modelId] : [])];
      else if (id === "kimi") {
        const agent = join(cwd, "planner.md");
        await writeFile(agent, "---\nname: kinetable-planner\ndescription: Return a hardware plan without using tools\ntools: []\nsubagents: []\n---\nReturn only the requested JSON object. Never call tools.\n");
        args = ["-p", prompt, "--agent-file", agent, "--output-format", "stream-json", ...(modelId ? ["-m", modelId] : [])];
      } else if (id === "opencode") {
        env = { OPENCODE_CONFIG_CONTENT: JSON.stringify({ permission: "deny" }) };
        args = ["run", "--format", "json", ...(modelId ? ["-m", modelId] : []), prompt];
      } else args = ["-p", prompt, "--readonly", ...(modelId ? ["--model", modelId] : [])];
      const result = await run(file, args, cwd, 120000, 65536, env);
      const content = id === "codex" ? await readFile(output, "utf8") : result.stdout;
      const structuredOutput = normalizeCliOutput(id, content);
      const normalized: CliResult = { structuredOutput, provider: id, model: modelId, latency: Date.now() - started };
      return normalized.structuredOutput;
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("INVALID_MODEL_RESPONSE");
      throw error;
    } finally { await rm(cwd, { recursive: true, force: true }); }
  } };
}
