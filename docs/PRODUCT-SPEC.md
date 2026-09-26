# Kinetable Product Specification

## 1. Product definition

Kinetable is an AI-native visual hardware workspace for building, understanding, simulating, and eventually deploying physical electronics projects.

The product should make hardware creation feel closer to manipulating a system in a game or spatial design tool than operating a traditional IDE.

The default user mental model is:

> **I have these parts. I want this behaviour. Show me how it works.**

Kinetable handles board setup, part compatibility, wiring logic, project structure and later generated firmware underneath that experience.

## 2. Core audience

### Primary

- Students learning ESP32, Arduino, Raspberry Pi Pico and physical computing.
- Makers who understand the idea they want but struggle with wiring, breadboards, pin mapping or setup.
- People who want to prototype electronics without beginning from source code.

### Secondary

- Teachers and university labs.
- Hackathon teams.
- Experienced developers who want faster prototyping and visual debugging.
- Product designers experimenting with interactive hardware.

## 3. Product promise

Kinetable should allow a new user to go from opening the product to interacting with a working supported simulated circuit with almost no setup.

Ideal first-run path:

```text
Open
→ choose ESP32
→ table appears
→ type "make a motion alarm"
→ validated components assemble
→ inspect/edit wiring
→ press simulate
→ see motion travel through the system
```

The user should not need to understand package managers, libraries, board managers, COM ports or firmware frameworks to reach this point.

## 4. Product pillars

### 4.1 Personalized workbench

Kinetable is designed around three distinct concepts:

- **My Parts** — what the user owns. Slice 11.
- **Project** — the persistent circuit and behavior being built. Implemented.
- **Table** — the spatial arrangement and active workbench. Implemented.

Once inventory arrives, recommendations and AI-generated projects should prefer owned components whenever possible.

### 4.2 Spatial hardware

Components are live 3D objects, not decorative illustrations.

Current objects can be selected, moved, rotated, inspected, connected, removed, simulated and highlighted by electrical/runtime state. Their physical visuals are linked to canonical electrical metadata through stable IDs.

### 4.3 Visual logic

Project behaviour is represented in human-readable cause/effect structures before code.

Current Slice 10 subset:

```text
WHEN button pressed
IF optional DHT11 comparisons
DO OLED "BONK!"
AND LED ON
AND BEEP ×2
```

The current language supports bounded WHEN / IF / DO rules, timers, button/PIR/DHT triggers, DHT comparisons and LED/OLED/buzzer actions. WAIT, REPEAT, OR trees and arbitrary expressions are future language extensions, not current capabilities.

### 4.4 Simulation

Simulation prioritizes common practical physical-computing behaviour rather than trying to become a complete SPICE replacement.

Currently implemented semantic simulation includes:

- HIGH/LOW digital states for supported topologies;
- buttons with supported pull-up semantics;
- PIR virtual motion;
- DHT11 virtual temperature/humidity data;
- LEDs through the supported resistor topology;
- buzzers;
- OLED text over semantic I²C;
- deterministic timers and Visual Logic;
- causal traces and Explain/X-Ray.

Potential later simulation extensions include ADC, PWM, potentiometers and additional protocols/components when their canonical models/drivers are implemented. Do not present those as current functionality.

### 4.5 Explain mode

Kinetable can isolate a component, connection or behaviour and show what is happening spatially.

Example:

```text
PIR OUT
  ↓
connected net
  ↓
ESP32 GPIO27
  ↓
authored rule
  ↓
BUZZER ON
```

Explain uses the same compiled physical graph and causal runtime trace; it does not invent a parallel explanation model.

### 4.6 Code as progressive disclosure

Code exists as a future advanced deployment layer, but it is not the default surface.

Three abstraction levels:

1. **Visual** — build and understand without source code.
2. **Technical** — pins, protocols, values, graph state and runtime evidence.
3. **Code** — generated/editable firmware in Slice 14.

### 4.7 Real hardware deployment

Primary wording should remain human:

> **Run on my ESP32**

not:

> Compile → select port → upload.

Physical compilation/flashing/live telemetry belong to Slice 14 and are not current product claims.

### 4.8 Real workbench digital twin — later

Slice 15 may use camera input to recognize the user's physical workbench and maintain a synchronized digital twin.

Potential capabilities:

- recognize boards and modules;
- map breadboard geometry;
- compare intended vs observed connections;
- guide physical wiring with overlays;
- verify completed actions;
- reconcile camera observations with firmware/runtime state.

