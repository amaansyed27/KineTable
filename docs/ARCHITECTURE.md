# Kinetable Technical Architecture

## 1. Architectural goals

Kinetable must support a visual-first product without coupling product logic to one UI framework, AI provider, cloud vendor or hardware toolchain.

```text
┌──────────────────────────────────────────────┐
│                  UI / UX                     │
│ landing · onboarding · table · parts · learn │
├──────────────────────────────────────────────┤
│             Spatial interaction              │
│ select · drag · snap · wire · camera        │
├──────────────────────────────────────────────┤
│           Project / hardware model           │
│ components · pins · nets · breadboards      │
├──────────────────────────────────────────────┤
│                Simulation                    │
│ signals · timing · virtual sensor state     │
├──────────────────────────────────────────────┤
│                 AI layer                     │
│ intent · planning · explanation · tools     │
├──────────────────────────────────────────────┤
│          Persistence / cloud services        │
│ local DB · Supabase · Vercel APIs           │
├──────────────────────────────────────────────┤
│          Platform / hardware bridge          │
│ Web Serial/USB · compile worker · Tauri     │
└──────────────────────────────────────────────┘
```

The electrical/project model is the source of truth. 3D scenes, visual logic, AI, persistence and future camera reconstruction all read or modify that model through controlled interfaces.

## 2. Locked stack

### Frontend

- React
- TypeScript with strict mode
- Vite
- React Router

### 3D

- Three.js
- React Three Fiber
- Drei
- GLB/glTF assets

### UI

- Tailwind CSS for tokens/utilities
- Radix UI for accessible primitives
- Motion for non-3D interface transitions
- custom Kinetable visible components

Avoid adopting a pre-styled component library as the product's visual language.

### Client state and local persistence

- Zustand, separated by domain
- IndexedDB + Dexie

High-frequency workbench interaction must remain local and immediate.

Suggested stores:

```text
projectStore
workbenchStore
selectionStore
simulationStore
inventoryStore
uiStore
aiStore
profileStore
```

Pure hardware/simulation code must not depend on Zustand.

### Backend / cloud

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime later where useful
- Vercel Functions for API/AI orchestration
- Vercel for web hosting and preview deployments

Heavy firmware compilation is behind a separate replaceable worker interface rather than running in the database layer.

### Testing

- Vitest for pure packages/unit tests
- React Testing Library for UI state
- Playwright for end-to-end/browser flows
- deterministic simulation tests in hardware-core/simulation
- schema/migration/RLS checks for backend work where practical

### Workspace

- pnpm workspaces
- Turborepo when package count justifies it

## 3. Runtime topology

```text
                       VERCEL
                          │
                    Kinetable Web
                          │
             ┌────────────┴────────────┐
             │                         │
          Supabase                Vercel APIs
      DB/Auth/Storage              AI / server
             │                         │
             └────────────┬────────────┘
                          │
                IndexedDB + Zustand
                          │
                 Web Serial / WebUSB
                          │
               ESP32 / Pico / Arduino
```

Cloud enhances the product but does not sit in the render/input loop for the workbench.

## 4. Repository direction

```text
apps/
  web/
    src/
      app/
      landing/
      onboarding/
      table/
      hardware/
      state/
      persistence/
      spatial/
      styles/
  desktop/                  # later Tauri host

packages/
  ui/
  spatial/
  hardware-core/
  simulation/
  visual-logic/
  component-library/
  ai/
  project-format/

supabase/
  migrations/

assets/
  models/
  textures/

docs/
```

Do not force this exact shape prematurely; package boundaries should appear when they have real ownership.

## 5. Core package boundaries

### `hardware-core`

Framework-agnostic source of electrical truth.

Responsibilities:

- component instances;
- pin definitions;
- electrical capabilities;
- nets/connections;
- breadboard topology;
- compatibility and validation rules;
- project mutations;
- stable IDs.

Must not import React, Three.js, Zustand or an AI SDK.

### `simulation`

Responsibilities:

- runtime state;
- digital/analog propagation;
- timers/events;
- component simulation drivers;
- deterministic stepping;
- observable simulation state.

Depends on hardware-core types.

### `spatial`

Responsibilities:

- 3D scene and camera;
- transforms;
- hit testing;
- selection;
- drag/rotate;
- placement visualization;
- wire curves;
- signal animation;
- mapping project entity IDs to 3D objects.

It does not decide electrical legality; it asks hardware-core.

### `visual-logic`

Responsibilities:

- semantic WHEN/IF/DO graph;
- simulation intermediate representation;
- behaviour validation;
- serialization;
- later code-generation mapping.

