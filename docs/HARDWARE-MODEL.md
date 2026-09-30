# Kinetable Hardware and Simulation Model

## 1. Principle

Hardware is structured, electrically meaningful data—not 3D decoration.

Each supported definition eventually has three linked representations sharing one stable definition ID:

```text
Visual
3D geometry · dimensions · pin/lead anchors

Electrical
electrical model · pins · supply · capabilities · topology

Behavioural
simulation driver · virtual inputs · runtime outputs/events
```

Changing a visual model must never change electrical or simulation behavior.

## 2. Current project representation — v4

Project v4 stores physical facts explicitly and persistent semantic logic. Historical v3 retains its empty logic field.

```ts
type ElectricalEndpoint =
  | { kind: 'pin'; componentId: string; pinId: string }
  | { kind: 'breadboard-hole'; breadboardId: string; holeId: string }

interface Wire {
  id: string
  from: ElectricalEndpoint
  to: ElectricalEndpoint
}

interface TerminalPlacement {
  componentId: string
  pinId: string
  breadboardId: string
  holeId: string
}
```

The project also stores component instances, layout, intent and metadata.

A terminal placement means a physical component lead is inserted into a breadboard hole. It is not represented as a fake jumper wire.

## 3. Pins and capabilities

Pins use stable machine-readable IDs shared by electrical definitions and presentation anchors.

Current role vocabulary includes:

```text
ground
power
digital-in
digital-out
digital-io
i2c-sda
i2c-scl
passive
```

As the component platform grows this should evolve toward richer capability metadata such as analog input, PWM, interrupts, SPI and UART without breaking stable definition/pin IDs.

Board-specific restrictions belong in canonical data/rules, not React or AI prompts.

## 4. Visual anchors

Visual pin anchors are presentation data keyed by the same stable electrical pin IDs.

```text
electrical definition     spatial definition
GPIO23 -----------------> GPIO23 anchor
OLED SDA ----------------> SDA anchor
PIR OUT -----------------> OUT anchor
```

Three.js may transform an anchor into world coordinates, but geometry has no authority over electrical connectivity.

Anchor coverage is testable for the currently supported physical subset.

## 5. Canonical breadboard

The current supported breadboard is:

`breadboard-half-400`

Topology:

- A–J × 30 terminal columns;
- A–E at one numbered column form one conductive strip;
- F–J at that number form a separate conductive strip;
- the center trench separates both sides;
- four rail rows: L+, L−, R+, R−;
- each rail has 25 holes;
- each of those four rails is continuous in this exact Kinetable definition;
- no rail is implicitly connected to another rail.

Commercial breadboards vary. A different physical rail layout requires a different canonical definition rather than changing this topology dynamically.

Hole identity, coordinates and conductive-group membership come from pure hardware-core data.

## 6. Wires, placements and nets

A visible jumper and an electrical net are different concepts.

```text
Wire
= persisted physical conductor between two endpoints

TerminalPlacement
= persisted inserted lead ↔ breadboard-hole relationship

Breadboard topology
= canonical implicit conductors

Net
= derived electrical equivalence set
```

Nets are computed, not stored:

```text
component pins
+ physical wires
+ inserted leads
+ breadboard strips/rails
→ resolveNets()
→ derived nets
```

This allows:

```text
ESP32 GND
→ jumper
→ breadboard rail
→ internal rail conductivity
→ another hole
→ inserted LED cathode
```

to resolve as one electrical net.

Passive components such as resistors and LEDs retain distinct terminals; their internal behavior is not treated as copper continuity.

## 7. Validation confidence layers

Do not collapse every type of correctness into one `valid` boolean.

### Project structure

Proves that IDs, definitions, endpoints, transforms and serialized data are well formed.

### Electrical safety

Rejects supported hard-invalid states such as:

- power-to-ground short;
- incompatible supply rails sharing a net;
- prohibited output conflicts;
- invalid pin/hole references;
- duplicate/occupied physical endpoints where disallowed.

### Circuit completeness

Reports supported missing requirements such as:

