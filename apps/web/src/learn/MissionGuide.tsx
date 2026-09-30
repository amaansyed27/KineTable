import { useState } from "react";
import { Link } from "react-router";
import type { Mission } from "./missions";
import { missionComplete, type Progress } from "./progress";
import type { Evidence } from "./evaluate";

export function MissionGuide({ mission, progress, evidence, busy, onCheck, onStage, onHint }: { mission: Mission; progress: Progress; evidence: Evidence; busy: boolean; onCheck: ()=>void; onStage:(id:string)=>void; onHint:()=>void }) {
  const [why,setWhy] = useState(false);
  const stage=mission.stages.find(s=>s.id===progress.stageId)!, index=mission.stages.indexOf(stage), depth=progress.hints[stage.id]??0;
  const earned=progress.completed.includes(stage.id), done=missionComplete(progress,mission);
  return <aside className="mission-guide" aria-label="Mission guidance"><div className="mission-guide-top"><span>{done ? "Mission complete ✓" : `${index+1} of ${mission.stages.length}`}</span><span>Verified by Kinetable</span></div>
    <h1>{stage.instruction}</h1>{mission.id==="brightness" && <p className="mission-limit">More resistance generally limits current more under the same conditions. This model supports a 220 Ω series path and ON/OFF only. It does not calculate current, PWM or precise brightness.</p>}
    <p className="mission-feedback" data-pass={evidence.pass} role="status">{evidence.feedback}</p>
    <div className="mission-guide-actions"><button className="button" disabled={busy || !evidence.pass || earned} onClick={onCheck}>{earned ? "Stage complete ✓" : "Check goal"}</button><button disabled={busy || depth>=3} onClick={onHint}>{depth===0 ? "Hint" : depth===2 ? "Show answer" : "Another hint"}</button></div>
    {depth>0 && <div className="mission-hint" aria-live="polite"><small>{depth===3 ? "ANSWER · MAKE THESE CONNECTIONS YOURSELF" : `HINT ${depth}`}</small><p>{depth===3 ? evidence.answer : stage.hints[depth-1]}</p>{depth>=2 && evidence.facts.length>0 && <p>{evidence.facts[0]}</p>}</div>}
    <button className="mission-why" aria-expanded={why} onClick={()=>setWhy(!why)}>Why? · Ask Kinetable</button>
    {why && <div className="mission-explanation"><p>{stage.concept}</p><strong>Observed in your project</strong>{evidence.facts.length ? <ul>{evidence.facts.map((fact,i)=><li key={i}>{fact}</li>)}</ul> : <p>No matching electrical path has been verified yet.</p>}<p>Use Explain in the workbench to inspect nets and causal traces. These observations are deterministic; generated AI explanations are not available in Learn yet.</p></div>}
    <nav className="mission-stage-nav" aria-label="Mission stages"><button disabled={busy || index===0} onClick={()=>onStage(mission.stages[index-1].id)}>← Previous</button>{index<mission.stages.length-1 ? <button disabled={busy || !earned} onClick={()=>onStage(mission.stages[index+1].id)}>Next task →</button> : done && <Link to="/learn">Back to Learn →</Link>}</nav>
  </aside>;
}
