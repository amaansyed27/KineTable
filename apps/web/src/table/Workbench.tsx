import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { catalog, getDefinition } from "../component-library/catalog";
import { analyzeCircuit, type ProjectCommand } from "../hardware-core/commands";
import { holes } from "../hardware-core/breadboard";
import { netFor, resolveNets } from "../hardware-core/nets";
import type { Transform } from "../projects/schema";
import { endpointKey, holeEndpoint, pinEndpoint, type ElectricalEndpoint, type KinetableProjectV3 } from "../projects/v3";
import { useProjectStore } from "../state/projectStore";
import type { CameraAction } from "../spatial/WorkbenchStage";
import { endpointLabel, inspectComponent, inspectHole, inspectWire } from "./inspector";
import { SimulationPanel } from "./SimulationPanel";
import { useSimulationStore } from "../state/simulationStore";

const WorkbenchStage = lazy(() => import("../spatial/WorkbenchStage"));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function Workbench({ document }: { document: KinetableProjectV3 }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ElectricalEndpoint | null>(null);
  const [wireSource, setWireSource] = useState<ElectricalEndpoint | null>(null);
  const [wiring, setWiring] = useState(false);
  const [placingLead, setPlacingLead] = useState<{ componentId: string; pinId: string } | null>(null);
  const [sourceKey, setSourceKey] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [tray, setTray] = useState<"add" | "replace" | null>(null);
  const [cameraAction, setCameraAction] = useState<CameraAction | null>(null);
  const [message, setMessage] = useState("");
  const sequence = useRef(0);
  const applyTransaction = useProjectStore(s => s.applyTransaction);
  const undo = useProjectStore(s => s.undo);
  const redo = useProjectStore(s => s.redo);
  const canUndo = useProjectStore(s => s.canUndo);
  const canRedo = useProjectStore(s => s.canRedo);
  const mode = useSimulationStore(s => s.mode);
  useEffect(() => { useSimulationStore.getState().ensure(document); }, [document]);
  const selected = document.components.find(c => c.id === selectedId);
  const diagnostics = useMemo(() => analyzeCircuit(document), [document]);
  const partCount = document.components.filter(c => c.kind === "component").length;
  const nets = useMemo(() => resolveNets(document), [document]);
  const selectedWire = document.wires.find(w => w.id === selectedWireId);
  const selectedInfo = selected ? inspectComponent(document, selected.id) : null;
  const wireInfo = selectedWire ? inspectWire(document, selectedWire.id) : null;
  const holeInfo = selectedEndpoint?.kind === "breadboard-hole" ? inspectHole(document, selectedEndpoint.breadboardId, selectedEndpoint.holeId) : null;
  const highlightedKeys = (selectedEndpoint ? netFor(nets, selectedEndpoint) : selectedWire ? netFor(nets, selectedWire.from) : undefined)?.endpoints.map(endpointKey) ?? [];
  const endpoints: ElectricalEndpoint[] = document.components.flatMap((c): ElectricalEndpoint[] => c.kind === "breadboard" ? holes.map(h => holeEndpoint(c.id, h.id)) : getDefinition(c.definitionId)!.pins.map(p => pinEndpoint(c.id, p.id)));
  const endpointMap = new Map(endpoints.map(e => [endpointKey(e), e]));
  const activeWireSource = wireSource && endpointMap.has(endpointKey(wireSource)) ? wireSource : null;
  useEffect(() => { if (selectedId && !document.components.some(c => c.id === selectedId)) setSelectedId(null); }, [document, selectedId]);
  useEffect(() => { if (wireSource && !activeWireSource) setWireSource(null); }, [wireSource, activeWireSource]);
  function selectComponent(id: string | null) { setSelectedId(id); setSelectedWireId(null); setSelectedEndpoint(null); }
  function selectWire(id: string) { setSelectedWireId(id); setSelectedId(null); setSelectedEndpoint(null); setWireSource(null); }
  function camera(type: CameraAction["type"], entityId?: string) { setCameraAction({ sequence: ++sequence.current, type, entityId }); }
  async function commit(commands: ProjectCommand[] | ((current: KinetableProjectV3) => ProjectCommand[]), nextSelection?: string | null): Promise<boolean> {
    try {
      await applyTransaction(commands);
      setMessage("");
      if (nextSelection !== undefined) { setSelectedId(nextSelection); setSelectedEndpoint(null); setSelectedWireId(null); }
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Couldn’t save this edit."); return false; }
  }
  async function selectTarget(endpoint: ElectricalEndpoint) {
    if (placingLead) {
      if (endpoint.kind !== "breadboard-hole") { setMessage("Choose a breadboard hole for this lead."); return; }
      if (await commit([{ type: "terminal.place", placement: { ...placingLead, breadboardId: endpoint.breadboardId, holeId: endpoint.holeId } }])) { setPlacingLead(null); setSelectedId(null); setSelectedEndpoint(endpoint); }
      return;
    }
    setSelectedEndpoint(endpoint); setSelectedId(null); setSelectedWireId(null);
    if (!wiring) return;
    if (!activeWireSource) { setWireSource(endpoint); setMessage("Choose the other pin or hole."); return; }
    if (endpointKey(activeWireSource) === endpointKey(endpoint)) { setWireSource(null); setMessage(""); return; }
    if (await commit([{ type: "wire.add", id: `wire-${crypto.randomUUID()}`, from: activeWireSource, to: endpoint }])) { setWireSource(null); setMessage(""); }
  }
  function move(id: string, next: Transform) { if (mode === "build") void commit([{ type: "layout.move", entityId: id, transform: next }]); }
  function rotate(step: -1 | 1) {
    if (!selected || selected.kind === "breadboard") return;
    const id = selected.id;
    void commit(current => {
      const from = current.layout.entities[id];
      return from ? [{ type: "layout.move", entityId: id, transform: { ...from, rotation: [from.rotation[0], from.rotation[1], from.rotation[2] + step * Math.PI / 12] } }] : [];
    });
  }
  function nudge(key: string, large: boolean) {
    if (!selected) return;
    const id = selected.id;
    const amount = large ? .5 : .1;
    void commit(current => {
      const from = current.layout.entities[id];
      if (!from) return [];
      const x = clamp(from.position[0] + (key === "ArrowRight" ? amount : key === "ArrowLeft" ? -amount : 0), -4.5, 4.5);
      const y = clamp(from.position[1] + (key === "ArrowUp" ? amount : key === "ArrowDown" ? -amount : 0), -2.8, 2.8);
      return x === from.position[0] && y === from.position[1] ? [] : [{ type: "layout.move", entityId: id, transform: { ...from, position: [x, y, from.position[2]] } }];
    });
  }
  function remove() {
    if (selectedWire) { void commit([{ type: "wire.remove", id: selectedWire.id }]); setSelectedWireId(null); }
    else if (selected?.kind === "component") void commit([{ type: "component.remove", instanceId: selected.id }], null);
    else if (selected?.kind === "breadboard") void commit([{ type: "breadboard.remove", id: selected.id }], null);
  }
  function choose(definitionId: string) {
    const id = `part-${crypto.randomUUID()}`;
    const command: ProjectCommand = tray === "replace" && selected?.kind === "component"
      ? { type: "component.replace", instanceId: selected.id, replacementId: id, definitionId }
      : { type: "component.add", instanceId: id, definitionId };
    setTray(null);
    void commit([command], id);
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (mode !== "build") return;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); void (event.shiftKey ? redo() : undo()); return; }
      if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); void redo(); return; }
      if (event.key === "Escape") { setSelectedId(null); setSelectedWireId(null); setSelectedEndpoint(null); setWireSource(null); setPlacingLead(null); setTray(null); return; }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedWire) { event.preventDefault(); remove(); return; }
      if (!selected) return;
      if (event.key.startsWith("Arrow")) { event.preventDefault(); nudge(event.key, event.shiftKey); }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); remove(); }
      if (event.key.toLowerCase() === "f" && !mod && !event.altKey) { event.preventDefault(); camera("focus", selected.id); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  return <section className="workbench" aria-label="Circuit workbench">
    <div className="workbench-modes" aria-label="Workbench modes"><button aria-current={mode === "build" ? "page" : undefined} onClick={() => useSimulationStore.getState().build()}>Build</button><button aria-current={mode === "simulate" ? "page" : undefined} onClick={() => useSimulationStore.getState().enter(document, "simulate")}>Simulate</button><button aria-current={mode === "explain" ? "page" : undefined} onClick={() => mode === "simulate" ? useSimulationStore.getState().explain() : useSimulationStore.getState().enter(document, "explain")}>Explain</button></div>
    <div className="workbench-surface">
      <Suspense fallback={<p className="scene-fallback">Opening your workbench…</p>}><WorkbenchStage project={document} selectedId={selectedId} selectedWireId={selectedWireId} selectedEndpointKey={selectedEndpoint ? endpointKey(selectedEndpoint) : null} highlightedKeys={highlightedKeys} wireSource={mode === "build" ? activeWireSource : null} wiring={mode === "build" && wiring} onSelect={selectComponent} onEndpoint={endpoint => mode === "build" ? void selectTarget(endpoint) : (setSelectedEndpoint(endpoint), setSelectedId(null))} onWire={selectWire} onMove={move} cameraAction={cameraAction} /></Suspense>
      <div className="workbench-topline"><span>KINETABLE / WORKBENCH</span><span role="status">{partCount === 0 ? "Board ready" : diagnostics.length ? `Incomplete · ${diagnostics.length} ${diagnostics.length === 1 ? "issue" : "issues"}` : "Circuit ready"}</span></div>
      <div className="workbench-camera" aria-label="View controls"><button onClick={() => camera("zoom-in")} aria-label="Zoom in">+</button><button onClick={() => camera("zoom-out")} aria-label="Zoom out">−</button><button onClick={() => camera("reset")}>Reset view</button></div>
      <p className="workbench-gesture">{mode !== "build" ? "Select hardware to inspect · drag to orbit · scroll or pinch to zoom" : placingLead ? "Tap a breadboard hole to insert this lead" : wiring ? wireSource ? "Choose the other endpoint" : "Tap a pin or hole to start a wire" : "Drag a part to move · drag empty space to orbit · right drag to pan · scroll or pinch to zoom"}</p>
      {selectedInfo && <aside className="workbench-inspector" aria-label={`${selectedInfo.name} inspector`}>
        <button className="inspector-close" onClick={() => selectComponent(null)} aria-label="Close inspector">×</button>
        <span className="inspector-kicker">{selectedInfo.category.toUpperCase()}</span><h2>{selectedInfo.name}</h2><p>{selectedInfo.description}</p>
        {selectedInfo.explanation && <p>{selectedInfo.explanation}</p>}
        {selectedInfo.pins.length > 0 && <><h3>Connections</h3><ul>{selectedInfo.pins.map(pin => <li key={pin.id}><button onClick={() => mode === "build" ? void selectTarget(pinEndpoint(selected!.id,pin.id)) : setSelectedEndpoint(pinEndpoint(selected!.id,pin.id))}>{pin.id.toUpperCase()}</button><span>{pin.connections.join(", ") || "Open"}</span>{mode === "build" && selected!.kind === "component" && ["led-passive","resistor","momentary-switch"].includes(selectedInfo.model) && <button onClick={() => { setPlacingLead({ componentId: selected!.id, pinId: pin.id }); setWiring(false); setWireSource(null); setMessage("Choose a breadboard hole."); }}>Insert lead</button>}{mode === "build" && document.terminalPlacements.some(p => p.componentId === selected!.id && p.pinId === pin.id) && <button onClick={() => void commit([{ type: "terminal.unplace", componentId: selected!.id, pinId: pin.id }])}>Lift lead</button>}</li>)}</ul></>}
        <details><summary>Technical details</summary><p>Model: {selected!.definitionId}<br />Electrical role: {selectedInfo.model}{selectedInfo.supply ? <><br />Supply: {selectedInfo.supply} V</> : null}</p></details>
        <div className="inspector-actions"><button onClick={() => camera("focus", selected!.id)}>Focus</button>{mode === "build" && selected!.kind !== "breadboard" && <><button onClick={() => rotate(-1)} aria-label="Rotate left 15 degrees">↶ 15°</button><button onClick={() => rotate(1)} aria-label="Rotate right 15 degrees">↷ 15°</button></>}{mode === "build" && selected!.kind === "component" && <button onClick={() => setTray("replace")}>Replace</button>}{mode === "build" && selected!.kind !== "board" && <button onClick={remove}>Remove</button>}{mode === "explain" && <button onClick={() => { const state = useSimulationStore.getState(); const event = state.snapshot?.trace.slice().reverse().find(e => e.componentId === selected!.id); state.selectTrace(event?.id ?? null); }}>Why?</button>}</div>
      </aside>}
      {wireInfo && <aside className="workbench-inspector" aria-label="Wire inspector"><button className="inspector-close" onClick={() => setSelectedWireId(null)} aria-label="Close inspector">×</button><span className="inspector-kicker">WIRE</span><h2>Connection</h2><p>{wireInfo.from}<br />↓<br />{wireInfo.to}</p><h3>On this net</h3><p>{wireInfo.netPins.join(" · ") || "No component pins"}</p>{mode === "build" && <div className="inspector-actions"><button onClick={remove}>Remove wire</button></div>}</aside>}
      {holeInfo && <aside className="workbench-inspector" aria-label="Breadboard hole inspector"><button className="inspector-close" onClick={() => setSelectedEndpoint(null)} aria-label="Close inspector">×</button><span className="inspector-kicker">BREADBOARD</span><h2>Hole {holeInfo.holeId}</h2><p>{holeInfo.connectedHoles.join(" · ")} share one internal strip.</p><h3>Connected pins</h3><p>{holeInfo.connectedPins.join(" · ") || "No component pins yet"}</p></aside>}
      {selectedEndpoint?.kind === "pin" && <aside className="workbench-inspector" aria-label="Pin inspector"><button className="inspector-close" onClick={() => setSelectedEndpoint(null)} aria-label="Close inspector">×</button><span className="inspector-kicker">PIN</span><h2>{endpointLabel(document, selectedEndpoint)}</h2><p>{(netFor(nets, selectedEndpoint)?.endpoints ?? []).filter(e => endpointKey(e) !== endpointKey(selectedEndpoint) && e.kind === "pin").map(e => endpointLabel(document,e)).join(" · ") || "No connected component pins yet"}</p></aside>}
      {mode === "build" && tray && <div className="workbench-tray" role="dialog" aria-label={tray === "add" ? "Add part" : "Replace part"}>
        <div className="workbench-tray-head"><strong>{tray === "add" ? "Add a part" : "Replace part"}</strong><button onClick={() => setTray(null)} aria-label="Close part tray">×</button></div>
        <p>Choose a virtual part from the component library.</p><div className="workbench-tray-items">{catalog.filter(d => d.kind === "component").map(definition => <button key={definition.id} onClick={() => choose(definition.id)}><span className="part-glyph" data-visual={definition.visualId} aria-hidden="true" />{definition.name}</button>)}</div>
      </div>}
    </div>
    <SimulationPanel selectedId={selectedId} />
    {mode === "build" && <div className="workbench-actions"><div><button className="workbench-add" onClick={() => setTray("add")}>+ Add part</button>{!document.components.some(c => c.kind === "breadboard") && <button onClick={() => void commit([{ type: "breadboard.add", id: "breadboard-1" }])}>+ Breadboard</button>}<button aria-pressed={wiring} onClick={() => { setWiring(value => !value); setWireSource(null); setPlacingLead(null); }}>Wire</button></div><div><button disabled={!canUndo} onClick={() => void undo()} aria-label="Undo">↶ Undo</button><button disabled={!canRedo} onClick={() => void redo()} aria-label="Redo">↷ Redo</button></div></div>}
    <div className="workbench-parts" aria-label="Parts on this table"><span>PARTS ON TABLE</span>{document.components.map(component => <button key={component.id} aria-pressed={selectedId === component.id} onClick={() => selectComponent(component.id)}>{getDefinition(component.definitionId)?.name}</button>)}</div>
    <div className="workbench-parts" aria-label="Wires on this table"><span>WIRES</span>{document.wires.map((wire, index) => <button key={wire.id} aria-pressed={selectedWireId === wire.id} onClick={() => selectWire(wire.id)}>{index + 1}. {endpointLabel(document, wire.from)} → {endpointLabel(document, wire.to)}</button>)}</div>
    {mode === "build" && <details className="workbench-connection-controls"><summary>Accessible connection controls</summary><div><label>From<select aria-label="From" value={sourceKey} onChange={event => setSourceKey(event.target.value)}><option value="">Choose endpoint</option>{endpoints.map(e => <option key={endpointKey(e)} value={endpointKey(e)}>{endpointLabel(document,e)}</option>)}</select></label><label>To<select aria-label="To" value={targetKey} onChange={event => setTargetKey(event.target.value)}><option value="">Choose endpoint</option>{endpoints.map(e => <option key={endpointKey(e)} value={endpointKey(e)}>{endpointLabel(document,e)}</option>)}</select></label><button disabled={!sourceKey || !targetKey} onClick={() => { const from = endpointMap.get(sourceKey), to = endpointMap.get(targetKey); if (from && to) void commit([{ type: "wire.add", id: `wire-${crypto.randomUUID()}`, from, to }]); }}>Create wire</button><button disabled={!sourceKey} onClick={() => { const endpoint = endpointMap.get(sourceKey); if (endpoint) void selectTarget(endpoint); }}>Inspect from</button>{placingLead && <button disabled={!targetKey || endpointMap.get(targetKey)?.kind !== "breadboard-hole"} onClick={() => { const endpoint = endpointMap.get(targetKey); if (endpoint) void selectTarget(endpoint); }}>Place lead in destination hole</button>}</div></details>}
    {diagnostics.length > 0 && <p className="workbench-diagnostic" role="status">This build is safe to keep editing. It needs connections before it can be called a complete circuit.</p>}
    {message && <p className="workbench-error" role="alert">{message}</p>}
  </section>;
}
