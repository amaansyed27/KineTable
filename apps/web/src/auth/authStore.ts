import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { cloudConfigured, getSupabaseClient } from "../backend/supabaseClient";
export type SyncStatus = "idle" | "syncing" | "synced" | "offline";
export const useAuthStore = create<{
  session: Session | null; resolved: boolean; syncStatus: SyncStatus; error: string | null;
}>(() => ({ session: null, resolved: !cloudConfigured, syncStatus: "idle", error: null }));
export function safeDestination(value: string | null) { return value && (/^\/(?:home|start|table|parts|learn(?:\/[a-z-]+)?|explore(?:\/[a-z-]+)?|projects(?:\/[0-9a-f-]{36}(?:\/history)?|\/new)?|settings\/(?:appearance|providers|account))$/.test(value)) ? value : "/home"; }
export const providerEnabled = {
  google: import.meta.env.VITE_AUTH_GOOGLE_ENABLED === "true",
  github: import.meta.env.VITE_AUTH_GITHUB_ENABLED === "true",
};
export function validEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254; }
export const authActions = {
  async password(email: string, password: string, mode: "signin" | "signup") {
    if (!validEmail(email.trim())) throw new Error("Enter a valid email address.");
    if (!password || (mode === "signup" && password.length < 8)) throw new Error("Use a password with at least 8 characters.");
    const client = getSupabaseClient(); if (!client) throw new Error("Sign-in is unavailable here. You can still use your local table.");
    const credentials = { email: email.trim(), password };
    const { data, error } = mode === "signup" ? await client.auth.signUp(credentials) : await client.auth.signInWithPassword(credentials);
    if (error) throw new Error(mode === "signin" ? "Couldn’t sign in. Check your email and password, then try again." : "Couldn’t create your account. Try signing in if you already have one, or try again shortly.");
    if (!data.session) throw new Error("This account requires email confirmation. Email delivery isn’t available yet.");
    useAuthStore.setState({ session: data.session, resolved: true, syncStatus: "syncing" });
  },
  async oauth(provider: "google" | "github", destination: string) {
    const client = getSupabaseClient(); if (!client || !providerEnabled[provider]) throw new Error("This sign-in provider is not connected yet.");
    const callback = new URL("/auth/callback", window.location.origin); callback.searchParams.set("next", safeDestination(destination));
    const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: callback.toString() } });
    if (error) throw new Error("We couldn’t open sign-in. Please try again.");
  },
  async signOut() {
    const client = getSupabaseClient();
    const result = await client?.auth.signOut({ scope: "local" });
    if (result?.error) throw new Error("Sign-out couldn’t finish. Please try again.");
    useAuthStore.setState({ session: null, syncStatus: "idle", error: null });
  },
};