- unconnected required pin;
- missing board supply/ground;
- missing supported GPIO path;
- incorrect supported OLED I²C mapping;
- LED without required supported resistor/ground topology.

Manual projects may be safe but incomplete.

AI Assembly must pass complete-circuit validation before claiming success.

### Simulation compatibility — Slice 09

A circuit may be electrically complete but not supported by the simulator. Simulation compatibility is a separate capability check.

### Simulation runtime state — Slice 09

A compatible circuit may have changing virtual state over logical time. Runtime state is not persisted as electrical truth.

### Physical verification — Slice 14/15

Simulation does not prove the real circuit is physically built correctly. Real board telemetry and later camera observations provide additional evidence.

## 8. Simulation philosophy

Slice 09 is event-oriented and deterministic. It is not SPICE and not an ESP32/Pico/AVR CPU emulator.

The goal is to model supported product behavior reliably enough to teach, test and visualize cause/effect.

Required architecture:

```text
Project v4 physical document + authored logic
→ validate electrical structure/safety
→ check simulation compatibility
→ compile topology once
→ SimulationRuntime
    ├─ logical time
    ├─ compiled nets
    ├─ component driver state
    ├─ net/signal state
    ├─ event queue
    └─ causal trace
→ spatial/UI observers
```

The compiled graph should be rebuilt only when relevant project topology changes. `resolveNets()` must not run every animation frame or simulation tick.

## 9. Logical clock

Simulation time is independent of browser frame rate.

The same input/event sequence at the same logical times must produce the same runtime result whether rendered at 30, 60 or 144 fps.

Expected controls:

```text
Play
Pause
Reset
step/advance helpers for deterministic tests
```

Wall-clock scheduling may drive the user experience, but domain correctness is based on logical time.

## 10. Runtime signal values

A practical initial vocabulary may include:

```ts
type SignalValue =
  | { kind: 'digital'; value: 0 | 1 }
  | { kind: 'voltage'; volts: number }
  | { kind: 'analog'; value: number; min: number; max: number }
  | { kind: 'data'; protocol: string; value: unknown }
```

Only use signal kinds that the implemented driver/runtime can justify.

Do not animate “current flowing” as if Kinetable were doing analog circuit analysis when it is not.

## 11. Component driver registry

Simulation drivers must be registered by canonical behavioral/electrical semantics, never by `visualId`.

Direction:

```text
electricalModel: momentary-switch
→ momentary switch driver

electricalModel: pir
→ PIR driver

electricalModel: led-passive
→ LED output observer/driver

electricalModel: buzzer
→ buzzer output driver

electricalModel: ssd1306-i2c
→ SSD1306 display driver

electricalModel: dht11
→ DHT11 protocol/sensor driver
```

A driver receives stable component/pin/net identities from the compiled circuit graph.

## 12. Initial virtual inputs

Slice 09 supports only inputs that can be modeled honestly for the current catalog.

### Push button

User action:

```text
press
release
```

The runtime changes the corresponding switch behavior/net state according to the supported topology.

### PIR

User action:

```text
trigger motion
```

The driver can emit a deterministic HIGH interval for a documented simulated duration.

### DHT11

Virtual environment:

```text
temperature
humidity
```

DHT11 should be represented as protocol/data behavior, not as a fake analog voltage.

## 13. Initial outputs

### LED

Visual state may reflect the runtime's supported drive/on-off result.

This is a semantic simulation of supported topology, not a photometric/current calculation.

### Buzzer

Expose on/off or supported beep state. Optional browser audio must be user-controlled and restrained; sound is not required for runtime correctness.

### OLED

Expose display state/text only when there is an actual supported runtime behavior producing it. Do not invent display text from project intent.

## 14. Board behavior before Visual Logic

Slice 10 owns editable persistent Visual Logic.

Therefore Slice 09 must not quietly create a hidden general-purpose programming system.

The simulator may support a small explicit set of deterministic **simulation recipes/scenarios** for verified demo circuits, provided that:

