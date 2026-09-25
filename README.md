# Kinetable

**An AI-native visual workspace for building hardware.**

Kinetable is a spatial, visual-first hardware environment where people build electronics by manipulating live 3D hardware, wiring real electrical topology, simulating behaviour, and using AI for planning and explanation. Code exists underneath, but it is not the starting point.

> Select your board. Describe the idea. See it work.

## Product thesis

Most hardware tools begin with code, pin tables, wiring diagrams, or CAD. Kinetable begins with **the thing you want to make**.

The workbench is the product. It should know what hardware exists in the project, how it is connected, whether the supported electrical rules are satisfied, what the project is intended to do, and eventually how the virtual build maps to the real physical workbench.

Core rules:

- **Visual first.** Hardware and behaviour are the primary interface.
- **Code optional.** Source code is an advanced escape hatch, not the starting point.
- **AI proposes; the hardware engine proves.** Models never override deterministic electrical rules.
- **Local first, cloud backed.** Direct manipulation stays local and fast; accounts add sync.
- **Provider agnostic.** AI can use BYOK APIs, custom compatible endpoints, local runtimes, or authenticated local CLIs.
- **Fun through interaction, not clutter.** Physical response and cause/effect replace dashboard density.

## Current status

**Slices 01–09 are implemented. Slice 10 — Visual Logic is next.**

Kinetable currently supports:

- board-first onboarding for ESP32, Raspberry Pi Pico and Arduino Uno;
- optional Supabase authentication and owner-only cloud project sync;
- local-first IndexedDB project persistence;
- intent-first New Build;
- real AI assembly through BYOK/local/CLI providers with structured commands and deterministic validation;
- an interactive 3D workbench with camera controls, direct manipulation, add/remove/replace, undo/redo and autosave;
- Project v3 physical circuit data;
- explicit pin and breadboard-hole endpoints;
- a deterministic 400-hole half-size breadboard topology;
- physical wires and through-hole lead placement;
- derived electrical nets;
- net-aware safety/completeness checks;
- component, pin, wire and breadboard-hole inspection;
- accessible wiring controls, touch interaction and WebGL fallback.

Deterministic simulation, runtime recipes, virtual inputs, causal Explain and Power/Signals/Data X-Ray are available for supported complete circuits. Visual logic, personal inventory, physical-board runtime and digital-twin features remain future slices.

## Architecture

```text
                        Kinetable Web
                   React + R3F + Vite
                            │
          ┌─────────────────┼──────────────────┐
          │                 │                  │
     Workbench        AI provider router     Supabase
          │                 │             Auth/Postgres
          │         ┌───────┴────────┐         │
          │         │                │         │
          │      Remote BYOK      Local Bridge │
          │      / Vercel API     HTTP / CLI   │
          │                                   │
          └───────────────┬───────────────────┘
                          │
                     Project v3
                          │
        components · wires · lead placements · layout
                          │
                    hardware-core
                          │
          breadboard topology + derived nets
                          │
           structural / safety / completeness
                          │
             ┌────────────┴─────────────┐
             │                          │
     IndexedDB local-first     simulation compiler
                                       │
                                logical runtime
                                       │
                              Explain / X-Ray
```

The project/electrical model is the source of truth. Three.js renders it; AI proposes commands against it; persistence stores it. Derived nets are recomputed from physical project data and are not stored as a second source of truth.

See [Technical architecture](docs/ARCHITECTURE.md), [Hardware model](docs/HARDWARE-MODEL.md), [Backend](docs/BACKEND.md), [Providers](docs/PROVIDERS.md), and [Local Bridge](docs/LOCAL-BRIDGE.md).

## Project format

The current editable project format is **schemaVersion 3**.

Project v3 stores:

- one board instance;
- supported component instances;
- at most one canonical breadboard today;
- physical wires between pin/hole endpoints;
- through-hole terminal placements;
- spatial transforms;
- project intent and metadata.

Electrical nets are derived from:

```text
component pins
+ physical wires
+ inserted leads
+ breadboard conductive strips
→ resolved nets
```

Older v1/v2 projects migrate deterministically in memory and are saved as v3 only at an intentional edit/checkpoint.

## AI architecture

Kinetable does not require a Kinetable-owned paid model account.

Supported transport classes:

