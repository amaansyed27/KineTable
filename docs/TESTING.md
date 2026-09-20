# Kinetable Testing Strategy

## Goal

Kinetable combines UI, 3D interaction, electrical rules, simulation, AI tools, and later real hardware. Testing should keep deterministic logic separate from visual/manual verification.

## Test layers

### 1. Pure unit tests

Primary tools: Vitest.

Highest priority areas:

- breadboard conductive groups;
- pin capability validation;
- net creation/removal;
- voltage/direction constraints;
- project command reducer/executor;
- serialization and migrations;
- simulation timing;
- visual-logic compilation;
- component schema validation;
- AI tool-call validation.

These tests should not require a browser or Three.js canvas.

### 2. UI/component tests

Primary tools: React Testing Library + Vitest.

Cover:

- onboarding state;
- board selection;
- contextual inspector visibility;
- mode switching;
- My Parts interactions;
- logic editor controls;
- error/validation messaging;
- accessibility states.

### 3. Spatial interaction tests

Use a combination of:

- pure transform/anchor unit tests;
- small integration tests;
- Playwright for critical pointer flows;
- manual visual verification for rendering quality.

Do not rely only on screenshot snapshots for 3D correctness.

### 4. End-to-end tests

Primary tool: Playwright.

First canonical E2E flow:

```text
fresh app
→ select ESP32
→ table ready
→ load/request BONK fixture
→ start simulation
→ press button
→ LED state on
→ OLED says BONK!
→ buzzer action count = 2
→ edit visual logic to beep 3 times
→ rerun
→ buzzer action count = 3
```

The test may assert project/simulation state directly in addition to visible UI.

## Core deterministic fixtures

Keep small reference projects under test fixtures.

Suggested:

```text
empty-esp32-table
led-basic
button-led
bonk
motion-alarm
dht11-oled
```

Fixtures should use the same project schema as real saved projects.

## Breadboard tests

Minimum cases:

- A1–E1 connected;
- F1–J1 connected;
- left and right sides separated across center trench;
- adjacent rows not connected;
- power-rail grouping matches selected breadboard variant;
- split rails remain split when the model defines a break;
- moving a lead from E17 to E18 changes connectivity;
- multiple leads in one conductive group share a net.

## Simulation tests

Use a deterministic logical clock.

Test examples:

### Button

- press emits correct logical state;
- release restores state;
- pull-up semantics are represented correctly in supported reference project.

### BONK buzzer

- exactly two beeps;
- each beep uses expected duration;
- changing visual logic to three beeps produces exactly three;
- pause/reset restores expected runtime state.

### OLED

- startup text;
- button press text;
- button release text.

### Potentiometer

- 0.0 maps to minimum;
- 1.0 maps to maximum;
- midpoint maps within expected tolerance.

## Project serialization tests

Every project schema version should test:

- round-trip save/load;
- stable entity IDs;
- missing optional fields;
- invalid references;
- future migration path when schema version changes.

## AI tests

Do not make most tests depend on live model calls.

Test the AI layer using fixture plans/tool calls.

Examples:

- model requests valid `addComponent` → accepted;
- model requests LED on input-only GPIO → rejected by hardware core;
- model references unknown component ID → rejected;
- model asks to mutate arbitrary JSON → no supported tool exists;
- inventory-aware planner fixture prefers owned part;
- unsupported goal yields explicit unsupported result.

Live-provider tests, when added, should be optional/integration-only and not required for deterministic CI.

## Visual QA checklist

For each major spatial slice verify manually:

- object scale feels physically coherent;
- selected object is obvious without excessive glow;
- labels do not overlap important hardware;
- shadows aid depth instead of obscuring pins;
- wires remain attached while objects move;
- camera orbit/zoom cannot easily lose the project;
- UI chrome does not dominate the table;
- reduced-motion mode remains usable;
- common 16:9 and 16:10 desktop sizes work.

## Performance checks

Track at minimum:

- first useful scene time;
- model load time;
- frame rate on canonical BONK scene;
- selection response latency;
- wire update cost while moving components;
- memory use after repeated project opens.

Performance regressions should be checked before the component library grows large.

## Release gate for each roadmap slice

A slice is ready when:

- deterministic tests pass;
- lint/build pass;
- manual checklist passes;
- product behaviour matches the slice spec;
- known limitations are documented;
- no temporary fake state has become a hidden dependency for later slices.