- recipes are separate from persistent project logic;
- supported topology requirements are explicit;
- unsupported projects say simulation behavior is unavailable rather than guessing;
- no arbitrary natural-language intent is treated as executable firmware;
- Slice 10 compiles authored project behavior into the same runtime; demonstration recipes run only for logic-empty projects.

Direct device/electrical behavior that requires no board program can be simulated independently.

## 15. Causal trace

Every meaningful runtime transition should be able to produce structured evidence.

Example:

```text
12 ms  button-1 pressed
12 ms  board-main:gpio18 input LOW
12 ms  recipe/button-led evaluated
12 ms  board-main:gpio23 output HIGH
12 ms  led-1 state ON
```

Explain/X-Ray must consume this trace and the same compiled nets/runtime state.

Do not build an independent “explanation interpretation” that can disagree with simulation.

## 16. Explain / X-Ray — Slice 09

Modes:

```text
Power
Signals
Data
All
```

### Power

Highlight deterministic power/ground relationships from the circuit graph.

### Signals

Highlight supported active digital/signal nets from current runtime state.

### Data

Show supported protocol relationships such as I²C/DHT data conceptually where implemented.

### Explain

A concise explanation should be generated first from deterministic topology/runtime facts. Optional future AI language can translate those facts, but a model is not required for correctness.

## 17. Visual Logic — Slice 10

Slice 10 owns the persistent editable semantic behavior graph.

Implemented semantic subset:

```text
WHEN button pressed
DO OLED "BONK!"
AND LED ON
AND BEEP ×2
```

The v4 behavior IR drives the same Slice 09 simulation runtime. Canonical momentary-switch, PIR and DHT11 bindings support triggers; bounded timers use logical time. DHT11 temperature/humidity comparisons are ANDed. LED ON/OFF/toggle, bounded OLED text/clear and bounded buzzer sequences use verified physical output bindings. Removal/replacement or rewiring that breaks authored behavior is blocked at the command boundary. No capability is inferred from visual IDs. See [SLICE-10.md](SLICE-10.md). Later firmware generation can consume the same semantic IR.

## 18. BONK reference

Reference electrical mapping:

```text
OLED SDA    → ESP32 GPIO21
OLED SCL    → ESP32 GPIO22
LED drive   → ESP32 GPIO23 through 220 Ω resistor
Button      → ESP32 GPIO18 using input pull-up semantics
Buzzer      → ESP32 GPIO19
```

Slice 09 can use BONK as a simulation/explanation fixture only when the runtime behavior is explicitly represented by a supported deterministic recipe. Slice 10 makes that behavior editable.

## 19. Component provenance and future platform

Production component records eventually need:

- technical sources;
- reviewed/verified status;
- electrical metadata;
- physical dimensions/anchors;
- simulation driver ID/version;
- asset provenance/license;
- compatibility information.

That broader verified knowledge and inventory platform belongs to **Slice 11 — Hardware Platform**.

## 20. Canonical roadmap ownership

```text
08 Physical Circuit Editor  → physical topology, nets, inspectors
09 Living Circuit           → simulation + Explain/X-Ray
10 Visual Logic             → editable semantic behavior
11 Hardware Platform        → inventory + full component knowledge
14 Physical Runtime         → compile/flash/live telemetry/code
15 Digital Twin             → real-workbench vision/reconciliation
```

See [Slice 08](SLICE-08.md) for the current physical graph implementation and [ROADMAP.md](ROADMAP.md) for the full 15-slice roadmap.

Slice 11 adds supported-variant, source, voltage, interface and simulation metadata to the stable-ID component platform. Compatibility checks use board logic/supply/interface facts; visual IDs remain presentation-only. These profiles bound Kinetable's model and do not certify every physical clone. [Current profiles](SLICE-11.md).

## Learning boundary

Learn observes the same canonical breadboard strips, compiled nets, component driver bindings and matching simulation traces. It does not add another electrical model or board pin table. Brightness teaches current limiting qualitatively using supported 220 Ω and ON/OFF semantics; analog current, precise brightness and PWM remain unsupported. [Mission contract](SLICE-13.md).
