import { useEffect, useRef } from "react";
import { useSimulationStore } from "../state/simulationStore";
import { causalChain, describeTrace, latestForComponent, xrayNets, type XRayMode } from "../simulation/explain";
import type { Snapshot } from "../simulation/runtime";

function outputLabel(output: Snapshot["outputs"][string] | undefined): string {
  if (output?.text !== undefined) return output.text || "Blank";
  if (output?.on === true) return "ON";
  if (output?.on === false) return "OFF";
  return "Not driven";
}

export function SimulationPanel({ selectedId }: { selectedId: string | null }) {
  const mode = useSimulationStore(s => s.mode), playing = useSimulationStore(s => s.playing);
  const circuit = useSimulationStore(s => s.circuit), recipes = useSimulationStore(s => s.recipes), recipe = useSimulationStore(s => s.recipe);
  const snapshot = useSimulationStore(s => s.snapshot), error = useSimulationStore(s => s.error), xray = useSimulationStore(s => s.xray), selectedTraceId = useSimulationStore(s => s.selectedTraceId);
  const actions = useSimulationStore.getState();
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) { last.current = null; return; }
    let frame = 0;
    const tick = (now: number) => { if (last.current !== null) useSimulationStore.getState().advanceBy(now - last.current); last.current = now; frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); last.current = null; };
  }, [playing]);
  if (mode === "build" || mode === "logic") return null;
  const latest = selectedId && snapshot ? latestForComponent(snapshot, selectedId) : undefined;
  const selected = snapshot?.trace.find(event => event.id === selectedTraceId) ?? (selectedId ? latest : snapshot?.trace.at(-1));
  const chain = selected && snapshot && circuit ? causalChain(snapshot.trace, selected.id) : [];
  const nets = circuit ? xrayNets(circuit, snapshot, xray) : [];
  const buttons = recipe?.id === "project-logic" ? recipe.inputs.buttons : recipe?.button ? [recipe.button] : [];
  const pirs = recipe?.id === "project-logic" ? recipe.inputs.pirs : recipe?.pir ? [recipe.pir] : [];
  const dhts = recipe?.id === "project-logic" ? recipe.inputs.dhts : recipe?.dht ? [recipe.dht] : [];
  return <section className="simulation-panel" aria-label={mode === "simulate" ? "Simulation controls" : "Explain circuit"}>
    <div className="simulation-panel-top"><div><span className="simulation-kicker">{mode === "simulate" ? "LIVING CIRCUIT" : "EXPLAIN / X-RAY"}</span><h2>{mode === "simulate" ? "See the circuit respond." : "Follow the hardware."}</h2></div>{snapshot && <span className="simulation-clock" role="status">{playing ? "Playing" : "Paused"} · {Math.round(snapshot.timeMs)} ms</span>}</div>
    {error && <p role="alert" className="simulation-error">{error}</p>}
    {mode === "simulate" && circuit && <>
      <div className="simulation-row">{recipe?.id === "project-logic" ? <strong>Project Logic · saved behavior</strong> : <label>Try this circuit<select aria-label="Simulation recipe" value={recipe?.id ?? ""} onChange={e => actions.selectRecipe(e.target.value)}>{recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}<div className="simulation-buttons"><button disabled={!recipe || !!error || playing} onClick={() => actions.play()}>Play</button><button disabled={!playing} onClick={() => actions.pause()}>Pause</button><button disabled={!recipe} onClick={() => actions.reset()}>Reset</button></div></div>
      {recipe && <p className="simulation-hint">{recipe.description}</p>}
      {buttons.map(button => <div key={button.id} className="simulation-row"><span>Push button {buttons.length > 1 ? button.id : ""}</span><button aria-pressed={!!snapshot?.outputs[button.id]?.pressed} onClick={() => actions.button(button.id, !snapshot?.outputs[button.id]?.pressed)}>{snapshot?.outputs[button.id]?.pressed ? "Release button" : "Press button"}</button></div>)}
      {pirs.map(pir => <div key={pir.id} className="simulation-row"><span>Motion sensor {pirs.length > 1 ? pir.id : ""}</span><button onClick={() => actions.pir(pir.id)}>Trigger motion</button></div>)}
      {dhts.map(dht => <div key={dht.id} className="simulation-row simulation-environment"><span>Virtual environment {dhts.length > 1 ? dht.id : ""}</span><label>Temperature °C<input type="range" min="0" max="50" value={snapshot?.outputs[dht.id]?.temperatureC ?? 24} onChange={e => actions.environment(Number(e.target.value), snapshot?.outputs[dht.id]?.humidityPct ?? 50, dht.id)} /><output>{snapshot?.outputs[dht.id]?.temperatureC ?? 24} °C</output></label><label>Humidity %<input type="range" min="20" max="90" value={snapshot?.outputs[dht.id]?.humidityPct ?? 50} onChange={e => actions.environment(snapshot?.outputs[dht.id]?.temperatureC ?? 24, Number(e.target.value), dht.id)} /><output>{snapshot?.outputs[dht.id]?.humidityPct ?? 50}%</output></label></div>)}
      {snapshot && <div className="simulation-outputs" aria-live="polite">{circuit.bindings.filter(b => ["led-passive", "buzzer", "ssd1306-i2c"].includes(b.definition.electricalModel)).map(b => {
        const event = latestForComponent(snapshot, b.id);
        return <span key={b.id}>{b.definition.name}: <strong>{outputLabel(snapshot.outputs[b.id])}</strong> <button disabled={!event} title={event ? undefined : "No runtime event to explain yet."} onClick={() => { if (!event) return; actions.selectTrace(event.id); actions.explain(); }}>Why?</button></span>;
      })}</div>}
    </>}
    {mode === "explain" && <>
      <div className="simulation-xray" aria-label="X-Ray modes">{(["power","signals","data","all"] as XRayMode[]).map(m => <button key={m} aria-pressed={xray === m} onClick={() => actions.setXray(m)}>{m[0].toUpperCase() + m.slice(1)}</button>)}</div>
      <p className="simulation-hint">{selectedId ? `Selected ${circuit?.bindings.find(b => b.id === selectedId)?.definition.name ?? "hardware"}.` : "Select a part, pin, wire or breadboard hole to inspect its path."} {xray === "data" ? "Data links are semantic; no protocol waveform is modeled." : xray === "power" ? "Supply and ground connectivity; current is not calculated." : "Signals describe this simulation, not real firmware."}</p>
      {nets.length > 0 ? <ul className="simulation-net-list">{nets.filter(n => n.wires.length || n.endpoints.some(e => e.startsWith("pin:"))).slice(0, 12).map(n => <li key={n.id}>{n.label} · {n.endpoints.filter(e => e.startsWith("pin:")).map(e => e.split(":").slice(1).join(" ")).join(" → ") || "breadboard strip"}</li>)}</ul> : <p>No supported paths in this view.</p>}
      <div className="simulation-trace"><h3>{selected ? "What caused this?" : "No runtime event yet"}</h3>{chain.length ? <ol>{chain.map(event => <li key={event.id}><button aria-current={selected?.id === event.id ? "step" : undefined} onClick={() => actions.selectTrace(event.id)}><span>{Math.round(event.timeMs)} ms</span> {describeTrace(event, circuit!)}</button></li>)}</ol> : <p>{snapshot ? "Interact with the circuit in Simulate to record a causal path." : "Power and connection paths are available before simulation."}</p>}</div>
    </>}
  </section>;
}
