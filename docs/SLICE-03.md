# Slice 03 — hosted identity and cloud profiles

Status: **complete**, including real hosted email/password signup, login, profile write/read, cross-browser restoration, and deployed preview verification.

## Scope

Preserves the landing and guest board-first journey. Adds `/auth`, `/auth/callback`, email/password signup and sign-in, a small account/sign-out control, and local-first profile synchronization. No project persistence, My Table, inventory, AI, or simulation.

The user changed authentication scope to email/password with no SMTP. Magic-link requests are not implemented. Email verification and password recovery are deferred, stated in the signup UI. Google/GitHub integrations are disabled until real provider credentials are configured.

## Hosted backend

- Project: **Kinetable** (`eajyviksoaveunehuhpl`).
- Organization: **amaansyed27's Org** (`msvzqcmyheiizflxojqz`).
- Region: Mumbai, `ap-south-1`; quoted project cost $0/month, confirmed by the user.
- URL: `https://eajyviksoaveunehuhpl.supabase.co`.
- Provisioned and migrated using the Supabase integration.
- Applied migration: `20260922201049_cloud_profiles.sql`; committed filename matches hosted migration history.
- `public.profiles`: auth-owned ID, nullable display name and canonical board ID, completion flag, server timestamps. A constraint requires a board for completed setup.
- Auth user creation triggers profile creation, with a backfill for existing users. Private trigger functions have fixed search paths and no public execute grant.
- RLS enabled. SELECT, INSERT, UPDATE and DELETE policies are owner-only; deletion has no client grant or UI. Clients cannot write IDs or timestamps.
- Hosted transaction tests verified own read/update and blocked another user's read/update, then rolled back fixtures. Security advisor: no schema/RLS findings. After password auth was activated, the advisor reports leaked-password protection disabled; see [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Local/cloud behavior

Initial reconciliation prefers a cloud board when present; otherwise imports meaningful guest setup. Completion is true if either valid source is complete and a board exists. Server `updated_at` becomes the local timestamp only after successful reconciliation. Local owner metadata prevents silently importing a previous account's profile into a new identity.

Subsequent deliberate local edits persist to IndexedDB first, then sync. Dirty metadata retains pending changes for the same identity. Writes are serialized, responses are checked against the local revision and active identity, and each request captures its authenticated token. Cloud failure preserves the local table; retry is available on reconnect and in the account menu. Sign-out preserves IndexedDB.

`AuthBoundary` is the single session lifecycle owner. UI uses auth actions and a typed cloud repository. A fresh authenticated browser waits for the initial cloud profile before deciding whether `/table` requires setup. A completed local table remains usable during network failure.

## Environment and deployment

`.env.example` documents URL, publishable key and optional OAuth flags. Vite exposes only validated public configuration. No server credential is present in source or browser configuration.

Both public Supabase variables exist in Vercel Preview and Production; both environment values were compared against the Kinetable project and match. Preview:

https://kinetable-bhdlowyul-amaan-syeds-projects.vercel.app

Vercel built successfully using the repository configuration. Automated route tests ran against the deployed application, with deployment protection access obtained through the authenticated Vercel CLI. Direct navigation/refresh, guest table, authentication page and callback errors work. Production was not promoted in this slice.

Password authentication does not depend on a callback redirect. Optional OAuth needs allowed application `/auth/callback` URLs in Supabase and the provider callback `https://eajyviksoaveunehuhpl.supabase.co/auth/v1/callback` registered with Google/GitHub. Set provider secrets only in Supabase, then enable the corresponding public feature flag and redeploy. Provider credentials are not yet configured or verified.

## Tests and QA

- `pnpm lint`: passed.
- `pnpm test`: 16 Vitest cases and 1 choreography test passed.
- `pnpm build`: passed; existing large Three.js/client bundle warning remains.
- A separate build with both Supabase variables empty passed all four guest onboarding/table Playwright flows.
- All seven Playwright tests passed against the deployed preview, including real hosted password signup/login, guest-to-cloud upload, cross-browser restore, sign-out, offline table, direct routes and refresh. The same guest/auth flows also passed locally. The keyboard test waits for lazy route readiness before tabbing.
- Responsive checks: 390×844, 768×1024, 1440×900, 1600×1000, 1920×1080.
- Desktop/mobile auth screenshots generated by the automated suite and visually reviewed. No interactive computer-use QA, per user request.
- Hosted RLS SQL assertions passed and security advisor found no schema/RLS issues; the leaked-password protection advisory is documented above.
- `e2e/hosted-auth.spec.ts` is opt-in via `KINETABLE_HOSTED_QA=1`, with disposable test account credentials in ignored `output/hosted-qa-accounts.json`; do not commit credentials or traces containing sessions.

## Hosted authentication proof and limitations

The live settings API confirmed Email enabled, signup allowed and `mailer_autoconfirm: true`. `node scripts/verify-hosted.mjs` created two disposable accounts and verified real signup, password login, authenticated profile upsert/read and blocked cross-user read/update through the public REST API. No privileged key was used. The deployed app separately created a dummy account through its signup form, uploaded an existing guest Arduino Uno setup, and restored it after login in a fresh browser context. Another account restored ESP32, switched to Pico, refreshed, signed out without losing local state and restored Pico in a separate context.

To repeat the opt-in hosted checks from the repository root (creates dummy users):

```powershell
node scripts/verify-hosted.mjs
$env:PLAYWRIGHT_CHANNEL='chrome'
$env:KINETABLE_HOSTED_QA='1'
pnpm test:e2e
```

For the deployed preview, additionally set `E2E_BASE_URL` and, if protection is enabled, `E2E_STORAGE_STATE` to an ignored Playwright state file obtained through authorized Vercel access. Credentials and protection cookies remain in ignored local QA artifacts. Dummy users use the `kinetable-qa-` email prefix and are retained for repeat testing. Passwords are generated randomly and never committed or printed.

SMTP, reset emails, verified email ownership and external OAuth credentials remain deferred per the updated scope. Google/GitHub are not claimed to work. Their exact activation steps are above and in BACKEND.md. Existing large 3D bundle warnings remain. No project persistence or My Table work was started.
