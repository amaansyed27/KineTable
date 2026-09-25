import { expect, it } from "vitest";
import { projectFromIntent, starterProject } from "../projects/schema";
import { migrateProject } from "../projects/v3";
import { routePlan, RoutingError, maskSecret, type CredentialMeta, type RoutingProfile } from "./routing";

const project = migrateProject(projectFromIntent(starterProject("esp32-dev-module"), "esp32-dev-module", "Build me a drone flight controller", "Drone"));
const request = { projectId: project.id, revision: project.metadata.updatedAt, intent: project.intent!.text, boardId: project.boardIds[0] };
const unsupported = { status: "unsupported", summary: "Unsupported", unsupportedReason: "No flight controller definition exists.", commands: [], revision: request.revision };
const credentials: CredentialMeta[] = [
  { id: "backup", providerId: "groq", label: "Backup", priority: 1, enabled: true, lastFour: "abcd", remembered: false },
  { id: "primary", providerId: "groq", label: "Personal", priority: 0, enabled: true, lastFour: "9f2a", remembered: false },
];
const profile: RoutingProfile = { id: "default", name: "My providers", routes: [
  { id: "other", providerId: "codex", transport: "LOCAL_CLI", modelId: "", credentialIds: [], enabled: true, priority: 1 },
  { id: "remote", providerId: "groq", transport: "REMOTE_API", modelId: "model", credentialIds: ["backup", "primary"], enabled: true, priority: 0 },
] };

it("orders providers and multiple keys, masks diagnostics, and falls back only for provider errors", async () => {
  const calls: string[] = [];
  const result = await routePlan(profile, credentials, request, project, async (route, key) => {
    calls.push(`${route.id}:${key}`);
    if (calls.length < 3) throw new Error(calls.length === 1 ? "RATE_LIMIT" : "CREDENTIAL_REJECTED");
    return unsupported;
  });
  expect(calls).toEqual(["remote:primary", "remote:backup", "other:null"]);
  expect(result.plan.status).toBe("unsupported");
  expect(JSON.stringify(result.attempts)).not.toContain("secret");
  expect(result.attempts[0].credential).toBe("Personal ••••9F2A");
  expect(maskSecret("12ce")).toBe("••••12CE");
});

it("stops on refusal, hardware invalidity, and unsupported responses", async () => {
  let count = 0;
  await expect(routePlan(profile, credentials, request, project, async () => { count++; throw new Error("SAFETY_REFUSAL"); })).rejects.toMatchObject({ code: "SAFETY_REFUSAL" });
  expect(count).toBe(1);
  await expect(routePlan(profile, credentials, request, project, async () => { count++; return { ...unsupported, status: "supported", commands: [{ type: "component.add", instanceId: "x", definitionId: "invented" }], unsupportedReason: "" }; })).rejects.toMatchObject({ code: "UNKNOWN_COMPONENT" });
  expect(count).toBe(2);
  const result = await routePlan(profile, credentials, request, project, async () => { count++; return unsupported; });
  expect(result.attempts).toHaveLength(1);
});

it("reports exhaustion and rejects stale results", async () => {
  try { await routePlan(profile, credentials, request, project, async () => { throw new Error("TIMEOUT"); }); }
  catch (error) { expect(error).toBeInstanceOf(RoutingError); expect(error).toMatchObject({ code: "PROVIDERS_EXHAUSTED", attempts: [{ code: "TIMEOUT" }, { code: "TIMEOUT" }, { code: "TIMEOUT" }] }); }
  await expect(routePlan(profile, credentials, request, project, async () => ({ ...unsupported, revision: "2020-01-01T00:00:00.000Z" }))).rejects.toMatchObject({ code: "STALE_PROJECT" });
});