This extends the same project model rather than creating a separate camera-only circuit representation.

## 5. Top-level navigation

Keep navigation deliberately small:

```text
Table     Projects     Parts     Learn
```

Secondary destinations are contextual or live under profile/settings. Workbench modes live inside Table:

```text
Build     Logic     Simulate     Explain
```

## 6. Product surface map

### Public / entry

1. Landing.
2. Optional sign in / continue locally.
3. Board selection.
4. Table ready.

### Main workbench — implemented core

5. Table / Home.
6. New Build / intent.
7. AI assembly.
8. Build mode — manipulation and physical connections.
9. Component/connection inspection.
10. Logic mode — bounded editable WHEN / IF / DO behavior.
11. Simulate mode — deterministic semantic runtime.
12. Explain / X-Ray — Power / Signals / Data / All.

### Personal platform — planned

13. My Parts.
14. Add Hardware.
15. Component Library / Component Detail.
16. Projects / Project Detail / versions.
17. Explore recommendations.
18. Learn / Guided Mission / Concept Playground.

### Physical/runtime — planned

19. Run on Board.
20. Live Data.
21. Advanced Code.

### Digital twin — later

22. Workbench Scan.
23. Digital Twin Calibration.
24. Live Workbench.

### Utility

25. Settings, including AI providers/privacy/advanced options.
26. Optional command/search surface later if it materially improves navigation.

## 7. Key user stories

### Beginner

> I have an ESP32 kit and want to understand how to make a button control an LED without first learning Arduino syntax.

Kinetable should let the user manipulate those objects, wire them, simulate the behaviour, see the signal path and edit the behavior visually.

### Maker

> I own an ESP32, OLED, DHT11, PIR, buzzer and relay. Tell me what I can build without ordering anything.

Slice 11/12 should make inventory-aware planning and Explore prioritize projects whose requirements are already satisfied.

### Advanced developer

> I want to change behavior or a pin and understand what physical connection that affects.

Current Visual Logic already links authored behavior to physical components. Slice 14 adds the code/firmware mapping.

### Future physical-workbench user

> I followed a wiring step but the project does not work. Tell me what is physically wrong.

The live workbench can later combine camera observations, expected net topology, board metadata and runtime evidence to identify likely mismatches.

## 8. Canonical MVP project — BONK

Hardware:

- ESP32
- push button
- LED
- 220 Ω resistor
- active buzzer
- 0.96 inch I²C OLED
- optional breadboard routing in the editor

Behaviour:

```text
WHEN button pressed
DO OLED show "BONK!"
AND LED turn on
AND buzzer beep twice

WHEN button released
DO OLED show "READY"
AND LED turn off
```

The current virtual product proves this flow end-to-end: validated physical topology, deterministic simulation, Explain/X-Ray and Visual Logic editing from `BEEP ×2` to `BEEP ×3`. Real-board compilation/execution remains Slice 14.

## 9. Current MVP boundary

Already real:

- board-first onboarding;
- optional accounts and owner-only cloud project sync;
- local project persistence;
- provider-independent real AI assembly;
- spatial component interaction;
- project schemas/migrations;
- electrical graph and breadboard connectivity;
- pin anchors and physical wires;
- deterministic supported simulation;
- Visual Logic;
- Explain/X-Ray;
- canonical component definitions for the current small catalog.

Still intentionally deferred:

- large verified component catalog and personal inventory;
- conflict-safe project versioning;
- firmware generation/compilation/flashing;
- live physical-board telemetry;
- camera recognition/digital twin;
- collaborative editing;
- community sharing.

A convincing Kinetable build must never fake the core spatial/electrical/behavior model.

## 10. Non-goals for V1

- Full PCB CAD.
- Full SPICE simulation.
- Support for every development board.
- Mechanical CAD.
- Multiplayer collaboration.
- Mobile-first authoring.
- Production manufacturing workflows.
- Replacing professional EDA tools.

## 11. Success criteria for the core product demo

A user with no documentation should be able to:

1. select ESP32;
2. understand that the table is interactive;
3. request the BONK build;
4. inspect the assembled physical circuit;
5. enter simulation;
6. press the virtual button and observe LED/OLED/buzzer response;
7. switch to Explain and follow the causal path;
8. open Visual Logic and understand the behavior;
9. change `BEEP ×2` to `BEEP ×3` visually;
10. rerun and observe exactly three deterministic pulses.

Slices 01–10 implement this virtual core. If any of these steps still requires documentation in normal use, the UX needs simplification before treating the core experience as polished.
