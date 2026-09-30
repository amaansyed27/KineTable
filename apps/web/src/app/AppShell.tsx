import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { AccountControl } from "../auth/AccountControl";
import { useProfileStore } from "../state/profileStore";
import { useAuthStore } from "../auth/authStore";
export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const pathname = useLocation().pathname;
  useEffect(() => { document.title = `${title} · Kinetable`; }, [title]);
  return <div className="product-app"><a className="skip-link" href="#app-main">Skip to main content</a>
    <header className="app-header"><Link className="wordmark" to="/home" aria-label="Kinetable home">kinetable<span className="brand-dot" /></Link><nav aria-label="Application"><Link to="/home" aria-current={pathname === "/home" ? "page" : undefined}>Home</Link><Link to="/projects" aria-current={pathname.startsWith("/projects") ? "page" : undefined}>Projects</Link><Link to="/parts" aria-current={pathname === "/parts" ? "page" : undefined}>Parts</Link><Link to="/explore" aria-current={pathname.startsWith("/explore") ? "page" : undefined}>Explore</Link><Link to="/learn" aria-current={pathname.startsWith("/learn") ? "page" : undefined}>Learn</Link></nav><div className="app-header-actions"><Link className="appearance-icon" to="/settings/appearance" aria-label="Appearance">☼</Link><AccountControl /></div></header>
    {children}
  </div>;
}
export function ProfileGate({ children }: { children: ReactNode }) {
  const hydrated = useProfileStore(s => s.hydrated);
  const profile = useProfileStore(s => s.profile);
  const error = useProfileStore(s => s.error);
  const hydrate = useProfileStore(s => s.hydrate);
  const resolved = useAuthStore(s=>s.resolved), session = useAuthStore(s=>s.session), sync = useAuthStore(s=>s.syncStatus);
  useEffect(() => { void hydrate(); }, [hydrate]);
  if (!hydrated || !resolved || session && sync === "syncing" && !profile?.setupCompleted) return <main id="app-main" className="route-loading"><p role={error ? "alert" : "status"}>{error ?? "Opening your table…"}</p>{error && <button className="button" onClick={() => void hydrate()}>Try again</button>}</main>;
  return children;
}
