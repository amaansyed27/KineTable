import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { AppShell } from "./AppShell";

export function SettingsLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <AppShell title={title}><main id="app-main" className="settings-layout">
    <nav className="settings-nav" aria-label="Settings"><h2>Settings</h2>
      <NavLink to="/settings/account">Account</NavLink>
      <NavLink to="/settings/appearance">Appearance</NavLink>
      <NavLink to="/settings/providers">AI providers</NavLink>
    </nav>
    <section className="settings-content"><header className="settings-heading"><h1>{title}</h1><p>{description}</p></header>{children}</section>
  </main></AppShell>;
}
