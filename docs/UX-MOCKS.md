# Kinetable UX Flows and Screen Mocks

This document defines the initial coded mockups. These are interaction specifications, not static image references.

## Global UX rules

- The workbench is the center of gravity.
- Avoid permanent sidebars unless a selected object genuinely needs detail.
- Keep most screens to one primary action.
- Use contextual UI that appears near the object being acted on.
- Prefer physical response and spatial highlighting over explanatory paragraphs.
- Code is hidden by default.
- Hardware terms may appear, but syntax and toolchain terminology should stay behind advanced views.
- Do not build a chatbot transcript into the main experience.

---

# 0. Public landing

Purpose: explain the product quickly and get the user into Kinetable.

The landing should be coded only after the in-app design system is stable.

```text
┌──────────────────────────────────────────────────────────────┐
│ Kinetable        Product   Learn   Parts         Open →      │
│                                                              │
│               Build hardware by seeing                       │
│                    how it works.                             │
│                                                              │
│          [ sparse interactive 3D hardware scene ]            │
│                                                              │
│                  [ Open Kinetable ]                          │
│                                                              │
│        one concise interactive product demonstration         │
│                                                              │
│                  final statement + footer                    │
└──────────────────────────────────────────────────────────────┘
```

Landing rule: minimal structure, playful interaction. Do not repeat the same tabletop photo for every section.

---

# 1. Splash

Purpose: instantaneous brand transition into the app.

```text
┌──────────────────────────────────────────────┐
│                                              │
│                                              │
│                  Kinetable                   │
│                                              │
│                                              │
└──────────────────────────────────────────────┘
```

Expected behaviour:

- wordmark fades in;
- restore local state immediately;
- transition directly into onboarding or Table;
- no decorative loading sequence longer than necessary.

---

# 2. Sign in / continue

Account creation is optional in early versions.

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Kinetable                         Continue with Google       │
│                                    Continue with GitHub       │
│  Your workbench, everywhere.       Continue with email        │
│                                                              │
│                                    Continue locally           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Local use must remain a first-class path.

---

# 3. Welcome

```text
┌──────────────────────────────────────────────┐
│                                              │
│                  Kinetable                   │
│                                              │
│       Build hardware by seeing how it works. │
│                                              │
│                    [ Start ]                 │
│                                              │
└──────────────────────────────────────────────┘
```

No onboarding questionnaire.

---

# 4. Board selection

Purpose: only required configuration step.

```text
┌──────────────────────────────────────────────────────────────┐
│              What are you building with?                    │
│                                                              │
│       [ ESP32 ]     [ PICO ]     [ UNO ]     [ OTHER ]      │
│                                                              │
│                 hardware shown as 3D objects                 │
│                                                              │
│              You can add more boards anytime.               │
└──────────────────────────────────────────────────────────────┘
```

Interaction:

- hover: slight physical lift;
- select: object settles onto a subtle highlighted surface;
- no pin specifications yet.

---

# 5. Board detection

If supported hardware is connected:

```text
                  ESP32 detected

                [ large 3D ESP32 ]

               ESP32 Dev Module
                 USB connected

               [ Use this board ]
```

If nothing is connected:

```text
No board detected.
That's fine — you can build virtually.

[ Continue ]
```

Never block onboarding on hardware access.

---

# 6. Table ready / empty table

This is the first "aha" screen.

```text
┌──────────────────────────────────────────────────────────────┐
│ Kinetable                                        profile     │
│                                                              │
│                                                              │
│                    [ 3D ESP32 ]                              │
│                                                              │
│                    Your table is ready.                      │
│                                                              │
│       ┌───────────────────────────────────────────┐          │
│       │ What do you want to make?                 │          │
│       └───────────────────────────────────────────┘          │
│                                                              │
│     Blink an LED   Motion alarm   OLED temperature           │
└──────────────────────────────────────────────────────────────┘
```

The prompt should feel like part of the table, not a chat box.

---

# 7. Returning-user Table

Top-level navigation:

```text
Table     Projects     Parts     Learn
```

