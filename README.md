# Kinetable

**An AI-native visual workspace for building hardware.**

Kinetable is a spatial, visual-first hardware environment where people can build electronics by manipulating live 3D components, understanding visual logic, simulating behaviour, and asking AI for help. Code exists underneath, but it is not the starting point.

> Select your board. Describe the idea. See it work.

## Product thesis

Most hardware tools begin with code, pin tables, wiring diagrams, or CAD. Kinetable begins with **the thing you want to make**.

The core experience is a personalized digital workbench that knows:

- which boards and components you own;
- how those components behave electrically;
- how they are connected;
- what the project is supposed to do;
- how to explain that behaviour visually;
- and, later, how your virtual project maps to your real physical workbench.

Kinetable is not another Arduino IDE, generic circuit simulator, or chatbot around hardware documentation. **The workbench itself is the product.**

## Product principles

1. **Visual first.** Hardware and behaviour are the primary interface.
2. **Code optional.** Source code is available when wanted, not forced on beginners.
3. **One-step setup.** Pick a board; Kinetable configures the rest.
4. **Personal by default.** Projects are built around the parts the user actually owns.
5. **AI proposes; the hardware engine proves.** Electrical truth comes from deterministic models and constraints.
6. **Progressive disclosure.** Beginner-friendly on the surface, serious engineering detail underneath.
7. **Fun through interaction, not clutter.** Tactile objects, motion, feedback, and satisfying cause/effect.
8. **Browser first.** Normal use should require no installation.
9. **Local first, cloud backed.** Fast workbench interactions stay local; accounts provide sync, sharing, AI and storage.
10. **Full-stack slices.** A feature is not complete if its required backend is still fake.

## Browser-first architecture

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

Normal users never manage Arduino-style cores, libraries, compilers, plugins or toolchains directly. Internally Kinetable can use board packs, component packs, simulation drivers and toolchain adapters while presenting only the physical hardware the user recognizes.

For supported devices, browser APIs such as Web Serial/WebUSB can connect to real boards. Heavy firmware compilation can later run in an isolated container worker behind a compile API. A Tauri desktop/native bridge remains a fallback for hardware or browser combinations requiring deeper access.

See [Backend and deployment](docs/BACKEND.md) and [Technical architecture](docs/ARCHITECTURE.md).

## Locked stack

| Need | Choice |
| --- | --- |
| Web application | React + TypeScript + Vite |
| 3D/spatial UI | Three.js + React Three Fiber + Drei |
| UI state | Zustand |
| Local/offline persistence | IndexedDB + Dexie |
| UI primitives | Radix UI |
| Styling | Tailwind CSS + custom Kinetable design system |
| Motion | Motion |
| Cloud database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| 3D/project asset storage | Supabase Storage |
| API / AI orchestration | Vercel Functions |
| Web deployment | Vercel |
| Testing | Vitest + React Testing Library + Playwright |
| Workspace | pnpm workspaces + Turborepo |
| Heavy compile worker, later | isolated container service |
| Native fallback, later | Tauri + Rust |

## Build plan — outside to inside, feature by feature

The project is built in the same order a new user experiences it. Each slice is a user-visible capability **plus the real backend required by that capability**.

### 01 — Landing ✅

Public-facing Kinetable introduction.

- premium minimal landing page;
- continuous 3D product story;
- personalization and learning teaser;
- responsive visual QA;
- no fake application functionality.

Status: implemented. See [Slice 01](docs/SLICE-01.md).

### 02 — Product Entry + Onboarding + Backend Foundation

The first real application slice.

User journey:

```text
Landing
→ Open Kinetable
→ choose ESP32 / Pico / Arduino
→ Set up my table
→ /table
```

Build:

- real application routing;
- `/start` onboarding and `/table` handoff;
- board-first 3D selection;
- no mandatory account;
- local hardware profile and persistence boundary;
- canonical board definitions;
- Supabase client/config foundation;
- database migrations folder and typed data boundary;
- Vercel-ready environment configuration;
- `.env.example`;
- no fake device-detection success.

The selected board must survive refresh. If cloud credentials are configured, the architecture must be ready to sync without rewriting UI components.

### 03 — Sign In / Account Upgrade + Real Auth

Authentication adds cloud value; it does not gate experimentation.

- Supabase Auth;
- Google / GitHub / email;
- continue locally/guest;
- preserve existing local onboarding/project data when signing in;
- user profile row;
- Row Level Security policies;
- session restore/logout;
- clear local-vs-cloud ownership semantics.

### 04 — My Table / Home + Real Project Persistence

The main home screen is a personal workbench, not a dashboard.

