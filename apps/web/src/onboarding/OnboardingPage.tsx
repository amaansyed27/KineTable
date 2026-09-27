import { useNavigate } from "react-router";
import { AppShell, ProfileGate } from "../app/AppShell";
import { getBoard } from "../hardware/boards";
import { useProfileStore } from "../state/profileStore";
import { BoardSelector } from "./BoardSelector";
import { useProjectStore } from "../state/projectStore";
import { useAuthStore } from "../auth/authStore";
import { useState } from "react";
export default function OnboardingPage() {
  const { profile, saving, error, completeSetup } = useProfileStore();
  const navigate = useNavigate();
  const board = getBoard(profile?.primaryBoardId);
  const setBoard = useProjectStore(s => s.setBoard);
  const session = useAuthStore(s => s.session);
  const [projectError, setProjectError] = useState<string | null>(null);
  return <AppShell title="Set up your table"><ProfileGate>
    <main id="app-main" className="onboarding-page">
      <div className="onboarding-intro"><p className="eyebrow">A place to begin</p><h1>Choose your starting board.</h1><p>You can build virtually. You don’t need the board beside you.</p></div>
      <BoardSelector />
      <div className="setup-action">
        <p className="selection-status" role="status">{board ? `${board.name} selected.` : "Pick your board to begin."}</p>
        {(error || projectError) && <p className="storage-error" role="alert">{error || projectError}</p>}
        {board && <button className="button" disabled={saving || !!error} onClick={async () => { if (await completeSetup()) { try { await setBoard(board.id, session); navigate("/home"); } catch { setProjectError("We couldn’t save your project. Please allow browser storage and try again."); } } }}>Continue with {board.name} <span aria-hidden="true">→</span></button>}
        <p className="local-note">Not sure? Start with ESP32.</p>
      </div>
    </main>
  </ProfileGate></AppShell>;
}
