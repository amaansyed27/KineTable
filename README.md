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
- [Asset and model licensing](docs/ASSET-LICENSING.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

## Status

**Planning / pre-implementation.**

The immediate goal is not to build every feature. It is to build one excellent product slice at a time, beginning with the spatial foundation and one interactive board.

## License

Kinetable is currently a private project and is **not open source**. See [LICENSE](LICENSE).