- selected board already present;
- prompt: `What do you want to make?`;
- recent project spatially visible;
- Table / Projects / Parts / Learn navigation;
- IndexedDB local project state;
- Supabase project save/sync for signed-in users;
- versioned JSONB project document;
- returning-user restore.

### 05 — New Build + Project Creation

Intent-first project creation.

- natural-language project entry UI;
- create a real project record/local document;
- generated editable project name;
- choose from owned parts when available;
- `Show me first` preview;
- autosave/checkpoint boundary.

AI may still be mocked in this slice; project creation/persistence must not be.

### 06 — AI Assembly + Real AI Backend

The build itself becomes the loading state.

- components enter spatially;
- auto-placement and structured auto-wiring;
- server-side AI orchestration through Vercel Functions;
- provider secrets remain server-side;
- model returns structured Kinetable commands only;
- deterministic hardware validation before commands are applied;
- unsupported requests fail clearly rather than hallucinating hardware.

### 07 — Core 3D Workbench

The primary Kinetable screen.

- pan / orbit / zoom / focus;
- select, move, rotate and inspect hardware;
- snap objects to valid positions;
- add / remove / replace parts;
- contextual controls;
- Build / Simulate / Explain modes;
- local autosave of layout and project state.

### 08 — Wiring + Breadboard Intelligence

Physical connectivity becomes real rather than decorative.

- pin anchors;
- draggable wires;
- electrical nets;
- breadboard A–E / F–J topology;
- rails and center gap;
- connected-hole highlighting;
- invalid-placement warnings;
- undo/redo;
- serialized connection graph.

### 09 — Component Inspector

Understand one object without leaving the table.

- plain-language explanation;
- `Used here for` context;
- connections;
- Try / Replace actions;
- technical details on demand;
- metadata sourced from the canonical component definition rather than UI hardcoding.

### 10 — Simulation

Make the virtual project behave like the real system.

- deterministic logical clock;
- buttons / potentiometers / sensors;
- LED / OLED / buzzer / servo outputs;
- play / pause / reset;
- spatial event labels;
- state propagation through the hardware graph;
- deterministic tests independent of frame rate.

### 11 — Explain / X-Ray

Turn invisible electronics into visible behaviour.

- Power / Signals / Data views;
- isolate one connection path;
- signal animation through physical wires;
- explain why a connection exists;
- highlight relevant pins/components;
- beginner explanation first, technical explanation on demand.

### 12 — Visual Logic

Programming without requiring source code.

- spatial cause/effect graph;
- events, conditions and actions;
- editable action values;
- simulation synchronization;
- code remains hidden by default.

Canonical example:

```text
BUTTON → BONK
       ├─ OLED: "BONK!"
       ├─ LED: ON
       └─ BEEP ×2
```

### 13 — My Parts + Real Inventory Persistence

Persistent personal hardware inventory.

- Boards / Sensors / Displays / Outputs / Components / Tools;
- quantities;
- add/search hardware;
- local persistence;
- Supabase inventory sync for signed-in users;
- RLS ownership;
- recommendations query the same inventory model.

### 14 — Component Library

The canonical Kinetable hardware knowledge base.

Each supported part can contain:

- accurate 3D model;
- dimensions and anchors;
- pins and capabilities;
- electrical constraints;
- protocol metadata;
- simulation behaviour;
- compatible boards/frameworks;
- known libraries;
- common mistakes;
- provenance/license information.

Canonical assets can be stored in Supabase Storage with metadata in PostgreSQL.

### 15 — Projects + Cloud Sync / Versioning

Projects should look like things the user built, not document rows.

- Recent / Saved;
- miniature 3D previews;
- duplicate / rename / archive;
- project versions/checkpoints;
- cloud restore;
- conflict-safe sync rules;
- signed-out local projects remain usable.

### 16 — Explore

`What can I make with what I already own?`

- Build Now;
- Everything Required;
- One Part Away;
- deterministic inventory requirement matching;
- AI redesign action: `Use something I already own instead`.

### 17 — Learn

Interactive missions rather than courses.

- breadboard basics;
- LED/button/sensor missions;
- topology-aware validation;
- staged hints;
- explain why the successful circuit works;
- progression without childish gamification.

### 18 — Run on Board + Compile Infrastructure

Move from simulation to the user's actual hardware.

- browser board connection where supported;
- target detection/confirmation;
- generated firmware;
- compile-job API;
- isolated Arduino CLI / ESP-IDF / Pico SDK worker;
- firmware artifact returned to browser;
- flash/upload;
- primary UX: `Preparing → Sending → Running`;
- technical details optional.

### 19 — Live Data

Friendly runtime inspection.

- sensor values;
- GPIO state;
- board status;
- visual mapping back to 3D components;
- raw serial available as an advanced option.

### 20 — Advanced Code

Optional escape hatch for developers.

