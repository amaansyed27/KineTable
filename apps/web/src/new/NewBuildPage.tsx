import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { AppShell, ProfileGate } from "../app/AppShell";
import { useAuthStore } from "../auth/authStore";
import { getBoard } from "../hardware/boards";
import { MAX_INTENT_LENGTH, titleFromIntent, validIntentText, validProjectName } from "../projects/schema";
import { useProfileStore } from "../state/profileStore";
import { useProjectStore } from "../state/projectStore";

const BoardStage = lazy(() => import("../spatial/BoardStage"));
const draftKey = "kinetable.new-build-draft";
function savedDraft(): { idea: string; name: string; edited: boolean } {
  try {
    const value = JSON.parse(sessionStorage.getItem(draftKey) ?? "null");
    if (typeof value?.idea === "string" && typeof value?.name === "string" && typeof value?.edited === "boolean") return value;
  } catch { /* Draft storage is optional. */ }
  return { idea: "", name: "", edited: false };
}
function ReadyNewBuild() {
  const navigate = useNavigate();
  const profile = useProfileStore(s => s.profile);
  const resolved = useAuthStore(s => s.resolved);
  const syncStatus = useAuthStore(s => s.syncStatus);
  const session = useAuthStore(s => s.session);
  const ownerId = session?.user.id;
  const project = useProjectStore(s => s.project);
  const ready = useProjectStore(s => s.ready);
  const storageError = useProjectStore(s => s.error);
  const open = useProjectStore(s => s.open);
  const createBuild = useProjectStore(s => s.createBuild);
  const board = getBoard(profile?.primaryBoardId);
  const [draft] = useState(savedDraft);
  const [idea, setIdea] = useState(draft.idea);
  const [name, setName] = useState(draft.name);
  const [edited, setEdited] = useState(draft.edited);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ideaRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (profile?.setupCompleted && board) void open(board.id, useAuthStore.getState().session); }, [profile?.setupCompleted, board, ownerId, open]);
  useEffect(() => { try { sessionStorage.setItem(draftKey, JSON.stringify({ idea, name, edited })); } catch { /* Project saving uses IndexedDB; draft storage is optional. */ } }, [idea, name, edited]);
  useEffect(() => { if (preview) previewRef.current?.focus(); }, [preview]);
  if (!profile?.setupCompleted && (!resolved || syncStatus === "syncing")) return <main id="app-main" className="route-loading" role="status">Opening your table…</main>;
  if (!profile?.setupCompleted || !board) return <Navigate to="/start" replace />;
  if (!ready || !project) return <main id="app-main" className="route-loading"><p role={storageError ? "alert" : "status"}>{storageError ?? "Opening your table…"}</p>{storageError && <button className="button" onClick={() => void open(board.id, session)}>Try again</button>}</main>;
  const selectedBoard = getBoard(project.document.boardIds[0]) ?? board;
  const transform = project.document.layout.entities[project.document.components[0].id];
  function validate() {
    if (!validIntentText(idea.trim())) { setError(`Describe your idea in 1–${MAX_INTENT_LENGTH} characters.`); ideaRef.current?.focus(); return false; }
    if (!validProjectName(name.trim())) { setError("Give this build a name of 1–120 characters."); nameRef.current?.focus(); return false; }
    setError(null);
    return true;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    try {
      await createBuild(selectedBoard.id, idea, name);
      try { sessionStorage.removeItem(draftKey); } catch { /* Optional draft storage. */ }
      navigate("/table");
    } catch (failure) {
      setError(failure instanceof Error && /^(Describe|Give this build)/.test(failure.message) ? failure.message : "We couldn’t save your build on this device. Please allow browser storage and try again.");
    } finally { setSaving(false); }
  }
  return <main id="app-main" className="new-build">
    <section className="new-build-editor" aria-label="New build">
      <Link className="new-build-back" to="/table">← My Table</Link>
      <p className="eyebrow">NEW BUILD <span aria-hidden="true">/</span> YOUR IDEA</p>
      <form onSubmit={submit} noValidate>
        {preview ? <div className="new-build-preview">
          <p className="new-build-kicker">THIS IS YOUR STARTING POINT</p>
          <h1 ref={previewRef} tabIndex={-1}>{name.trim()}</h1>
          <p className="new-build-request">“{idea.trim()}”</p>
          <p className="new-build-known">Starting with <strong>{selectedBoard.name}</strong></p>
          <p className="new-build-honest">No parts or connections have been planned yet.</p>
          <div className="new-build-actions"><button className="button" type="submit" disabled={saving}>Create build <span aria-hidden="true">→</span></button><button className="new-build-secondary" type="button" onClick={() => { setPreview(false); requestAnimationFrame(() => nameRef.current?.focus()); }}>Back to edit</button></div>
        </div> : <div className="new-build-entry">
          <h1>What do you want to make?</h1>
          <label className="new-build-label" htmlFor="build-idea">Describe your idea</label>
          <textarea id="build-idea" ref={ideaRef} autoFocus rows={3} maxLength={MAX_INTENT_LENGTH} placeholder="Make a motion alarm." value={idea} aria-invalid={!!error && !validIntentText(idea.trim())} aria-describedby="build-hint build-error" onChange={event => { const value = event.target.value; setIdea(value); if (!edited) setName(value.trim() ? titleFromIntent(value) : ""); setError(null); }} />
          <p id="build-hint" className="new-build-hint">A sentence is enough. You can use multiple lines; Enter adds a new line.</p>
          {idea.trim() && <div className="new-build-name"><label htmlFor="build-name">Project name</label><input id="build-name" ref={nameRef} maxLength={120} value={name} aria-invalid={!!error && !validProjectName(name.trim())} aria-describedby="build-error" onChange={event => { setName(event.target.value); setEdited(true); setError(null); }} /><span>Generated on this device. Make it yours.</span></div>}
          <div className="new-build-actions"><button className="button" type="submit" disabled={saving}>Create build <span aria-hidden="true">→</span></button><button className="new-build-secondary" type="button" onClick={() => { if (validate()) setPreview(true); }}>Show me first <span aria-hidden="true">↗</span></button></div>
        </div>}
        <p id="build-error" className="new-build-error" role="alert">{error}</p>
      </form>
    </section>
    <aside className="new-build-scene" aria-label={`${selectedBoard.name} is the selected starting board`}>
      <span className="new-build-scene-index" aria-hidden="true">01 / YOUR BOARD</span>
      <div className="new-build-board" role="img" aria-label={`${selectedBoard.name} on your table`}><Suspense fallback={<p className="scene-fallback">Placing your board…</p>}><BoardStage selected={selectedBoard.id} single transform={transform} /></Suspense></div>
      <div className="new-build-scene-foot"><span className="surface-label-dot" aria-hidden="true" /><span>{selectedBoard.name}<small>ON YOUR TABLE</small></span></div>
    </aside>
  </main>;
}
export default function NewBuildPage() { return <AppShell title="New build" tableNav><ProfileGate><ReadyNewBuild /></ProfileGate></AppShell>; }
