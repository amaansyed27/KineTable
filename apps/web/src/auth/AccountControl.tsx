import { useState } from "react";
import { Link } from "react-router";
import { authActions, useAuthStore } from "./authStore";
import { syncProfile } from "./AuthBoundary";
export function AccountControl() {
  const session = useAuthStore(s => s.session);
  const status = useAuthStore(s => s.syncStatus);
  const [error, setError] = useState<string | null>(null);
  if (!session) return <Link className="account-control" to="/auth">Sign in</Link>;
  return <details className="account-control"><summary>Account</summary><div className="account-menu"><p>Signed in as<br /><strong>{session.user.email}</strong></p><p role="status">{status === "synced" ? "Your table is synced." : status === "offline" ? "Saved here. Cloud sync is unavailable." : status === "idle" ? "Using this device’s table." : "Syncing your table…"}</p>{status === "offline" && <button onClick={() => void syncProfile()}>Retry sync</button>}<button onClick={() => { void authActions.signOut().catch(cause => setError(cause.message)); }}>Sign out</button>{error && <p role="alert">{error}</p>}</div></details>;
}
