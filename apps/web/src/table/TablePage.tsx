import { lazy, Suspense, useEffect } from "react";
import { Link, Navigate } from "react-router";
import { AppShell, ProfileGate } from "../app/AppShell";
import { getBoard } from "../hardware/boards";
import { useProfileStore } from "../state/profileStore";
import { useAuthStore } from "../auth/authStore";
import { useProjectStore } from "../state/projectStore";
const BoardStage = lazy(() => import("../spatial/BoardStage"));
function ReadyTable() {
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
  const boardInstance = project.document.components.find(c => c.kind === "board" && c.definitionId === activeBoard.id);
  const transform = boardInstance && project.document.layout.entities[boardInstance.id];
  return <main id="app-main" className="my-table" data-board-id={activeBoard.id} data-project-id={project.id}>
    <div className="my-table-heading"><p className="eyebrow">YOUR TABLE <span aria-hidden="true">/</span> A PLACE TO BEGIN</p><h1>What do you want to make?</h1><p>Your board is here whenever you’re ready.</p></div>
    <section className="work-surface" aria-label="Your saved workbench">
      <div className="surface-coordinate surface-coordinate-top" aria-hidden="true">01 — YOUR WORKSPACE</div>
      <div className="surface-board" role="img" aria-label={`${activeBoard.name} on your table`}><Suspense fallback={<p className="scene-fallback">Placing your board…</p>}><BoardStage selected={activeBoard.id} single transform={transform} /></Suspense></div>
      <div className="surface-board-label"><span className="surface-label-dot" aria-hidden="true" /><span>{activeBoard.name}<small>ON YOUR TABLE</small></span></div>
      <div className="surface-coordinate surface-coordinate-bottom" aria-hidden="true">KINETABLE / 001</div>
    </section>
    <div className="table-foot"><div className="project-identity"><span className="project-identity-mark" aria-hidden="true" /><div><span className="project-overline">CURRENT PROJECT</span><strong>{project.name}</strong><span className="project-meta">Saved {new Date(project.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {projectSync === "synced" ? "On this device and your account" : projectSync === "offline" ? "On this device · cloud unavailable" : "On this device"}</span></div></div><Link className="change-board-link" to="/start">Change board <span aria-hidden="true">↗</span></Link></div>
  </main>;
}
export default function TablePage() { return <AppShell title="Your table" tableNav><ProfileGate><ReadyTable /></ProfileGate></AppShell>; }
