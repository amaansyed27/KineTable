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

## Initial user flow

```text
Open Kinetable
    ↓
Select / detect board
    ↓
Your table is ready
    ↓
Describe an idea
    ↓
Kinetable chooses owned parts
    ↓
3D project assembles
    ↓
Build / Simulate / Explain
    ↓
Visual logic + signal flow
    ↓
Run on real board
```

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

## Development slices

Build one complete, testable product slice at a time.

| Slice | Goal |
| --- | --- |
| **01 — Spatial foundation** | React/Vite/R3F shell, table, camera, lighting, design system, one interactive ESP32. |
| **02 — Component system** | Reusable hardware objects, breadboard, LED, button, OLED, metadata. |
| **03 — Wiring** | Pin anchors, wire creation/routing, snapping, electrical connection graph. |
| **04 — Breadboard intelligence** | Real row/rail topology, connected-hole highlighting, placement validation. |
| **05 — BONK demo** | ESP32 + OLED + LED + button + buzzer assembled as the canonical project. |
| **06 — Simulation** | Button press drives LED, OLED and buzzer behaviour. |
| **07 — Explain / X-Ray** | Visualize power, data and signal paths spatially. |
| **08 — Visual Logic** | Behaviour editing without code: `BUTTON → BONK → LED / OLED / BEEP`. |
| **09 — My Parts** | Personal hardware inventory and builds based on what the user owns. |
| **10 — AI build actions** | Prompt-driven structured actions such as add, connect, replace, explain and modify logic. |
| **11 — Browser hardware** | Board detection, Web Serial/WebUSB where supported, compile/flash abstraction, live data. |
| **12 — Advanced layer** | Optional code view, technical details, raw serial/debugging. |
| **13 — Real Workbench** | Photo scan, digital twin, component recognition and alignment. |
| **14 — Live Workbench** | Camera-guided physical assembly, verification and real-time spatial debugging. |

**Immediate target:** Slice 01 only. Get the spatial interaction and visual quality right before adding wiring, simulation or AI.

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

The 3D scene, electrical graph, project state, and simulation should remain framework-independent enough to be reused by the future desktop app.

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

## Canonical first demo: BONK

The first end-to-end project should recreate a small real build:

```text
BUTTON PRESS
      ↓
   BONK EVENT
   ├── OLED: "BONK!"
   ├── LED: ON
   └── BUZZER: BEEP ×2
```

The demo must prove Kinetable's core interaction loop:

1. ESP32 appears on the table.
2. User asks for the BONK build.
3. Components assemble spatially.
4. Connections are represented by a real electrical graph.
5. Pressing the virtual button runs the simulation.
6. Explain mode visualizes the relevant signal path.
7. Visual Logic shows the behaviour without code.
8. Changing `BEEP ×2` to `BEEP ×3` changes simulation behaviour.

If this interaction feels clear and satisfying, the core product is working.

## Documentation

- [Product specification](docs/PRODUCT-SPEC.md)
- [UX flows and screen mocks](docs/UX-MOCKS.md)
- [Design system](docs/DESIGN-SYSTEM.md)
- [Technical architecture](docs/ARCHITECTURE.md)
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

**Planning / pre-implementation.**

The immediate goal is not to build every feature. It is to build one excellent product slice at a time, beginning with the spatial foundation and one interactive board.

## License

Kinetable is currently a private project and is **not open source**. See [LICENSE](LICENSE).
