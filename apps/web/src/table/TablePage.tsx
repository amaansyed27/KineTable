import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { AppShell, ProfileGate } from "../app/AppShell";
import { getBoard } from "../hardware/boards";
import { useProfileStore } from "../state/profileStore";
import { useAuthStore } from "../auth/authStore";
import { useProjectStore } from "../state/projectStore";
import { assembleProject, assemblyError, type AssemblyPhase } from "../ai/assembleProject";
import { migrateProject } from "../projects/v4";
import { getDefinition } from "../component-library/catalog";
import { starterProject } from "../projects/schema";
import { Workbench } from "./Workbench";
function ReadyTable() {
  const [phase, setPhase] = useState<AssemblyPhase | null>(null);
  const [assemblyMessage, setAssemblyMessage] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [routeLabel, setRouteLabel] = useState<string | null>(null);
  const profile = useProfileStore(s => s.profile);
  const resolved = useAuthStore(s => s.resolved);
  const syncStatus = useAuthStore(s => s.syncStatus);
  const session = useAuthStore(s => s.session);
  const ownerId = session?.user.id;
  const syncProject = useProjectStore(s => s.sync);
  const project = useProjectStore(s => s.project);
  const ready = useProjectStore(s => s.ready);
  const projectSync = useProjectStore(s => s.status);
  const error = useProjectStore(s => s.error);
  const open = useProjectStore(s => s.open);
  const board = getBoard(profile?.primaryBoardId);
  useEffect(() => { if (profile?.setupCompleted && board) void open(board.id, useAuthStore.getState().session); }, [profile?.setupCompleted, board, ownerId, open]);
  useEffect(() => { if (!ownerId) return; const retry = () => { void syncProject(); }; window.addEventListener("online", retry); return () => window.removeEventListener("online", retry); }, [ownerId, syncProject]);
  if (!profile?.setupCompleted && (!resolved || syncStatus === "syncing")) return <main id="app-main" className="route-loading" role="status">Opening your table…</main>;
  if (!profile?.setupCompleted || !board) return <Navigate to="/start" replace />;
  if (!ready || !project) return <main id="app-main" className="route-loading"><p role={error ? "alert" : "status"}>{error ?? "Opening your table…"}</p>{error && <button className="button" onClick={() => void open(board.id, session)}>Try again</button>}</main>;
  const activeBoard = getBoard(project.document.boardIds[0]) ?? board;
  const document = migrateProject(project.document);
  const assembled = document.components.length > 1;
  const partCount = document.components.filter(c => c.kind === "component").length;
  const buildSummary = [partCount ? `${partCount} ${partCount === 1 ? "part" : "parts"}` : null,
    document.components.some(c => c.kind === "breadboard") ? "breadboard" : null,
    `${document.wires.length} saved connections`].filter(Boolean).join(" · ");
  const initialBoard = starterProject(activeBoard.id).layout.entities["board-main"];
  const canAssemble = !!document.intent && !assembled && !document.wires.length && !document.terminalPlacements.length &&
    JSON.stringify(document.layout.entities["board-main"]) === JSON.stringify(initialBoard);
  async function build() {
    if (phase) return;
    setAssemblyMessage(null); setUnsupported(false);
    try {
      const plan = await assembleProject(setPhase);
      setRouteLabel(plan.routeLabel);
      if (plan.status === "unsupported") { setUnsupported(true); setAssemblyMessage(`Kinetable can’t build that reliably yet. ${plan.unsupportedReason}`); }
    } catch (failure) { setAssemblyMessage(assemblyError(failure)); }
    finally { setPhase(null); }
  }
  return <main id="app-main" className="my-table" data-board-id={activeBoard.id} data-project-id={project.id}>
    <div className="my-table-heading"><div><p className="eyebrow">YOUR TABLE <span aria-hidden="true">/</span> BUILD</p><h1>{assembled ? "Your build is on the table." : "What do you want to make?"}</h1><p>{assembled ? buildSummary : "Your board is here whenever you’re ready."}</p></div><Link className="table-new-build button" to="/new">New Build <span aria-hidden="true">↗</span></Link>
      {canAssemble && <div className="table-assembly"><button className="button" disabled={!!phase} onClick={() => void build()}>{phase ? "Building…" : "Build with Kinetable"}</button><Link className="table-provider-link" to="/settings/providers">Provider settings ↗</Link>
        <p role={assemblyMessage ? "alert" : "status"} className={unsupported ? "assembly-message unsupported" : "assembly-message"}>{phase === "planning" ? "Planning your build…" : phase === "checking" ? "Checking the connections…" : phase === "placing" ? "Putting it on the table…" : assemblyMessage}</p></div>}
    </div>
    <Workbench key={document.id} document={document} />
    <div className="table-foot"><div className="project-identity"><span className="project-identity-mark" aria-hidden="true" /><div><span className="project-overline">CURRENT PROJECT</span><strong>{project.name}</strong>{document.intent && <span className="project-intent">“{document.intent.text}”</span>}{assembled && <span className="project-parts">{document.components.filter(c => c.kind === "component").map(c => getDefinition(c.definitionId)!.name).join(" · ")}</span>}{routeLabel && <span className="project-meta">Built with {routeLabel}</span>}<span className="project-meta">Saved {new Date(project.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {projectSync === "synced" ? "On this device and your account" : projectSync === "offline" ? "On this device · cloud unavailable" : "On this device"}</span></div></div><Link className="change-board-link" to="/start">Change board <span aria-hidden="true">↗</span></Link></div>
  </main>;
}
export default function TablePage() { return <AppShell title="Your table" tableNav><ProfileGate><ReadyTable /></ProfileGate></AppShell>; }