- generated firmware editor;
- code ↔ hardware highlighting;
- code ↔ visual-logic synchronization rules;
- libraries/build details;
- raw serial/debug logs;
- never required for the default workflow.

### 21 — Real Workbench Scan — later

Create a digital twin from the physical desk.

- camera/photo import;
- identify board/breadboard/components;
- map geometry;
- reconcile physical objects with Kinetable entities;
- confidence-aware confirmation;
- media storage/processing added only when this slice is built.

### 22 — Live Workbench — later

Closed-loop physical building support.

- continuous camera mode;
- overlay the next physical connection;
- compare intended vs observed topology;
- verify physical actions;
- debug incorrect rows/reversed components/missing connections;
- combine vision with firmware/runtime state.

## Backend-by-slice rule

Kinetable is **not** being built as a finished frontend followed by a backend phase.

When a feature needs persistent or server-side behaviour, that backend ships in the same slice:

```text
Onboarding → persistence boundary + backend foundation
Auth       → real Supabase Auth + RLS
My Table   → real project persistence/sync
AI Build   → real server-side model API
My Parts   → real inventory persistence
Projects   → real cloud versions/restore
Run Board  → real compile-job infrastructure
```

No fake success states and no client-side secrets.

## Canonical first end-to-end demo: BONK

The first complete internal project should recreate the existing real ESP32 build:

```text
BUTTON PRESS
      ↓
   BONK EVENT
   ├── OLED: "BONK!"
   ├── LED: ON
   └── BUZZER: BEEP ×2
```

It should eventually prove the full product loop:

1. select ESP32;
2. open My Table;
3. ask for the BONK build;
4. watch components assemble;
5. inspect real breadboard/wire topology;
6. press the virtual button;
7. see the OLED/LED/buzzer respond;
8. use Explain/X-Ray;
9. edit `BEEP ×2` to `BEEP ×3` in Visual Logic;
10. run it on the real board.

## Proposed repository shape

```text
KineTable/
├── apps/
│   ├── web/
│   └── desktop/                 # later
├── packages/
│   ├── ui/
│   ├── spatial/
│   ├── hardware-core/
│   ├── simulation/
│   ├── visual-logic/
│   ├── component-library/
│   ├── ai/
│   └── project-format/
├── supabase/
│   └── migrations/
├── assets/
│   └── models/
├── docs/
└── .github/
```

## Documentation

- [Product specification](docs/PRODUCT-SPEC.md)
- [UX flows and screen mocks](docs/UX-MOCKS.md)
- [Design system](docs/DESIGN-SYSTEM.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Backend and deployment](docs/BACKEND.md)
- [Hardware and simulation model](docs/HARDWARE-MODEL.md)
- [AI interaction model](docs/AI-TOOLS.md)
- [Starter component library](docs/COMPONENT-LIBRARY.md)
- [Development roadmap](docs/ROADMAP.md)
- [Decision log](docs/DECISIONS.md)
- [Testing strategy](docs/TESTING.md)
- [Asset and model licensing](docs/ASSET-LICENSING.md)
- [Slice 01 implementation](docs/SLICE-01.md)
- [Slice 02 implementation and QA](docs/SLICE-02.md)
- [Slice 03 implementation and hosted verification](docs/SLICE-03.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

## Status

**Slice 03 completed — optional email/password accounts and real Supabase cloud-profile sync. Slice 01 landing and Slice 02 guest onboarding/local table remain intact. Project persistence (Slice 04) remains planned.**

Implementation proceeds page-by-page and feature-by-feature, with each completed slice visually finished, tested, and backed by the real persistence/server functionality it requires.

## Run locally

Requirements: Node.js 24 LTS (or 22.22+) and pnpm (the exact pnpm version is recorded in `package.json`).

```sh
pnpm install
pnpm dev
```

Verify:

```sh
pnpm lint
pnpm test
pnpm build
```

The web app lives in `apps/web`. `/start` selects ESP32, Pico or Uno, and `/table` restores the board from IndexedDB without an account. Optional `/auth` sign-in syncs the profile to Supabase. Project creation remains deferred.

Copy `.env.example` to `apps/web/.env.local` for cloud development; missing configuration preserves guest mode. See [BACKEND.md](docs/BACKEND.md). Vercel uses the root `vercel.json` for the build and direct SPA routes.

Browser journey tests:

```sh
pnpm --filter @kinetable/web exec playwright install chromium
pnpm test:e2e
```

For system Chrome on Windows set `PLAYWRIGHT_CHANNEL=chrome`. Hosted dummy-account checks are documented in [Slice 03](docs/SLICE-03.md).

## License

Kinetable is currently a private project and is **not open source**. See [LICENSE](LICENSE).
