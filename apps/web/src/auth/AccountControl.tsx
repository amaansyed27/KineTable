import { useState } from "react";
import { Link } from "react-router";
import { authActions, useAuthStore } from "./authStore";
import { syncProfile } from "./AuthBoundary";
import { useProjectStore } from "../state/projectStore";
export function AccountControl() {
  const session = useAuthStore(s => s.session);
  const status = useAuthStore(s => s.syncStatus);
  const projectStatus = useProjectStore(s => s.status);
  const syncProject = useProjectStore(s => s.sync);
  const [error, setError] = useState<string | null>(null);
  if (!session) return <Link className="account-control" to="/auth">Sign in</Link>;
  return <details className="account-control"><summary>Account</summary><div className="account-menu"><p>Signed in as<br /><strong>{session.user.email}</strong></p><p role="status">{status === "offline" || projectStatus === "offline" ? "Saved here. Cloud sync is unavailable." : status === "syncing" || projectStatus === "syncing" ? "Syncing your table…" : status === "synced" && projectStatus === "synced" ? "Your table is synced." : "Using this device’s table."}</p>{(status === "offline" || projectStatus === "offline") && <button onClick={() => { void syncProfile(); void syncProject(); }}>Retry sync</button>}<button onClick={() => { void authActions.signOut().catch(cause => setError(cause.message)); }}>Sign out</button>{error && <p role="alert">{error}</p>}</div></details>;
}
