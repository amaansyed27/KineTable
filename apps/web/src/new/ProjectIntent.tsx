import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { boards, getBoard, type BoardId } from "../hardware/boards";
import { useInventory } from "../persistence/useInventory";
import { inventoryOwner } from "../persistence/inventoryRepository";
import { useProfileStore } from "../state/profileStore";
import { useAuthStore } from "../auth/authStore";
import { useProjectStore } from "../state/projectStore";
import { MAX_INTENT_LENGTH, titleFromIntent, validateBuildInput } from "../projects/schema";
import { assemblyError } from "../ai/assembleProject";
import { loadProviderSettings } from "../ai/providerSettings";
import { proposeBuild, proposalParts, type BuildProposal } from "./intentPlanning";
import "./projectIntent.css";

const draftKey = "kinetable.project-intent";
function savedIntent() {
  try { const value: unknown = JSON.parse(sessionStorage.getItem(draftKey) ?? "null"); return typeof value === "string" && value.length <= MAX_INTENT_LENGTH ? value : ""; } catch { return ""; }
}
export function ProjectIntent({ explicit = false }: { explicit?: boolean }) {
  const navigate = useNavigate();
  const primary = useProfileStore(s => s.profile?.primaryBoardId);
  const owner = useAuthStore(s => inventoryOwner(s.session?.user.id));
  const inventory = useInventory();
  const [idea, setIdea] = useState(savedIntent), [name, setName] = useState(() => titleFromIntent(savedIntent()));
  const [edited, setEdited] = useState(false), [selected, setSelected] = useState<BoardId | null>(null);
  const board = getBoard(selected ?? primary);
  const [useParts, setUseParts] = useState(true), [proposal, setProposal] = useState<BuildProposal | null>(null);
  const [phase, setPhase] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const flight = useRef(false), alive = useRef(true), completed = useRef(false), heading = useRef<HTMLHeadingElement>(null), input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setProposal(null); }, [owner, primary]);
  useEffect(() => { if (proposal) heading.current?.focus(); }, [proposal]);
  const parts = proposal?.status === "supported" ? proposalParts(proposal, inventory.rows) : [];
  const total = parts.reduce((count, part) => count + part.need, 0), missing = parts.reduce((count, part) => count + part.missing, 0);
  const hasProvider = loadProviderSettings().profile.routes.some(route => route.enabled);
  const hasInventory = inventory.rows.some(row => row.quantity > 0);
  function change(value: string) {
    setIdea(value); if (!edited) setName(titleFromIntent(value)); setError(null); setProposal(null); completed.current = false;
    try { sessionStorage.setItem(draftKey, JSON.stringify(value)); } catch { /* Optional draft. */ }
  }
  async function plan(event: FormEvent) {
    event.preventDefault();
    if (flight.current || !board || !inventory.loaded) return;
    flight.current = true; setError(null); setPhase("Checking your idea…");
    const submittedOwner = owner;
    try {
      validateBuildInput(idea, name);
      const next = await proposeBuild(board.id, idea, name, inventory.rows, useParts,
        value => { if (alive.current) setPhase(value === "planning" ? "Planning your build…" : "Checking connections…"); });
      if (alive.current && inventoryOwner(useAuthStore.getState().session?.user.id) === submittedOwner) setProposal(next);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error && /^(Describe|Give this build)/.test(cause.message) ? cause.message : assemblyError(cause));
    } finally { flight.current = false; if (alive.current) setPhase(null); }
  }
  async function create(blank = false) {
    if (flight.current || completed.current || !board || !blank && proposal?.status !== "supported") return;
    flight.current = true; setError(null); setPhase("Preparing your table…");
    try {
      let document;
      if (blank) {
        if (idea.trim()) validateBuildInput(idea, name);
        const store = useProjectStore.getState();
        await store.open(board.id, useAuthStore.getState().session);
        document = await store.createBuild(board.id, idea, idea.trim() ? name : "Untitled project");
      } else document = await useProjectStore.getState().createFromProposal(proposal!.base, proposal!.commands, owner);
      completed.current = true;
      try { sessionStorage.removeItem(draftKey); } catch { /* Optional draft. */ }
      if (alive.current) navigate(`/projects/${document.id}`);
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error && /^(Describe|Give this build)/.test(cause.message) ? cause.message : "We couldn’t save your build. Allow browser storage and try again.");
    } finally { flight.current = false; if (alive.current) setPhase(null); }
  }
  function back() { setProposal(null); setError(null); requestAnimationFrame(() => input.current?.focus()); }
  return <section className="project-intent" aria-label="Create a project" aria-busy={!!phase}>
    {proposal ? <div className="intent-proposal">
      <h2 tabIndex={-1} ref={heading}>{proposal.status === "supported" ? proposal.base.name : "Not supported yet"}</h2>
      <p>{proposal.summary}</p>
      {proposal.status === "supported" ? <>
        <ul className="intent-parts">{parts.map(part => <li key={part.id}><span>{part.name}</span>{part.need > 1 && <span>× {part.need}</span>}</li>)}</ul>
        {useParts && inventory.loaded && !inventory.error && <div className="intent-inventory"><p>{missing === 0 ? "You already have everything." : `You have ${total - missing} of ${total} parts.`}</p>{missing > 0 && <p>Missing: {parts.filter(part => part.missing).map(part => `${part.name}${part.missing > 1 ? ` × ${part.missing}` : ""}`).join(", ")}</p>}</div>}
        <p className="intent-note">{proposal.source === "starter" ? "Canonical BONK · ready to simulate" : "Validated hardware · explore behavior in the Workbench"}</p>
        <div className="intent-actions"><button className="button" disabled={!!phase} onClick={() => void create()}>{useParts && missing > 0 ? "Build virtually anyway" : "Build it"}</button><button className="text-action" disabled={!!phase} onClick={back}>Back to edit</button></div>
      </> : <><p>{proposal.reason}</p><p className="intent-note">Try a button and LED, motion alarm, or temperature display.</p><button disabled={!!phase} onClick={back}>Back to edit</button></>}
    </div> : <form onSubmit={plan} noValidate>
      <h1>What do you want to make?</h1>
      <label className="visually-hidden" htmlFor="project-idea">Describe your idea</label>
      <div className="intent-input"><textarea id="project-idea" ref={input} autoFocus={explicit} rows={2} maxLength={MAX_INTENT_LENGTH} value={idea} placeholder="Press a button and make it go BONK." disabled={!!phase} aria-describedby="intent-context intent-error" onChange={event => change(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="submit" className="intent-submit" aria-label="See proposal" disabled={!!phase || !idea.trim() || !inventory.loaded}><svg className="button-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg></button></div>
      <p id="intent-context" className="intent-context">{board?.name} <span aria-hidden="true">·</span> {hasInventory ? "My Parts available" : "Virtual building welcome"}</p>
      <div className="intent-examples" aria-label="Example ideas">{["Press a button and make it go BONK.", "Make a motion alarm.", "Show temperature on an OLED.", "Make a button control an LED."].map((value, index) => <button type="button" className="text-action" disabled={!!phase} key={value} onClick={() => { change(value); input.current?.focus(); }}>{["BONK", "Motion alarm", "Temperature display", "Button controls LED"][index]}</button>)}</div>
      {hasInventory && <label className="intent-owned"><input type="checkbox" checked={useParts} disabled={!!phase} onChange={event => setUseParts(event.target.checked)} /> Consider My Parts <small>Missing parts can be built virtually.</small></label>}
      {explicit && <div className="intent-options"><label>Board<select value={board?.id} disabled={!!phase} onChange={event => setSelected(event.target.value as BoardId)}>{boards.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{idea.trim() && <label>Project name<input maxLength={120} value={name} disabled={!!phase} onChange={event => { setName(event.target.value); setEdited(true); setError(null); }} /></label>}</div>}
      {!hasProvider && <p className="intent-note">BONK works without AI on ESP32. For other ideas, <Link to="/settings/providers">set up AI providers →</Link></p>}
      {explicit && <button type="button" className="text-action intent-blank" disabled={!!phase} onClick={() => void create(true)}>Create blank project</button>}
    </form>}
    <p className="intent-status" role="status" aria-live="polite">{phase}</p>
    <p id="intent-error" className="intent-error" role="alert">{error ?? inventory.error}</p>
  </section>;
}