### `component-library`

Responsibilities:

- canonical definitions;
- schemas;
- asset/model references;
- pin/anchor metadata;
- simulation-driver registration;
- documentation/provenance/license metadata.

### `ai`

Responsibilities:

- provider adapters;
- natural-language intent parsing;
- controlled tool calls;
- explanation generation;
- structured plan validation.

AI never edits DOM, Three.js objects or arbitrary project JSON directly.

### `project-format`

Responsibilities:

- versioned project schema;
- migrations;
- import/export;
- stable IDs;
- validation.

## 6. Project model

```ts
interface KinetableProjectV2 {
  schemaVersion: 2
  id: string
  name: string
  intent?: { text: string }
  boardIds: string[]
  components: ComponentInstanceV2[]
  connections: Connection[]
  logic: []
  layout: WorkbenchLayout
  metadata: ProjectMetadata
}
```

Schema version 1 remains the original one-board, empty-connection format. Slice 06 introduces version 2 with canonical board/component instances and electrical endpoint connections. On load, v1 migrates deterministically in memory; an intentional checkpoint stores v2. Logic remains empty. Layout maps stable instance IDs to serializable position, rotation and scale.

`/new` calls `projectStore.createBuild`, not Dexie or Supabase. The domain builder validates intent and name, promotes a structurally pristine starter or creates a new UUID, then the store saves locally and starts an authenticated cloud checkpoint. The `projects` IndexedDB store holds multiple documents; most recent update selects the current project. The cloud repository validates structural and electrical safety plus matching relational ID, name, board and schema version on read. Incomplete editor drafts are allowed; AI Assembly separately requires a complete circuit.

## 7. Stable entity IDs

Every component instance, pin, net, logic node and meaningful spatial anchor requires a stable ID.

```text
component: esp32-main
pin:       esp32-main:gpio23
net:       net-led-drive
logic:     event-button-pressed
```

Required for persistence, AI tools, undo/redo, visual highlighting, code mappings, collaboration and future camera reconciliation.

## 8. Command-based mutations

Project changes use commands rather than arbitrary mutation.

```ts
type ProjectCommand =
  | { type: 'component.add'; instanceId: string; definitionId: string }
  | { type: 'component.remove'; instanceId: string }
  | { type: 'component.replace'; instanceId: string; replacementId: string; definitionId: string }
  | { type: 'connection.create'; id: string; from: EndpointRef; to: EndpointRef }
  | { type: 'connection.remove'; id: string }
  | { type: 'layout.move'; entityId: string; transform: Transform }
```

Benefits:

- AI and manual tools share the same mutation path;
- validation is centralized;
- undo/redo is tractable;
- operations can be logged/replayed;
- future collaboration is easier.

## 9. Persistence architecture

### Local

IndexedDB/Dexie stores:

- onboarding/profile state;
- local inventory;
- projects;
- table layouts;
- preferences;
- pending cloud-sync metadata.

UI components should use repositories/stores, not call IndexedDB/localStorage directly.

### Cloud

Initial Supabase entities:

```text
profiles
projects
project_versions
hardware_inventory
board_catalog
component_catalog
```

The complete project graph is initially stored as versioned JSONB. Important searchable metadata stays relational.

Cloud sync occurs at deliberate boundaries rather than on every pointer movement.

## 10. Authentication and authorization

Authentication is optional for first use.

Supabase Auth provides Google/GitHub/email. Guest/local work remains possible.

All user-owned cloud tables require Row Level Security. Service-role credentials remain server-only. BYOK credentials reside on the user's device and are sent to the Vercel proxy only for the selected request; the server neither persists nor logs them.

When a local/guest user signs in, existing local work must be associated/migrated intentionally rather than silently discarded.

## 11. AI server boundary

```text
Browser
  ↓
Vercel Function
  ↓
model provider
  ↓
structured Kinetable commands
  ↓
hardware-core validation
  ↓
apply/reject
```

The model never returns arbitrary React code or unvalidated full project state as the mutation mechanism.

## 12. Spatial scene

Suggested hierarchy:

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

`HardwareObject` is generic and driven by definition + instance state.

## 13. 3D asset pipeline

Preferred format: GLB.

Each canonical model needs:

- consistent scale;
- intentional origin;
- machine-readable pin/connection anchors;
- simplified collision geometry where useful;
- reasonable polygon budget;
- overridable materials for interaction states;
- provenance/license record.

Canonical assets can live in Supabase Storage once the component-library backend is introduced.

## 14. Wire and breadboard representation

