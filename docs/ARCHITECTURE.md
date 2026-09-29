# Kinetable Technical Architecture

## 1. Architectural goal

Kinetable is an AI-native visual hardware workspace. The versioned project/electrical model is the source of truth; UI, 3D rendering, AI, persistence, simulation and future physical-workbench vision operate through controlled domain boundaries.

```text
┌──────────────────────────────────────────────┐
│                  UI / UX                     │
│ landing · onboarding · table · logic · learn │
├──────────────────────────────────────────────┤
│             Spatial interaction              │
│ select · drag · snap · wire · camera         │
├──────────────────────────────────────────────┤
│           Project / hardware model           │
│ components · pins · wires · logic            │
├──────────────────────────────────────────────┤
│           Derived electrical graph           │
│ topology · nets · validation                 │
├──────────────────────────────────────────────┤
│          Behavior + simulation runtime       │
│ logic compiler · drivers · clock · trace     │
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
- semantic native controls + custom Kinetable UI
- Tailwind CSS
- Motion

The current app does not depend on a separate component-primitives framework; add one only when it reduces real UI complexity.

### Cloud

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage when asset use requires it
- Vercel Functions
- Vercel previews/hosting

### Local bridge

The optional Kinetable Local Bridge binds to loopback and supports approved local runtimes/CLIs. It is not an arbitrary remote-shell API.

### Testing

- Vitest for deterministic domain/unit tests
- Playwright for browser and deployed flows
- hosted Supabase ownership/RLS checks
- deterministic simulation/logic tests

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

Cloud never sits in the high-frequency workbench, simulation or visual-logic interaction loop.

## 4. Main domain boundaries

### `projects`

Owns versioned project schemas and deterministic migrations.

Current editable format: **Project v4**.

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
- bounded history helpers.

It must not depend on React, Three.js, Zustand, Vercel, Supabase or AI provider SDKs.

### `component-library`

Owns canonical component definitions and stable definition IDs.

Current records include electrical models, pins, supply metadata, descriptions and visual IDs. Visual pin/lead anchors remain presentation metadata keyed by the same stable electrical pin IDs.

Slice 11 expands this into the provenance-aware hardware platform and should reduce remaining board/catalog metadata duplication rather than creating another parallel definition source.

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

Owns planner contracts, provider routing and provider-independent hardware assembly orchestration.

AI returns strict Kinetable operations. It never directly edits the DOM, Three.js scene or arbitrary project JSON. The hardware planner rejects `logic.*`; the separate behavior planner validates bounded proposals through the same deterministic command path.

### `simulation`

Simulation is independent from rendering and persistence. `compileCircuit.ts` caches the validated physical graph by project + topology key, `drivers.ts` binds canonical electrical models, `recipes.ts` matches logic-empty demonstrations, `runtime.ts` advances a logical clock and records causal events, and `explain.ts` derives X-Ray paths and explanations from the same graph/trace.

Responsibilities:

- compile a project/net graph into simulation-ready state;
- deterministic logical clock;
- bounded event queue;
- component-driver bindings;
- net/signal runtime state;
- causal trace used by Explain/X-Ray.

The simulator reuses a compiled graph rather than recomputing breadboard topology every tick.

### `logic`

`logic/schema.ts` owns the strict persistent WHEN/IF/DO IR. `logic/compile.ts` validates component references and binds authored behavior to the compiled physical circuit. `LogicPanel.tsx` emits explicit project commands; React does not own behavior truth.

No arbitrary script, expression language, WAIT/REPEAT program or executable source exists in the current logic IR.

## 5. Current project format — v4

Conceptually:

```ts
interface KinetableProjectV4 {
  schemaVersion: 4
  id: string
  name: string
  intent?: { text: string }
  boardIds: string[]
  components: ComponentInstance[]
  wires: Wire[]
  terminalPlacements: TerminalPlacement[]
  logic: LogicRule[]
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

A wire joins two physical endpoints. A terminal placement inserts a supported lead into a breadboard hole. Breadboard internal conductivity is defined by the topology engine.

Derived nets are **not persisted**:

```text
pins
+ wires
+ terminal placements
+ breadboard conductive strips
→ resolveNets()
→ electrical nets
```

Simulation outputs, logical time and traces are also ephemeral and are not project data.

## 6. Project migration

- v1: board-first starter/intention format;
- v2: board + canonical components + direct component-pin connections;
- v3: explicit physical wires, breadboard-hole endpoints and terminal placements; historical logic stays empty;
- v4: v3 physical document + strict persistent semantic behavior rules.

Migration is deterministic:

```text
v1 → v2 → v3 → v4
```

Old documents migrate in memory on load. Reading alone does not force a cloud rewrite. An intentional edit/checkpoint persists the newest version. Supabase accepts schema versions 1–4 so historical rows remain recoverable.

Historical schema modules are intentionally retained for parsing/migration; they are not duplicate current project models.

## 7. Validation layers

Validation is intentionally layered.

### Structural validity

Rejects malformed documents, unknown definitions, invalid IDs/endpoints/transforms and malformed logic syntax.

### Electrical safety

Rejects states Kinetable must never commit, including supported power shorts, incompatible rails and prohibited output conflicts.

### Circuit completeness

Returns structured diagnostics for missing required connections or supported topology rules. Manual editing may save a **safe incomplete** project. AI Assembly must pass the stricter complete-circuit gate before claiming success.

### Simulation compatibility

A circuit may be structurally/electrically valid yet unsupported by the semantic simulator. Simulation compatibility checks canonical drivers/topology separately.

### Logic validity

Authored rules must reference compatible, physically bound components. Hardware changes that would leave persisted behavior invalid are rejected atomically until the user updates/removes the relevant logic.

### Physical verification — later

Simulation does not prove a real circuit is physically built correctly. Slice 14 telemetry and Slice 15 camera observations add separate evidence.

## 8. Breadboard and nets

The current canonical breadboard is `breadboard-half-400`:

- A–J × 30 terminal holes;
- center trench separating A–E and F–J;
- four independent continuous 25-hole rails in this exact model;
- 400 generated holes total.

Topology is pure domain data, not derived from mesh position.

`resolveNets` performs deterministic graph/union-find resolution across component pins, physical wires, inserted leads and breadboard strips/rails.

## 9. Command-based mutations

Manual and AI changes share deterministic commands rather than patching raw JSON.

Current command families include:

```text
component.add / remove / replace
connection.create / remove   # compatibility for AI/direct-pin plans
breadboard.add / remove
wire.add / remove
terminal.place / unplace
layout.move
logic.rule.add / update / remove / enable / reorder
```

`connection.*` remains deliberately as the AI/direct-pin compatibility surface while `wire.*` represents the current physical conductor model. It should not be removed merely because the names overlap.

Each transaction:

```text
current project
→ commands
→ candidate copy
→ structural / electrical / logic validation as applicable
→ atomic local save
→ optional cloud checkpoint
```

Invalid transactions leave the original document unchanged.

## 10. Workbench state

Persistent project truth:

- components;
- wires;
- terminal placements;
- authored logic;
- layout;
- project metadata.

Transient UI/runtime state:

- selection;
- hover;
- current drag transform;
- wire preview;
- camera state;
- inspector visibility;
- simulation playback/state;
- causal trace;
- X-Ray selection.

Transient state must not be written to IndexedDB or Supabase each frame.

## 11. History and persistence

Manual edits are local-first:

```text
interaction
→ one validated transaction
→ IndexedDB
→ update visible project
→ debounced/coalesced cloud checkpoint
```

Undo/redo history is bounded and session-local. Restoring old content creates a new current revision timestamp.

The Slice 12 local candidate uses a server revision and atomic PostgreSQL checkpoint function. Local IndexedDB versions and persistent conflicts preserve device work; immutable cloud versions preserve each successful head. Concurrent project edits require an explicit choice instead of timestamp-based overwrite. Production checkpoint writes remain paused pending approval. [Slice 12](SLICE-12.md).

## 12. AI provider architecture

Provider transports:

```text
REMOTE_API
CUSTOM_OPENAI_COMPATIBLE
LOCAL_HTTP
LOCAL_CLI
```

Routing supports multiple credentials for a provider and ordered provider fallback.

BYOK credentials are device-local by default. They are never stored in project JSON or Supabase project rows. Remote calls may send the selected credential through a Vercel function only for that request.

Local Bridge handles supported localhost runtimes and authenticated CLIs with explicit bounded adapters rather than arbitrary command execution.

## 13. Simulation + Visual Logic architecture

```text
Project v4 physical document
→ validate physical graph / simulation compatibility
→ CompiledCircuit

Project v4.logic
→ validate semantic references + physical bindings
→ CompiledBehaviorProgram

CompiledCircuit + behavior/recipe
→ SimulationRuntime
    ├─ logical clock
    ├─ component state
    ├─ net/signal state
    ├─ bounded event queue
    └─ causal trace
→ UI observation
→ Explain / X-Ray
```

Authored Visual Logic suppresses demonstration recipes. Logic-empty projects may still use the Slice 09 recipes. Rendering observes runtime state; animation-frame rate never determines simulation correctness.

## 14. Physical runtime — Slice 14

Future path:

```text
Project v4 + Visual Logic
→ firmware generation
→ compile API
→ isolated Arduino CLI / ESP-IDF / Pico SDK worker
→ .bin / .uf2
→ Web Serial / WebUSB / supported Local Bridge
→ live telemetry
```

Heavy compilation must not run in Supabase Edge Functions.

## 15. Digital twin — Slice 15

Vision/camera reconstruction must map observations into the same project entities:

```text
observed component → canonical definition / component instance
observed wire → project electrical endpoints
observed breadboard hole → canonical hole ID
```

There must not be a second incompatible camera circuit model.

## 16. Canonical roadmap

```text
01 Landing                     ✅
02 Onboarding / Foundation     ✅
03 Auth                        ✅
04 My Table                    ✅
05 New Build                   ✅
06 AI Assembly                 ✅
07 Core 3D Workbench           ✅
08 Physical Circuit Editor     ✅
09 Living Circuit              ✅
10 Visual Logic                ✅
11 Hardware Platform
12 Personal Workspace
13 Learn
14 Physical Runtime
15 Digital Twin
```

See [ROADMAP.md](ROADMAP.md) for full slice scope.

## 17. Reliability principle

Users must be able to trust statements such as:

> This power connection is unsafe.

Those claims come from deterministic metadata, topology and runtime rules—not model improvisation or visual proximity.

Operational details are in [BACKEND.md](BACKEND.md). Slice-specific implementation evidence is recorded in [SLICE-06.md](SLICE-06.md), [SLICE-07.md](SLICE-07.md), [SLICE-08.md](SLICE-08.md), [SLICE-09.md](SLICE-09.md) and [SLICE-10.md](SLICE-10.md).

## Pre-Slice-11 integration

ProjectsPage reads the existing repository with liveQuery and owner filtering; cloud reconciliation restores rows through existing sync. openById resolves exact eligible identity and rejects superseded selection. /table is a remembered/current compatibility redirect. Appearance preference storage is separate from project storage.

behaviorPlanner is a strict separate logic contract within the existing provider pipeline. It compiles physical bindings and a complete candidate. Apply rechecks identity/revision inside applyTransaction, sharing atomic commands/history/local save/cloud checkpoint with manual editing. Hardware inference remains hardware-only. Pointer previews update Three.js on demand. Simulate/Explain retains unchanged runtime identity. [Correction](PRE-SLICE-11-UX-CORRECTION.md).

## Slice 11 hardware platform

The validated component definitions in `component-library/definitions/` are indexed by `catalog.ts` and feed deterministic compatibility, electrical validation, simulation capabilities, UI details and generated planner context. IndexedDB `inventoryItems` is separate from Project v4. Guest and account namespaces are exact; signed-in rows reconcile with owner-only Supabase `inventory_items`. The remote owned-only AI boundary reloads the owned project and inventory through the user JWT/RLS before planning. [Implementation](SLICE-11.md).

## Slice 12 personal workspace

`projectHistoryRepository` owns local versions/conflicts; `projectSyncService` reconciles cloud heads by server revision; `checkpoint_project` advances head and inserts a cloud version atomically. `workspaceSyncState` interprets profile, project and inventory state without moving their persistence into one store. Explore uses five static recipes, canonical component IDs, compatibility and exact inventory quantities. [Implementation](SLICE-12.md).
