# Kinetable Technical Architecture

## 1. Architectural goal

Kinetable is an AI-native visual hardware workspace. The project/electrical model is the source of truth; UI, 3D rendering, AI, persistence, simulation and future physical-workbench vision operate through controlled domain boundaries.

```text
┌──────────────────────────────────────────────┐
│                  UI / UX                     │
│ landing · onboarding · table · parts · learn │
├──────────────────────────────────────────────┤
│             Spatial interaction              │
│ select · drag · snap · wire · camera         │
├──────────────────────────────────────────────┤
│           Project / hardware model           │
│ components · pins · wires · breadboards      │
├──────────────────────────────────────────────┤
│           Derived electrical graph           │
│ topology · nets · validation                 │
├──────────────────────────────────────────────┤
│                Simulation                    │
│ drivers · timing · virtual runtime state     │
├──────────────────────────────────────────────┤
│                 AI layer                     │
│ intent · planner · provider router           │
├──────────────────────────────────────────────┤
│          Persistence / cloud services        │
│ IndexedDB · Supabase · Vercel APIs           │
├──────────────────────────────────────────────┤
│          Platform / hardware bridge          │
│ Local Bridge · Serial/USB · compile worker   │
└──────────────────────────────────────────────┘
```

Core rule:

> AI proposes; the deterministic Kinetable engine proves.

## 2. Locked stack

### Web

- React
- TypeScript strict mode
- Vite
- React Router
- Three.js + React Three Fiber + Drei
- Zustand
- IndexedDB + Dexie
- Radix UI
- Tailwind CSS + custom Kinetable UI
- Motion

### Cloud

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Vercel Functions
- Vercel previews/hosting

### Local bridge

The optional Kinetable Local Bridge binds to loopback and supports approved local runtimes/CLIs. It is not an arbitrary remote-shell API.

### Testing

- Vitest for deterministic domain/unit tests
- Playwright for browser and deployed flows
- hosted Supabase ownership/RLS checks
- deterministic simulation tests from Slice 09 onward

## 3. Runtime topology

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
                                      Ollama / LM Studio
                                      vLLM / local CLIs
```

Cloud never sits in the high-frequency workbench render/input loop.

## 4. Main domain boundaries

### `projects`

Owns versioned project schemas and migrations.

Current editable format: **Project v3**.

### `hardware-core`

Framework-independent source of structural/electrical truth.

Responsibilities:

- project commands;
- component/pin validation;
- breadboard topology;
- physical endpoint validation;
- net resolution;
- electrical safety;
- circuit completeness;
- deterministic mutations;
- history helpers.

It must not depend on React, Three.js, Zustand, Vercel, Supabase or AI provider SDKs.

### `component-library`

Owns canonical definitions and stable definition IDs.

Current records include electrical models, pins, supply metadata, descriptions and visual IDs. Visual pin/lead anchors remain presentation metadata keyed by the same stable electrical pin IDs.

### `spatial`

Owns presentation and direct manipulation:

- 3D models;
- camera;
- selection/dragging;
- breadboard rendering;
- pin targets;
- wire curves;
- visual highlighting.

Spatial geometry never determines electrical truth.

### `ai`

Owns planner contracts, provider routing and provider-independent assembly orchestration.

AI returns strict Kinetable operations. It never directly edits the DOM, Three.js scene or arbitrary project JSON.

### `simulation` — Slice 09

Simulation must remain independent from rendering and persistence.

Responsibilities:

- compile a project/net graph into simulation-ready state;
- deterministic logical clock;
- event queue;
- component drivers;
- net/signal runtime state;
- causal trace used by Explain/X-Ray.

The simulator must reuse a compiled graph rather than recomputing the 400-hole breadboard topology every tick.

### `visual-logic` — Slice 10

Owns semantic behavior such as WHEN/IF/DO/WAIT and later firmware-generation mapping.

## 5. Current project format — v3

Project v3 explicitly stores physical circuit facts.

Conceptually:

```ts
interface KinetableProjectV3 {
  schemaVersion: 3
  id: string
  name: string
  intent?: { text: string }
  boardIds: string[]
  components: ComponentInstanceV3[]
  wires: Wire[]
  terminalPlacements: TerminalPlacement[]
  logic: []
  layout: WorkbenchLayout
  metadata: ProjectMetadata
}
```

Electrical endpoints are discriminated:

```ts
type ElectricalEndpoint =
  | { kind: 'pin'; componentId: string; pinId: string }
  | { kind: 'breadboard-hole'; breadboardId: string; holeId: string }
