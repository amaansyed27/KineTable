import { lazy, Suspense, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { Link, Navigate, useNavigate } from "react-router";
import { AppShell, ProfileGate } from "../app/AppShell";
import { getBoard } from "../hardware/boards";
import { useProfileStore } from "../state/profileStore";
import { useAuthStore } from "../auth/authStore";
import { useProjectStore } from "../state/projectStore";
import { localProjectRepository, type LocalProject } from "../persistence/localProjectRepository";
import { migrateProject } from "./v4";
import { starterRow } from "./projectCreation";
import { bonkProject } from "./starters";
import { endpointWorld } from "../spatial/anchors";
import { getDefinition } from "../component-library/catalog";
const WorkbenchStage = lazy(() => import("../spatial/WorkbenchStage"));
function useProjects() {
  const profile = useProfileStore(s => s.profile), session = useAuthStore(s => s.session);
  const [rows, setRows] = useState<LocalProject[]>([]), [error,setError] = useState<string | null>(null), [loaded,setLoaded] = useState(false);
  useEffect(() => {
    const subscription = liveQuery(() => localProjectRepository.list()).subscribe({ next: value => { setRows(value.filter(row => !session || !row.cloudUserId || row.cloudUserId === session.user.id).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))); setLoaded(true); }, error: () => { setError("We couldn’t read your saved projects. Allow browser storage and reload."); setLoaded(true); } });
    const board = getBoard(profile?.primaryBoardId);
    if (board && profile?.setupCompleted) void useProjectStore.getState().open(board.id, session);
    return () => subscription.unsubscribe();
  }, [profile?.primaryBoardId,profile?.setupCompleted,session]);
  return { rows, error, loaded, profile };
}
function summary(row: LocalProject) { const document = migrateProject(row.document); const count = document.components.filter(c => c.kind === "component").length; return `${getBoard(document.boardIds[0])?.name ?? "Board"}${count ? ` · ${count} parts` : ""}`; }
function opened(id: string) { try { const time = localStorage.getItem(`kinetable.opened.${id}`); return time ? `Opened ${new Date(time).toLocaleDateString(undefined,{month:"short",day:"numeric"})}` : "Saved on this device"; } catch { return "Saved on this device"; } }
export function ProjectPreview({ row }: { row: LocalProject }) {
  const project = migrateProject(row.document);
  return <svg className="project-preview" viewBox="-5 -3.4 10 6.8" role="img" aria-label={`${row.name} circuit preview`}><g transform="scale(1,-1)">{project.wires.map(w => { const a=endpointWorld(project,w.from), b=endpointWorld(project,w.to); return <path key={w.id} d={`M ${a.x} ${a.y} Q ${(a.x+b.x)/2} ${(a.y+b.y)/2+.2} ${b.x} ${b.y}`} fill="none" stroke={w.color === "red" ? "#a44537" : w.color === "black" ? "#55574f" : "#527b85"} strokeWidth=".035" />; })}{project.components.map(c => { const t=project.layout.entities[c.id], d=getDefinition(c.definitionId)!; return <g key={c.id} transform={`translate(${t.position[0]} ${t.position[1]}) rotate(${t.rotation[2]*180/Math.PI}) scale(${t.scale[0]})`}>{c.kind === "breadboard" ? <><rect x="-1.1" y="-1.5" width="2.2" height="3" rx=".08" fill="#e4e1d7" stroke="#b8b4aa" strokeWidth=".02" /><path d="M 0 -1.4 V 1.4" stroke="#b5b2a8" strokeWidth=".09" /></> : c.kind === "board" ? <><rect x="-.56" y="-1.1" width="1.12" height="2.2" rx=".06" fill="#263c34" /><rect x="-.38" y="-.45" width=".76" height="1" fill="#abb0a6" /></> : d.visualId === "resistor" ? <rect x="-.45" y="-.09" width=".9" height=".18" rx=".05" fill="#c6a977" /> : d.visualId === "led" ? <circle r=".17" fill="#c95839" /> : d.visualId === "button" ? <><rect x="-.29" y="-.25" width=".58" height=".5" fill="#b7b9ad" /><circle r=".13" fill="#333b35" /></> : <><rect x="-.46" y="-.3" width=".92" height=".6" rx=".04" fill={d.visualId === "oled" ? "#22434b" : "#2d5142"} /><rect x="-.32" y="-.2" width=".64" height=".38" rx=".06" fill="#202b2b" /></>}</g>; })}</g></svg>;
}
function ProjectsContent({ home = false }: { home?: boolean }) {
  const { rows,error,loaded,profile } = useProjects(); const navigate = useNavigate();
  const active = useProjectStore(s => s.project), tryBonk = useProjectStore(s => s.tryBonk);
  const [busy,setBusy]=useState(false), [failure,setFailure]=useState<string | null>(null), [search,setSearch]=useState("");
  const [demo] = useState(() => { const row=starterRow("esp32-dev-module"); const document=bonkProject({...migrateProject(row.document),name:"BONK"}); return {...row,name:"BONK",document}; });
  if (!profile?.setupCompleted) return <Navigate to="/start" replace />;
  const projects = rows.filter(row => row.name !== "First table" || row.document.components.length > 1 || row.document.intent);
  const current = projects.find(row => row.id === active?.id) ?? projects[0];
  async function starter() { setBusy(true); setFailure(null); try { const document = await tryBonk(); navigate(`/projects/${document.id}`); } catch { setFailure("We couldn’t save BONK. Allow browser storage and try again."); } finally { setBusy(false); } }
  const preview = current ?? demo;
  return <main id="app-main" className={home ? "home-page" : "projects-page"}>
    {(error || failure) && <p role="alert">{error || failure}</p>}{!loaded && <p role="status">Opening your projects…</p>}
    {home ? <><section className="home-hero"><div className="home-copy"><h1>{current ? `Good ${new Date().getHours()<12 ? "morning" : new Date().getHours()<18 ? "afternoon" : "evening"}.` : "Ready to make something?"}</h1>{current ? <><p className="folio-kicker">Continue building</p><h2>{current.name}</h2><p>{summary(current)}</p><p className="folio-muted">Edited {new Date(current.updatedAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</p><Link className="button" to={`/projects/${current.id}`}>Open project <span>→</span></Link></> : <><p className="folio-kicker">Starting board</p><h2>{getBoard(profile.primaryBoardId)?.name}</h2><p>You can build virtually. Physical hardware isn’t required.</p><h2 className="home-try-title">Try BONK</h2><p>Your first button, display, LED and buzzer build.<br />No AI provider required.</p><button className="button" disabled={busy} onClick={() => void starter()}>Try BONK <span>→</span></button></>}</div><div className="home-hardware" aria-label={`${preview.name} hardware`}><Suspense fallback={<ProjectPreview row={preview} />}><WorkbenchStage preview project={migrateProject(preview.document)} selectedId={null} selectedWireId={null} selectedEndpointKey={null} highlightedKeys={[]} wireSource={null} wiring={false} onSelect={() => undefined} onEndpoint={() => undefined} onWire={() => undefined} onMove={() => undefined} cameraAction={null} /></Suspense></div></section><section className="home-launch"><div><h2>{current ? "" : "Start a project"}</h2>{!current && <p>Describe what you want to make.</p>}<Link className="button secondary" to="/projects/new">+ {current ? "New project" : "Start a project"}</Link></div>{current && <div><p className="folio-kicker">Try Kinetable</p><h3>BONK</h3><p>A guided button, display, LED and buzzer build.</p><button className="text-action" disabled={busy} onClick={() => void starter()}>Try BONK →</button></div>}</section>{projects.length>1 && <section className="recent-projects"><h2>Recent projects</h2>{projects.filter(row=>row.id!==current?.id).slice(0,3).map(row=><Link key={row.id} to={`/projects/${row.id}`}><span>▤ &nbsp; {row.name}</span><small>{summary(row)}</small><span>→</span></Link>)}</section>}</> : <><div className="projects-head"><h1>Projects</h1><label className="project-search"><span className="visually-hidden">Search projects</span><input placeholder="Search projects" value={search} onChange={e=>setSearch(e.target.value)} /></label><Link className="button" to="/projects/new">+ New project</Link></div><div className="project-folio">{rows.filter(row=>row.name.toLowerCase().includes(search.toLowerCase())).map(row=><Link key={row.id} className="project-folio-row" to={`/projects/${row.id}`}><ProjectPreview row={row} /><div><h2>{row.name}</h2><p>{summary(row)}</p><small>{opened(row.id)}</small></div><time dateTime={row.updatedAt}>Edited {new Date(row.updatedAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</time><span aria-hidden="true">→</span></Link>)}</div>{loaded && !rows.length && <div className="projects-empty"><h2>Your next idea starts here.</h2><p>Create a project or try BONK. No account or AI provider needed.</p><button className="button" onClick={()=>void starter()} disabled={busy}>Try BONK</button></div>}{rows.length>0 && !rows.some(row=>row.name.toLowerCase().includes(search.toLowerCase())) && <p>No projects match that name.</p>}</>}
  </main>;
}
export default function ProjectsPage({ home = false }: { home?: boolean }) { return <AppShell title={home ? "Home" : "Projects"}><ProfileGate><ProjectsContent home={home} /></ProfileGate></AppShell>; }
