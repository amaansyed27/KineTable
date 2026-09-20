# Kinetable Product Specification

## 1. Product definition

Kinetable is an AI-native visual hardware workspace for building, understanding, simulating, and eventually deploying physical electronics projects.

The product should make hardware creation feel closer to manipulating a system in a game or spatial design tool than operating a traditional IDE.

The default user mental model is:

> **I have these parts. I want this behaviour. Show me how it works.**

Kinetable handles board configuration, part compatibility, wiring logic, project structure, and generated code underneath that experience.

## 2. Core audience

### Primary

- Students learning ESP32, Arduino, Raspberry Pi Pico, and physical computing.
- Makers who understand the idea they want but struggle with wiring, breadboards, pin mapping, or setup.
- People who want to prototype electronics without beginning from source code.

### Secondary

- Teachers and university labs.
- Hackathon teams.
- Experienced developers who want faster prototyping and visual debugging.
- Product designers experimenting with interactive hardware.

## 3. Product promise

Kinetable should allow a new user to go from opening the product to interacting with a working simulated circuit with almost no setup.

Ideal first-run path:

```text
Open
→ choose ESP32
→ table appears
→ type "make a motion alarm"
→ components assemble
→ press simulate
→ see motion travel through the system
```

The user should not need to understand package managers, libraries, board managers, COM ports, or firmware frameworks to reach this point.

## 4. Product pillars

### 4.1 Personalized workbench

Kinetable maintains a persistent representation of hardware the user actually owns.

Three distinct concepts:

- **My Parts** — what the user owns.
- **Project** — what is currently being built.
- **Table** — the spatial arrangement of objects and active work.

Recommendations and generated projects should prefer owned components whenever possible.

### 4.2 Spatial hardware

Components are live 3D objects, not decorative illustrations.

Objects can be:

- selected;
- moved;
- rotated;
- inspected;
- connected;
- removed;
- simulated;
- highlighted by signal state;
- associated with electrical metadata.

### 4.3 Visual logic

Project behaviour is represented in human-readable cause/effect structures before code.

Example:

```text
BUTTON PRESSED
      ↓
     BONK
   ↙   ↓   ↘
 LED  OLED  BUZZER
 ON   BONK! BEEP ×2
```

This representation is editable and remains synchronized with project behaviour.

### 4.4 Simulation

Simulation should prioritize common practical physical-computing behaviour rather than trying to become a complete SPICE replacement in V1.

Initial simulation should cover:

- HIGH/LOW digital signals;
- buttons and switches;
- ADC values;
- PWM-like output behaviour where useful;
- LEDs;
- buzzers;
- potentiometers;
- common sensors with virtual inputs;
- OLED output;
- simple timing and logic.

### 4.5 Explain mode

Kinetable can isolate a component, connection, or behaviour and show the user what is happening spatially.

Example:

```text
PIR OUT
  ↓
wire lights up
  ↓
ESP32 GPIO27
  ↓
logic node activates
  ↓
BUZZER ON
```

### 4.6 Code as progressive disclosure

Code exists and can be generated or edited, but it is not the default surface.

Three abstraction levels:

1. **Visual** — build and understand without source code.
2. **Technical** — pins, protocols, values, graph state, live data.
3. **Code** — generated/editable firmware for advanced users.

### 4.7 Real hardware deployment

Primary wording should be human:

> **Run on my ESP32**

not:

> Compile → select port → upload.

Technical details remain available behind an expandable advanced view.

### 4.8 Real workbench digital twin — later

Future versions can use camera input to recognize the user's physical workbench and maintain a synchronized digital twin.

Potential capabilities:

- recognize boards and modules;
- map breadboard geometry;
- compare intended vs observed connections;
- guide physical wiring with overlays;
- verify completed actions;
- reconcile camera observations with firmware/runtime state.

This is a future extension of the same project model, not a separate mode built on unrelated data.

## 5. Top-level navigation

Keep navigation deliberately small:

```text
Table     Projects     Parts     Learn
```

Secondary destinations are contextual or live under profile/settings.

## 6. Complete page map

### Public / outside the app

1. **Landing** — concise product story and entry point. Build in code after the product design system is established.
2. **Sign in / Continue** — optional account path; local use remains possible.

### Onboarding

3. **Welcome** — single action to begin.
4. **Board selection** — ESP32 / Pico / Arduino / Other.
5. **Board detection** — optional USB-assisted identification.
6. **Table ready** — selected board appears; first prompt is immediately available.