```

A wire joins two physical endpoints. A terminal placement inserts a supported lead into a breadboard hole. Breadboard internal conductivity is defined by the breadboard topology engine.

Derived nets are **not persisted**.

```text
pins
+ wires
+ terminal placements
+ breadboard conductive strips
→ resolveNets()
→ electrical nets
```

This avoids storing a stale second representation of connectivity.

## 6. Project migration

- v1: board-first starter/intention format;
- v2: board + canonical component instances + direct component pin connections;
- v3: explicit physical wires, breadboard-hole endpoints and terminal placements.

Migration is deterministic:

```text
v1 → v2 → v3
```

Old documents migrate in memory on load. Reading alone does not force a cloud rewrite. An intentional edit/checkpoint persists the newest version.

Supabase currently accepts schema versions 1, 2 and 3 so old documents remain recoverable during migration.

## 7. Validation layers

Validation is intentionally layered.

### Structural validity

Rejects malformed documents, unknown definitions, invalid IDs/endpoints and malformed transforms.

### Electrical safety

Rejects states that Kinetable must never commit, including supported power shorts, incompatible rails and prohibited output conflicts.

### Circuit completeness

Returns structured incomplete diagnostics for missing required connections or supported topology rules.

Manual editing may save a **safe incomplete** project.

AI Assembly must pass the stricter complete-circuit gate before claiming success.

### Future simulation compatibility

Slice 09 adds a separate compatibility/runtime layer. A circuit that is electrically complete is not automatically a proof of analog, timing, thermal or firmware correctness.

## 8. Breadboard and nets

The current canonical breadboard is `breadboard-half-400`:

- A–J × 30 terminal holes;
- center trench separating A–E and F–J;
- four independent continuous 25-hole rails in this exact model;
- 400 generated holes total.

Topology is pure domain data, not derived from mesh position.

`resolveNets` uses deterministic graph/union-find resolution across:

- component pins;
- physical wires;
- inserted leads;
- breadboard strips/rails.

A net can therefore connect a board pin to a component through several breadboard holes without requiring a direct edge.

## 9. Command-based mutations

Manual and AI changes share deterministic commands rather than patching raw JSON.

Current command families include:

```text
component.add / remove / replace
connection.create / remove   # compatibility for AI/direct pin plans
breadboard.add / remove
wire.add / remove
terminal.place / unplace
layout.move
```

Each transaction:

```text
current project
→ commands
→ candidate
→ structural + electrical-safety validation
→ atomic local save
→ optional cloud checkpoint
```

Invalid transactions leave the original document unchanged.

## 10. Workbench state

Persistent project truth:

- components;
- wires;
- terminal placements;
- layout;
- project metadata.

Transient UI state:

- selection;
- hover;
- current drag transform;
- wire preview;
- camera state;
- inspector visibility;
- simulation playback state.

Transient interaction state must not be written to IndexedDB or Supabase each frame.

## 11. History and persistence

Manual edits are local-first.

```text
interaction
→ one validated transaction
→ IndexedDB
→ update visible project
→ debounced/coalesced cloud checkpoint
```

Undo/redo history is bounded and session-local. Undo/redo restores content but creates a new current revision timestamp.

Current multi-device sync remains last-successful-write oriented. Conflict-safe project versioning belongs to Slice 12 — Personal Workspace.

## 12. AI provider architecture

Provider transports:

```text
REMOTE_API
CUSTOM_OPENAI_COMPATIBLE
LOCAL_HTTP
LOCAL_CLI
```

Routing supports multiple credentials for a provider and ordered provider fallback.

BYOK credentials are device-local by default. They are never stored in project JSON or Supabase project rows. Remote calls may send the selected credential through the Vercel function only for that request.

Local Bridge handles supported localhost runtimes and authenticated CLIs with explicit bounded adapters rather than arbitrary command execution.

## 13. Simulation architecture — next

Slice 09 — Living Circuit combines simulation and Explain/X-Ray.

Required design:

```text
Project v3
→ validate simulation compatibility
→ compile topology once
→ SimulationRuntime
    ├─ logical clock
    ├─ component state
    ├─ net/signal state
    └─ event/causal trace
→ UI observation
→ Explain / X-Ray
```

Rendering must observe simulation state; animation frames must not determine simulation correctness.

Explain/X-Ray should consume the same runtime/net facts rather than recomputing a second interpretation.

## 14. Visual Logic — Slice 10

Visual Logic will add a semantic behavior IR such as:

```text
WHEN button.pressed
DO oled.text = "BONK!"
AND led.state = ON
AND buzzer.beep(count=2)
```

That IR should drive Slice 09 simulation and later compile to board/framework-specific firmware.

## 15. Physical runtime — Slice 14

Future path:

```text
project + visual logic
→ firmware generation
→ compile API
→ isolated Arduino CLI / ESP-IDF / Pico SDK worker
→ .bin / .uf2
→ Web Serial / WebUSB / supported local bridge
→ live telemetry
```

Heavy compilation must not run in Supabase Edge Functions.

## 16. Digital twin — Slice 15

Vision/camera reconstruction must map observations into the same project entities:

```text
observed component → canonical definition / component instance
observed wire → project electrical endpoints
observed breadboard hole → canonical hole ID
```

There must not be a second incompatible “camera circuit model.”

## 17. Canonical roadmap

Current canonical roadmap:

```text
01 Landing                     ✅
02 Onboarding / Foundation     ✅
03 Auth                        ✅
04 My Table                    ✅
05 New Build                   ✅
06 AI Assembly                 ✅
07 Core 3D Workbench           ✅
08 Physical Circuit Editor     ✅
09 Living Circuit              next
10 Visual Logic
11 Hardware Platform
12 Personal Workspace
13 Learn
14 Physical Runtime
15 Digital Twin
```

See [ROADMAP.md](ROADMAP.md) for full slice scope.

## 18. Reliability principle

Users must be able to trust statements like:

> This power connection is unsafe.

Those claims come from deterministic metadata, topology and runtime rules—not model improvisation or visual proximity.

Operational details are in [BACKEND.md](BACKEND.md). Current implementation evidence is in [SLICE-06.md](SLICE-06.md), [SLICE-07.md](SLICE-07.md), and [SLICE-08.md](SLICE-08.md).
