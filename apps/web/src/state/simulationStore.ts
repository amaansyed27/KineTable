import { create } from "zustand";
import { analyzeSimulationCompatibility, compileCircuit, topologyKey, type CompiledCircuit } from "../simulation/compileCircuit";
import { availableRecipes, type Recipe } from "../simulation/recipes";
import { SimulationRuntime, type Snapshot } from "../simulation/runtime";
import { compileLogic, type CompiledBehaviorProgram } from "../logic/compile";
import type { XRayMode } from "../simulation/explain";
import type { CircuitProject } from "../projects/v4";

type Mode = "build" | "logic" | "simulate" | "explain";
type State = {
  mode: Mode; playing: boolean; circuit: CompiledCircuit | null; recipes: Recipe[]; recipe: Recipe | CompiledBehaviorProgram | null;
  runtime: SimulationRuntime | null; snapshot: Snapshot | null; xray: XRayMode; selectedTraceId: number | null;
  error: string | null; projectId: string | null; revision: string | null; key: string | null;
  enter(project: CircuitProject, mode: "simulate" | "explain"): void;
  build(): void; logic(): void; explain(): void; selectRecipe(id: string): void; play(): void; pause(): void; reset(): void;
  advanceBy(ms: number): void; button(id: string, pressed: boolean): void; pir(id: string): void; environment(temperatureC: number, humidityPct: number, componentId?: string): void;
  setXray(mode: XRayMode): void; selectTrace(id: number | null): void; ensure(project: CircuitProject): void;
};
const initial = { mode: "build" as Mode, playing: false, circuit: null, recipes: [], recipe: null, runtime: null, snapshot: null, xray: "power" as XRayMode, selectedTraceId: null, error: null, projectId: null, revision: null, key: null };
const refresh = (runtime: SimulationRuntime) => ({ snapshot: runtime.snapshot(), playing: !runtime.error, error: runtime.error ?? null });

export const useSimulationStore = create<State>((set, get) => ({
  ...initial,
  enter: (project, mode) => {
    const state = get();
    if (state.projectId === project.id && state.key === topologyKey(project) && state.revision === project.metadata.updatedAt && state.runtime) { set({ mode, playing: false }); return; }
    try {
      const circuit = compileCircuit(project);
      const compatible = analyzeSimulationCompatibility(project);
      const recipes = compatible.status === "supported" && !project.logic.length ? availableRecipes(circuit) : [];
      const recipe = project.schemaVersion === 4 && project.logic.length && compatible.status === "supported" ? compileLogic(project, circuit) : recipes.find(r => r.id !== "explore") ?? recipes[0] ?? null;
      const runtime = mode === "simulate" && recipe ? new SimulationRuntime(circuit, recipe) : null;
      set({ mode, playing: false, circuit, recipes, recipe, runtime, snapshot: runtime?.snapshot() ?? null, xray: mode === "explain" ? "power" : get().xray, selectedTraceId: null,
        error: mode === "simulate" && compatible.status === "unsupported" ? compatible.diagnostics[0] : null, projectId: project.id, revision: project.metadata.updatedAt, key: topologyKey(project) });
    } catch (error) { set({ ...initial, mode, error: error instanceof Error ? error.message : "Couldn’t open this circuit.", projectId: project.id, revision: project.metadata.updatedAt, key: topologyKey(project) }); }
  },
  build: () => set({ ...initial }),
  logic: () => set({ ...initial, mode: "logic" }),
  explain: () => set({ mode: "explain", playing: false }),
  selectRecipe: id => { const { circuit, recipes } = get(); const recipe = recipes.find(r => r.id === id); if (!circuit || !recipe) { set({ error: "This recipe is unavailable for this circuit." }); return; } const runtime = new SimulationRuntime(circuit, recipe); set({ recipe, runtime, snapshot: runtime.snapshot(), playing: false, selectedTraceId: null, error: runtime.error ?? null }); },
  play: () => { if (get().runtime && !get().error) set({ playing: true }); },
  pause: () => set({ playing: false }),
  reset: () => { const { circuit, recipe } = get(); if (!circuit || !recipe) return; const runtime = new SimulationRuntime(circuit, recipe); set({ runtime, snapshot: runtime.snapshot(), playing: false, selectedTraceId: null, error: runtime.error ?? null }); },
  advanceBy: ms => { const runtime = get().runtime; if (!runtime || !get().playing) return; const before = runtime.version, lastShown = get().snapshot?.timeMs ?? 0; runtime.advanceBy(ms); if (runtime.error || runtime.version !== before || runtime.timeMs - lastShown >= 100) set(refresh(runtime)); },
  button: (id, pressed) => { const runtime = get().runtime; if (!runtime) return; runtime.setButton(id, pressed); set({ ...refresh(runtime), playing: get().playing && !runtime.error }); },
  pir: id => { const runtime = get().runtime; if (!runtime) return; runtime.triggerPir(id); set({ ...refresh(runtime), playing: get().playing && !runtime.error }); },
  environment: (temperatureC, humidityPct, componentId) => { const runtime = get().runtime; if (!runtime) return; runtime.setEnvironment(temperatureC, humidityPct, componentId); set({ ...refresh(runtime), playing: get().playing && !runtime.error }); },
  setXray: xray => set({ xray }), selectTrace: selectedTraceId => set({ selectedTraceId }),
  ensure: project => { const state = get(); if (["simulate", "explain"].includes(state.mode) && (state.projectId !== project.id || state.revision !== project.metadata.updatedAt || state.key !== topologyKey(project))) set({ ...initial, error: "Circuit changed. Start a new simulation session." }); },
}));
