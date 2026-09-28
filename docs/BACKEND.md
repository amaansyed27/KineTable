# Kinetable Backend and Deployment

Kinetable is browser-first and local-first, but not frontend-only. Each product slice ships the persistence/server work required by that capability rather than leaving fake success states behind.

## Platform choices

| Need | Choice |
| --- | --- |
| Web hosting / previews | Vercel |
| Frontend | React + TypeScript + Vite |
| API / remote AI proxy | Vercel Functions |
| Cloud database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Future canonical asset storage | Supabase Storage |
| Realtime/collaboration | Later, only where justified |
| Fast local UI state | Zustand |
| Local/offline persistence | IndexedDB + Dexie |
| Local AI/device bridge | loopback Node/TypeScript bridge |
| Heavy firmware compilation | later isolated container worker |
| Browser hardware | Web Serial / WebUSB where supported |
| Native fallback | later Tauri + Rust |

## Runtime shape

```text
                         Browser
                            │
                    Kinetable Web App
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   IndexedDB             Supabase           Vercel API
   local-first       Auth / Postgres       remote BYOK
        │                                       │
        │                                external provider
        │
        └────────────── project model ──────────┐
                                               │
                                        Local Bridge
                                      local HTTP / CLI
```

Cloud never sits in the high-frequency workbench, logic or simulation loop.

## Local-first rule

High-frequency or ephemeral operations stay local:

- selecting and manipulating hardware;
- wire preview and pin/hole interaction;
- temporary camera/selection state;
- simulation playback, virtual inputs and causal traces;
- in-progress UI interaction before a validated project transaction commits.

Persistent project edits—including Visual Logic edits—are written to IndexedDB at meaningful transaction boundaries. Signed-in users receive debounced cloud checkpoints. Simulation state never creates project revisions or cloud writes.

## Cloud data model

Implemented relational tables:

```text
profiles
projects
```

Planned when their canonical slices arrive:

```text
hardware_inventory     # Slice 11 — Hardware Platform
component_catalog      # Slice 11 — Hardware Platform
project_versions       # Slice 12 — Personal Workspace
```

The complete workbench graph remains a versioned JSONB project document. Relational columns hold ownership/search metadata such as project ID, owner, name, primary board, schema version and timestamps.

## Current project persistence — schema v4

The current editable document is **Project v4**. It stores:

```text
components
physical wires
through-hole terminal placements
layout
persistent WHEN / IF / DO logic
intent
metadata
```

Electrical nets are derived at runtime from wires, placements and breadboard topology. Nets are not separately persisted. Simulation state is also not persisted.

Historical documents remain supported:

```text
v1 → v2 → v3 → v4
```

Load performs deterministic in-memory migration. Reading an old project does not by itself rewrite the cloud row. The next intentional project mutation/checkpoint persists v4. Supabase accepts schema versions 1, 2, 3 and 4 so historical rows remain recoverable during migration.

## `public.projects`

The project table stores:

- client-generated UUID;
- auth-owned `owner_id`;
- project name;
- primary board ID;
- schema version;
- JSONB document;
- archive flag;
- server timestamps.

RLS restricts project operations to the owner. Client grants prevent reassignment of ownership, project ID and server-owned timestamps. Schema-version migrations only widen the accepted version set; they do not weaken RLS.

## Authentication

Authentication is optional for first use:

```text
Open Kinetable
→ choose board
→ build locally
→ sign in only when cloud sync is useful
```

Current development auth uses email/password. Google/GitHub integrations remain disabled until their production account flows and credentials are configured.

Local guest projects are preserved. Signing in adopts eligible guest work instead of silently discarding it or retargeting projects from another account.

## Project reconciliation

The local project repository is authoritative for immediate interaction.

```text
validated project edit
→ IndexedDB save
→ visible state updates
→ signed-in cloud checkpoint
```

Cloud failure leaves the valid local project dirty and retryable. A fresh authenticated browser can restore the most recent cloud project. Current simultaneous multi-device writes are still last-successful-write oriented; conflict-safe project versioning belongs to **Slice 12 — Personal Workspace**.

## AI backend and BYOK

Kinetable does not require a Kinetable-owned paid inference account.

