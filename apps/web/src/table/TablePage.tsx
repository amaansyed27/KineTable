import { lazy, Suspense } from "react";
import { Link, Navigate } from "react-router";
import { AppShell, ProfileGate } from "../app/AppShell";
import { getBoard } from "../hardware/boards";
import { useProfileStore } from "../state/profileStore";
const BoardStage = lazy(() => import("../spatial/BoardStage"));
function ReadyTable() {
  const profile = useProfileStore(s => s.profile);
  const board = getBoard(profile?.primaryBoardId);
  if (!profile?.setupCompleted || !board) return <Navigate to="/start" replace />;
  return <main id="app-main" className="ready-table" data-board-id={board.id}>
    <div className="table-intro"><p className="eyebrow">A little possibility, all yours.</p><h1>Your table is ready.</h1></div>
    <div className="table-board" role="img" aria-label={`${board.name} on your table`}><Suspense fallback={<p className="scene-fallback">Placing your board…</p>}><BoardStage selected={board.id} single /></Suspense></div>
    <div className="table-caption"><p>{board.name}</p><span>Saved on this device.</span><Link to="/start">Change board <span aria-hidden="true">↗</span></Link></div>
  </main>;
}
export default function TablePage() { return <AppShell title="Your table"><ProfileGate><ReadyTable /></ProfileGate></AppShell>; }
