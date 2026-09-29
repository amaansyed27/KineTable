import { useEffect, useRef, useState } from "react";
import { behaviorChatRepository, type BehaviorChat } from "../persistence/behaviorChatRepository";
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
  const ownerId=useAuthStore(s=>s.session?.user.id ?? "guest");
  const [chats,setChats]=useState<BehaviorChat[]>([]), [activeId,setActiveId]=useState<string|null>(null);
  const [request,setRequest]=useState(""), [busy,setBusy]=useState(false), [loaded,setLoaded]=useState(false), [error,setError]=useState<string|null>(null);
  const [proposal,setProposal]=useState<{messageId:string;plan:PlanResponse}|null>(null), [providerId,setProviderId]=useState("");
  const messages=useRef<HTMLDivElement>(null);
  const routes=loadProviderSettings().profile.routes.filter(r=>r.enabled);
  const active=chats.find(c=>c.id===activeId);
  const fresh=():BehaviorChat=>({id:crypto.randomUUID(),projectId:document.id,ownerId,title:"New chat",draft:"",messages:[],updatedAt:new Date().toISOString()});
  useEffect(()=>{
    let current=true;
    setLoaded(false);setProposal(null);setRequest("");setError(null);
    void behaviorChatRepository.list(ownerId,document.id).then(rows=>{if(current){setChats(rows);setActiveId(rows[0]?.id ?? null);setRequest(rows[0]?.draft ?? "");setLoaded(true);}}).catch(()=>{if(current)setError("Chat history couldn’t be opened. Reload to try again.");});
    return ()=>{current=false;};
  },[ownerId,document.id]);
  useEffect(()=>{messages.current?.scrollTo({top:messages.current.scrollHeight});},[active?.messages.length,busy,proposal]);
  useEffect(()=>{const scroll=()=>messages.current?.scrollTo({top:messages.current.scrollHeight});window.addEventListener("resize",scroll);return ()=>window.removeEventListener("resize",scroll);},[]);
  async function save(chat:BehaviorChat) {
    if(ownerId!==(useAuthStore.getState().session?.user.id ?? "guest"))throw new Error("ACCOUNT_CHANGED");
    await behaviorChatRepository.save(chat);
    setChats(rows=>[chat,...rows.filter(c=>c.id!==chat.id)]);setActiveId(chat.id);
  }
  async function newChat() {
    if(active && !active.messages.length && !request.trim())return;
    try {if(active)await save({...active,draft:request});const chat=fresh();await save(chat);setRequest("");setProposal(null);setError(null);}catch{setError("Chat couldn’t be saved. Check device storage and try again.");}
  }
  async function switchChat(chat:BehaviorChat) {
    if(chat.id===activeId)return;
    const previous=active?{...active,draft:request}:null;
    setChats(rows=>previous?rows.map(row=>row.id===previous.id?previous:row):rows);
    setActiveId(chat.id);setRequest(chat.draft);setProposal(null);setError(null);
    try {if(previous)await behaviorChatRepository.save(previous);}catch{setError("Your draft couldn’t be saved. Check device storage and try again.");}
  }
  async function propose() {
    if(busy || !loaded || !request.trim())return;
    setBusy(true);setError(null);setProposal(null);
    let chat=active ?? fresh();
    try {
      if(chat.messages.length>=200)throw new Error("CHAT_FULL");
      const settings=loadProviderSettings();
      const profile=providerId?{...settings.profile,routes:settings.profile.routes.filter(r=>r.id===providerId && r.enabled)}:settings.profile;
      if(!profile.routes.some(r=>r.enabled))throw new Error("NO_PROVIDER");
      const row=useProjectStore.getState().project;if(!row || row.id!==document.id)throw new Error("STALE_PROJECT");
      const text=request.trim();
      const input={projectId:document.id,revision:document.metadata.updatedAt,boardId:document.boardIds[0],intent:text,conversation:chat.messages.slice(-10).map(({role,content})=>({role,content}))};
      chat={...chat,title:chat.messages.length?chat.title:text.slice(0,60),draft:"",messages:[...chat.messages,{id:crypto.randomUUID(),role:"user",content:text}],updatedAt:new Date().toISOString()};
      await save(chat);setRequest("");
      const session=useAuthStore.getState().session;
      const result=await routePlan(profile,settings.credentials,input,document,(route,key)=>invokeProvider(route,key,input,document,session && !row.cloudDirty ? session : null,"logic"),raw=>parseBehaviorResponse(input,document,raw));
      const messageId=crypto.randomUUID();
      chat={...chat,messages:[...chat.messages,{id:messageId,role:"assistant",content:[result.plan.summary,result.plan.unsupportedReason].filter(Boolean).join("\n\n"),provider:result.route.name || result.route.providerId}],updatedAt:new Date().toISOString()};
      await save(chat);setProposal({messageId,plan:result.plan});
    } catch(cause) {setError(cause instanceof Error && cause.message==="CHAT_FULL"?"This chat is full. Start a new chat to continue.":cause instanceof Error && ["QuotaExceededError","UnknownError"].includes(cause.name)?"Chat couldn’t be saved. Check device storage and try again.":assemblyError(cause));} finally {setBusy(false);}
  }
  async function apply() {
    if(!proposal || !active)return;
    setBusy(true);setError(null);
    try {
      await useProjectStore.getState().applyTransaction(current=>{if(current.id!==document.id || current.metadata.updatedAt!==proposal.plan.revision)throw new Error("STALE_PROJECT");return proposal.plan.commands;}, "Updated behavior with Kinetable");
      setProposal(null);
      await save({...active,messages:[...active.messages,{id:crypto.randomUUID(),role:"assistant",content:"Applied to your circuit. You can review the rules in Manual and undo the change there."}],updatedAt:new Date().toISOString()});
    }catch(cause){setError(assemblyError(cause));}finally{setBusy(false);}
  }
  return <section className="behavior-assistant behavior-chat" aria-label="AI behavior assistance">
    <div className="chat-toolbar"><details className="chat-history"><summary>Chat history{chats.length?` (${chats.length})`:""}</summary><div>{chats.length?chats.map(chat=><button key={chat.id} disabled={busy} aria-current={activeId===chat.id?"true":undefined} onClick={e=>{void switchChat(chat);e.currentTarget.closest("details")?.removeAttribute("open");}}>{chat.title}<small>{new Date(chat.updatedAt).toLocaleDateString()}</small></button>):<p>No saved chats yet.</p>}</div></details><button disabled={busy || !loaded} onClick={()=>void newChat()}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>New chat</button></div>
    <div ref={messages} className="chat-messages" role="log" aria-label="Behavior conversation" aria-live="polite">
      {!active?.messages.length && <div className="chat-empty"><h3>What should your circuit do?</h3><p>Describe a behavior, then review the proposed rules before applying them.</p><button disabled={busy} onClick={()=>setRequest("When I press the button, show BONK and beep three times.")}>Try a button response</button></div>}
      {active?.messages.map(message=><article key={message.id} className="chat-message" data-role={message.role}><span className="visually-hidden">{message.role==="user"?"You":"Kinetable"}</span>{message.provider && <small>{message.provider}</small>}<p>{message.content}</p>{proposal?.messageId===message.id && proposal.plan.status==="supported" && <div className="ai-change-preview"><ul>{proposal.plan.commands.map((c,index)=><li key={index}>{c.type==="logic.rule.add" || c.type==="logic.rule.update" ? `${c.type==="logic.rule.add"?"Add":"Update"}: ${behaviorSentence(c.rule,document)}` : c.type==="logic.rule.remove" ? `Remove: ${document.logic.find(r=>r.id===c.id)?behaviorSentence(document.logic.find(r=>r.id===c.id)!,document):"Missing behavior"}` : ""}</li>)}</ul><button className="button" disabled={busy} onClick={()=>void apply()}>Apply</button><button disabled={busy} onClick={()=>setProposal(null)}>Dismiss</button></div>}</article>)}
      {busy && <p className="chat-working" role="status">Checking behavior…</p>}
    </div>
    <form className="chat-composer" onSubmit={e=>{e.preventDefault();void propose();}}><label className="visually-hidden" htmlFor="behavior-request">Message Kinetable</label><textarea id="behavior-request" disabled={busy || !loaded} rows={2} maxLength={500} placeholder="Describe what should happen…" value={request} onChange={e=>setRequest(e.target.value)} onKeyDown={e=>{if(e.key==="Enter" && !e.shiftKey && !e.nativeEvent.isComposing){e.preventDefault();void propose();}}} /><div className="chat-composer-actions"><label className="visually-hidden" htmlFor="behavior-provider">Chat provider</label><select id="behavior-provider" disabled={busy} value={providerId} onChange={e=>setProviderId(e.target.value)}><option value="">{routes.length?"Automatic provider":"No provider connected"}</option>{routes.map(route=><option key={route.id} value={route.id}>{route.name || route.providerId}{route.modelId?` · ${route.modelId}`:""}</option>)}</select><Link to="/settings/providers" aria-label="Manage chat providers">Providers</Link><button className="button chat-send" type="submit" disabled={busy || !loaded || !routes.length || !request.trim()} aria-label="Send message"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10 5-5 5 5M10 5v11" /></svg></button></div>{error && <p role="alert">{error}</p>}{!routes.length && <p>Connect a provider to chat. Manual works without AI.</p>}<small>Chats are saved on this device.</small></form>
  </section>;
}
