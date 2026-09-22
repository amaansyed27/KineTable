# Slice 02 — Product entry, onboarding and backend foundation

## Journey and routes

`/` preserves the landing visuals; all three Open Kinetable links enter `/start`. `/start` presents ESP32, Raspberry Pi Pico and Arduino Uno as physical objects with semantic radio controls. Set up my table saves the profile before navigating to `/table`. The table displays the selected board and a change-board link. An incomplete/missing profile redirects `/table` to `/start` after hydration, including direct loads and refreshes.

React Router owns routing in `src/app/App.tsx`. Future route entries can be added without changing the landing. Unknown paths show a small not-found state, not a fake product page. No `/auth`, projects, parts or learning app routes are implemented.

## Hardware and interaction

Canonical definitions live in `src/hardware/boards.ts`:

| ID | Display name | Visual | Family |
| --- | --- | --- | --- |
| esp32-dev-module | ESP32 | esp32 | esp32 |
| raspberry-pi-pico | Raspberry Pi Pico | pico | rp2040 |
| arduino-uno | Arduino Uno | uno | avr |

Definitions include descriptions and minimal capability tags. They contain no electrical pin specification. The picker and table share `BoardStage`, the existing ESP32/Pico models and an original Uno illustration. Shared shadow code moved out of landing choreography without changing the landing scene. No external 3D assets were downloaded.

Native radios provide selected state, accessible names, arrow-key movement and Space selection; Enter is supported too. Focus is visible around each object's area. The whole object area is clickable. Demand-rendered R3F updates only during interaction; reduced motion applies state immediately. Selection remains usable if WebGL fails. Small screens stack the three objects vertically, preserving their scale.

## Persistence

`UI → Zustand profile store → profileRepository → Dexie / IndexedDB`.

Database `kinetable`, version 1, has one `profiles` object store with local record ID `local`. The hardware profile contains `primaryBoardId`, `setupCompleted`, and ISO `updatedAt`. Selection is saved immediately, even before finishing onboarding. Serialized writes prevent rapid switching from restoring an older selection. The route only declares the table ready after the completion write succeeds.

Hydration validates persisted metadata, and unavailable storage produces explicit retry feedback. There is no fake successful save or silent volatile fallback. Invalid/unknown persisted board data is treated as unconfigured. Changing boards clears completion until setup is confirmed again. Browser storage is origin-specific and can be removed by the browser or user; cross-device sync and cross-tab coordination are deferred.

## Backend and deployment

See [Backend foundation](BACKEND.md) for exact Supabase/Vercel setup, public environment variables, secrets boundary and deferred cloud provisioning.

- Pinned Supabase JS client with safe missing/malformed config and an internal `cloudConfigured` distinction.
- `.env.example` documents `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Vite exposes only validated public config. No auth operation runs in onboarding.
- `supabase/config.toml` and empty migrations directory establish local tooling without unused cloud tables.
- Root `vercel.json` supplies monorepo build/output and direct-route SPA fallback.

## Main files and dependencies

- `src/app/`: route entries, minimal shared header and profile hydration gate.
- `src/onboarding/` and `src/table/`: semantic board selection and real table handoff.
- `src/hardware/boards.ts`, `src/state/profileStore.ts`, `src/persistence/profileRepository.ts`: canonical metadata and local persistence boundary.
- `src/spatial/BoardStage.tsx`, `UnoModel.tsx`, `SoftShadow.tsx`: shared board presentation, new original geometry and extracted shadow utility.
- `src/backend/`, `.env.example`, `supabase/`, `vercel.json`, `.vercelignore`: optional backend and deployment configuration.
- `src/**/*.test.ts`, `e2e/onboarding.spec.ts`: integration and browser checks.

Added runtime dependencies: React Router 8.4.0, Zustand 5.0.15, Dexie 4.4.6, Supabase JS 2.116.0. Added development dependencies: Vitest 5.0.1, fake-indexeddb 6.2.5, Playwright Test 1.63.0 and Node type definitions. React/React DOM are pinned to 19.2.8, within the installed R3F peer range; `pnpm peers check` passes. Use Node 24 LTS (or 22.22+).

## Verification

Run from the repository root:

```sh
pnpm lint
pnpm test
pnpm build
pnpm --filter @kinetable/web exec playwright install chromium
pnpm test:e2e
```

If using an already installed Chrome, set `PLAYWRIGHT_CHANNEL=chrome` for `pnpm test:e2e`. `E2E_BASE_URL` targets an existing local/preview deployment; otherwise the suite starts a production preview on port 4174. Browser state is isolated per test. For a protected preview, `E2E_STORAGE_STATE` can point to an ignored Playwright storage-state file containing its access cookie; never commit that file.

Automated coverage includes the original choreography test; real IndexedDB repository/store integration with fake-indexeddb; rapid selection changes, hydration, validation and failure paths; missing/invalid/public Supabase configuration; and full browser journeys for all three boards, reload, history, direct routes, keyboard, reduced motion, WebGL fallback and responsive overflow.

### Results — 2026-09-23

- `pnpm lint`, `pnpm test` (one choreography test and eight Vitest checks), `pnpm build`, and `pnpm peers check` pass.
- Four production-browser tests pass locally. All four also pass against the protected Vercel preview; one deployed navigation initially stalled downloading assets and passed when rerun.
- A build with a deliberately invalid secret-like test key omitted that value from browser output, and all four browser tests still passed in local-only mode.
- Direct deployed `/`, `/start`, and `/table` requests return HTTP 200. Fresh `/table` redirects in the app; completed `/table` survives reload.
- Visually inspected onboarding at 390×844, 768×1024, 1440×900, 1600×1000 and 1920×1080. Inspected ESP32/Pico/Uno switching, desktop/mobile table views, reduced motion, back/forward/refresh and the preserved landing hero. No horizontal overflow or uncaught application errors were captured in the normal journeys.
- Original Uno scale was reduced after it crowded its label; inactive descriptions retain readable contrast. There are no board cards or additional product features.
- Screenshots and local QA scripts are under ignored `output/playwright/slice02-*`. Authentication state used to access the protected preview is ignored and is not committed.

### Deployment

[Slice 02 preview](https://kinetable-kzipmg6is-amaan-syeds-projects.vercel.app) — **READY**, preview target, Vite, built from this slice's working tree before the documentation commit. Vercel authentication protection remains enabled. Project `kinetable` is connected to `amaansyed27/KineTable` for Git deployments. No production deployment was promoted.

The initial remote build failed because the root script picked a different global pnpm; the filtered Corepack build command fixed it. `.vercelignore` now limits uploads to source/configuration assets. Hosted Supabase is deliberately unconfigured: the SDK and safe configuration boundary are implemented and tested, but no remote database connection is claimed.

## Deferred and known limits

No auth, cloud sync, project creation, AI, electrical simulation, wiring editor, board detection, flashing or inventory backend was added. All three selected boards and local persistence are real; the models' physical details remain illustrative rather than dimension/pin-verified.

The existing large Three.js shared chunk warning remains. Local browser checks use Chromium/Chrome, not physical devices, Firefox or Safari. No hosted Supabase project or local Docker database is running. This does not gate the local onboarding journey or imply a successful cloud connection.
