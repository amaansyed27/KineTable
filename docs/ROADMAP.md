# Kinetable Development Roadmap

Kinetable should be built as a sequence of independently testable product slices. Do not implement the whole product in one pass.

The rule for every slice:

> Build one coherent capability, verify it completely, then move on.

## Phase 0 — Repository and product foundation

Status: planning/docs.

Deliverables:

- repository structure;
- design tokens;
- lint/test/build setup;
- architecture boundaries;
- project-format skeleton;
- component schema skeleton;
- first 3D asset conventions.

Exit criteria:

- `pnpm lint`
- `pnpm test`
- `pnpm build`

all pass from the repository root once code exists.

---

# Slice 01 — Spatial foundation

Goal: prove the app can feel like Kinetable before adding product complexity.

Build:

- React + TypeScript + Vite app;
- React Three Fiber canvas;
- warm Kinetable background/workbench;
- camera controls;
- lighting/environment;
- minimal top chrome;
- one ESP32 object;
- hover/select state;
- drag and rotate;
- focus selected object;
- responsive desktop shell.

Do not add:

- AI;
- wiring;
- simulation;
- backend;
- parts library UI;
- fake dashboards.

Verification:

- ESP32 is easy to inspect from useful angles;
- camera never becomes disorienting;
- selection is obvious but restrained;
- drag/rotate feels physical;
- 60 fps target on a normal modern laptop;
- reduced-motion preference does not break controls.

---

# Slice 02 — Component system

Goal: prove multiple hardware objects can share one generic spatial architecture.

Build:

- `HardwareObject` abstraction;
- component instance IDs;
- model loading/cache;
- transform persistence;
- selection store;
- component metadata binding;
- add breadboard, LED, button, OLED.

Verification:

- no component-specific scene logic duplicated unnecessarily;
- reload restores layout;
- selection identifies canonical component instance;
- unsupported/broken asset fails gracefully.

---

# Slice 03 — Pin anchors and wiring

Goal: make components electrically connectable.

Build:

- machine-readable pin anchors;
- hoverable pins/leads;
- start wire from endpoint;
- preview valid/invalid targets;
- wire curve rendering;
- net creation/removal;
- undo/redo for connections;
- connection inspector.

Verification:

- visual wire always references a real net/endpoint;
- wire deletion updates graph;
- invalid targets cannot silently become valid nets;
- moving an object updates wire geometry without changing electrical identity.

---

# Slice 04 — Breadboard intelligence

Goal: make breadboard connectivity understandable and real.

Build:

- supported breadboard hole grid;
- A–E / F–J center split;
- conductive-group model;
- rails;
- component lead snapping;
- connected-hole highlighting;
- off-by-one placement feedback.

Verification:

- hover A17 highlights A17–E17 only;
- F17–J17 remains separate;
- lead placement updates electrical graph correctly;
- moving one row changes connectivity;
- tests cover rail and row topology.

This slice is core Kinetable value and must not be faked.

---

# Slice 05 — BONK physical project

Goal: reconstruct the canonical real project in Kinetable.

Parts:

- ESP32;
- breadboard;
- OLED;
- push button;
- LED;
- 220 ohm resistor;
- active buzzer;
- jumper wires.

Connections:

```text
OLED SDA  → GPIO21
OLED SCL  → GPIO22
LED       → GPIO23 through 220 Ω
Button    → GPIO18
Buzzer    → GPIO19
```

Build a saved fixture that loads directly for development.

Verification:

- every visible connection maps to project graph;
- project can serialize/reload;
- selecting any connection identifies both endpoints;
- breadboard-mediated connections are represented correctly.

---

# Slice 06 — Simulation core

Goal: make BONK come alive.

Build:

- deterministic logical clock;
- component simulation driver API;
- digital signal state;
- button input;
- LED output;
- OLED rendered text state;
- active buzzer state/sound;
- basic timed actions.

BONK behaviour:

```text
button press
→ OLED "BONK!"
→ LED ON
→ BEEP ×2

button release
→ OLED "READY"
→ LED OFF
```

Verification:

- simulation tests use deterministic time;
- repeated runs produce same result;
- UI animation does not control simulation correctness;
- sound can be muted without changing state;
- OLED output matches logical state.

---

# Slice 07 — Simulate mode UX

Goal: make simulation feel tactile rather than like a debugger.

Build:

- Build / Simulate mode switching;
- authoring chrome recedes in Simulate;
- button physically depresses;
- LED emits restrained light;
- OLED updates;
- buzzer reacts;
- event annotations near components;
- pause/reset.

Verification:

A first-time viewer should understand that pressing the virtual button causes all three outputs without looking at code.

---

# Slice 08 — Explain and X-Ray

Goal: make invisible electrical relationships understandable.

Build:

- Explain mode;
- causal trace visualization;
- Power / Signals / Data filters;
- active-path highlighting;
- contextual short explanations;
- component isolation/fade.

Verification:

For BONK, the user can answer:

