import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AppShell } from "../app/AppShell";
import { useAuthStore } from "../auth/authStore";
import { catalog, getDefinition, type Definition } from "../component-library/catalog";
import { compatibility } from "../component-library/compatibility";
import { searchLibrary } from "../component-library/search";
import { inventoryRepository, type InventoryItem } from "../persistence/inventoryRepository";
import { useInventory } from "../persistence/useInventory";
import { setOwnedQuantity, syncInventory } from "../sync/inventorySync";
import { useProfileStore } from "../state/profileStore";
import "./parts.css";

const categories = ["all", "board", "input", "output", "sensor", "passive", "breadboard"];
export default function PartsPage() {
  const session = useAuthStore(s => s.session), resolved = useAuthStore(s => s.resolved);
  const profile = useProfileStore(s => s.profile);
  const {rows,loaded,error:storageError} = useInventory();
  const [view,setView] = useState<"mine"|"library">("mine");
  const [query,setQuery] = useState(""), [category,setCategory] = useState("all");
  const [boardId,setBoardId] = useState<string>(profile?.primaryBoardId ?? "esp32-dev-module");
  const [compatibleOnly,setCompatibleOnly] = useState(false), [simulatedOnly,setSimulatedOnly] = useState(false);
  const [selected,setSelected] = useState<Definition|null>(null), [busy,setBusy] = useState<string|null>(null), [error,setError] = useState<string|null>(null);
  const [guestItems,setGuestItems] = useState<InventoryItem[]>([]);
  const detail = useRef<HTMLDialogElement>(null);
  useEffect(() => { if(profile?.primaryBoardId) setBoardId(profile.primaryBoardId); },[profile?.primaryBoardId]);
  useEffect(() => { if(session) void inventoryRepository.list("guest").then(setGuestItems).catch(()=>setGuestItems([])); else setGuestItems([]); },[session]);
  const owned = new Map(rows.filter(row=>row.quantity>0).map(row=>[row.definitionId,row.quantity]));
  const guestCount = guestItems.filter(item => item.quantity > 0 && !owned.has(item.definitionId)).length;
  const found = searchLibrary({ query, category:category==="all"?undefined:category, boardId, compatibleOnly, simulatedOnly });
  const shown = view==="mine" ? found.filter(d=>owned.has(d.id)) : found;
  function inspect(d: Definition) { setSelected(d); requestAnimationFrame(()=>detail.current?.showModal()); }
  async function change(d: Definition, quantity: number) {
    setBusy(d.id);setError(null);
    try { await setOwnedQuantity(session,d.id,quantity); }
    catch { setError("Couldn’t save My Parts on this device. Try again."); }
    finally { setBusy(null); }
  }
  async function importGuest() {
    if (!session) return;
    setBusy("import");setError(null);
    try {
      const guest = await inventoryRepository.list("guest");
      const existing = new Set((await inventoryRepository.list(session.user.id)).filter(item=>item.quantity>0).map(item=>item.definitionId));
      for (const item of guest) if (item.quantity>0 && !existing.has(item.definitionId)) await inventoryRepository.setQuantity(session.user.id,item.definitionId,item.quantity);
      await syncInventory(session);
    } catch { setError("Local parts stayed on this device. Try importing again when connected."); }
    finally { setBusy(null); }
  }
  const selectedQuantity = selected ? owned.get(selected.id) ?? 0 : 0;
  const selectedCompatibility = selected ? compatibility(selected.id,boardId) : null;
  if (!resolved) return <AppShell title="Parts"><main id="app-main" className="route-loading" role="status">Opening My Parts…</main></AppShell>;
  return <AppShell title="Parts"><main id="app-main" className="parts-page">
    <header className="parts-intro"><div><h1>Parts</h1><p>Keep the hardware you own close. Explore Kinetable’s supported profiles.</p></div><div className="parts-intro-action"><Link to="/projects/new">Start a build <span aria-hidden="true">↗</span></Link></div></header>
    <div className="parts-tabs" role="tablist" aria-label="Parts view" onKeyDown={event=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(event.key)){event.preventDefault();const next=event.key==="Home"?"mine":event.key==="End"?"library":view==="mine"?"library":"mine";setView(next);event.currentTarget.querySelector<HTMLButtonElement>(`#parts-tab-${next}`)?.focus();}}}><button id="parts-tab-mine" role="tab" aria-controls="parts-panel" aria-selected={view==="mine"} tabIndex={view==="mine"?0:-1} onClick={()=>setView("mine")}>My Parts <span>{owned.size}</span></button><button id="parts-tab-library" role="tab" aria-controls="parts-panel" aria-selected={view==="library"} tabIndex={view==="library"?0:-1} onClick={()=>setView("library")}>Library <span>{catalog.length}</span></button></div>
    {session && guestCount>0 && <div className="parts-import"><p>You have local guest parts on this device. Importing copies only parts absent from this account; quantities already here stay as they are.</p><button disabled={!!busy} onClick={()=>void importGuest()}>Import local parts</button></div>}
    <div className="parts-filters"><label className="parts-search">Search parts<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="LED, motion sensor, I²C…" /></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c} value={c}>{c==="all"?"All categories":c[0].toUpperCase()+c.slice(1)}</option>)}</select></label><label>Board<select value={boardId} onChange={e=>setBoardId(e.target.value)}>{catalog.filter(d=>d.kind==="board").map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div>
    <div className="parts-filter-toggles"><label><input type="checkbox" checked={compatibleOnly} onChange={e=>setCompatibleOnly(e.target.checked)} /> Compatible with board</label><label><input type="checkbox" checked={simulatedOnly} onChange={e=>setSimulatedOnly(e.target.checked)} /> Simulation modeled</label></div>
    {(error || storageError) && <p className="parts-error" role="alert">{error || storageError}</p>}
    {!loaded ? <p role="status">Opening parts…</p> : <section id="parts-panel" role="tabpanel" aria-labelledby={`parts-tab-${view}`}><p className="parts-result" role="status">{shown.length} {shown.length===1?"part":"parts"} {view==="mine"?"on your shelf":"in the library"}</p><div className="parts-list" role="list">{shown.map(d=>{const qty=owned.get(d.id)??0;const fit=compatibility(d.id,boardId);return <article className="parts-row" role="listitem" key={d.id}><button className="parts-object" onClick={()=>inspect(d)} aria-label={`Inspect ${d.name}`}><span className="part-glyph" data-visual={d.visualId} aria-hidden="true" /></button><div className="parts-row-copy"><button onClick={()=>inspect(d)}>{d.name}</button><p>{d.description}</p><small>{d.category} · {fit.status==="adapter"?"Needs level shifting":fit.status==="supported"?`Works with ${getDefinition(boardId)?.name}`:"Not modeled for this board"} · {d.simulation==="not-modeled"?"Not simulated":"Simulation modeled"}</small></div><div className="parts-row-actions">{qty>0 ? <><span className="parts-owned">My Parts</span><div className="parts-quantity" aria-label={`${d.name} quantity`}><button disabled={!!busy} aria-label={`Remove one ${d.name}`} onClick={()=>void change(d,qty-1)}>−</button><output aria-label={`${qty} owned`}>{qty}</output><button disabled={!!busy || qty>=999} aria-label={`Add one ${d.name}`} onClick={()=>void change(d,qty+1)}>+</button></div><button className="parts-remove" disabled={!!busy} onClick={()=>void change(d,0)}>Remove</button></> : <button className="parts-add" disabled={!!busy} onClick={()=>void change(d,1)}>Add to My Parts</button>}</div></article>;})}</div>{!shown.length && <div className="parts-empty"><h2>{view==="mine" && !query && category==="all" ? "Your shelf is waiting." : "No parts found."}</h2><p>{view==="mine" && !query && category==="all" ? "Browse the Library and add the hardware you have. Virtual builds stay free to use any supported part." : "Try a different search or filter."}</p>{view==="mine" && <button onClick={()=>{setView("library");setQuery("");setCategory("all");}}>Browse Library →</button>}</div>}</section>}
    <dialog ref={detail} className="parts-detail" aria-labelledby="part-detail-title" onClose={()=>setSelected(null)}>{selected && <><div className="parts-detail-top"><span className="part-glyph" data-visual={selected.visualId} aria-hidden="true" /><button onClick={()=>detail.current?.close()} aria-label="Close part details">×</button></div><h2 id="part-detail-title">{selected.name}</h2><p>{selected.description}</p><p className="parts-detail-fit">{selectedCompatibility?.status==="supported"?"Supported":selectedCompatibility?.status==="adapter"?"Requires level shifting":"Not supported"} with {getDefinition(boardId)?.name}: {selectedCompatibility?.reason}</p><div className="parts-detail-action"><strong>{selectedQuantity?`${selectedQuantity} in My Parts`:"Not in My Parts"}</strong>{selectedQuantity?<button disabled={!!busy || selectedQuantity>=999} onClick={()=>void change(selected,selectedQuantity+1)}>Add one</button>:<button disabled={!!busy} onClick={()=>void change(selected,1)}>Add to My Parts</button>}</div><details><summary>Electrical & simulation</summary><dl><dt>Supported variant</dt><dd>{selected.supportedVariant}</dd><dt>Supply</dt><dd>{selected.supply?`${selected.supply} V`:"Passive or board powered"}</dd><dt>Pins</dt><dd>{selected.pins.length?selected.pins.map(p=>`${p.id} (${p.role})`).join(" · "):"No modeled pins"}</dd><dt>Simulation</dt><dd>{selected.simulation==="not-modeled"?"Not simulated":selected.simulation==="topology-dependent"?"Simulated in supported circuits":"Supported"}</dd></dl></details><details><summary>Profile & sources</summary><p>{selected.verification==="verified"?"Manufacturer profile":selected.verification==="profiled"?"Kinetable supported profile":"Limited model"}. {selected.limitations}</p>{selected.sources.length?<ul>{selected.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title} ↗</a><small>{s.publisher} · accessed {s.accessed}</small></li>)}</ul>:<p>Generic part: Kinetable-defined assumptions; no manufacturer claim.</p>}<p>Visual: {selected.asset.kind} model · {selected.asset.license}</p></details></>}</dialog>
  </main></AppShell>;
}
