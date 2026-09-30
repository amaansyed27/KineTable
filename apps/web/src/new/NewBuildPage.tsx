import { lazy, Suspense } from "react";
import { Link, Navigate } from "react-router";
import { AppShell, ProfileGate } from "../app/AppShell";
import { getBoard } from "../hardware/boards";
import { useProfileStore } from "../state/profileStore";
import { ProjectIntent } from "./ProjectIntent";
const BoardStage = lazy(() => import("../spatial/BoardStage"));
function ReadyNewBuild() {
  const profile = useProfileStore(s => s.profile);
  const board = getBoard(profile?.primaryBoardId);
  if (!profile?.setupCompleted || !board) return <Navigate to="/start" replace />;
  return <main id="app-main" className="new-build">
    <section className="new-build-editor"><Link className="new-build-back" to="/projects">← Projects</Link><ProjectIntent explicit /></section>
    <aside className="new-build-scene" aria-label={`${board.name} is your primary board`}>
      <div className="new-build-board"><Suspense fallback={<p className="scene-fallback">Placing your board…</p>}><BoardStage selected={board.id} single /></Suspense></div>
      <div className="new-build-scene-foot"><span>{board.name}<small>YOUR PRIMARY BOARD</small></span></div>
    </aside>
  </main>;
}
export default function NewBuildPage() { return <AppShell title="New project"><ProfileGate><ReadyNewBuild /></ProfileGate></AppShell>; }
