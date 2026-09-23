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

Kinetable is not intended to be another Arduino IDE, generic circuit simulator, or chatbot wrapped around hardware documentation. The workbench itself is the product.

## Product principles

1. **Visual first.** Hardware and behaviour are the primary interface.
2. **Code optional.** Source code is available when wanted, not forced on beginners.
3. **One-step setup.** Pick a board; Kinetable configures the rest.
4. **Personal by default.** Projects are built around the parts the user actually owns.
5. **AI proposes; the hardware engine proves.** Electrical truth comes from deterministic models and constraints.
6. **Progressive disclosure.** Beginner-friendly on the surface, serious engineering detail underneath.
7. **Fun through interaction, not clutter.** Tactile objects, motion, feedback, and satisfying cause/effect.
8. **The real workbench is the destination.** Camera-based digital-twin support is a later extension of the same model, not a separate product.

## Browser-first architecture

Kinetable should work for normal users directly in the browser with no installation required for the virtual experience.

```text
Kinetable Web
    ↓
3D Workbench + Visual Logic + Simulation + AI
    ↓
Kinetable Hardware Runtime
    ↓
Board / Component / Toolchain adapters
    ↓
Arduino · ESP-IDF · Pico SDK · others
```

For supported physical boards, Kinetable can use browser hardware APIs such as Web Serial or WebUSB. Compilation can be handled by a cloud compiler or compatible runtime so users do not manually install board packages, libraries, compilers, or plugins.

Internally Kinetable may have board packs, component packs, simulation drivers, and toolchain adapters. For normal users these stay invisible: the user sees **ESP32**, **OLED**, **PIR sensor**, etc., not plugin/package management.

A small native bridge or future Tauri desktop app remains an optional fallback for hardware or browser combinations that need deeper local access.

## Build plan — outside to inside

The numbered pages below describe the broader product journey. The active delivery order is Slice 01 public landing, Slice 02 product entry/onboarding/backend foundation, Slice 03 Auth, and Slice 04 project persistence; see [the roadmap](docs/ROADMAP.md).

The project should be built in the same order a new user experiences it. Each stage should look finished before moving deeper into the product.

### 01 — Landing

Public-facing Kinetable introduction.

- minimal premium landing page;
- strong product statement;
- interactive 3D hardware hero;
- visual demonstration of prompt → 3D build → simulation;
- sections for visual logic, personalization, learning and real-workbench vision;
- `Open Kinetable` CTA;
- responsive desktop-first implementation.

### 02 — Sign in / Continue

Authentication should never block experimentation.

- Google / GitHub / email sign-in;
- continue without account;
- explain cloud sync in one sentence;
- preserve local projects for guest users.

### 03 — First-run onboarding

The only required setup should be choosing a board.

- welcome screen;
- board picker: ESP32, Pico, Arduino, Other;
- optional USB auto-detection;
- no COM-port, framework, compiler or library setup;
- create the user's first table automatically.

### 04 — My Table / Home

The main home screen is a personal workbench, not a dashboard.

- selected board already present;
- recent project visible spatially;
- prompt: `What do you want to make?`;
- suggestions based on owned parts;
- lightweight navigation: Table / Projects / Parts / Learn;
- returning-user state restores the previous table.

### 05 — New Build

Intent-first project creation.

- natural-language prompt;
- use owned parts by default;
- show selected parts before building;
- optional `Show me first` preview;
- project name generated automatically but editable.

### 06 — AI Assembly

The build itself becomes the loading state.

- components enter the table spatially;
- auto-placement;
- auto-wiring;
- subtle progress: choosing parts → planning → building → checking;
- deterministic hardware validation before declaring the build ready.

### 07 — Core 3D Workbench

The primary Kinetable screen.

- pan / orbit / zoom / focus;
- select, move, rotate and inspect hardware;
- snap components to valid positions;
- add / remove / replace parts;
- contextual controls only when needed;
- minimal `Build / Simulate / Explain` mode switch;
- `Ask Kinetable` available without becoming a chat sidebar.

### 08 — Wiring + Breadboard Intelligence

Physical connectivity must be real, not decorative.

- pin anchors;
- draggable wires;
- breadboard hole topology;
- center-gap and power-rail rules;
- connected-row highlighting;
- invalid-placement warnings;
- electrical graph underlying every visible connection.

### 09 — Component Inspector

Understand one object without leaving the table.

- plain-language component description;
- `Used here for` explanation;
- connections;
- try/interact action;
- replace action;
- optional technical details with pinout, voltage and protocol information.

### 10 — Simulation

Make the virtual project behave like the real system.

- play / pause / reset;
- press buttons;
- rotate potentiometers;
- trigger PIR and other sensors;
- LED/OLED/buzzer/servo behaviour;
- signal and state propagation through the electrical graph;
- small spatial event labels instead of a debugger console.

### 11 — Explain / X-Ray

Turn invisible electronics into visible behaviour.

- Power / Signals / Data views;
- isolate one connection path;
- animate signal flow through wires;
- explain why a connection exists;
- highlight relevant pins and components;
- beginner explanation first, technical explanation on demand.

### 12 — Visual Logic

Programming without requiring code.

- spatial cause/effect graph;
- events, conditions and actions;
- example: `BUTTON → BONK → LED / OLED / BEEP ×2`;
- edit values directly in the logic representation;
- simulation updates immediately;
- code remains hidden by default.

