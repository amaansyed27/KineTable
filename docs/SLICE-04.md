# Slice 04 — My Table and persistent projects

Status: **complete**, with local, hosted Supabase and deployed preview verification on 2026-09-23.

## My Table

`/table` opens the selected physical board on a spacious work surface. The current saved project appears as a small physical identity below it. The Table link works; Projects, Parts and Learn are omitted until their slices. “What do you want to make?” is editorial copy, with no fake AI entry or New Build action. Landing, onboarding and auth retain their earlier behavior. The saved project, not React or Three.js, supplies the board definition and transform.

## Project v1

`apps/web/src/projects/schema.ts` defines and runtime-validates a JSON-serializable `KinetableProject`. It has `schemaVersion: 1`, a client-generated UUID, name, board definition IDs, stable component instance IDs, empty connections and logic, `layout.entities` transforms, and ISO creation/update metadata. V1 permits one board instance. A starter uses the `board-main` instance; `esp32-dev-module` is its definition. Unsupported versions and malformed local or cloud JSON are rejected before rendering. A future graph will extend the document through an explicit schema migration.

The first completed `/table` entry creates exactly one “First table” document when no eligible project exists. This is infrastructure, not the Slice 05 intent flow. Reopening or refreshing loads that same UUID. A deliberate onboarding board change updates the existing document, including its board instance, without replacing its saved layout. A current project is selected by recent local update time; no Projects page is implemented.

## Storage and sync

`UI → projectStore → localProjectRepository → Dexie` uses the existing `kinetable` IndexedDB database, upgraded to version 2 with a `projects` store. Each row has ID, name, schema version, document, local timestamps, optional cloud owner and dirty metadata. Guest projects stay local. Local data appears before an authenticated network reconciliation; an existing local table remains available offline and after browser restart.

Authenticated reconciliation reads owner projects from Supabase. A guest project has no cloud owner, so it is assigned to the connecting account and uploaded with its original UUID. A project carrying another account's owner ID is preserved in IndexedDB and excluded from the new account's selection and upload. No name-based merge occurs. If cloud has the selected project and local is clean, the newer server row wins. A dirty local document is never silently deleted or replaced; it is retried. If the cloud is unavailable on a first authenticated entry, the starter is created locally and marked dirty.

Only meaningful checkpoints write to cloud: starter creation, explicit board change and retries. The app does not send animation frames. Cloud writes capture the active session token and verify the account still matches before applying a response. The local project stays intact on write failure. After success, the server `updated_at` is saved as the row's authoritative sync timestamp. Automatic retry runs on browser reconnect, with a manual Account retry. There is no Realtime, collaboration or CRDT. **Simultaneous multi-device edits are not conflict-safe**; the last successful cloud write wins. Slice 15 owns project history and conflict resolution.

## Hosted database and security

The committed and hosted migration is `supabase/migrations/20260923120545_local_first_projects.sql`, matching Supabase migration history for project `eajyviksoaveunehuhpl`. `public.projects` holds UUID, owner ID, name, primary board, schema version, JSONB document, archive flag and server timestamps. Its RLS policies constrain SELECT, INSERT, UPDATE and DELETE to `auth.uid() = owner_id`. Column grants disallow client changes to owner, project ID and server timestamps. The owner defaults to `auth.uid()`; no service-role key is exposed. The cloud repository validates every returned JSON document and its relational metadata.

Hosted public API QA used two disposable password users. User A created, read and updated a project; User B saw no row and could not update it. A client owner reassignment failed. Disposable project rows were deleted after the test. The Supabase security advisor reported no projects schema/RLS finding. Its existing leaked-password-protection advisory remains; email confirmation is disabled and there is no SMTP or reset flow, so email identity is **not production-ready verification**.

## Verification

- `pnpm lint`, `pnpm test` (20 Vitest cases and one choreography check), and `pnpm build` passed. The existing large 3D chunk warning remains.
- Local Chrome Playwright: 8/8 passed, including guest onboarding, refresh, a real browser restart with the same IndexedDB profile, sign-in, guest project adoption, same-ID fresh-browser restore, offline reload, failed cloud-write preservation, and WebGL fallback.
- Visual and overflow checks covered 390×844, 768×1024, 1440×900, 1600×1000 and 1920×1080. The 390 and 1440 table captures were inspected under ignored `output/playwright/`.
- [Vercel preview](https://kinetable-wni1apew1-amaan-syeds-projects.vercel.app) is READY. Direct `/`, `/start`, `/auth` and `/table` return the application document. The protected preview passed 7/7 applicable Playwright tests with real hosted Supabase authentication and project restoration; the local browser-restart test is intentionally local-only. No production promotion was made.

To repeat hosted checks, run `node scripts/verify-hosted.mjs`, then set `KINETABLE_HOSTED_QA=1` for `pnpm test:e2e`. QA credentials and Vercel preview browser access stay in ignored `output/` files. The disposable account rows are retained for repeat QA; their project rows are cleared by the tests where practical.

## Limits

Slice 04 has no New Build, AI endpoint, wiring, simulation, project list, drag editor or collaboration. The first project contains a board only. Browser storage is origin-specific and can be cleared by the browser or user. Multi-device concurrent writes require Slice 15 versioning. Hosted password auth still has unverified email ownership and no recovery mail.
