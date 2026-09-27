import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { authActions, useAuthStore } from "./authStore";
import { syncProfile } from "./AuthBoundary";
import { useProjectStore } from "../state/projectStore";
import { useAppearance } from "../app/appearance";
export function AccountControl() {
  const session = useAuthStore(s => s.session), status = useAuthStore(s => s.syncStatus);
  const projectStatus = useProjectStore(s => s.status), theme = useAppearance(s => s.theme);
  const [open, setOpen] = useState(false), [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const name = typeof session?.user.user_metadata?.full_name === "string" ? session.user.user_metadata.full_name : session?.user.email?.split("@")[0] || "Guest";
  const initials = session ? name.split(/[\s._-]+/).map((word: string) => word[0]).join("").slice(0,2).toUpperCase() : "G";
  const offline = status === "offline" || projectStatus === "offline";
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    window.addEventListener("pointerdown", outside); window.addEventListener("keydown", key);
    root.current?.querySelector<HTMLAnchorElement>(".account-menu a")?.focus();
    return () => { window.removeEventListener("pointerdown", outside); window.removeEventListener("keydown", key); };
  }, [open]);
  return <div className="account-control" ref={root}><button ref={trigger} className="account-avatar" aria-label={session ? "Account" : "Guest account"} aria-expanded={open} aria-controls="account-popover" onClick={() => setOpen(!open)}>{initials}</button>{open && <div id="account-popover" className="account-menu"><div className="account-identity"><span className="account-avatar">{initials}</span><div><strong>{name}</strong>{session && <small>{session.user.email}</small>}</div></div><p className="sync-label" role="status">{session ? offline ? "○ Saved here · sync unavailable" : status === "syncing" || projectStatus === "syncing" ? "○ Syncing…" : status === "synced" && projectStatus === "synced" ? "● Synced" : "○ Saved on this device" : "Saved on this device"}</p><nav onClick={() => setOpen(false)}><Link to="/settings/appearance">Appearance <span>{theme} ›</span></Link><Link to="/settings/providers">AI providers <span>›</span></Link><Link to="/auth">{session ? "Account" : "Sign in"} <span>›</span></Link>{!session && <Link to="/auth?mode=signup">Create account <span>›</span></Link>}</nav>{offline && <button onClick={() => { void syncProfile(); void useProjectStore.getState().sync(); }}>Retry sync</button>}{session && <button className="account-signout" onClick={() => void authActions.signOut().then(() => setOpen(false)).catch(cause => setError(cause.message))}>Sign out</button>}{error && <p role="alert">{error}</p>}</div>}</div>;
}
