# Kinetable Hardware and Simulation Model

## 1. Principle

Kinetable must treat hardware as structured, electrically meaningful data — not as 3D decorations.

Every supported component needs three linked representations:

```text
Visual
  3D model / anchors / dimensions

Electrical
  pins / voltage / capabilities / constraints / topology

Behavioural
  simulation driver / state / events
```

These three representations share one canonical component definition ID.

## 2. Component definition

Suggested shape:

```ts
interface ComponentDefinition {
  id: string
  name: string
  manufacturer?: string
  model?: string
  category: ComponentCategory
  description: string

  visual: VisualDefinition
  electrical: ElectricalDefinition
  simulation?: SimulationDefinition
  compatibility?: CompatibilityDefinition
  provenance: ProvenanceDefinition
}
```

Definitions describe a component type. Projects contain component instances.

## 3. Component instance

```ts
interface ComponentInstance {
  id: string
  definitionId: string
  label?: string
  properties: Record<string, unknown>
  placement?: PlacementState
}
```

Example:

```json
{
  "id": "pir-1",
  "definitionId": "sensor.hc-sr501",
  "label": "Front motion sensor",
  "properties": {
    "delayMs": 1000
  }
}
```

## 4. Pins

```ts
interface PinDefinition {
  id: string
  label: string
  kind: PinKind
  capabilities: PinCapability[]
  voltage?: VoltageConstraint
  direction?: 'input' | 'output' | 'bidirectional' | 'power'
}
```

Possible capabilities:

```text
digital-input
digital-output
analog-input
pwm
interrupt
i2c-sda
i2c-scl
spi-mosi
spi-miso
spi-sck
uart-tx
uart-rx
power-3v3
power-5v
ground
input-only
```

Board-specific restrictions must be data-driven.

## 5. Endpoints

Any connectable location resolves to an endpoint.

```ts
interface EndpointRef {
  componentId: string
  portId: string
  subPortId?: string
}
```

Examples:

```text
esp32-main:gpio23
pir-1:out
breadboard-1:e17
breadboard-1:rail-plus-left-12
```

## 6. Nets

Electrical relationships are represented as nets.

```ts
interface Net {
  id: string
  endpoints: EndpointRef[]
  kind?: SignalKind
  metadata?: Record<string, unknown>
}
```

Important: a net is not the same thing as a visible jumper wire.

A breadboard may join several endpoints into one conductive net without any direct visible wire connecting those exact endpoints.

## 7. Connection validation

Validation should return structured results rather than booleans.

```ts
interface ValidationResult {
  status: 'valid' | 'warning' | 'invalid'
  code: string
  message: string
  evidence?: string[]
  suggestions?: SuggestedFix[]
}
```

Example:

```json
{
  "status": "invalid",
  "code": "PIN_INPUT_ONLY",
  "message": "GPIO34 can read signals but cannot drive this LED.",
  "suggestions": [
    { "target": "esp32-main:gpio23" }
  ]
}
```

## 8. Validation categories

Initial validation should include:

- incompatible direction;
- input-only output attempt;
- voltage mismatch;
- missing power/ground;
- short between power rails;
- conflicting outputs on same net;
- unsupported protocol pin assignment;
- duplicate exclusive peripheral assignment where relevant;
- required passive component missing where encoded by project rule;
- unconnected required input/output;
- breadboard placement mismatch.

Warnings should be distinguishable from hard-invalid states.

## 9. Breadboard model

A breadboard is a component with internal topology.

Example mini breadboard group rules:

```text
A1 B1 C1 D1 E1   = group row-1-left
F1 G1 H1 I1 J1   = group row-1-right
```

Each supported breadboard variant defines:

- hole coordinates;
- row/column labels;
- conductive groups;
- center trench;
- rail groups;
- rail breaks if present;
- physical dimensions;
- insertion normals.

Suggested schema:

```ts
interface BreadboardDefinition {
  holes: BreadboardHole[]
  conductiveGroups: ConductiveGroup[]
}

interface BreadboardHole {
  id: string
  row: number
  column: string
  anchorId: string
}

interface ConductiveGroup {
  id: string
  holeIds: string[]
}
```

Hovering one hole can therefore highlight all electrically connected holes without running simulation.

## 10. Physical placement vs electrical connection

Placing a lead in a breadboard hole creates a physical insertion relationship.

The hardware engine then derives the electrical relationship through breadboard topology.

This distinction supports:

- visual learning;
- snapping;
- different breadboard variants;
- future camera reconstruction;
- explaining why an off-by-one row placement breaks a project.

## 11. Simulation model

V1 simulation is event-oriented and practical, not full analog circuit analysis.

Core runtime concepts:

```ts
interface SimulationRuntime {
  timeMs: number
  componentState: Map<string, unknown>
  netState: Map<string, SignalValue>
  queue: SimulationEvent[]
}
```

Signal values may include:

