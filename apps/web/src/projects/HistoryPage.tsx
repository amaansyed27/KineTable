import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { AppShell, ProfileGate } from "../app/AppShell";
import { useAuthStore } from "../auth/authStore";
import { useProfileStore } from "../state/profileStore";
import { useProjectStore } from "../state/projectStore";
import { projectHistoryRepository, projectOwner, type ProjectConflict, type ProjectVersion } from "../persistence/projectHistoryRepository";
import { cloudProjectRepository } from "../persistence/cloudProjectRepository";
import { migrateProject } from "./v4";
import { ProjectPreview } from "./ProjectsPage";
import { getBoard } from "../hardware/boards";
import "../explore/explore.css";

function facts(document: ProjectVersion["document"]) {
  const project = migrateProject(document);
  return `${project.name} · ${getBoard(project.boardIds[0])?.name ?? "Board"} · ${project.components.filter(c => c.kind === "component").length} parts · ${project.wires.length} wires · ${project.logic.length} rules`;
}
function HistoryContent() {
  const { projectId = "" } = useParams(), session = useAuthStore(s => s.session), profile = useProfileStore(s => s.profile);
  const row = useProjectStore(s => s.project), status = useProjectStore(s => s.status);
  const [versions,setVersions] = useState<ProjectVersion[]>([]), [conflict,setConflict] = useState<ProjectConflict | null>(null);
  const [selected,setSelected] = useState<ProjectVersion | null>(null), [confirm,setConfirm] = useState<string | null>(null);
  const [error,setError] = useState<string | null>(null), [busy,setBusy] = useState(false), [ready,setReady] = useState(false);
  const ownerId = projectOwner(session?.user.id);
  useEffect(() => {
    if (!profile?.primaryBoardId || !projectId) return;
    let active = true;
    setReady(false); setError(null);
    void (async () => {
      const found = await useProjectStore.getState().openById(projectId,profile.primaryBoardId,useAuthStore.getState().session);
      if (!found) { if (active) setError("This project isn’t available in this account."); return; }
      const local = await projectHistoryRepository.list(ownerId,projectId);
      const record = await projectHistoryRepository.conflict(ownerId,projectId);
      let cloud: ProjectVersion[] = [];
      if (session) try { cloud = await cloudProjectRepository.versions(session.access_token,session.user.id,projectId); } catch { /* Local history stays available offline. */ }
      if (active) { setVersions([...cloud,...local].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))); setConflict(record ?? null); setReady(true); }
    })().catch(() => { if (active) setError("History could not open. Try again."); });
    return () => { active = false; };
  },[projectId,ownerId,profile?.primaryBoardId,session]);
  useEffect(() => { if (ready && status === "conflict") void projectHistoryRepository.conflict(ownerId,projectId).then(record => setConflict(record ?? null)); },[ready,status,ownerId,projectId]);
  async function refresh() {
    const local = await projectHistoryRepository.list(ownerId,projectId);
    const cloud = session ? await cloudProjectRepository.versions(session.access_token,session.user.id,projectId).catch(()=>[]) : [];
    setVersions([...cloud,...local].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
    setConflict(await projectHistoryRepository.conflict(ownerId,projectId) ?? null);
  }
  async function action(kind: string) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (kind === "restore" && selected) await useProjectStore.getState().restoreSnapshot(migrateProject(selected.document));
      else if (kind === "checkpoint") await useProjectStore.getState().checkpoint();
      else if (kind === "device" || kind === "cloud" || kind === "both") await useProjectStore.getState().resolveConflict(kind);
      await refresh(); setConfirm(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t save this choice. Your versions are still here."); }
    finally { setBusy(false); }
  }
  if (error && !ready) return <main id="app-main" className="history-page"><h1>History</h1><p role="alert">{error}</p><Link to="/projects">Projects</Link></main>;
  if (!ready || !row || row.id !== projectId) return <main id="app-main" className="route-loading" role="status">Opening project history…</main>;
  const preview = selected ?? null;
  const previewRow = preview ? { ...row, name: preview.document.name, document: preview.document } : null;
  return <main id="app-main" className="history-page"><Link to={`/projects/${projectId}`}>← Back to project</Link>
    <div className="history-heading"><div><p className="eyebrow">PROJECT MEMORY</p><h1>{row.name} history</h1><p>Earlier versions stay available when you restore one.</p></div><button className="button secondary" disabled={busy || !!conflict} onClick={()=>void action("checkpoint")}>Save checkpoint</button></div>
    {conflict && <section className="history-conflict" aria-labelledby="conflict-title"><p className="eyebrow">NEEDS ATTENTION</p><h2 id="conflict-title">This project changed on another device.</h2><p>Both versions are safe. Choose which one should be your project, or keep both.</p><div className="history-comparison"><article><h3>Your version</h3><p>Edited on this device</p><p>{facts(conflict.local)}</p></article><article><h3>Cloud version</h3><p>Updated on another device</p><p>{facts(conflict.cloud)}</p></article></div><div className="history-actions">{(["device","cloud","both"] as const).map(choice=><button key={choice} disabled={busy} onClick={()=>setConfirm(choice)}>{choice==="device"?"Use this device":choice==="cloud"?"Use cloud version":"Keep both"}</button>)}</div>{confirm && confirm!=="restore" && <div className="history-confirm" role="group" aria-label="Confirm conflict choice"><p>{confirm==="device"?"Your device version becomes the cloud project. The previous cloud version stays in history.":confirm==="cloud"?"The cloud version becomes current. Your device version stays in local history.":"The cloud version stays in this project. Your device version becomes a separate project."}</p><button className="button" disabled={busy} onClick={()=>void action(confirm)}>Confirm choice</button><button onClick={()=>setConfirm(null)}>Cancel</button></div>}</section>}
    <section className="history-current"><h2>Current</h2><p>{facts(row.document)}</p><span role="status">{status==="conflict"?"Needs attention":status==="synced"?"Synced":status==="syncing"?"Syncing":"Saved on this device"}</span></section>
    <div className="history-layout"><section aria-labelledby="versions-title"><h2 id="versions-title">Previous versions</h2>{versions.length ? <ol className="history-list">{versions.map(version=><li key={version.id}><button aria-current={selected?.id===version.id?"true":undefined} onClick={()=>{setSelected(version);setConfirm(null);}}><strong>{version.reason}</strong><time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString()}</time></button></li>)}</ol> : <p>No previous versions yet. Save a checkpoint to start.</p>}</section>
    <section className="history-preview" aria-live="polite"><h2>Preview</h2>{preview && previewRow ? <><ProjectPreview row={previewRow} /><h3>{preview.document.name}</h3><p>{facts(preview.document)}</p><p>{preview.reason} · <time dateTime={preview.createdAt}>{new Date(preview.createdAt).toLocaleString()}</time></p>{!conflict && <>{confirm==="restore" ? <div className="history-confirm"><p>Restore this version as a new current version?</p><button className="button" disabled={busy} onClick={()=>void action("restore")}>Confirm restore</button><button onClick={()=>setConfirm(null)}>Cancel</button></div> : <button className="button" onClick={()=>setConfirm("restore")}>Restore this version</button>}</>}</> : <p>Choose a version to inspect it. Your current project will stay as it is.</p>}</section></div>
    {error && <p role="alert">{error}</p>}
  </main>;
}
export default function HistoryPage() { return <AppShell title="Project history"><ProfileGate><HistoryContent /></ProfileGate></AppShell>; }
