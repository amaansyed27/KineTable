# Kinetable Backend and Deployment

Kinetable is browser-first and local-first, but it is not frontend-only. Product slices should ship the backend required by that slice rather than leaving fake APIs or placeholder persistence behind.

## Locked platform choices

| Need | Choice |
| --- | --- |
| Web hosting / previews | Vercel |
| Frontend | React + TypeScript + Vite |
| API / AI orchestration | Vercel Functions |
| Cloud database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| 3D/project asset storage | Supabase Storage |
| Realtime/collaboration later | Supabase Realtime |
| Fast local state | Zustand |
| Local/offline persistence | IndexedDB + Dexie |
| Heavy firmware compilation later | isolated container worker (Cloud Run/Railway/Fly-style service) |
| Browser hardware | Web Serial / WebUSB where supported |
| Native fallback later | Tauri + Rust bridge |

## Runtime shape

```text
                       VERCEL
                          │
                    Kinetable Web
                 React + R3F + Vite
                          │
             ┌────────────┴────────────┐
             │                         │
          Supabase                Vercel APIs
             │                         │
   Postgres/Auth/Storage          AI orchestration
             │                    protected server keys
             │                         │
             └────────────┬────────────┘
                          │
                    Local runtime
                 IndexedDB + Zustand
                          │
                 Web Serial / WebUSB
                          │
               ESP32 / Pico / Arduino
```

## Local-first rule

High-frequency workbench actions must never require a network round trip.

Examples:

- dragging or rotating parts;
- selecting pins;
- editing visual logic;
- simulation state;
- temporary workbench layout.

These update local state immediately and persist to IndexedDB. Cloud sync happens at deliberate boundaries such as project save, debounced checkpoints, version creation, inventory changes, or account sync.

## Cloud data model

Relational entities (`profiles` and `projects` are implemented; the rest are planned):

```text
profiles
hardware_inventory
projects
project_versions
component_catalog
board_catalog
```

The full workbench/project graph should initially be stored as a versioned JSONB document rather than being prematurely normalized into dozens of tables.

Illustrative Slice 05 v1 project fragment (the stored document also requires `id` and `name`); Slice 06 migrates it to v2 on load:

```json
{
  "schemaVersion": 1,
  "intent": {"text": "Make a motion alarm"},
  "boardIds": ["esp32-dev-module"],
  "components": [{"id": "board-main", "kind": "board", "definitionId": "esp32-dev-module"}],
  "connections": [],
  "logic": [],
  "layout": {"entities": {"board-main": {"position": [0, 0.15, 0], "rotation": [0.94, -0.3, 0.07], "scale": [1.5, 1.5, 1.5]}}},
  "metadata": {"createdAt": "2026-09-23T00:00:00.000Z", "updatedAt": "2026-09-23T00:00:00.000Z"}
}
```

Searchable metadata such as project name, owner, timestamps, primary board and visibility remain relational columns.

## Authentication

Authentication is optional for first use.

Desired experience:

```text
Open Kinetable
→ choose board
→ use the table immediately
→ sign in only when cloud sync/sharing is useful
```

Supabase Auth should support Google, GitHub and email. Guest/local usage must remain possible. If anonymous Supabase sessions are used, account upgrade must preserve local projects and inventory rather than creating a second disconnected identity.

## Security

- Never expose Supabase service-role credentials or model provider secrets to the browser.
- Use Row Level Security for all user-owned cloud tables.
- Browser code receives only publishable/public configuration.
- AI requests go through a server boundary.
- Validate every AI-produced project command against deterministic Kinetable rules before applying it.
- Storage buckets containing private user assets must enforce ownership policies.

## AI backend

The browser sends intent and relevant project context to a Vercel Function.

```text
Browser
  ↓
/api/ai/plan
  ↓
model provider
  ↓
structured Kinetable operations
  ↓
hardware-core validation
  ↓
apply or reject
```

The model must not return arbitrary React, DOM mutations or unvalidated project JSON. It should use structured operations such as:

```text
component.add
component.remove
connection.create
connection.remove
layout.move
```

## 3D and component assets

Supabase Storage can host canonical GLB models, thumbnails and future user-imported assets. PostgreSQL stores model metadata, version, provenance/license information, dimensions, anchors and compatibility data.

Do not store unlicensed third-party models.

## Firmware compilation

Do not run heavy Arduino/ESP-IDF/Pico compilation inside the browser-facing database layer.

Initial path:

```text
project / generated firmware
        ↓
compile API
        ↓
isolated container worker
        ↓
Arduino CLI / ESP-IDF / Pico SDK
        ↓
.bin / .uf2 artifact
        ↓
browser flashes connected board
```

A Vercel Function may orchestrate the job, but heavy toolchains should remain behind a replaceable worker interface so Kinetable is not coupled to a single compute provider.

## Deployment environments

Maintain at least:

- local development;
- Vercel preview deployments;
- production.

Use separate Supabase projects or an equivalent isolated strategy for development/staging vs production before real users are onboarded.

Environment variables must be documented in `.env.example`; secrets must never be committed.

## Backend-by-slice rule

Every product slice owns the backend it needs:

- onboarding establishes local profile persistence and backend client boundary;
- auth establishes real Supabase Auth and RLS;
- My Table establishes real project save/sync;
- AI Assembly establishes real server-side model orchestration;
- My Parts establishes real inventory persistence;
- Projects establishes versioning and cloud restore;
- Run on Board establishes compile-job infrastructure;
- camera/live-workbench features establish media upload/processing only when they are built.

