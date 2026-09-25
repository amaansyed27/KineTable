import { executeCommands, HardwareError, validateHardware } from "../hardware-core/commands.js";
import type { KinetableProjectV3 } from "../projects/v3.js";
import { parsePlan, type Plan, type PlanRequest } from "./contract.js";
import { plannerPrompt } from "./prompt.js";

export type ModelProvider = { generate(prompt: string): Promise<unknown> };
export function validatePlanInput(request: PlanRequest, project: KinetableProjectV3): void {
  if (project.id !== request.projectId || project.metadata.updatedAt !== request.revision || project.intent?.text !== request.intent || project.boardIds[0] !== request.boardId) throw new Error("STALE_PROJECT");
  if (project.components.length !== 1 || project.wires.length !== 0 || project.terminalPlacements.length !== 0) throw new Error("INVALID_PROJECT");
  validateHardware(project);
}
export function validateGeneratedPlan(request: PlanRequest, project: KinetableProjectV3, output: unknown): Plan {
  validatePlanInput(request, project);
  const plan = parsePlan(output);
  if (plan.status === "supported") {
    try { executeCommands(project, plan.commands); }
    catch (error) { if (error instanceof HardwareError) throw error; throw new Error("HARDWARE_VALIDATION"); }
  }
  return plan;
}
export async function planHardware(provider: ModelProvider, request: PlanRequest, project: KinetableProjectV3): Promise<Plan> {
  validatePlanInput(request, project);
  let output: unknown;
  try { output = await provider.generate(plannerPrompt(request)); }
  catch (error) { throw new Error(error instanceof Error && ["INVALID_MODEL_RESPONSE", "MODEL_UNAVAILABLE", "LOCAL_RUNTIME_UNAVAILABLE", "CLI_UNAVAILABLE", "CLI_AUTH_REQUIRED", "CLI_PERMISSION_DENIED", "TIMEOUT", "NETWORK_FAILURE", "RATE_LIMIT", "QUOTA_EXHAUSTED", "CREDENTIAL_REJECTED", "SAFETY_REFUSAL", "CLI_OUTPUT_LIMIT"].includes(error.message) ? error.message : "PROVIDER_UNAVAILABLE"); }
  return validateGeneratedPlan(request, project, output);
}
