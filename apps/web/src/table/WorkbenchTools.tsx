import { useState } from "react";
import { Link } from "react-router";
import { useSimulationStore } from "../state/simulationStore";
import { useProjectStore } from "../state/projectStore";
import { getDefinition } from "../component-library/catalog";
import type { KinetableProjectV4 } from "../projects/v4";
import { assembleProject, assemblyError, type AssemblyPhase } from "../ai/assembleProject";
import type { PlanResponse } from "../ai/contract";
export function WorkbenchModes({ document }: { document: KinetableProjectV4 }) {
  const mode=useSimulationStore(s=>s.mode);
  return <nav className="workbench-modes" aria-label="Workbench modes">{(["build","logic","simulate","explain"] as const).map(value=><button key={value} aria-current={mode===value ? "page" : undefined} onClick={()=>{const state=useSimulationStore.getState(); if(value==="build") state.build(); else if(value==="logic") state.logic(); else state.enter(document,value);}}>{value[0].toUpperCase()+value.slice(1)}</button>)}</nav>;
}
export function CoachMark({ step }: { step: "move" | "wire" | "simulate" }) {
  const [dismissed,setDismissed]=useState<string[]>(()=>{try{const value=JSON.parse(localStorage.getItem("kinetable.guidance")??"[]");return Array.isArray(value)?value:[];}catch{return [];}});
  if(dismissed.includes(step) || dismissed.includes("all")) return null;
  const copy=step==="move" ? ["This is your workbench.","Drag hardware to move it."] : step==="wire" ? ["Wire your first connection.","Select a pin to begin."] : ["Try your circuit.","Press the virtual button or use the controls."];
  function dismiss(value: string) {const next=[...dismissed,value];setDismissed(next);try{localStorage.setItem("kinetable.guidance",JSON.stringify(next));}catch{/* Optional guidance preferences. */}}
  return <aside className="coach-mark" aria-label="Workbench guidance"><strong>{copy[0]}</strong><p>{copy[1]}</p><button onClick={()=>dismiss(step)}>Got it</button><button onClick={()=>dismiss("all")}>Skip guidance</button></aside>;
}
export function BuildAssistant({ document }: { document: KinetableProjectV4 }) {
  const [open,setOpen]=useState(false),[phase,setPhase]=useState<AssemblyPhase|null>(null),[error,setError]=useState<string|null>(null),[proposal,setProposal]=useState<PlanResponse|null>(null);
  async function plan() {setError(null);setPhase("planning");try{setProposal(await assembleProject(setPhase,false));}catch(cause){setError(assemblyError(cause));}finally{setPhase(null);}}
  async function apply() {if(!proposal)return;try{await useProjectStore.getState().applyTransaction(current=>{if(current.id!==document.id || current.metadata.updatedAt!==proposal.revision)throw new Error("STALE_PROJECT");return proposal.commands;});setProposal(null);setOpen(false);}catch(cause){setError(assemblyError(cause));}}
  return <div className="build-assistant"><button className="ai-affordance" onClick={()=>setOpen(!open)} aria-expanded={open}>✦ Ask Kinetable</button>{open && <aside className="ai-sheet"><button className="inspector-close" aria-label="Close AI assistance" onClick={()=>setOpen(false)}>×</button><h2>Build with Kinetable</h2>{document.components.length===1 && document.intent ? <><p>Plan the initial assembly for “{document.intent.text}”.</p><button className="button" disabled={!!phase} onClick={()=>void plan()}>{phase ? "Checking your build…" : "Preview assembly"}</button></> : <p>AI can assemble a new project from its idea. Incremental part and wiring changes aren’t supported yet. Use + Part and Wire here, or <Link to="/projects/new">start a new project</Link>.</p>}<Link to="/settings/providers">Set up AI providers →</Link>{proposal && <div className="ai-change-preview"><h3>{proposal.status==="supported" ? "I’ll add" : "Not supported yet"}</h3><p>{proposal.summary}</p><p>{proposal.unsupportedReason}</p>{proposal.status==="supported" && <><ul>{proposal.commands.filter(c=>c.type==="component.add").map((c,i)=><li key={i}>{c.type==="component.add" && getDefinition(c.definitionId)?.name}</li>)}</ul><p>{proposal.commands.filter(c=>c.type==="connection.create" || c.type==="wire.add").length} validated connections</p><button className="button" onClick={()=>void apply()}>Apply</button><button onClick={()=>setProposal(null)}>Change</button></>}</div>}{error && <p role="alert">{error}</p>}</aside>}</div>;
}