A visible wire is not the electrical connection itself.

Separate:

- **Net** — electrical relationship in hardware-core.
- **Wire visual** — one spatial representation of that relationship.

Breadboards expose hole anchors and internal conductive groups. Lead placement changes project topology through hardware-core rather than through Three.js state.

## 15. Simulation

Simulation must be deterministic and testable.

```text
user input
→ driver state change
→ logical events
→ graph propagation
→ output drivers
→ UI observation
```

Use a logical clock/tick system; animation frame rate does not determine simulation correctness.

## 16. Visual Logic and generated code

Visual logic compiles to a semantic intermediate representation.

```text
WHEN button.pressed
DO oled.text = "BONK!"
AND led.state = ON
AND buzzer.beep(count=2)
```

Preferred generated-code direction:

```text
project + visual logic
        ↓
behaviour IR
        ↓
board/framework adapter
        ↓
Arduino / ESP-IDF / Pico SDK source
```

Code is not the default source of truth in the visual workflow. Advanced two-way editing needs explicit round-trip rules.

## 17. Browser hardware and compilation

Where supported:

```text
Kinetable Web
→ Web Serial / WebUSB
→ connected board
```

Firmware compilation is abstracted:

```text
project/source
→ Vercel orchestration API
→ isolated compile worker
→ Arduino CLI / ESP-IDF / Pico SDK
→ .bin / .uf2
→ browser flash
```

The worker is replaceable so Kinetable is not coupled to one compute vendor. Do not use Supabase Edge Functions for heavy toolchain workloads.

## 18. Desktop fallback — later

Tauri host:

```text
React UI
   ↓ IPC
Rust commands
   ↓
serial / USB / filesystem / compiler adapters
```

The browser product remains primary; desktop/native exists for deeper local access, unsupported browsers and advanced workflows.

## 19. Deployment

- Vercel preview deployment per branch/PR where appropriate;
- production on Vercel;
- Supabase for cloud data/auth/storage;
- separate development/staging and production data boundaries before real users;
- `.env.example` documents required configuration;
- secrets never committed.

See `docs/BACKEND.md` for operational/backend details.

## 20. Performance targets

Initial desktop web target:

- smooth interaction near 60 fps for small/medium projects;
- quick first useful scene;
- selection response under ~100 ms perceived latency;
- no full-scene rerender for minor UI state;
- lazy-load heavy models;
- use instancing for repeated simple parts where appropriate;
- network/cloud latency must not block spatial manipulation.

## 21. Reliability principle

Users must be able to trust statements such as:

> This pin cannot drive that output.

Those claims come from deterministic metadata/rules and validated sources, not model improvisation.

That boundary is one of Kinetable's core architectural constraints.


## 22. Implemented through Slice 07

React Router supplies `/`, `/start`, `/table`, `/new`, `/auth` and `/auth/callback`. Canonical board and part definitions live in `apps/web/src/component-library`; Zustand profile state persists through a Dexie repository. Presentation geometry is shared independently of landing choreography.

A single auth boundary owns Supabase sessions. The typed cloud profile repository reconciles guest setup with owner-only hosted profiles. Project creation and sync are separate services; the project store coordinates observable state. Local/cloud repositories persist validated v1/v2 documents in Dexie and `public.projects`. Pure `hardware-core` executes strict commands atomically and validates the graph. The provider-independent planner routes through remote BYOK, custom compatible, local HTTP or local CLI transports. The Vercel endpoint validates remote plans; the optional Local Bridge validates local plans. The client revalidates against its current revision before saving. Guest assembly is allowed; cloud sync still uses Supabase Auth. The spatial scene reads persisted layout and instances. Real Codex CLI plans passed the four initial intents and unsupported case. Inventory, simulation, firmware and editable wiring remain future slices. Operational details are in [BACKEND.md](BACKEND.md), [SLICE-06.md](SLICE-06.md) and [LOCAL-BRIDGE.md](LOCAL-BRIDGE.md).

Slice 07 adds `WorkbenchStage` for interaction while `BoardStage` continues serving static previews. `Workbench` holds transient selection, tray and camera requests; a Three group holds only the current pointer drag. Manual edits and AI both use `hardware-core` commands. The project store serializes manual transactions, saves locally once per edit and coalesces authenticated cloud checkpoints. Its bounded history is transient and project-scoped; undo and redo save new document revisions. Structural and electrical safety validation protects repositories, while circuit completeness remains the AI gate. Provider metadata is runtime-validated and versioned separately from the credential vault. See [Slice 07](SLICE-07.md).