Main view:

```text
┌──────────────────────────────────────────────────────────────┐
│ Table      Projects      Parts      Learn                    │
│                                                              │
│       [ owned parts resting in sparse spatial layout ]       │
│                                                              │
│                   [ recent project ]                         │
│                                                              │
│              ┌───────────────────────────┐                   │
│              │ Ask Kinetable...          │                   │
│              └───────────────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

Do not show metrics, activity graphs, or dashboard cards.

Personal suggestions can appear quietly near the prompt:

```text
Motion alarm · everything required
Weather display · everything required
```

---

# 8. Build prompt

User enters:

> Make a motion alarm using what I already have.

Before execution:

```text
I'll use

[ ESP32 ]   [ PIR ]   [ BUZZER ]

Everything is already on your table.

[ Build it ]      Show me first
```

This is a compact decision surface, not a chat response.

---

# 9. AI assembly state

The project physically assembles instead of showing a loader.

```text
               Choosing parts ✓
          Planning connections ✓
                   Building

       [ ESP32 ] --wire--> [ breadboard ]
                            [ PIR ] [ buzzer ]
```

Animation order should communicate causality:

1. parts move into project area;
2. breadboard settles;
3. components place;
4. wires route;
5. simulation sanity check;
6. controls appear.

---

# 10. Main Workbench

This is the primary Kinetable screen.

```text
┌──────────────────────────────────────────────────────────────┐
│ Kinetable          BUILD   SIMULATE   EXPLAIN        Run ▶   │
│                                                              │
│                                                              │
│                                                              │
│                   3D WORKBENCH                               │
│                                                              │
│            ESP32 + breadboard + components                   │
│                                                              │
│                                                              │
│              ┌───────────────────────────┐                   │
│              │ Ask Kinetable...          │                   │
│              └───────────────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

Rules:

- workbench occupies roughly 80–90% of the useful surface;
- no always-open inspector;
- selection may reveal local controls;
- camera controls remain subtle;
- object manipulation is direct.

---

# 11. Build mode

Capabilities:

- click to select;
- drag to move;
- rotate with explicit or gesture control;
- snap supported components to breadboard holes;
- start a wire from pin/hole anchor;
- preview legal targets;
- show invalid connection feedback without blocking exploration;
- undo/redo;
- add/replace/remove component.

Context example:

```text
       [ selected OLED ]

      Move   Rotate   Replace   Remove
```

Keep actions physically close to selection.

---

# 12. Component inspector

Selecting PIR:

```text
                       ┌─────────────────────────────┐
       [ PIR lifts ]   │ PIR Motion Sensor           │
                       │ Detects movement.            │
                       │                              │
                       │ Used here                    │
                       │ Trigger the alarm.           │
                       │                              │
                       │ Connections   Try   Replace  │
                       │ Technical details →          │
                       └─────────────────────────────┘
```

Inspector should be compact and disappear when deselected.

---

# 13. Connection inspector

Click a wire or endpoint:

```text
PIR OUT  ───────────────────  ESP32 GPIO27

          digital signal

HIGH means motion was detected.
```

Everything unrelated fades enough for the connection to read instantly.

---

# 14. Visual Logic

Default behaviour visualization:

```text
                [ MOTION ]
                    ↓
                 [ ESP32 ]
                    ↓
                [ BUZZER ]
                    ↓
                  [ BEEP ]
```

The physical components remain visible beneath or behind this layer.

Nodes should visually anchor to the objects they represent.

No programming syntax.

---

# 15. Logic editor

Use concise semantic controls rather than Scratch-like blocks.

```text
WHEN
[ Motion detected                 ]

DO
[ Turn buzzer on                  ]
[ Wait 500 ms                     ]
[ Turn buzzer off                 ]
```

More complex example:

```text
WHEN [ Button pressed ]

DO   [ OLED show "BONK!" ]
AND  [ LED ON            ]
AND  [ BEEP ×2           ]
```

Interactions should feel like editing behaviour, not writing a program.

---

# 16. Simulation mode

When simulation starts, authoring chrome recedes.

