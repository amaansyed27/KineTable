# Kinetable Technical Architecture

## 1. Architectural goals

Kinetable must support a visual-first product without coupling product logic to a single UI framework or AI provider.

The architecture should make these layers explicit:

```text
┌──────────────────────────────────────────────┐
│                  UI / UX                     │
│  workbench · parts · projects · learn        │
├──────────────────────────────────────────────┤
│             Spatial interaction              │
│  select · drag · snap · wire · camera        │
├──────────────────────────────────────────────┤
│           Project / hardware model           │
│  components · pins · nets · breadboards      │
├──────────────────────────────────────────────┤
│                Simulation                    │
│  signals · timing · virtual sensor state     │
├──────────────────────────────────────────────┤
│                 AI layer                     │
│  intent · planning · explanation · tools     │
├──────────────────────────────────────────────┤
│          Platform / hardware bridge          │
│ browser now · Tauri/USB/CLI later            │
└──────────────────────────────────────────────┘
```

The electrical/project model is the source of truth. 3D scenes, visual logic, AI, and future camera reconstruction all read or modify that model through controlled interfaces.

## 2. Stack

### Frontend

- React
- TypeScript with `strict` mode
- Vite
- React Router or a similarly small client router

### 3D

- Three.js
- React Three Fiber
- Drei
- GLB/glTF assets
- optional Draco/Meshopt compression after asset pipeline is stable

### UI

- Tailwind CSS for tokens/utilities
- Radix UI for accessible primitives
- Motion for non-3D interface transitions
- custom components for all visible product surfaces

Avoid adopting a pre-styled component system as Kinetable's visual language.

### State

Zustand, separated by domain rather than one global store.

Suggested stores:

```text
projectStore
workbenchStore
selectionStore
simulationStore
inventoryStore
uiStore
aiStore
```

Pure hardware/simulation code should not depend on Zustand.

### Local persistence

- IndexedDB
- Dexie

Store locally by default:

- onboarding state;
- My Parts;
- projects;
- table layouts;
- preferences;
- local model/cache metadata when relevant.

### Testing

- Vitest for pure packages and unit tests
- React Testing Library for UI state
- Playwright for end-to-end flows
- deterministic simulation tests in `hardware-core` / `simulation`

### Monorepo

- pnpm workspaces
- Turborepo

## 3. Proposed repository structure

```text
apps/
  web/
    src/
      app/
      routes/
      features/
      styles/
  desktop/                  # later, Tauri host

packages/
  ui/                       # Kinetable UI primitives
  spatial/                  # R3F scene, selection, transforms, wire visuals
  hardware-core/            # components, pins, nets, validation
  simulation/               # runtime graph + behaviour drivers
  visual-logic/             # semantic behaviour graph
  component-library/        # canonical component definitions
  ai/                       # provider adapters + tool planner
  project-format/           # versioned serialization

assets/
  models/
  textures/

docs/
```

## 4. Package boundaries

### `hardware-core`

Must be framework-agnostic.

Responsibilities:

- component instances;
- pin definitions;
- electrical capabilities;
- nets/connections;
- breadboard topology;
- compatibility/validation rules;
- project mutations;
- IDs and references.

Must not import React, Three.js, Zustand, or an AI SDK.

### `simulation`

Responsibilities:

- runtime state;
- digital/analog value propagation;
- timers/events;
- component simulation drivers;
- deterministic stepping;
- observable state for UI.

Depends on `hardware-core` types.

### `spatial`

Responsibilities:

- 3D scene;
- camera;
- object transforms;
- hit testing;
- selection;
- drag/rotate;
- breadboard placement visualization;
- wire curves;
- signal animation;
- mapping between project entity IDs and 3D objects.

Should not decide whether a connection is electrically legal. It asks `hardware-core`.

### `visual-logic`

Responsibilities:

- semantic WHEN/IF/DO graph;
- mapping visual behaviour to simulation operations;
- validation of behaviour graph;
- serialization.

### `component-library`

Responsibilities:

- canonical definitions;
- schemas;
- model references;
- metadata;
- simulation-driver registration;
- provenance/license metadata.

### `ai`

Responsibilities:

- natural-language intent parsing;
- provider adapters;
- controlled tool calls;
- explanation generation;
- structured plan validation.

AI never directly edits DOM, Three.js scene objects, or arbitrary project JSON.

### `project-format`

Responsibilities:

- versioned project schema;
- migrations;
- import/export;
- stable IDs;
- validation.

## 5. Project model

Example high-level project:

```ts
interface KinetableProject {
  schemaVersion: number
  id: string
  name: string
  boardIds: string[]
  components: ComponentInstance[]
  nets: Net[]
  behaviours: BehaviourGraph
  layout: WorkbenchLayout
  simulation?: SimulationSettings
  metadata: ProjectMetadata
}
```

Project logic and layout are related but separate.

Moving an ESP32 in 3D changes `layout`, not its electrical identity.

## 6. Entity IDs

Every component instance, pin, net, logic node, and meaningful spatial anchor needs a stable ID.

Example:

```text
component: esp32-main
pin:       esp32-main:gpio23
net:       net-led-drive
logic:     event-button-pressed
```

