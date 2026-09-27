import { useState } from "react";
import { Link } from "react-router";
import type { KinetableProjectV4 } from "../projects/v4";
import type { LogicRule } from "../logic/schema";
import type { PlanResponse } from "../ai/contract";
import { parseBehaviorResponse } from "../ai/behaviorPlanner";
import { loadProviderSettings } from "../ai/providerSettings";
import { invokeProvider } from "../ai/providerTransport";
import { routePlan } from "../ai/routing";
import { assemblyError } from "../ai/assembleProject";
import { useProjectStore } from "../state/projectStore";
import { useAuthStore } from "../auth/authStore";
import { getDefinition } from "../component-library/catalog";
export function behaviorSentence(rule: LogicRule, document: KinetableProjectV4): string {
  const name=(id:string)=>getDefinition(document.components.find(c=>c.id===id)?.definitionId ?? "")?.name ?? "Missing part";
  const trigger=rule.when.kind==="timer" ? `Every ${rule.when.intervalMs} ms` : `${name(rule.when.componentId)} ${rule.when.kind==="button" ? `is ${rule.when.edge}` : rule.when.kind==="pir" ? "detects motion" : "changes"}`;
  return `WHEN ${trigger}${rule.if.length ? " · IF sensor conditions match" : ""} → ${rule.do.map(a=>a.kind==="buzzer" ? `${name(a.componentId)} beeps ${a.count} times` : a.kind==="led" ? `${name(a.componentId)} turns ${a.operation.toUpperCase()}` : `${name(a.componentId)} ${a.operation==="show" ? `shows “${a.text}”` : "clears"}`).join(" · ")}`;
}
export function BehaviorAssistant({ document }: { document: KinetableProjectV4 }) {
  const [request,setRequest]=useState(""), [busy,setBusy]=useState(false), [error,setError]=useState<string|null>(null), [proposal,setProposal]=useState<PlanResponse|null>(null);
  const configured=loadProviderSettings().profile.routes.some(r=>r.enabled);
  async function propose() {
    setBusy(true);setError(null);setProposal(null);
    try {
      const settings=loadProviderSettings();if(!settings.profile.routes.some(r=>r.enabled))throw new Error("NO_PROVIDER");
      const row=useProjectStore.getState().project;if(!row || row.id!==document.id)throw new Error("STALE_PROJECT");
      const input={projectId:document.id,revision:document.metadata.updatedAt,boardId:document.boardIds[0],intent:request.trim()};
      const session=useAuthStore.getState().session;
      const result=await routePlan(settings.profile,settings.credentials,input,document,(route,key)=>invokeProvider(route,key,input,document,session && !row.cloudDirty ? session : null,"logic"),raw=>parseBehaviorResponse(input,document,raw));
      setProposal(result.plan);
    } catch(cause) {setError(assemblyError(cause));} finally {setBusy(false);}
  }
  async function apply() {
    if(!proposal)return;
    setBusy(true);setError(null);
    try {await useProjectStore.getState().applyTransaction(current=>{if(current.id!==document.id || current.metadata.updatedAt!==proposal.revision)throw new Error("STALE_PROJECT");return proposal.commands;});setProposal(null);setRequest("");}catch(cause){setError(assemblyError(cause));}finally{setBusy(false);}
  }
  return <section className="behavior-assistant" aria-label="AI behavior assistance"><label htmlFor="behavior-request">✦ Describe what should happen…</label><textarea id="behavior-request" disabled={busy} rows={2} maxLength={500} placeholder="When I press the button, show BONK and beep three times." value={request} onChange={e=>{setRequest(e.target.value);setProposal(null);}} /><div>{configured ? <button disabled={busy || !request.trim()} onClick={()=>void propose()}>{busy ? "Checking behavior…" : "Preview behavior →"}</button> : <Link to="/settings/providers">Connect a provider for AI help →</Link>}<small>Manual behavior works without AI.</small></div>{proposal && <div className="ai-change-preview"><h3>{proposal.status==="supported" ? "I’ll change" : "Not supported yet"}</h3><p>{proposal.summary}</p>{proposal.unsupportedReason && <p>{proposal.unsupportedReason}</p>}<ul>{proposal.commands.map((c,index)=><li key={index}>{c.type==="logic.rule.add" || c.type==="logic.rule.update" ? <>{c.type==="logic.rule.add" ? "Add: " : "Update: "}{c.type==="logic.rule.update" && document.logic.find(r=>r.id===c.rule.id) && <><del>{behaviorSentence(document.logic.find(r=>r.id===c.rule.id)!,document)}</del><br />→ </>}{behaviorSentence(c.rule,document)}</> : c.type==="logic.rule.remove" ? `Remove: ${document.logic.find(r=>r.id===c.id) ? behaviorSentence(document.logic.find(r=>r.id===c.id)!,document) : "Missing behavior"}` : ""}</li>)}</ul>{proposal.status==="supported" && <><button className="button" disabled={busy} onClick={()=>void apply()}>Apply</button><button onClick={()=>setProposal(null)}>Change</button></>}</div>}{error && <p role="alert">{error}</p>}</section>;
}
