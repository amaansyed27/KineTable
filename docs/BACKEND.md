# Kinetable Backend and Deployment

Kinetable is browser-first and local-first, but not frontend-only. Each product slice ships the persistence/server work actually required by that capability rather than leaving fake success states behind.

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
| Fast local state | Zustand |
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

Cloud must never sit in the workbench render/input loop.

## Local-first rule

High-frequency operations happen locally:

- selecting and manipulating hardware;
- wire preview and pin/hole interaction;
- simulation playback/state;
- temporary camera/selection state;
- future visual-logic editing feedback.

Persistent project edits are written to IndexedDB at meaningful transaction boundaries. Signed-in users receive deliberate/debounced cloud checkpoints. Simulation tick state is ephemeral and must not be written to IndexedDB or Supabase every tick.

## Cloud data model

Implemented relational tables:

```text
profiles
projects
```

Planned when their compressed slices arrive:

```text
hardware_inventory     # Slice 11 — Hardware Platform
component_catalog      # Slice 11 — Hardware Platform
project_versions       # Slice 12 — Personal Workspace
```

The complete workbench graph remains a versioned JSONB project document. Relational columns hold searchable ownership/metadata such as project ID, owner, name, primary board, schema version and timestamps.

## Current project persistence — schema v3

The current editable document is Project v3.

It stores:

```text
components
physical wires
through-hole terminal placements
layout
intent
metadata
```

Electrical nets are derived at runtime from wires, placements and breadboard topology. Nets are not separately persisted.

Older documents remain supported:

```text
v1 → v2 → v3
```

Load performs deterministic in-memory migration. An intentional edit/checkpoint persists v3. Supabase currently accepts schema versions 1, 2 and 3 so old cloud rows remain recoverable during migration.

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

RLS restricts project operations to the owner. Client grants prevent reassignment of ownership, project ID and server-owned timestamps. The Slice 08 migration expanded the schema-version constraint without weakening RLS.

## Authentication

Authentication is optional for first use:

```text
Open Kinetable
→ choose board
→ build locally
→ sign in only when cloud sync is useful
```

Current development auth uses email/password. Google/GitHub integrations are prepared but disabled until credentials and production-ready account flows are configured.

Local guest projects are preserved. Signing in intentionally adopts eligible guest work instead of silently discarding or retargeting projects from another account.

## Project reconciliation

The local project repository is authoritative for immediate interaction.

Current flow:

```text
edit
→ validate
→ IndexedDB save
→ visible state updates
→ signed-in cloud checkpoint
```

Cloud failure leaves the valid local project dirty and retryable. A fresh authenticated browser can restore the most recent cloud project.

Current simultaneous multi-device writes are not conflict-safe; the last successful cloud write can win. **Slice 12 — Personal Workspace** owns project versions, checkpoints and conflict-safe sync rules.

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

There is not yet a shared distributed public rate limiter for the BYOK proxy; this is a production-hardening requirement before broad public launch.

## AI mutation boundary

AI does not replace arbitrary project JSON.

The planner produces strict project operations that flow through hardware-core. Current command families include component, layout and connection operations, while the physical editor additionally uses wire/breadboard/terminal-placement commands.

AI Assembly still requires the complete-circuit validation gate before claiming success.

## Simulation backend ownership — Slice 09

**Living Circuit is primarily a local deterministic runtime, not a cloud service.**

Slice 09 uses a local deterministic runtime and adds no server dependency.

Required boundary:

```text
Project v3
→ simulation compatibility check
→ compile topology/runtime graph once per relevant project revision
→ deterministic simulation clock
→ component/net state + causal trace
→ UI / Explain / X-Ray
```

Simulation playback, virtual sensor inputs and causal traces are ephemeral. They should not generate cloud writes each tick.

Explain/X-Ray should consume deterministic runtime/net evidence first. AI may later translate structured evidence, but correctness must not depend on a model request.

## Backend ownership by compressed slice

```text
01–02  local persistence + deployment foundation
03     Supabase Auth / profiles / RLS
04–05  project persistence and real creation
06     provider-independent AI orchestration
07–08  local-first workbench + physical circuit persistence
09     local deterministic simulation/runtime; no backend required unless real need appears
10     persistent visual-logic model if required by implementation
11     inventory + canonical component catalog/storage
12     project versions, cloud restore and conflict-safe sync
13     learning progress only if product flow needs persistence
14     compile jobs, artifact worker, board transport and runtime telemetry
15     media/vision processing/storage for digital twin
```

Do not build unused future infrastructure early.

## Firmware compilation — Slice 14

Heavy compilation must stay behind a replaceable worker interface:

```text
project + generated firmware
→ Vercel orchestration API
→ isolated compile worker
→ Arduino CLI / ESP-IDF / Pico SDK
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
- runtime validation for cloud-loaded project JSON;
- deterministic hardware validation before AI/manual commits;
- no unrestricted custom remote proxy;
- no arbitrary Local Bridge shell endpoint;
- cloud/network failure never destroys valid local work.

Current implementation details and verification are recorded in [Slice 06](SLICE-06.md), [Slice 07](SLICE-07.md), and [Slice 08](SLICE-08.md). The canonical roadmap is [ROADMAP.md](ROADMAP.md).
