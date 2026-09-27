import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ signUp: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), exchangeCodeForSession: vi.fn(), load: vi.fn(), save: vi.fn() }));
vi.mock("../backend/supabaseClient", () => ({ cloudConfigured: true, getSupabaseClient: () => ({ auth: mocks }) }));
vi.mock("../persistence/cloudProfileRepository", async importOriginal => ({ ...await importOriginal<object>(), cloudProfileRepository: { load: mocks.load, save: mocks.save } }));
import { authActions, safeDestination, useAuthStore } from "./authStore";
import { syncProfile } from "./AuthBoundary";
import { completeCallback } from "./AuthCallback";
import { useProfileStore } from "../state/profileStore";
import { profileRepository } from "../persistence/profileRepository";
import { reconcileProfile, validateCloudProfile } from "../persistence/cloudProfileRepository";
const session = { user: { id: "user-a" }, access_token: "test-token" } as Session;
const timestamp = "2026-09-23T00:00:00Z";
const local = { primaryBoardId: "esp32-dev-module" as const, setupCompleted: true, updatedAt: timestamp };
const cloud = { id: "user-a", display_name: null, primary_board_id: "raspberry-pi-pico", setup_completed: true, created_at: timestamp, updated_at: timestamp };
beforeEach(() => {
 vi.resetAllMocks();
 useAuthStore.setState({ session, resolved: true, syncStatus: "idle", error: null });
 useProfileStore.setState({ profile: local, hydrated: true, saving: false, error: null });
 mocks.save.mockImplementation(async value => ({ ...cloud, ...value }));
 mocks.signOut.mockResolvedValue({ error: null });
});
it("validates credentials and uses real SDK password methods", async () => {
 await expect(authActions.password("invalid", "password123", "signup")).rejects.toThrow("valid email");
 await expect(authActions.password("a@example.com", "short", "signup")).rejects.toThrow("8 characters");
 expect(mocks.signUp).not.toHaveBeenCalled();
 mocks.signUp.mockResolvedValue({ data: { session }, error: null });
 await authActions.password("a@example.com", "password123", "signup");
 expect(mocks.signUp).toHaveBeenCalledWith({ email: "a@example.com", password: "password123" });
 mocks.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
 await authActions.password("a@example.com", "password123", "signin");
 expect(useAuthStore.getState().session).toBe(session);
 mocks.signInWithPassword.mockResolvedValue({ data: {}, error: { message: "bad credentials" } });
 await expect(authActions.password("a@example.com", "bad", "signin")).rejects.toThrow("Check your email");
});
it("uploads meaningful guest setup and persists cloud ownership", async () => {
 mocks.load.mockResolvedValue(null);
 await syncProfile();
 expect(mocks.save).toHaveBeenCalledWith({ primary_board_id: "esp32-dev-module", setup_completed: true }, "test-token");
 expect((await profileRepository.load())?.cloudUserId).toBe("user-a");
 expect(useAuthStore.getState().syncStatus).toBe("synced");
});
it("prefers an existing cloud board on sign-in, with deterministic completion", async () => {
 mocks.load.mockResolvedValue({ ...cloud, setup_completed: false });
 await syncProfile();
 expect(useProfileStore.getState().profile).toMatchObject({ primaryBoardId: "raspberry-pi-pico", setupCompleted: true });
 expect(reconcileProfile({ ...local, cloudUserId: "other" }, null, "user-a")).toEqual({ primary_board_id: null, setup_completed: false });
});
it("restores a cloud board on a new device", async () => {
 useProfileStore.setState({ profile: null }); mocks.load.mockResolvedValue(cloud);
 await syncProfile();
 expect(useProfileStore.getState().profile?.primaryBoardId).toBe("raspberry-pi-pico");
});
it("keeps local state when offline, then retries pending same-account changes", async () => {
 const dirty = { ...local, cloudUserId: "user-a", cloudDirty: true };
 useProfileStore.setState({ profile: dirty }); mocks.load.mockRejectedValue(new Error("offline"));
 await syncProfile(); expect(useProfileStore.getState().profile).toBe(dirty);
 expect(useAuthStore.getState().syncStatus).toBe("offline");
 mocks.load.mockResolvedValue(cloud); await syncProfile();
 expect(useProfileStore.getState().profile?.primaryBoardId).toBe("esp32-dev-module");
 expect(useProfileStore.getState().profile?.cloudDirty).toBe(false);
});
it("sign-out preserves the local table", async () => {
 await authActions.signOut(); expect(useAuthStore.getState().session).toBeNull();
 expect(useProfileStore.getState().profile).toBe(local);
});
it("rejects malformed cloud records and external redirect destinations", () => {
 expect(() => validateCloudProfile({ ...cloud, primary_board_id: "unknown" })).toThrow();
 expect(() => validateCloudProfile({ ...cloud, updated_at: "bad" })).toThrow();
 expect(safeDestination("https://evil.example")).toBe("/home");
 expect(safeDestination("/start")).toBe("/start");
});
it("handles invalid callbacks and exchanges valid codes only once", async () => {
 await expect(completeCallback(new URLSearchParams("error=expired"))).rejects.toThrow("expired");
 mocks.exchangeCodeForSession.mockResolvedValue({ data: { session }, error: null }); mocks.load.mockResolvedValue(cloud);
 const params = new URLSearchParams("code=test-code");
 await Promise.all([completeCallback(params), completeCallback(params)]);
 expect(mocks.exchangeCodeForSession).toHaveBeenCalledTimes(1);
});
