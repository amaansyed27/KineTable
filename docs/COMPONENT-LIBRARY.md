# Kinetable Starter Component Library

## Goal

The first library should be deliberately small but useful. Kinetable does not need hundreds of components to prove the product.

Target: roughly **25 components** that cover common ESP32 / Arduino / Pico learning projects and the canonical BONK demo.

## Library priorities

A component is worth adding early if it:

- is common in beginner kits;
- enables many projects;
- has clear visual behaviour;
- teaches an important electronics concept;
- can be simulated reliably;
- or is required by the first Kinetable demos.

## Tier 0 — required for BONK

### Boards

1. **ESP32 Dev Module / common 30-pin ESP32 DevKit-style board**

### Infrastructure

2. **Small/medium solderless breadboard**
3. **Male-to-male jumper wire**
4. **220 ohm resistor**

### Inputs

5. **Tactile push button**

### Outputs

6. **5 mm LED**
7. **Active buzzer**
8. **0.96 inch I2C OLED (SSD1306-class, 128x64)**

These eight parts are enough for the first full product proof.

## Tier 1 — core beginner kit

### Boards

9. **Raspberry Pi Pico**
10. **Arduino Uno-class board**

### Inputs / sensors

11. **10k potentiometer**
12. **LDR module**
13. **DHT11 module**
14. **HC-SR501 PIR motion sensor**
15. **IR obstacle sensor module**
16. **HC-SR04 ultrasonic sensor**

### Outputs / actuators

17. **Passive buzzer**
18. **RGB LED**
19. **SG90-class micro servo**
20. **2-channel relay module**

## Tier 2 — useful expansion

21. **DC motor**
22. **motor driver module**
23. **soil moisture sensor**
24. **rotary encoder**
25. **I2C LCD / common character display**

Possible next additions:

- NeoPixel / WS2812 LED strip;
- joystick module;
- MPU6050 IMU;
- BMP/BME environmental sensor;
- RFID module;
- small speaker;
- 7-segment display;
- transistor/MOSFET primitives;
- common capacitors;
- batteries/power supplies.

## Component record requirements

Every production-ready component definition should contain:

```text
Identity
- canonical ID
- display name
- manufacturer/model where relevant
- aliases
- category

Visual
- GLB model path
- dimensions
- origin/orientation
- selection bounds
- pin/lead anchors
- optional interaction anchors

Electrical
- pins
- directions
- capabilities
- voltage constraints
- protocol metadata
- internal topology where relevant

Simulation
- driver ID
- state schema
- virtual inputs
- output behaviour

Learning
- plain-language purpose
- common mistakes
- explanation snippets
- beginner difficulty

Compatibility
- supported boards
- known restrictions

Provenance
- technical sources
- 3D asset source
- asset license
- reviewer/status
```

## Suggested file structure

```text
packages/component-library/
  definitions/
    boards/
      esp32-devkit.json
      raspberry-pi-pico.json
      arduino-uno.json
    sensors/
      hc-sr501.json
      dht11.json
    outputs/
      active-buzzer.json
      oled-ssd1306-128x64.json
    components/
      led-5mm.json
      resistor-220r.json
      tactile-button.json
    infrastructure/
      breadboard-mini.json

assets/models/
  esp32-devkit.glb
  breadboard-mini.glb
  ...
```

## Example definition sketch

```json
{
  "id": "sensor.hc-sr501",
  "name": "PIR Motion Sensor",
  "model": "HC-SR501",
  "category": "sensor",
  "description": "Detects movement by sensing changes in infrared energy.",
  "visual": {
    "modelPath": "/models/hc-sr501.glb",
    "anchors": {
      "vcc": "pin-vcc",
      "out": "pin-out",
      "gnd": "pin-gnd"
    }
  },
  "electrical": {
    "pins": [
      { "id": "vcc", "kind": "power-in" },
      { "id": "out", "kind": "digital-out" },
      { "id": "gnd", "kind": "ground" }
    ]
  },
  "simulation": {
    "driver": "pir-digital-motion"
  },
  "provenance": {
    "confidence": "experimental",
    "sources": []
  }
}
```

## Variants

Do not duplicate every generic module as a completely separate implementation.

Use inheritance/composition where sensible:

```text
SSD1306 OLED base behaviour
  ├── 0.96" 128x64 variant
  └── other supported physical variants later
```

But physical pin order and voltage details must never be assumed identical across variants without verification.

## 3D asset standard

Each model should:

- use consistent physical scale;
- have clean topology and modest polygon count;
- render clearly at normal workbench zoom;
- expose accurate connector/pin anchor positions;
- avoid unnecessary hidden internal geometry;
- use reusable materials where practical;
- include provenance in `docs/ASSET-LICENSING.md` or machine-readable metadata.

## Model fidelity philosophy

Kinetable does not need photogrammetry-level realism.

Prioritize:

1. dimensions and pin positions;
2. recognizable shape;
3. readable labels where useful;
4. interaction clarity;
5. performance;
6. cosmetic realism.

A slightly simplified but dimensionally trustworthy ESP32 is more useful than a beautiful model whose pins do not align.

## Community library — later

Potential contribution flow:

```text
submit component
→ schema validation
→ asset/license validation
→ technical source review
→ simulation tests
→ maintainer approval
→ verified library
```

Community components should have trust levels such as:

```text
Verified
Reviewed
Community
Experimental
```

The UI must not present incomplete community data as equally trustworthy to verified Kinetable definitions.

## First implementation order

1. ESP32
2. breadboard
3. jumper wire
4. LED
5. resistor
6. button
7. OLED
8. active buzzer
9. potentiometer
10. PIR
11. DHT11
12. Pico
13. remaining Tier 1

Do not block early interaction work waiting for the entire catalog.
