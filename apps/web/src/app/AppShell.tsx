import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";
import { AccountControl } from "../auth/AccountControl";
import { useProfileStore } from "../state/profileStore";
export function AppShell({ children, title, tableNav = false }: { children: ReactNode; title: string; tableNav?: boolean }) {
  useEffect(() => { document.title = `${title} · Kinetable`; }, [title]);
  return <div className="product-app"><a className="skip-link" href="#app-main">Skip to your table</a>
    <header className="app-header"><Link className="wordmark" to="/" aria-label="Kinetable home">kinetable<span className="brand-dot" /></Link>{tableNav && <nav aria-label="Application"><Link className="table-nav-current" to="/table" aria-current="page">Table</Link></nav>}<AccountControl /></header>
    {children}
  </div>;
}
export function ProfileGate({ children }: { children: ReactNode }) {
  const hydrated = useProfileStore(s => s.hydrated);
  const error = useProfileStore(s => s.error);
  const hydrate = useProfileStore(s => s.hydrate);
  useEffect(() => { void hydrate(); }, [hydrate]);
  if (!hydrated) return <main id="app-main" className="route-loading"><p role={error ? "alert" : "status"}>{error ?? "Opening your table…"}</p>{error && <button className="button" onClick={() => void hydrate()}>Try again</button>}</main>;
  return children;
}