Supported provider transports:

```text
REMOTE_API
CUSTOM_OPENAI_COMPATIBLE
LOCAL_HTTP
LOCAL_CLI
```

Remote BYOK flow:

```text
Browser
→ /api/ai/plan
→ selected provider
→ structured planner response
→ deterministic hardware validation
→ browser revalidation
→ atomic local project save
```

A selected remote credential is sent over TLS to the Vercel function only for that request. It is not written to Supabase, project JSON, logs or analytics by Kinetable.

Custom remote endpoints are constrained to validated public HTTPS destinations. Localhost/private-network inference stays behind the authenticated loopback Local Bridge.

The Local Bridge exposes bounded known-provider actions rather than arbitrary shell execution. It supports local HTTP runtimes and approved headless CLI adapters.

There is not yet a shared distributed public rate limiter for the BYOK proxy; this remains a production-hardening requirement before broad public launch.

## AI mutation boundary

AI never replaces arbitrary project JSON.

The Slice 06 hardware planner emits strict project operations through hardware-core and remains hardware-assembly-only. Visual Logic can be authored manually through deterministic `logic.rule.*` commands or proposed by the bounded AI behavior assistant; preview/Apply uses the same validated command, logic compiler, history and persistence boundary.

AI Assembly still requires the complete-circuit validation gate before claiming success.

## Simulation and Visual Logic ownership — Slices 09–10

Living Circuit and Visual Logic are local deterministic product runtimes, not cloud services.

```text
Project v4
→ physical validation / simulation compatibility
→ compile physical topology once
→ compile authored logic when present
→ deterministic logical runtime
→ component/net state + causal trace
→ UI / Explain / X-Ray
```

Logic-empty projects may use explicit Slice 09 demonstration recipes. Projects with authored Visual Logic run their saved `Project Logic`; hidden recipes do not run alongside it.

Playback, virtual sensor inputs, output state and trace history are ephemeral. Authored logic itself is project data and therefore participates in normal IndexedDB persistence, undo/redo and cloud checkpoints.

Explain/X-Ray consumes deterministic runtime/net evidence first. Correctness does not depend on an AI model request.

## Backend ownership by canonical slice

```text
01–02  local persistence + deployment foundation
03     Supabase Auth / profiles / RLS
04–05  project persistence and real creation
06     provider-independent AI orchestration
07–08  local-first workbench + physical circuit persistence
09     local deterministic simulation/runtime
10     Project v4 persistent Visual Logic; no new runtime service
11     inventory + canonical component catalog/storage
12     project versions, cloud restore and conflict-safe sync
13     learning progress only if product flow needs persistence
14     compile jobs, artifacts, board transport and runtime telemetry
15     media/vision processing/storage for digital twin
```

Do not build unused future infrastructure early.

## Firmware compilation — Slice 14

Heavy compilation must stay behind a replaceable worker interface:

```text
Project v4 + Visual Logic
→ firmware generation
→ Vercel orchestration API
→ isolated Arduino CLI / ESP-IDF / Pico SDK worker
→ .bin / .uf2 artifact
→ browser/local bridge board transport
```

Do not run heavy toolchains in Supabase Edge Functions.

## Deployment environments

Maintain:

- local development;
- Vercel previews;
- production when ready.

Before onboarding real public users, isolate development/staging data from production appropriately.

Browser-safe public Supabase values are documented in `.env.example`. Secrets must never be committed or exposed through `VITE_*` variables.

## Security invariants

- owner-only RLS for user cloud data;
- no Supabase service-role credential in the browser;
- provider secrets outside project documents/cloud rows;
- runtime validation for local/cloud-loaded project JSON;
- deterministic electrical and logic validation before commits;
- no unrestricted custom remote proxy;
- no arbitrary Local Bridge shell endpoint;
- simulation never mutates persistent project state;
- cloud/network failure never destroys valid local work.

Implementation evidence is recorded in the slice documents, especially [Slice 06](SLICE-06.md), [Slice 08](SLICE-08.md), [Slice 09](SLICE-09.md) and [Slice 10](SLICE-10.md). The canonical roadmap is [ROADMAP.md](ROADMAP.md).