### Main product

7. **Table / Home** — the user's persistent spatial workbench.
8. **Build prompt** — describe what to make.
9. **AI assembly state** — parts and connections appear physically.
10. **Workbench: Build** — manipulation and connections.
11. **Workbench: Simulate** — live virtual behaviour.
12. **Workbench: Explain** — spatial explanation and isolation.
13. **Component inspector** — selected object's purpose and controls.
14. **Connection inspector** — source, destination, signal type, explanation.
15. **Visual Logic** — behaviour graph connected to physical objects.
16. **Logic Editor** — editable WHEN / IF / DO / WAIT / REPEAT behaviours.
17. **X-Ray** — Power / Signals / Data views.
18. **Run on Board** — compile/flash abstraction.
19. **Live Data** — friendly sensor/runtime state.
20. **Advanced Code** — generated/editable source and raw technical details.

### Personalization

21. **My Parts** — owned hardware.
22. **Add Hardware** — search, browse, scan, USB detect.
23. **Component Library** — supported canonical components.
24. **Component Detail** — 3D object, purpose, compatibility, technical data.

### Project management

25. **Projects** — saved 3D project dioramas.
26. **Project Detail** — summary, parts, logic, notes, versions.
27. **Explore** — recommendations based on owned hardware.

### Learning

28. **Learn** — mission selection.
29. **Guided Mission** — solve a physical/electrical task.
30. **Concept Playground** — breadboards, voltage, ground, PWM, ADC, I2C, SPI, UART.

### Future spatial bridge

31. **Workbench Scan** — detect and confirm real hardware.
32. **Digital Twin Calibration** — align recognized physical objects with project state.
33. **Live Workbench** — camera-guided physical build/debug loop.

### Utility

34. **Settings** — account, appearance, hardware, AI, privacy, advanced.
35. **Command/Search overlay** — open project, find part, ask AI, execute action.

## 7. Key user stories

### Beginner

> I have an ESP32 kit and want to understand how to make a button control an LED without first learning Arduino syntax.

Kinetable should let the user manipulate those objects, simulate the behaviour, see the signal path, and reveal code only if requested.

### Maker

> I own an ESP32, OLED, DHT11, PIR, buzzer, and relay. Tell me what I can build without ordering anything.

Explore should prioritize projects whose required inventory is already satisfied.

### Advanced developer

> I want to change a pin in code and understand what physical connection that affects.

The advanced editor should highlight the matching pin/object/net in the 3D scene.

### Future physical-workbench user

> I followed a wiring step but the project does not work. Tell me what is physically wrong.

The live workbench can combine camera observations, expected net topology, board metadata, and runtime evidence to identify likely mismatches.

## 8. Canonical MVP project

### BONK

Hardware:

- ESP32
- small breadboard
- push button
- LED
- 220 ohm resistor
- active buzzer
- 0.96 inch I2C OLED

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

This project is ideal because it exercises:

- breadboard topology;
- digital input;
- digital output;
- I2C;
- multiple outputs from one event;
- visual logic;
- simulation;
- explain mode;
- code mapping.

## 9. MVP boundary

### Must be real

- spatial component interaction;
- project state;
- electrical graph;
- breadboard connectivity;
- pin anchors and wire connections;
- basic simulation;
- visual logic;
- component definitions;
- local persistence.

### Can initially be mocked

- actual AI provider calls;
- cloud accounts;
- real firmware flashing;
- camera recognition;
- collaborative editing;
- huge component catalog;
- community sharing.

A convincing prototype must not fake the core spatial/electrical model.

## 10. Non-goals for V1

- Full PCB CAD.
- Full SPICE simulation.
- Support for every development board.
- Mechanical CAD.
- Multiplayer collaboration.
- Mobile-first authoring.
- Production manufacturing workflows.
- Replacing professional EDA tools.

## 11. Success criteria for the first product demo

A user with no explanation should be able to:

1. select ESP32;
2. understand that the table is interactive;
3. request the BONK build;
4. watch the components assemble;
5. press the virtual button;
6. observe LED/OLED/buzzer response;
7. switch to Explain and follow the signal;
8. open Visual Logic and understand the behaviour;
9. change `BEEP ×2` to `BEEP ×3` visually;
10. rerun and observe three beeps.

If any of those steps requires reading documentation, the UX needs simplification.