```text
┌──────────────────────────────────────────────────────────────┐
│                     SIMULATING                      Pause    │
│                                                              │
│                 [ interactive circuit ]                      │
│                                                              │
│ PIR triggered                                                │
│      ···signal···→ ESP32 ···→ BUZZER ))                     │
│                                                              │
│                              Reset                           │
└──────────────────────────────────────────────────────────────┘
```

Inputs are manipulated directly:

- click button;
- rotate potentiometer;
- trigger PIR;
- change virtual temperature/humidity;
- modify LDR brightness.

Events appear near the object that produced them.

---

# 17. Explain mode

Select a behaviour such as "why did the buzzer turn on?"

```text
[PIR]
  OUT
   │ pulse
   ▼
[GPIO27]
   │ motion event
   ▼
[logic]
   │
   ▼
[buzzer]
```

The user should be able to follow the explanation without reading a paragraph.

Optional short copy can appear at each stage.

---

# 18. X-Ray

Modes:

```text
Power     Signals     Data     All
```

Power:

- highlight 3.3V/5V/GND nets;
- dim data and decorative geometry.

Signals:

- highlight active digital/analog paths;
- animate transitions.

Data:

- show I2C/SPI/UART relationships at a conceptual level;
- advanced detail is optional.

---

# 19. My Parts

```text
┌──────────────────────────────────────────────────────────────┐
│ My Parts                                      Add hardware   │
│ The hardware on your table.                                 │
│                                                              │
│ Boards                                                       │
│ [ ESP32 ]        [ Pico ]                                   │
│                                                              │
│ Sensors                                                      │
│ [ PIR ] [ DHT11 ] [ LDR ]                                  │
│                                                              │
│ Displays                                                     │
│ [ OLED ]                                                    │
└──────────────────────────────────────────────────────────────┘
```

Use physical 3D objects and restrained labels.

Do not mimic ecommerce.

---

# 20. Add Hardware

```text
Add something to your table.

[ Search for a component...                 ]

[ Scan ]     [ Detect connected board ]     [ Browse ]

Popular with your ESP32

[ OLED ] [ PIR ] [ Servo ] [ DHT11 ] [ Relay ]
```

Future scan flow can reuse the same confirmation surface.

---

# 21. Component Detail

```text
                [ large rotatable 3D PIR ]

PIR Motion Sensor
Detects movement by sensing changes in infrared energy.

Works with your ESP32 ✓

[ Add to My Parts ]

How it behaves
Connections
Projects using this
Technical details
```

Technical detail expansion contains pinout, voltage, dimensions, protocol, warnings, and sources.

---

# 22. Projects

Represent projects as miniature workbench scenes rather than generic cards.

```text
Recent

[ miniature Motion Alarm table ]
Motion Alarm
ESP32 · PIR · Buzzer

[ miniature BONK table ]
BONK
ESP32 · OLED · Button · LED · Buzzer
```

Hover may animate one small behaviour in the diorama.

---

# 23. Project detail

```text
Motion Alarm

[ interactive miniature / preview ]

ESP32 · PIR · Buzzer
Last opened yesterday

[ Open on Table ]

Parts     Logic     Notes     Versions
```

Do not turn this into project-management software.

---

# 24. Explore

Primary organizing principle: inventory awareness.

```text
What can you make today?

BUILD NOW
Motion alarm              Everything required ✓
Weather display           Everything required ✓
Reaction timer            Everything required ✓

ONE PART AWAY
Plant monitor             Need: soil moisture sensor
```

Useful AI action:

```text
Use something I already own instead
```

---

# 25. Learn

```text
Learn by building.

[ Make an LED light up        5 min ]
[ Make a button do something  8 min ]
[ Understand a breadboard    10 min ]
[ Send data to an OLED       12 min ]
```

No course-dashboard treatment.

---

# 26. Guided mission

Example mission: Make the LED turn on.

```text
OBJECTIVE
Make the LED turn on.

[ ESP32 ] [ breadboard ] [ LED ] [ resistor ]

The LED doesn't have a path back to ground yet.

           - - - - ghost hint - - - -

[ Show me a clue ]                         2 / 3
```

