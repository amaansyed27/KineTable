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

Initial relational entities:

```text
profiles
hardware_inventory
projects
project_versions
component_catalog
board_catalog
```

The full workbench/project graph should initially be stored as a versioned JSONB document rather than being prematurely normalized into dozens of tables.

Example project document:

```json
{
  "schemaVersion": 1,
  "boardIds": ["esp32-dev-module"],
  "components": [],
  "connections": [],
  "logic": [],
  "layout": {},
  "simulation": {}
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
/api/ai/build
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
component.setProperty
logic.update
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
