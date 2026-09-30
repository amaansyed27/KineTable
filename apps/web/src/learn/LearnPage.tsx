import { useEffect, useState } from "react";
import { Link } from "react-router";
import { AppShell, ProfileGate } from "../app/AppShell";
import { useAuthStore } from "../auth/authStore";
import { inventoryOwner } from "../persistence/inventoryRepository";
import { missions } from "./missions";
import { missionComplete, progressRepository, type Progress } from "./progress";
import "./learn.css";

function Curriculum() {
  const userId = useAuthStore(s=>s.session?.user.id), owner = inventoryOwner(userId);
  const [progress,setProgress] = useState<Progress[]>([]), [error,setError] = useState("");
  useEffect(()=>{let alive=true;setProgress([]);void progressRepository.list(owner).then(rows=>{if(alive)setProgress(rows);}).catch(()=>{if(alive)setError("Couldn’t read progress on this device.");});return ()=>{alive=false;};},[owner]);
  const recent = [...progress].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).find(p=>!missionComplete(p,missions.find(m=>m.id===p.missionId)!));
  return <main id="app-main" className="learn-home"><header><p className="eyebrow">LEARN / BY DOING</p><h1>Hardware makes sense<br />when you can touch it.</h1><p>Build a connection. See a signal. Understand why.</p></header>
    {error && <p role="alert">{error}</p>}
    {recent && <div className="learn-continue"><div><small>Continue</small><h2>{missions.find(m=>m.id===recent.missionId)?.title}</h2></div><Link className="button" to={`/learn/${recent.missionId}`}>Continue →</Link></div>}
    <p className="eyebrow">START HERE · YOUR OWN PACE</p><ol className="learn-curriculum">{missions.map((mission,index)=>{
      const saved=progress.find(p=>p.missionId===mission.id);
      return <li key={mission.id}><span className="learn-number">{mission.id==="bonk"?"↗":String(index+1).padStart(2,"0")}</span><Link to={`/learn/${mission.id}`}><small>{mission.id==="bonk"?"CAPSTONE":""}</small><h2>{mission.title}</h2><p>{mission.description}</p></Link><span className="learn-quiet-progress">{saved ? missionComplete(saved,mission) ? "Complete ✓" : `${saved.completed.length} of ${mission.stages.length}` : "Start →"}</span></li>;
    })}</ol><p className="learn-note">Virtual hardware is included. No account, kit or AI provider needed. Progress stays on this device.</p></main>;
}
export default function LearnPage() { return <AppShell title="Learn"><ProfileGate><Curriculum /></ProfileGate></AppShell>; }