Stable IDs are required for:

- persistence;
- AI tools;
- undo/redo;
- visual highlighting;
- code mappings;
- future camera reconciliation.

## 7. Command-based mutations

Project changes should use commands rather than arbitrary mutation.

Example:

```ts
type ProjectCommand =
  | { type: 'component.add'; componentId: string; definitionId: string }
  | { type: 'component.remove'; componentId: string }
  | { type: 'connection.create'; from: EndpointRef; to: EndpointRef }
  | { type: 'connection.remove'; netId: string }
  | { type: 'component.setProperty'; componentId: string; key: string; value: unknown }
  | { type: 'logic.update'; graph: BehaviourGraph }
  | { type: 'layout.move'; entityId: string; transform: Transform }
```

Benefits:

- AI can call the same commands as users;
- undo/redo becomes straightforward;
- validation is centralized;
- actions can be logged/replayed;
- future collaboration is easier.

## 8. Undo / redo

Implement command history early for build actions.

Minimum:

- add/remove component;
- connect/disconnect;
- move/rotate;
- property change;
- logic edit.

Do not tie undo to React state snapshots of the entire app.

## 9. Spatial scene

Suggested scene hierarchy:

```text
<KinetableCanvas>
  <Environment />
  <WorkbenchSurface />
  <ProjectScene>
    <HardwareObject />...
    <WireLayer />
    <SignalLayer />
    <LogicOverlay3D />
  </ProjectScene>
  <SelectionLayer />
  <CameraController />
</KinetableCanvas>
```

`HardwareObject` should be generic and driven by component definition + instance state.

## 10. 3D asset pipeline

Preferred format: GLB.

Each model should have:

- consistent world scale (meters or documented conversion);
- origin defined intentionally;
- pin/connection anchor metadata;
- simplified collision geometry if needed;
- reasonable polygon budget;
- material names that can be overridden for selection states;
- provenance/license record.

Do not bake product behaviour into Blender node names without a schema layer.

## 11. Pin anchors

Pin locations should be machine-readable.

Example component metadata:

```json
{
  "anchors": {
    "gpio23": { "position": [0.012, 0.004, -0.021], "normal": [0, 1, 0] },
    "gnd-1":  { "position": [0.012, 0.004, -0.018], "normal": [0, 1, 0] }
  }
}
```

The spatial layer can transform these local coordinates into world coordinates for wires and overlays.

## 12. Wire representation

A wire is not the electrical connection itself.

Separate:

- **Net** — electrical relationship in `hardware-core`.
- **Wire visual** — one spatial representation of that relationship.

This distinction is essential for breadboards, where components may be electrically connected without a direct wire between them.

## 13. Breadboard placement

A breadboard component exposes hole anchors and internal conductive groups.

When a lead is placed into a hole:

1. spatial layer determines target hole;
2. `hardware-core` records placement endpoint;
3. breadboard topology resolves shared node membership;
4. validation/simulation sees the resulting net.

## 14. Simulation loop

Simulation should be deterministic and testable.

Possible shape:

```text
user input
→ component driver updates state
→ events queued
→ graph propagation
→ output drivers update
→ UI observes state
```

Avoid tying simulation correctness to animation frame rate.

Use a logical clock/tick system.

## 15. Visual Logic synchronization

Visual logic should compile into a small intermediate representation consumed by simulation.

Example:

```text
WHEN button.pressed
DO oled.text = "BONK!"
AND led.state = ON
AND buzzer.beep(count=2, duration=120ms)
```

The same semantic model can later generate firmware code through board/framework adapters.

## 16. Generated code architecture

Do not make source code the source of truth in the early visual workflow.

Preferred direction:

```text
project + visual logic
        ↓
intermediate behaviour model
        ↓
board/framework adapter
        ↓
Arduino / ESP-IDF / Pico SDK source
```

Advanced users may edit generated code later. Once two-way synchronization is introduced, clearly define which edits are round-trippable and which convert the project into an advanced/custom-code state.

## 17. Desktop architecture — later

Tauri host:

```text
React UI
   ↓ IPC
Rust commands
   ↓
serial / USB / filesystem / compiler adapters
```

Potential adapters:

```text
arduino-cli
esptool / ESP-IDF
Pico SDK / UF2
serial monitor
camera access
local asset/model cache
```

Do not let the web UI execute shell commands directly.

## 18. Cloud — later

Cloud should enhance, not gate, the local product.

Potential cloud responsibilities:

- account identity;
- project sync;
- inventory sync;
- component metadata updates;
- AI request proxy where needed;
- sharing/community;
- telemetry with consent.

## 19. Performance targets

Initial desktop web target:

- smooth interaction at 60 fps on a typical modern laptop for small/medium projects;
- first useful scene quickly after app load;
- component selection response under ~100 ms perceived latency;
- no full-scene rerender caused by minor UI state;
- lazy-load heavy 3D models;
- use instancing for repeated simple parts when useful.

## 20. Reliability principle

The user should be able to trust statements such as:

> This pin cannot drive that output.

Those statements must come from deterministic metadata/rules and validated sources, not model improvisation.

That reliability boundary is one of the most important architectural constraints in Kinetable.