- which pin reads the button;
- which pin drives the LED;
- which pins talk to the OLED;
- why pressing the button changes outputs.

without opening source code.

---

# Slice 09 — Visual Logic

Goal: prove programming can be represented as understandable behaviour.

Build:

```text
WHEN button pressed
DO OLED "BONK!"
AND LED ON
AND BEEP ×2
```

Features:

- visual node/semantic representation;
- mapping to physical objects;
- editable action properties;
- compile to simulation IR;
- validation;
- synchronization with simulation.

Demo requirement:

Change:

```text
BEEP ×2
```

to:

```text
BEEP ×3
```

and observe three beeps on the next simulation run.

---

# Slice 10 — Onboarding and Table shell

Goal: make the prototype usable from a cold start.

Build:

- splash;
- Welcome;
- board selection;
- optional mocked detection;
- Table ready screen;
- persistent navigation;
- local onboarding state;
- returning-user Table.

Verification:

A new user can reach the BONK-capable table without configuration terminology.

---

# Slice 11 — My Parts

Goal: introduce the personalization layer.

Build:

- inventory store;
- My Parts UI;
- add/remove quantities;
- owned status in component library;
- board-specific compatibility metadata;
- local persistence.

Seed initial demo inventory with common kit parts.

Verification:

Project generation/recommendation logic can query owned components independently of UI.

---

# Slice 12 — Prompt-to-build, mocked first

Goal: prove the desired AI interaction without model unpredictability.

Input:

> Make the BONK button.

Mock planner returns structured commands.

The UI should:

- preview parts;
- assemble them;
- create project graph;
- set visual logic;
- load simulation-ready state.

No chat transcript.

Verification:

The same command system could have been triggered manually; AI is not bypassing product rules.

---

# Slice 13 — Real AI planner

Goal: support constrained natural-language builds using the supported component set.

Initial requests:

- blink an LED;
- button controls LED;
- BONK;
- motion alarm;
- DHT11 → OLED;
- potentiometer controls threshold.

Requirements:

- structured tools only;
- inventory-aware planning;
- deterministic validation;
- clear unsupported-request response;
- provider adapter boundary.

Verification:

AI cannot create a project state that manual tools would reject.

---

# Slice 14 — Explore and recommendations

Goal: make My Parts meaningfully useful.

Build:

- Build Now;
- One Part Away;
- project requirement matching;
- "use something I already own instead" action;
- saved example projects.

Verification:

Inventory matching is deterministic and explainable.

---

# Slice 15 — Learn missions

Goal: prove Kinetable as a learning environment.

Initial missions:

1. understand breadboard rows;
2. make an LED light;
3. use a button;
4. control brightness with potentiometer;
5. display text on OLED.

Requirements:

- staged hints;
- topology-aware validation;
- no answer dump by default;
- explain why success works.

---

# Slice 16 — Component library expansion

Goal: reach roughly 25 high-quality components.

Do not optimize for raw count.

For each component require:

- validated metadata;
- anchors;
- asset provenance;
- basic tests;
- simulation if relevant;
- beginner explanation.

---

# Slice 17 — Desktop shell and real board bridge

Goal: move from pure simulation to real hardware.

Build later with Tauri:

- serial/USB discovery;
- board target detection;
- compile adapter;
- upload adapter;
- live runtime/serial abstraction;
- permissions/error UX.

Primary UI remains:

> Run on my ESP32

not raw toolchain controls.

---

# Slice 18 — Advanced code

Goal: provide escape hatch for experienced users.

Build:

- generated code view;
- physical pin ↔ source highlight;
- technical details;
- raw serial/log view;
- clear synchronization rules.

Do not let this change the default beginner experience.

---

# Future Phase — Camera and digital twin

Only begin after the virtual project model is robust.

Sequence:

1. still-photo component recognition;
2. breadboard geometry calibration;
3. component placement reconciliation;
4. wire endpoint inference;
5. confidence-aware confirmation UI;
6. persistent digital twin;
7. continuous camera observations;
8. guided physical actions;
9. closed-loop verification.

The camera layer must map observations into the same core entities used by simulation and the virtual table.

---

# Product milestone definitions

## Milestone A — Spatial prototype

Slices 01–04.

Kinetable already feels physically different from an IDE, even without simulation.

## Milestone B — Core demo

Slices 05–09.

BONK is fully interactive, explainable, and visually programmable.

This is the first serious demo milestone.

## Milestone C — Usable alpha

Slices 10–16.

A new user can onboard, maintain parts, request supported builds, explore ideas, and complete learning missions.

## Milestone D — Physical bridge

Slices 17–18.

Kinetable can run supported projects on real boards and expose advanced code when desired.

## Milestone E — Real workbench

Future camera/digital-twin phase.

Virtual and physical projects begin to synchronize.

---

# Slice completion template

Every implementation PR should include:

```text
What this slice adds
What it deliberately does not add
Architecture changed
User-visible interaction
Test checklist
Known limitations
Screenshots/video where visual
```

A slice is not complete because the screen renders. The intended interaction must be tested end-to-end.
