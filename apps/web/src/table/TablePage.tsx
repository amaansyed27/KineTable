import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { ProfileGate } from "../app/AppShell";
import { AccountControl } from "../auth/AccountControl";
import { getBoard } from "../hardware/boards";
import { useProfileStore } from "../state/profileStore";
import { useAuthStore } from "../auth/authStore";
import { useProjectStore } from "../state/projectStore";
import { migrateProject } from "../projects/v4";
import { Workbench } from "./Workbench";
import { WorkbenchModes } from "./WorkbenchTools";
import { useSimulationStore } from "../state/simulationStore";
function ReadyProject() {
  const { projectId } = useParams();
  const profile = useProfileStore(s=>s.profile), session=useAuthStore(s=>s.session), resolved=useAuthStore(s=>s.resolved), authSync=useAuthStore(s=>s.syncStatus);
  const project=useProjectStore(s=>s.project), status=useProjectStore(s=>s.status), error=useProjectStore(s=>s.error);
  const [opening,setOpening]=useState(true), [missing,setMissing]=useState(false);
  const board=getBoard(profile?.primaryBoardId);
  useEffect(()=>{
    if (!profile?.setupCompleted || !board) return;
    let alive=true; setOpening(true); setMissing(false);
    const store=useProjectStore.getState();
    const task=projectId ? store.openById(projectId,board.id,session) : store.open(board.id,session).then(()=>true);
    void task.then(found=>{if(alive){setMissing(!found);setOpening(false);}}).catch(()=>{if(alive){setMissing(true);setOpening(false);}});
    return ()=>{alive=false;};
  },[profile?.setupCompleted,board,session,projectId]);
  useEffect(()=>{ const retry=()=>void useProjectStore.getState().sync(); window.addEventListener("online",retry); return ()=>window.removeEventListener("online",retry); },[]);
  useEffect(()=>{globalThis.document.title=project ? `${project.name} · Kinetable` : "Workbench · Kinetable";},[project]);
  useEffect(()=>{useSimulationStore.getState().build();},[projectId]);
  if (!profile?.setupCompleted && (!resolved || authSync==="syncing")) return <main className="route-loading" role="status">Opening your projects…</main>;
  if (!profile?.setupCompleted || !board) return <Navigate to="/start" replace />;
  if(opening) return <main className="route-loading" role="status">Opening your project…</main>;
  if(missing || !project) return <main id="app-main" className="route-loading"><h1>This project isn’t here.</h1><p>{error || "It may be on another device or account. Your other projects are safe."}</p><Link className="button" to="/projects">Go to Projects</Link><Link to="/home">Home</Link></main>;
  if(!projectId) return <Navigate to={`/projects/${project.id}`} replace />;
  if(project.id!==projectId) return <main className="route-loading" role="status">Opening your project…</main>;
  const document=migrateProject(project.document);
  return <><header className="project-header"><Link className="project-back" to="/projects">← <span>Projects</span></Link><div className="project-title"><h1>{project.name}</h1><span className="project-save" role="status">● {status === "syncing" ? "Saved here · syncing" : status === "offline" ? "Saved here · offline" : "Saved"}</span></div><WorkbenchModes document={document} /><AccountControl /></header><main id="app-main" className="project-workspace" data-project-id={project.id} data-board-id={document.boardIds[0]}><Workbench key={document.id} document={document} /></main></>;
}
export default function TablePage() { return <div className="product-app project-app"><a className="skip-link" href="#app-main">Skip to workbench</a><ProfileGate><ReadyProject /></ProfileGate></div>; }
