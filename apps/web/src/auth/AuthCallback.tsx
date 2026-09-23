import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AppShell } from "../app/AppShell";
import { getSupabaseClient } from "../backend/supabaseClient";
import { safeDestination, useAuthStore } from "./authStore";
import { syncProfile } from "./AuthBoundary";

// React StrictMode may mount an effect twice; a one-time auth code must only be exchanged once.
let callback: { key: string; result: Promise<void> } | undefined;
export function completeCallback(params: URLSearchParams): Promise<void> {
  const key = params.toString();
  if (callback?.key === key) return callback.result;
  const result = (async () => {
    const client = getSupabaseClient();
    if (!client || params.has("error")) throw new Error("This sign-in link is invalid or has expired. Request a new one.");
    const code = params.get("code");
    const token = params.get("token_hash");
    if (!code && !token) throw new Error("This sign-in link is incomplete. Request a new one.");
    const response = code ? await client.auth.exchangeCodeForSession(code) : await client.auth.verifyOtp({ token_hash: token!, type: "email" });
    if (response.error || !response.data.session) throw new Error("This sign-in link is invalid or has expired. Request a new one.");
    useAuthStore.setState({ session: response.data.session, resolved: true });
    await syncProfile();
  })();
  callback = { key, result };
  return result;
}
export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void completeCallback(params).then(() => { if (active) navigate(safeDestination(params.get("next")), { replace: true }); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Sign-in couldn’t finish."); });
    return () => { active = false; };
  }, [params, navigate]);
  return <AppShell title="Opening your table"><main id="app-main" className="route-loading"><h1>{error ? "Let’s try that again." : "Bringing your table with you…"}</h1><p role={error ? "alert" : "status"}>{error ?? "Finishing sign-in."}</p>{error && <Link to="/auth" className="button">Back to sign in</Link>}<Link to="/table">Continue to your local table</Link></main></AppShell>;
}
