import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { AppShell, ProfileGate } from "../app/AppShell";
import { useAuthStore } from "../auth/authStore";
import { useProfileStore } from "../state/profileStore";
import { useProjectStore } from "../state/projectStore";
import { useSimulationStore } from "../state/simulationStore";
import { inventoryOwner } from "../persistence/inventoryRepository";
import { localProjectRepository } from "../persistence/localProjectRepository";
import { getBoard, type BoardId } from "../hardware/boards";
import { migrateProject } from "../projects/v4";
import { Workbench } from "../table/Workbench";
import { WorkbenchModes } from "../table/WorkbenchTools";
import { getMission, type Mission } from "./missions";
import { missionStarter } from "./starters";
import { completeStage, newProgress, parseProgress, progressRepository, type Progress } from "./progress";
import { evaluate } from "./evaluate";
import { MissionGuide } from "./MissionGuide";
import "./learn.css";

function MissionWorkspace({ mission }: { mission: Mission }) {
  const session=useAuthStore(s=>s.session), owner=inventoryOwner(session?.user.id), profile=useProfileStore(s=>s.profile);
  const [board,setBoard]=useState<BoardId>(profile?.primaryBoardId??"esp32-dev-module");
  const [progress,setProgress]=useState<Progress|null>(null), [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [error,setError]=useState("");
  useEffect(()=>{setBoard(profile?.primaryBoardId??"esp32-dev-module");},[profile?.primaryBoardId]);
  const project=useProjectStore(s=>s.project), snapshot=useSimulationStore(s=>s.snapshot), runtimeId=useSimulationStore(s=>s.projectId), runtimeRevision=useSimulationStore(s=>s.revision);
  useEffect(()=>{
    let alive=true;setLoading(true);setProgress(null);setError("");useSimulationStore.getState().build();
    void progressRepository.load(owner,mission).then(async p=>{
      if (!alive) return;
      if (p) { const found=await useProjectStore.getState().openById(p.projectId,useProfileStore.getState().profile?.primaryBoardId??"esp32-dev-module",useAuthStore.getState().session); if (!alive) return; if(!found)throw new Error("The mission project isn’t on this device or account. Start again; your previous work is preserved in Projects."); setProgress(p); }
    }).catch(cause=>{if(alive)setError(cause instanceof Error?cause.message:"Couldn’t open this mission.");}).finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;useSimulationStore.getState().build();};
  },[owner,mission]);
  const document = project && progress && project.id===progress.projectId && project.cloudUserId===session?.user.id ? migrateProject(project.document) : null;
  const stage=progress && mission.stages.find(s=>s.id===progress.stageId);
  const evidence=useMemo(()=>document && progress && stage ? evaluate(stage.goal,document,progress.roles,runtimeId===document.id && runtimeRevision===document.metadata.updatedAt ? snapshot : null) : null,[document,progress,stage,runtimeId,runtimeRevision,snapshot]);
  async function start() {
    if(busy)return;setBusy(true);setError("");
    const activeOwner=owner;
    try {
      const {document,roles}=missionStarter(mission,board);
      await localProjectRepository.save({id:document.id,name:document.name,schemaVersion:4,document,createdAt:document.metadata.createdAt,updatedAt:document.metadata.updatedAt,cloudUserId:session?.user.id,cloudDirty:!!session},"Created learning project");
      const p=newProgress(mission,owner,document.id,roles);
      if(inventoryOwner(useAuthStore.getState().session?.user.id)!==activeOwner)return;
      await progressRepository.save(p);
      const found=await useProjectStore.getState().openById(document.id,board,session);
      if(!found)throw new Error("Couldn’t open the saved learning project.");
      if(inventoryOwner(useAuthStore.getState().session?.user.id)===activeOwner)setProgress(p);
    } catch(cause){setError(cause instanceof Error?cause.message:"Couldn’t save the mission. Allow browser storage and try again.");}finally{setBusy(false);}
  }
  async function update(next: Progress) {
    if(busy || inventoryOwner(useAuthStore.getState().session?.user.id)!==next.ownerId)return;
    setBusy(true);setError("");
    try { await progressRepository.save(parseProgress(next,mission,owner)); if(inventoryOwner(useAuthStore.getState().session?.user.id)===next.ownerId)setProgress(next); }
    catch {setError("Couldn’t save learning progress. Your project edits are still saved separately. Try again.");}finally{setBusy(false);}
  }
  if(loading)return <main id="app-main" className="route-loading" role="status">Opening your mission…</main>;
  if(!progress || !document || !stage || !evidence)return <main id="app-main" className="learn-start"><Link to="/learn">← Learn</Link><p className="eyebrow">LEARN / {mission.id==="bonk"?"CAPSTONE":"GUIDED BUILD"}</p><h1>{mission.title}</h1><p>{mission.description}</p>{mission.prerequisites.length>0 && <p className="learn-note">Suggested first: {mission.prerequisites.map((id,i)=><span key={id}>{i>0?" · ":""}<Link to={`/learn/${id}`}>{getMission(id)?.title}</Link></span>)}. You can start here too.</p>}
    <label>Virtual board<select aria-label="Mission board" value={board} onChange={e=>{const selected=getBoard(e.target.value);if(selected)setBoard(selected.id);}}>{[...new Set([board,...mission.boards])].map(id=><option key={id} value={id}>{getBoard(id)?.name}{!mission.boards.includes(id)?" · unsupported for this mission":""}</option>)}</select></label>{!mission.boards.includes(board) && <p role="status">This component profile needs a different supported board. Choose one explicitly; your primary board preference stays the same.</p>}
    <button className="button" disabled={busy || !mission.boards.includes(board)} onClick={()=>void start()}>{busy?"Saving…":error?"Start a new mission":"Start mission"} →</button><p className="learn-note">A real project, saved locally. No sign-in or AI needed.</p>{error && <p role="alert">{error}</p>}</main>;
  return <main id="app-main" className="learn-mission" data-project-id={document.id} data-board-id={document.boardIds[0]}><header className="mission-header"><Link to="/learn">← Learn</Link><div><strong>{mission.title}</strong><small>{getBoard(document.boardIds[0])?.name} · <Link to={`/projects/${document.id}/history`}>Project history</Link></small></div><WorkbenchModes document={document} /></header>
    <div className="mission-layout"><div className="mission-hardware"><Workbench key={document.id} document={document} learning connectivityOnly={mission.id==="breadboard"} /></div><MissionGuide key={stage.id} mission={mission} progress={progress} evidence={evidence} busy={busy} onCheck={()=>{
      // Re-evaluate the current committed document at the action boundary, never accept a UI/AI verdict.
      const current=useProjectStore.getState().project, simulation=useSimulationStore.getState();
      if(!current || current.id!==progress.projectId || current.cloudUserId!==session?.user.id)return;
      const doc=migrateProject(current.document);
      void update(completeStage(progress,mission,evaluate(stage.goal,doc,progress.roles,simulation.projectId===doc.id && simulation.revision===doc.metadata.updatedAt?simulation.snapshot:null)));
    }} onStage={id=>void update({...progress,stageId:id,updatedAt:new Date().toISOString()})} onHint={()=>void update({...progress,hints:{...progress.hints,[stage.id]:Math.min(3,(progress.hints[stage.id]??0)+1)},updatedAt:new Date().toISOString()})} /></div>{error && <p className="mission-save-error" role="alert">{error}</p>}</main>;
}
function SelectedMission() { const {missionId}=useParams(), mission=getMission(missionId), owner=useAuthStore(s=>s.session?.user.id??"guest"); return mission ? <MissionWorkspace key={`${owner}:${mission.id}`} mission={mission} /> : <main id="app-main" className="learn-start"><h1>This mission isn’t here.</h1><Link to="/learn">Back to Learn</Link></main>; }
export default function MissionPage() { return <AppShell title="Learn"><ProfileGate><SelectedMission /></ProfileGate></AppShell>; }