### 13 — My Parts

Persistent personal hardware inventory.

- Boards / Sensors / Displays / Outputs / Components / Tools;
- accurate 3D object previews;
- quantities;
- add/search hardware;
- USB-detect boards;
- later: scan physical parts with the camera;
- recommendations based on what the user already owns.

### 14 — Component Library

The canonical Kinetable hardware knowledge base.

Each supported component can contain:

- accurate 3D model;
- dimensions and attachment points;
- pins and capabilities;
- voltage/current constraints;
- protocol metadata;
- simulation behaviour;
- compatible boards/frameworks;
- known libraries;
- common mistakes;
- documentation and examples.

Normal users never manage these as plugins. Kinetable resolves the correct packs and adapters automatically.

### 15 — Projects

Projects should look like things the user built, not document rows.

- Recent / Saved;
- miniature 3D workbench previews;
- duplicate / rename / archive;
- saved table layout, hardware graph, logic and simulation state;
- instant reopen.

### 16 — Explore

`What can I make with what I already own?`

- Build now;
- Everything required;
- One part away;
- personalized project generation;
- `Use something I already own instead` AI redesign action.

### 17 — Learn

Learning should work like interactive missions rather than courses.

- breadboard basics;
- LED/button/sensor missions;
- guided physical puzzles;
- hints rather than immediate answers;
- concepts explained spatially;
- progression without childish gamification.

### 18 — Run on Board

Move from simulation to the user's actual hardware.

- connect board in browser where supported;
- auto-detect target;
- compile behind the scenes;
- upload/flash;
- show only `Preparing → Sending → Running`;
- hide ports, packages, compilers and libraries unless Technical Details is opened.

### 19 — Live Data

Friendly runtime inspection.

- sensor values;
- GPIO state;
- board status;
- visual mapping back to the 3D component;
- raw serial console available only as an advanced option.

### 20 — Advanced Code

Optional escape hatch for developers.

- generated firmware editor;
- code ↔ hardware highlighting;
- code ↔ visual-logic synchronization;
- libraries and build details;
- never required for the default workflow.

### 21 — Real Workbench Scan — later

Create a digital twin from the physical desk.

- camera/photo import;
- identify board, breadboard and components;
- map breadboard geometry;
- align detected objects to Kinetable models;
- confirm uncertain detections;
- add recognized parts to My Parts.

### 22 — Live Workbench — later

Closed-loop physical building support.

- continuous camera mode;
- overlay next connection on the real build;
- compare intended vs observed topology;
- verify physical actions;
- spatial debugging of incorrect rows, reversed components and missing connections;
- combine visual observations with firmware/runtime state.

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

## Recommended stack

| Layer | Choice |
| --- | --- |
| Web application | React + TypeScript + Vite |
| 3D/spatial UI | Three.js + React Three Fiber + Drei |
| App state | Zustand |
| Local persistence | IndexedDB + Dexie |
| UI primitives | Radix UI |
| Styling | Tailwind CSS + custom Kinetable design system |
| UI motion | Motion |
| Testing | Vitest + React Testing Library + Playwright |
| Workspace | pnpm workspaces + Turborepo |
| Desktop, later | Tauri + Rust |
| Cloud sync, later | Supabase or equivalent |
| Hardware bridge, later | Arduino CLI / ESP-IDF / Pico SDK behind a local adapter |

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
- [Backend and deployment foundation](docs/BACKEND.md)
- [Slice 02 implementation and QA](docs/SLICE-02.md)
- [Slice 03 implementation and verification status](docs/SLICE-03.md)
- [Hardware and simulation model](docs/HARDWARE-MODEL.md)
- [AI interaction model](docs/AI-TOOLS.md)
- [Starter component library](docs/COMPONENT-LIBRARY.md)
- [Development roadmap](docs/ROADMAP.md)
- [Decision log](docs/DECISIONS.md)
- [Testing strategy](docs/TESTING.md)
- [Asset and model licensing](docs/ASSET-LICENSING.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

## Status

**Slice 03 completed — optional email/password accounts and real Supabase cloud-profile sync. Slice 01 landing and Slice 02 guest onboarding/local table remain intact. Project persistence (Slice 04) remains planned.**

Implementation should proceed page-by-page and feature-by-feature in the order above, keeping every completed stage usable and visually finished before moving deeper into the product.

## License

Kinetable is currently a private project and is **not open source**. See [LICENSE](LICENSE).

## Run the landing page

Requirements: Node.js 24 LTS (or 22.22+) and pnpm (the exact pnpm version is recorded in `package.json`).

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. To verify this slice:

```sh
pnpm lint
pnpm test
pnpm build
pnpm --filter @kinetable/web exec vite preview
```

The web app lives in `apps/web`. The public landing retains its continuous 3D story. Open Kinetable enters `/start`, where you choose ESP32, Pico or Uno; `/table` restores that board from local IndexedDB. No account or cloud configuration is required.

Optional Supabase variables are documented in `.env.example` and [BACKEND.md](docs/BACKEND.md). Vercel uses the repository-root `vercel.json` for the monorepo build and direct SPA routes. Auth and project creation remain unimplemented.

Browser journey tests:

```sh
pnpm --filter @kinetable/web exec playwright install chromium
pnpm test:e2e
```

See [Slice 01](docs/SLICE-01.md) and [Slice 02](docs/SLICE-02.md) for implementation boundaries and verification.
