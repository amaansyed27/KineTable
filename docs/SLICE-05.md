# Slice 05 — New Build and real project creation

Status: **complete**, including local persistence, hosted Supabase and protected Vercel preview verification on 2026-09-23.

## Experience

`/table` now opens `/new` through New Build. Direct `/new` works after onboarding and redirects to `/start` before setup. The page keeps the selected physical board visible beside a large natural-language textarea. Enter adds a newline. A locally generated project name can be edited before saving; the edited name wins. A session-scoped draft survives movement between `/table` and `/new` until creation. `Show me first` previews only the name, exact request and selected board. It shows no inferred parts, wires, logic or AI response. Keyboard flow, explicit labels, announced validation, focus on the preview heading, reduced motion and the textual WebGL fallback remain usable.

Creation returns to `/table`, where the project name, original request and existing local/cloud status appear with the same board. No hardware assembly starts.

## Project document and naming

`KinetableProject` remains `schemaVersion: 1` with optional `intent: { text: string }`. Existing v1 projects without intent load unchanged. The runtime parser requires trimmed intent of 1–500 characters, rejects control characters and extra intent keys, and validates cloud JSON before rendering. Project names remain 1–120 characters and are checked for control characters. The deterministic local title helper removes a simple leading command and title-cases the result; for example, “Make a motion alarm.” becomes “Motion Alarm” and “Show temperature on an OLED” becomes “OLED Temperature.” It makes no model request. Connections and logic remain empty and v1 still allows exactly one board. No SQL column or schema migration was needed: intent lives in the existing validated JSONB document.

## Starter and multiple projects

The first build promotes the current Slice 04 “First table” only when the whole document is pristine: runtime-valid v1, default name, no intent, the sole `board-main` board, empty connections and logic, and the exact starter position, rotation and scale. The structural rule works for existing Slice 04 documents without a new metadata field. Promotion preserves project UUID, board instance ID, board transform and `createdAt`, and changes name, intent and `updatedAt`. A changed name, intent or transform prevents promotion. The name alone is never enough.

Every later build gets a new UUID and retains earlier documents. The recent local update time selects the current project; a fresh authenticated browser selects the newest owner row by server update time. There is no Projects page or separate current-project pointer.

## Local-first and cloud

`projectStore.createBuild` validates through the domain builder, writes a complete document to the existing Dexie `projects` store, updates current state and returns without waiting for the authenticated Supabase checkpoint. A guest never needs the network. For an account, the existing owner-safe repository writes the project to `public.projects`; row ID, name, primary board and schema version must match the JSON document. Reconciliation uploads every eligible unsynced local project, so two guest builds both transfer on sign-in. Another account's local rows remain excluded. A cloud outage leaves the current build in IndexedDB with `cloudDirty: true`; reconnect or Account retry can checkpoint it later. No service-role credential is used in the client.

The hosted Kinetable project remains `eajyviksoaveunehuhpl`. Its migration history still contains only `20260922201049_cloud_profiles` and `20260923120545_local_first_projects`; Slice 05 added no migration and changed no RLS policy. The hosted security advisor found no schema/RLS finding. Its existing [leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains.

## Verification

- `pnpm lint`, `pnpm test` (26 Vitest cases and one landing choreography check), `pnpm build` and `pnpm peers check` passed.
- Local Chrome Playwright covered starter promotion, edited naming, second project retained in IndexedDB, refresh, real persistent-browser restart, offline save, keyboard-only completion, draft retention, WebGL failure, validation and responsive overflow. Hosted local browser QA used disposable accounts for two owner rows, document/relational agreement, fresh-browser restore of the newest project, User B read/update denial, and a local dirty project during cloud failure. Disposable project rows were removed afterward.
- Visual states on `/new` and the resulting `/table` were checked at 390×844, 768×1024, 1440×900, 1600×1000 and 1920×1080. No horizontal overflow or console/runtime error remained. Screenshots are ignored under `output/playwright/`.
- The protected [Vercel preview](https://kinetable-quwkz6ejr-amaan-syeds-projects.vercel.app) is READY. Direct `/`, `/start`, `/auth`, `/table` and `/new` requests returned HTTP 200. The deployed app passed 11 applicable Playwright tests, including hosted auth, New Build, cross-browser restore, RLS, offline behavior and visual layout; two local persistent-browser restart checks were intentionally skipped against the preview. Preview access state and QA credentials remain ignored.
- Rapid route changes exposed a known React Three Fiber 9.7.0 canvas teardown error. Updating the existing dependency to 9.8.0 resolved that error. Landing-to-app links now use normal document navigation to avoid an intermittent React DOM teardown error while the landing scene loads over a remote connection. Fifteen repeated deployed landing-to-auth journeys and the final deployed suite passed. Vercel preview settings remain at their original values.

## Limits

Slice 05 stores intent; it does not interpret it into electronics. AI planning, component choice, wiring, logic, simulation, inventory and the Projects page belong to later slices. Concurrent edits from two devices still use last successful cloud write. Guest documents remain local to their browser until an account adopts them. Existing password auth still has unverified email ownership and no recovery mail.
