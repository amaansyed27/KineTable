import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { catalog, getDefinition } from "../component-library/catalog";
import { analyzeCircuit, type ProjectCommand } from "../hardware-core/commands";
import type { Transform } from "../projects/schema";
import type { KinetableProjectV2 } from "../projects/v2";
import { useProjectStore } from "../state/projectStore";
import type { CameraAction } from "../spatial/WorkbenchStage";

const WorkbenchStage = lazy(() => import("../spatial/WorkbenchStage"));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function Workbench({ document }: { document: KinetableProjectV2 }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tray, setTray] = useState<"add" | "replace" | null>(null);
  const [cameraAction, setCameraAction] = useState<CameraAction | null>(null);
  const [message, setMessage] = useState("");
  const sequence = useRef(0);
  const applyTransaction = useProjectStore(s => s.applyTransaction);
  const undo = useProjectStore(s => s.undo);
  const redo = useProjectStore(s => s.redo);
  const canUndo = useProjectStore(s => s.canUndo);
  const canRedo = useProjectStore(s => s.canRedo);
  const selected = document.components.find(c => c.id === selectedId);
  const diagnostics = analyzeCircuit(document);
  const partCount = document.components.length - 1;
  useEffect(() => { if (selectedId && !document.components.some(c => c.id === selectedId)) setSelectedId(null); }, [document, selectedId]);
  function camera(type: CameraAction["type"], entityId?: string) { setCameraAction({ sequence: ++sequence.current, type, entityId }); }
  async function commit(commands: ProjectCommand[] | ((current: KinetableProjectV2) => ProjectCommand[]), nextSelection?: string | null) {
    try {
      await applyTransaction(commands);
      setMessage("");
      if (nextSelection !== undefined) setSelectedId(nextSelection);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Couldn’t save this edit."); }
  }
  function move(id: string, next: Transform) { void commit([{ type: "layout.move", entityId: id, transform: next }]); }
  function rotate(step: -1 | 1) {
    if (!selected) return;
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
  function remove() { if (selected?.kind === "component") void commit([{ type: "component.remove", instanceId: selected.id }], null); }
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
      if (target.closest("input, textarea, select, [contenteditable='true']")) return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); void (event.shiftKey ? redo() : undo()); return; }
      if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); void redo(); return; }
      if (event.key === "Escape") { setSelectedId(null); setTray(null); return; }
      if (!selected) return;
      if (event.key.startsWith("Arrow")) { event.preventDefault(); nudge(event.key, event.shiftKey); }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); remove(); }
      if (event.key.toLowerCase() === "f" && !mod && !event.altKey) { event.preventDefault(); camera("focus", selected.id); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  return <section className="workbench" aria-label="Build workbench">
    <div className="workbench-modes" aria-label="Workbench modes"><span aria-current="page">Build</span><button disabled title="Simulation arrives in Slice 10">Simulate · later</button><button disabled title="Explanations arrive in Slice 11">Explain · later</button></div>
    <div className="workbench-surface">
      <Suspense fallback={<p className="scene-fallback">Opening your workbench…</p>}><WorkbenchStage project={document} selectedId={selectedId} onSelect={setSelectedId} onMove={move} cameraAction={cameraAction} /></Suspense>
      <div className="workbench-topline"><span>KINETABLE / WORKBENCH</span><span role="status">{partCount === 0 ? "Board ready" : diagnostics.length ? `Incomplete · ${diagnostics.length} ${diagnostics.length === 1 ? "issue" : "issues"}` : "Circuit ready"}</span></div>
      <div className="workbench-camera" aria-label="View controls"><button onClick={() => camera("zoom-in")} aria-label="Zoom in">+</button><button onClick={() => camera("zoom-out")} aria-label="Zoom out">−</button><button onClick={() => camera("reset")}>Reset view</button></div>
      <p className="workbench-gesture">Drag a part to move · drag empty space to orbit · right drag to pan · scroll or pinch to zoom</p>
      {selected && <div className="workbench-context" aria-label={`${getDefinition(selected.definitionId)?.name} controls`}>
        <strong>{getDefinition(selected.definitionId)?.name}</strong><span className="workbench-context-hint">Drag or use arrow keys to move</span>
        <div><button onClick={() => camera("focus", selected.id)}>Focus</button><button onClick={() => rotate(-1)} aria-label="Rotate left 15 degrees">↶ 15°</button><button onClick={() => rotate(1)} aria-label="Rotate right 15 degrees">↷ 15°</button>{selected.kind === "component" && <><button onClick={() => setTray("replace")}>Replace</button><button onClick={remove}>Remove</button></>}</div>
      </div>}
      {tray && <div className="workbench-tray" role="dialog" aria-label={tray === "add" ? "Add part" : "Replace part"}>
        <div className="workbench-tray-head"><strong>{tray === "add" ? "Add a part" : "Replace part"}</strong><button onClick={() => setTray(null)} aria-label="Close part tray">×</button></div>
        <p>Choose a virtual part from the component library.</p><div className="workbench-tray-items">{catalog.filter(d => d.kind === "component").map(definition => <button key={definition.id} onClick={() => choose(definition.id)}><span className="part-glyph" data-visual={definition.visualId} aria-hidden="true" />{definition.name}</button>)}</div>
      </div>}
    </div>
    <div className="workbench-actions"><button className="workbench-add" onClick={() => setTray("add")}>+ Add part</button><div><button disabled={!canUndo} onClick={() => void undo()} aria-label="Undo">↶ Undo</button><button disabled={!canRedo} onClick={() => void redo()} aria-label="Redo">↷ Redo</button></div></div>
    <div className="workbench-parts" aria-label="Parts on this table"><span>PARTS ON TABLE</span>{document.components.map(component => <button key={component.id} aria-pressed={selectedId === component.id} onClick={() => setSelectedId(component.id)}>{getDefinition(component.definitionId)?.name}</button>)}</div>
    {diagnostics.length > 0 && <p className="workbench-diagnostic" role="status">This build is safe to keep editing. It needs connections before it can be called a complete circuit.</p>}
    {message && <p className="workbench-error" role="alert">{message}</p>}
  </section>;
}
