import { Link } from "react-router";
import { AppShell } from "./AppShell";
import { useAppearance, type Theme } from "./appearance";
export function SettingsNav() { return <nav className="settings-nav" aria-label="Settings"><h2>Settings</h2><Link to="/auth">Account</Link><Link to="/settings/appearance">Appearance</Link><Link to="/settings/providers">AI providers</Link></nav>; }
export default function AppearancePage() {
  const { theme, setTheme, error } = useAppearance();
  return <AppShell title="Appearance"><main id="app-main" className="settings-layout"><SettingsNav /><section className="appearance-settings"><h1>Appearance</h1><h2>Theme</h2><div className="theme-options">{(["system","light","dark"] as Theme[]).map(value => <button key={value} aria-label={value[0].toUpperCase()+value.slice(1)} aria-pressed={theme === value} onClick={() => setTheme(value)}><span aria-hidden="true" className={`theme-preview ${value}`}><i /><i /><i />{theme === value && <b>✓</b>}</span>{value[0].toUpperCase()+value.slice(1)}</button>)}</div><p>{theme === "system" ? "Follows your device’s appearance." : `A calm ${theme} workbench.`}</p>{error && <p role="status">{error}</p>}</section></main></AppShell>;
}