Do not postpone all backend work until after the UI is finished, and do not build unused backend infrastructure far ahead of the product slice that needs it.


# Implemented through Slice 05

## Local-first application

Guest onboarding and `/table` use Zustand and the IndexedDB profile repository. They do not require an account. A single auth boundary owns session resolution, persisted Supabase sessions, token refresh and auth events. UI components use auth actions and repositories rather than issuing database queries.

Hosted Supabase: **Kinetable**, reference `eajyviksoaveunehuhpl`, Mumbai (`ap-south-1`), in `amaansyed27's Org`. The committed `cloud_profiles` and `local_first_projects` migrations are applied there.

## Configuration

Copy `.env.example` to `apps/web/.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's URL and `sb_publishable_…` key. The Vite configuration explicitly allowlists validated public values. Missing/invalid configuration keeps the application in local-only mode. Never put a secret, service-role key, database password or OAuth secret in a VITE variable.

`cloudConfigured` indicates valid client configuration, not network health or successful authentication. Preview and Production need the same public variables in Vercel, followed by a rebuild.

## Authentication

Slice 03 uses **email and password**, per the updated product request. Enable Email and signup and disable Confirm email in the hosted Auth configuration. No SMTP, magic-link request or password-reset UI is implemented. Email addresses are unverified; do not treat email as proof of mailbox ownership. Passwords go directly to Supabase Auth and are never stored by Kinetable.

Google and GitHub are optional, disabled by default. To activate either, create the external OAuth application, use `https://eajyviksoaveunehuhpl.supabase.co/auth/v1/callback` as its authorized callback, enter its credentials in Supabase, configure allowed application redirects and then enable the corresponding `VITE_AUTH_GOOGLE_ENABLED` / `VITE_AUTH_GITHUB_ENABLED` flag. OAuth credentials remain in Supabase. `/auth/callback` exchanges PKCE codes and handles invalid links. Redirect destinations are limited to `/table` and `/start`.

## Cloud data and access

`public.profiles` has an auth-owned ID and a private trigger that creates the profile. Clients cannot assign identity or timestamps: INSERT/UPDATE grants cover only editable profile columns. RLS limits every operation to the authenticated owner's ID. DELETE has a policy but no grant or product flow yet. Both trigger functions are in a non-exposed private schema, with fixed search paths and public execution revoked.

`public.projects` stores a client-generated UUID, an auth-owned `owner_id`, searchable name and primary board, schema version, JSONB document, archive flag, and server timestamps. RLS restricts SELECT/INSERT/UPDATE/DELETE to the owner. Column grants prevent clients from updating `owner_id`, `id`, or timestamps. A database trigger sets `updated_at`; the validated server timestamp is saved locally after a successful write. No service-role key is sent to the browser.

## Reconciliation

On initial sign-in, prefer an existing cloud board, otherwise the meaningful local board. Setup is completed if either valid source is completed and a valid board exists. After a successful write, persist the server timestamp and cloud owner locally. A profile associated with another account is not silently uploaded to a new identity.

Later deliberate profile edits are saved first and synced to the active account. Pending same-account changes survive refresh using local dirty metadata. Requests capture the session token so changing accounts cannot retarget an in-flight write. Local revisions prevent a late cloud response from overwriting a newer local profile choice. Sign-out preserves IndexedDB.

The project store loads IndexedDB before cloud reconciliation. A guest project is adopted by the first connected account using the same UUID. A project owned by another account stays local and is excluded from the new account's project selection. `/new` creates or promotes a validated document through `projectStore.createBuild`: the IndexedDB write completes before navigation, then an authenticated checkpoint starts in the background. Reconciliation uploads every eligible unsynced local project, including multiple guest builds after sign-in. Cloud failures leave documents dirty and retry on reconnect or through Account. A fresh authenticated browser restores the most recent owner project. Project writes occur at meaningful checkpoints, never per 3D frame. Simultaneous multi-device editing is not conflict-safe yet: the last successful cloud write wins; Slice 15 owns versions and conflict handling.

Cloud errors leave local state intact and display a restrained status in the account menu. Requests have a bounded timeout. Another authenticated browser with empty IndexedDB restores the cloud board and project.

## Local database development

`supabase/config.toml` enables local PostgreSQL 17, API, Auth and Studio. Docker is required for `supabase start`. Storage, Realtime, Edge Runtime and analytics are not part of this slice. Migrations under `supabase/migrations/` are the schema source of truth; checked-in versions match hosted history. Slice 05 adds validated `intent.text` inside JSONB and needs no SQL migration. See [Slice 05](SLICE-05.md) for verification and limitations.

## Slice 06 provider-independent assembly

The hosted `project_v2` migration permits schema versions 1 and 2 without changing owner RLS. The client migrates v1 on load and persists v2 at an intentional checkpoint. `POST /api/ai/plan` verifies an optional Supabase bearer token and reads that user's project with RLS, or accepts a validated guest project. It checks revision, intent and board, accepts no client hardware definitions, validates structured commands with hardware-core, and sends only a validated plan. The browser validates again, writes one IndexedDB document, then checkpoints through sync when signed in. A failed cloud write leaves local work dirty for retry.

The Vercel API receives a selected BYOK credential over TLS, uses it only in memory for the current request, and never stores it in Supabase. The optional loopback bridge handles local models and authenticated CLIs without a Kinetable-paid provider. Remote custom endpoints use public HTTPS address checks and DNS pinning. There is no shared distributed rate limiter yet. See [Slice 06](SLICE-06.md), [Providers](PROVIDERS.md) and [Local Bridge](LOCAL-BRIDGE.md).
