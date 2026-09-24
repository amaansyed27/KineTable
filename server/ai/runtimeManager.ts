import { spawn, type ChildProcess } from "node:child_process";
import type { LocalRuntime } from "./localRuntime.js";
import { run } from "./cliRuntime.js";

const permissions = new Set<LocalRuntime>();
const owned = new Map<LocalRuntime, ChildProcess>();
let startedLms = false;
async function executable(name: "ollama" | "lms"): Promise<string> {
  if (process.platform !== "win32") return name;
  const result = await run("where.exe", [name], process.cwd(), 5000, 8192).catch(() => null);
  const path = result?.stdout.split(/\r?\n/).find(value => value.toLowerCase().endsWith(".exe"));
  if (!path) throw new Error("LOCAL_RUNTIME_UNAVAILABLE");
  return path.trim();
}
export const runtimeManager = {
  permit(runtime: LocalRuntime, allowed: boolean): void {
    if (allowed) permissions.add(runtime); else permissions.delete(runtime);
  },
  allowed(runtime: LocalRuntime): boolean { return permissions.has(runtime); },
  async start(runtime: LocalRuntime): Promise<void> {
    if (!permissions.has(runtime)) throw new Error("PERMISSION_REQUIRED");
    if (runtime === "vllm") throw new Error("MANUAL_START_REQUIRED");
    if (runtime === "lmstudio") {
      if (!startedLms) { await run(await executable("lms"), ["server", "start"], process.cwd(), 15000, 4096); startedLms = true; }
      return;
    }
    if (owned.has(runtime)) return;
    const child = spawn(await executable("ollama"), ["serve"], { shell: false, windowsHide: true, stdio: "ignore" });
    await new Promise<void>((resolve, reject) => { child.once("spawn", resolve); child.once("error", () => reject(new Error("LOCAL_RUNTIME_UNAVAILABLE"))); });
    owned.set(runtime, child);
    child.once("exit", () => { if (owned.get(runtime) === child) owned.delete(runtime); });
  },
  async stop(runtime: LocalRuntime): Promise<void> {
    if (!permissions.has(runtime)) throw new Error("PERMISSION_REQUIRED");
    if (runtime === "lmstudio") {
      if (!startedLms) throw new Error("NOT_BRIDGE_OWNED");
      await run(await executable("lms"), ["server", "stop"], process.cwd(), 10000, 4096);
      startedLms = false; return;
    }
    const child = owned.get(runtime);
    if (!child) throw new Error("NOT_BRIDGE_OWNED");
    child.kill();
    owned.delete(runtime);
  },
};
