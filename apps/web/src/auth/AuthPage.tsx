import { useState, type FormEvent } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
import { AppShell } from "../app/AppShell";
import { cloudConfigured } from "../backend/supabaseClient";
import { syncProfile } from "./AuthBoundary";
import { authActions, providerEnabled, safeDestination, useAuthStore } from "./authStore";

export default function AuthPage() {
  const [params] = useSearchParams();
  const destination = safeDestination(params.get("next"));
  const session = useAuthStore(s => s.session);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await authActions.password(email, password, mode); setPassword(""); await syncProfile(); navigate(destination, { replace: true }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-in couldn’t finish."); }
    finally { setBusy(false); }
  }
  async function provider(name: "google" | "github") {
    setBusy(true); setError(null);
    try { await authActions.oauth(name, destination); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-in couldn’t finish."); setBusy(false); }
  }
  return <AppShell title="Sign in"><main id="app-main" className="auth-page" data-cloud-configured={cloudConfigured}>
    <div className="auth-intro"><p className="eyebrow">A table of your own.</p><h1>Keep your table<br />with you.</h1><p>Sign in to keep your board and setup<br className="desktop-break" /> with you across devices.</p><span className="auth-detail" aria-hidden="true">01 — YOUR TABLE, ANYWHERE</span></div>
    <div className="auth-actions">
      {session ? <><h2>You’re signed in.</h2><p>{session.user.email}</p><Link className="button" to={destination}>Return to your table <span>↗</span></Link></> : <>
          <div className="provider-actions">{(["google", "github"] as const).filter(name => providerEnabled[name]).map(name => <button key={name} className="provider-button" disabled={busy} onClick={() => void provider(name)}>Continue with {name === "google" ? "Google" : "GitHub"}<span aria-hidden="true">↗</span></button>)}</div>
          <form onSubmit={submit}>
            <label htmlFor="auth-email">Your email</label><input id="auth-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy || !cloudConfigured} />
            <label htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : undefined} maxLength={256} value={password} onChange={event => setPassword(event.target.value)} disabled={busy || !cloudConfigured} />
            {mode === "signup" && <p className="auth-note">At least 8 characters. Email verification and password reset aren’t available yet.</p>}
            <button className="button" disabled={busy || !cloudConfigured}>{busy ? "Opening your table…" : mode === "signup" ? "Create account" : "Sign in"}<span aria-hidden="true">↗</span></button>
          </form>
          <button className="text-action" disabled={busy} onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}>{mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}</button>
        {!cloudConfigured && <p role="status">Cloud sign-in isn’t configured here. Your local table still works.</p>}
        {error && <p role="alert" className="storage-error">{error}</p>}
        <Link className="guest-link" to={destination}>Continue without an account <span aria-hidden="true">→</span></Link>
      </>}
    </div>
  </main></AppShell>;
}
