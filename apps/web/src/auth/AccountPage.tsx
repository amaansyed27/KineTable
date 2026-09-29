import { useState } from "react";
import { Link } from "react-router";
import { SettingsLayout } from "../app/SettingsLayout";
import { authActions, useAuthStore } from "./authStore";
import { useProjectStore } from "../state/projectStore";
import { syncProfile } from "./AuthBoundary";
import { useWorkspaceSync } from "../sync/workspaceSyncState";
import { syncInventory } from "../sync/inventorySync";

export default function AccountPage() {
  const session = useAuthStore(s => s.session);
  const workspace = useWorkspaceSync();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const offline = workspace === "Saved on this device" || workspace === "Needs attention";
  const name = typeof session?.user.user_metadata?.full_name === "string" ? session.user.user_metadata.full_name : session?.user.email?.split("@")[0] || "Guest workspace";
  async function signOut() { setBusy(true); try { await authActions.signOut(); } catch { setError("Couldn’t sign out. Try again."); } finally { setBusy(false); } }
  return <SettingsLayout title="Account" description="Your identity, your projects, your device.">
    <div className="account-settings-grid"><section className="settings-card account-profile">
      <span className="profile-monogram" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><div><h2>{name}</h2><p>{session?.user.email || "Your projects stay on this device."}</p></div>
      <div className="account-profile-actions">{session ? <button disabled={busy} onClick={() => void signOut()}>{busy ? "Signing out…" : "Sign out"}</button> : <><Link className="button" to="/auth?next=/settings/account">Sign in</Link><Link to="/auth?mode=signup&next=/settings/account">Create account →</Link></>}</div>
    </section><section className="settings-card"><h2>Workspace storage</h2><p className="account-storage-status" role="status">{workspace}</p><p>{session ? workspace === "Conflict" ? "A project changed on another device. Review both versions in its History." : "Projects and My Parts save locally first, then sync to your account." : "You can build, save, and simulate here. Sign in to use another device."}</p><Link className="text-action" to="/projects">Open your projects →</Link>{offline && session && <button onClick={() => { void syncProfile(); void useProjectStore.getState().sync(); void syncInventory(session).catch(()=>undefined); }}>Retry sync</button>}</section></div>
    {error && <p role="alert">{error}</p>}
  </SettingsLayout>;
}