- remote BYOK APIs;
- multiple keys per provider with fallback;
- custom OpenAI-compatible endpoints;
- local HTTP runtimes such as Ollama, LM Studio and vLLM;
- local authenticated CLIs through the optional loopback Local Bridge.

The AI path is always:

```text
intent
→ provider
→ strict planner response
→ ProjectCommand[]
→ deterministic hardware validation
→ atomic project update
```

Provider credentials never belong in project JSON or Supabase project documents.

## Canonical 15-slice roadmap

The earlier 22-slice plan was compressed after Slice 07. Historical Slice 01–07 documents retain their original records; from Slice 08 onward, this 15-slice roadmap is canonical.

| Slice | Status | Scope |
| --- | --- | --- |
| 01 — Landing | ✅ | Public product story |
| 02 — Onboarding / Foundation | ✅ | Board-first entry, local/backend foundation |
| 03 — Auth | ✅ | Supabase Auth, profiles, RLS |
| 04 — My Table | ✅ | Persistent local/cloud projects |
| 05 — New Build | ✅ | Intent-first project creation |
| 06 — AI Assembly | ✅ | Provider-independent AI → validated hardware graph |
| 07 — Core 3D Workbench | ✅ | Spatial editor, history, autosave |
| 08 — Physical Circuit Editor | ✅ | Breadboard, wires, nets, inspectors |
| 09 — Living Circuit | Implemented | Simulation + Explain/X-Ray |
| 10 — Visual Logic | Planned | Editable semantic behaviour |
| 11 — Hardware Platform | Planned | My Parts + canonical Component Library |
| 12 — Personal Workspace | Planned | Projects/versioning + Explore |
| 13 — Learn | Planned | Interactive topology-aware missions |
| 14 — Physical Runtime | Planned | Compile/flash + live data + advanced code |
| 15 — Digital Twin | Later | Workbench scan + continuous live workbench |

See [ROADMAP.md](docs/ROADMAP.md) for scope and completion rules.

## Canonical demo: BONK

The internal end-to-end reference remains the real ESP32 build:

```text
BUTTON PRESS
      ↓
   BONK EVENT
   ├── OLED: "BONK!"
   ├── LED: ON
   └── BUZZER: BEEP ×2
```

The target product loop is:

1. choose ESP32;
2. describe the build;
3. let AI propose a validated assembly;
4. inspect and edit the physical circuit;
5. simulate it;
6. use Explain/X-Ray;
7. change `BEEP ×2` to `BEEP ×3` through Visual Logic;
8. compile and run it on the real board.

## Stack

| Need | Choice |
| --- | --- |
| Web | React + TypeScript + Vite |
| 3D | Three.js + React Three Fiber + Drei |
| UI state | Zustand |
| Local persistence | IndexedDB + Dexie |
| UI primitives | Radix UI |
| Styling | Tailwind CSS + custom Kinetable design system |
| Motion | Motion |
| Cloud | Supabase PostgreSQL + Auth + Storage |
| API / remote AI proxy | Vercel Functions |
| Deployment | Vercel |
| Testing | Vitest + Playwright |
| Local AI/device bridge | Node/TypeScript loopback bridge |
| Heavy compile worker, later | isolated container service |
| Native fallback, later | Tauri + Rust |

## Local development

Requirements: Node.js 24 LTS (or 22.22+) and pnpm.

```bash
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm bridge
```

For hosted Supabase features, copy `.env.example` to `apps/web/.env.local` and provide only the browser-safe Supabase URL/publishable key. Missing cloud configuration leaves local-first use available.

## Documentation

- [Product specification](docs/PRODUCT-SPEC.md)
- [UX flows](docs/UX-MOCKS.md)
- [Design system](docs/DESIGN-SYSTEM.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Backend and deployment](docs/BACKEND.md)
- [Hardware and simulation model](docs/HARDWARE-MODEL.md)
- [AI interaction model](docs/AI-TOOLS.md)
- [Provider architecture](docs/PROVIDERS.md)
- [Local Bridge](docs/LOCAL-BRIDGE.md)
- [Component library](docs/COMPONENT-LIBRARY.md)
- [Canonical roadmap](docs/ROADMAP.md)
- [Testing strategy](docs/TESTING.md)
- [Slice 08 — Physical Circuit Editor](docs/SLICE-08.md)
- [Slice 09 — Living Circuit](docs/SLICE-09.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