```ts
type SignalValue =
  | { kind: 'digital'; value: 0 | 1 }
  | { kind: 'analog'; value: number; min: number; max: number }
  | { kind: 'voltage'; volts: number }
  | { kind: 'data'; protocol: string; value: unknown }
```

## 12. Simulation drivers

Each simulatable component can register a driver.

```ts
interface SimulationDriver<State, Input> {
  initialize(ctx: DriverContext): State
  applyInput(state: State, input: Input, ctx: DriverContext): State
  step(state: State, ctx: DriverContext): State
}
```

Examples:

### Button

Input:

```text
pressed = true / false
```

Output:

```text
digital HIGH/LOW depending on configured topology
```

### Potentiometer

Input:

```text
position = 0.0 ... 1.0
```

Output:

```text
ADC-like analog value
```

### PIR

Input:

```text
trigger()
```

Output:

```text
HIGH for configured duration
```

### DHT11

Virtual environment inputs:

```text
temperature
humidity
```

Output is exposed through its protocol abstraction rather than pretending it is a simple analog sensor.

### OLED

Consumes rendered display state from the project/firmware abstraction and exposes a texture/text representation to the spatial layer.

### Buzzer

State:

```text
on/off
frequency where supported
```

UI may generate audible feedback when sound is enabled.

## 13. Board runtime model

In early prototypes, board firmware can be represented semantically rather than emulated at the CPU instruction level.

Example:

```text
button event
→ behaviour graph
→ LED state
→ OLED text
→ buzzer sequence
```

Kinetable does not need an ESP32 ISA emulator to prove its initial product interaction.

Later integrations may compile and run actual firmware on physical hardware or use external emulation where useful.

## 14. Visual logic intermediate representation

Suggested semantic primitives:

```text
WHEN
IF
AND
OR
DO
WAIT
REPEAT
SET
SHOW
BEEP
```

Example IR:

```json
{
  "trigger": {
    "type": "event",
    "source": "button-1",
    "event": "pressed"
  },
  "actions": [
    { "type": "set", "target": "led-1.state", "value": true },
    { "type": "displayText", "target": "oled-1", "value": "BONK!" },
    { "type": "beep", "target": "buzzer-1", "count": 2, "durationMs": 120 }
  ]
}
```

This representation should drive simulation and later feed firmware generators.

## 15. BONK reference topology

Initial intended mapping:

```text
OLED SDA    → ESP32 GPIO21
OLED SCL    → ESP32 GPIO22
LED drive   → ESP32 GPIO23 through 220 Ω resistor
Button      → ESP32 GPIO18 using input pull-up semantics
Buzzer      → ESP32 GPIO19
```

The exact physical breadboard layout belongs to the project fixture, while these semantic connections belong to the reference project model.

## 16. Component data provenance

Every technical definition should include source metadata.

```ts
interface ProvenanceDefinition {
  sources: SourceReference[]
  reviewedAt?: string
  confidence?: 'verified' | 'reviewed' | 'experimental'
  assetLicense?: string
}
```

Kinetable should be able to distinguish verified technical facts from incomplete community metadata.

## 17. Versioning

Component definitions must be versionable because:

- model geometry may improve;
- pin metadata may be corrected;
- simulation may change;
- warnings may be added.

Projects should reference stable definition IDs and retain enough version metadata for deterministic migration.

## 18. Future camera/digital-twin mapping

The physical-vision layer should ultimately produce observations that map onto the same core entities:

```text
observed object
→ candidate ComponentDefinition
→ ComponentInstance

observed wire endpoint
→ EndpointRef

observed breadboard hole
→ breadboard hole ID
```

Vision should not create a second incompatible circuit representation.

The same graph powers simulation, explanation, AI, deployment, and the eventual real-workbench digital twin.

## Slice 06 implemented subset

The v2 project format stores one board instance, canonical component instances, and electrical connections with stable `{componentId, pinId}` endpoints. It does not yet store generalized multi-endpoint nets, breadboards, signal propagation or simulation drivers. The pure command executor applies a complete command list to a project copy and fills deterministic part layout slots. Under the Slice 06 complete-circuit gate, unknown parts or pins, missing component pin connections, mismatched supply, rail shorts, output conflict, GPIO conflict, unsupported I²C pins and LED-without-resistor topology all reject AI output. These rules are intentionally narrow; an unproven circuit is rejected by AI Assembly. See [Slice 06](SLICE-06.md) and the canonical definitions in `apps/web/src/component-library/catalog.ts`.

## Slice 07 editor validation

Manual editing keeps the same v2 graph. Structural checks reject missing definitions, invalid IDs or endpoints, and malformed transforms. Electrical safety rejects direct shorts, incompatible rails, output conflicts and unsupported board/pin relationships. Unconnected pins, absent LED resistor and incomplete I²C or button connections are structured `incomplete` diagnostics, so a safe draft can be saved. AI Assembly still invokes the complete-circuit gate before claiming success. Electrical rules use catalog `electricalModel` and capability metadata; changing `visualId` cannot change them. See [Slice 07](SLICE-07.md).
