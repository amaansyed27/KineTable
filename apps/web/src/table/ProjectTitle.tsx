import { useRef, useState } from "react";
import { validProjectName } from "../projects/schema";
import { useProjectStore } from "../state/projectStore";

export function ProjectTitle({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(name), [error, setError] = useState("");
  const cancelled = useRef(false), pending = useRef(false), trigger = useRef<HTMLButtonElement>(null);
  function close() { setEditing(false); setError(""); requestAnimationFrame(() => trigger.current?.focus()); }
  async function save() {
    if (pending.current || cancelled.current) return;
    const next = draft.trim();
    if (!validProjectName(next)) { setError("Use a name of 1–120 characters."); return; }
    pending.current = true;
    try { await useProjectStore.getState().applyTransaction(current => { if(current.id !== id) throw new Error("This project changed. Open it again to rename."); return current.name === next ? [] : [{type:"project.rename", name:next}]; }); close(); }
    catch { setError("Couldn’t save the name. Try again."); } finally { pending.current = false; }
  }
  return <div className="project-title">{editing ? <form onSubmit={e => { e.preventDefault(); void save(); }}><input autoFocus aria-label="Project name" maxLength={120} value={draft} onFocus={e => e.currentTarget.select()} onChange={e => setDraft(e.target.value)} onBlur={() => void save()} onKeyDown={e => { if(e.key === "Escape") { e.preventDefault(); cancelled.current = true; close(); } }} /></form> : <h1 aria-label={name}><button ref={trigger} className="project-name-button" aria-label="Rename project" data-tooltip="Click to rename this project" onClick={() => { cancelled.current = false; setDraft(name); setEditing(true); }}><span>{name}</span><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m10 3 3 3M3 10l7-7 3 3-7 7-3 .5z" /></svg></button></h1>}{error && <p role="alert">{error}</p>}</div>;
}