Feedback rules:

- explain what is missing, not merely "wrong";
- hints escalate gradually;
- successful completion produces a short satisfying physical response;
- immediately show why the solution worked.

---

# 27. Concept Playground

Concepts:

- breadboard connectivity;
- voltage;
- current;
- ground;
- pull-up/pull-down;
- PWM;
- ADC;
- I2C;
- SPI;
- UART.

Example breadboard lesson:

```text
hover A17

A17 B17 C17 D17 E17 illuminate together

               center gap

F17 G17 H17 I17 J17 illuminate separately
```

This should make invisible structure visible instantly.

---

# 28. Run on Board

Primary surface:

```text
Your ESP32 is connected.

[ Run on my ESP32 ]
```

Execution:

```text
Preparing ✓
Sending   ✓
Starting  ✓

Running on your ESP32 ✓

Technical details →
```

Only advanced expansion reveals ports, compiler output, framework, package versions, and raw logs.

---

# 29. Advanced Code

Suggested desktop layout:

```text
┌───────────────────────────────┬──────────────────────────────┐
│                               │                              │
│       3D WORKBENCH            │       GENERATED CODE         │
│                               │                              │
│ GPIO27 highlighted            │ const int PIR_PIN = 27;     │
│                               │            ^ highlighted     │
│                               │                              │
└───────────────────────────────┴──────────────────────────────┘
```

Selection is synchronized in both directions where safe.

---

# 30. Live Data

Friendly default:

```text
Live Data

PIR          Motion detected
Temperature  27.4 °C
Humidity     61 %
Potentiometer 45 %
```

Advanced:

```text
View raw serial
```

---

# 31. Workbench Scan — future

```text
[ camera view ]

ESP32 detected        ✓
Breadboard detected   ✓
OLED detected         ✓
PIR detected          ? confirm

[ Add detected parts ]
```

Recognition confidence must be explicit when uncertain.

---

# 32. Digital Twin Calibration — future

```text
real camera view              reconstructed Kinetable view

[ breadboard ]        ⇄       [ breadboard model ]
[ ESP32 ]             ⇄       [ ESP32 model ]

Drag to correct alignment if needed.

[ Looks right ]
```

---

# 33. Live Workbench — future

```text
[ camera feed of real circuit ]

GPIO19  - - - - ghost wire - - - -  buzzer +

Connect GPIO19 to the buzzer.

existing connection ✓
```

The loop is:

```text
guide → observe → verify → continue
```

Do not cover the camera feed with decorative AR graphics.

---

# 34. Settings

```text
Account
Appearance
Hardware
AI
Privacy
Advanced
```

Keep settings utilitarian and quiet.

---

# 35. Command/Search overlay

Keyboard-invoked global action surface:

```text
Search Kinetable...

Open Motion Alarm
Add OLED
Find DHT11
Run simulation
Explain selected connection
Ask Kinetable...
```

This is an advanced efficiency layer, not primary navigation.

---

# Responsive priority

Initial authoring target: desktop 16:10 / 16:9.

Tablet can become a later touch-first adaptation. Mobile should initially focus on viewing, scanning, camera guidance, and lightweight project management rather than trying to compress the full 3D authoring environment into a phone screen.

## Implemented Slice 08 circuit interaction

```text
Workbench:  [board pins]  [400-hole breadboard]  [physical wires]
Wire mode:  choose pin/hole → pointer preview → choose destination → validate/save
Hole tap:   selected strip + connected net highlighted; inspector names peers
Part tap:   description, real pin connections, lead insertion, details on demand
Wire tap:   exact source/destination and connected pins; remove/undo
Fallback:   From/To selectors provide the same validated wiring command
```

The responsive workbench keeps the circuit legible and exposes a DOM part list and connection controls on touch screens. Electrical editing works without simulation; Simulate, Explain and X-Ray are implemented in [Slice 09](SLICE-09.md). See [Slice 08](SLICE-08.md).
