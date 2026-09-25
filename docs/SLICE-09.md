# Slice 09 — Living Circuit

Status: implemented for the supported canonical component subset. Slice 10 Visual Logic has not started.

## Model and boundaries

Project v3 remains the persistent source of physical topology. `simulation/compileCircuit.ts` validates the project, compiles Slice 08 nets, and builds pin-to-net, component, board, and physical wire bindings. Its deterministic topology key includes component definitions, wire IDs/endpoints, and terminal placements. Layout, camera, selection, project name, and simulation time do not affect the key. A matching compiled graph is reused. The simulator never calls `resolveNets()` on a logical tick or render frame.

`simulation/runtime.ts` owns a monotonic logical clock, timestamp/sequence ordered event queue, typed net signals, output driver state, and bounded causal trace. `advanceTo()` and `advanceBy()` process due events independent of browser frame rate. The browser animation loop only decides elapsed wall time while Play is active. Event and trace limits stop a runaway session with a visible error. Input commands while paused apply at the current logical time. Reset creates a fresh runtime. A project or topology change discards the session. Browser refresh starts in Build.

`state/simulationStore.ts` is an ephemeral observer/controller. It holds no project mutation action and performs no IndexedDB or Supabase write. The pure compiler, recipe matcher, runtime, and explanation functions do not depend on Zustand, React, Three.js, AI providers, or the network. No schema v4 or database migration was needed.

## Compatibility and recipes

Simulation compatibility is separate from electrical completeness. The compatibility check requires Slice 08 structural/safety rules, a complete supported circuit, and implemented semantic drivers. An incomplete or unsupported circuit shows a concrete blocker. Explain can still show static physical paths on a safe incomplete project.

`simulation/drivers.ts` registers canonical `electricalModel` bindings against actual pin/net relationships, never `visualId` or project title. The supported board runtime handles digital inputs/outputs, pull-up button input, supply and ground, semantic DHT11 data, and semantic OLED I²C text. It does not execute MCU firmware.

Available runtime recipes are matched from the compiled graph and chosen explicitly:

| Recipe | Required circuit | Runtime behavior |
| --- | --- | --- |
| Blink LED | GPIO → 220 Ω resistor → LED → ground | Alternates every 500 ms |
| Button controls LED | Grounded button/pull-up input plus LED path | Press turns LED on; release turns it off |
| Motion alarm | Powered PIR GPIO input plus powered buzzer GPIO output | PIR HIGH for 1000 ms; buzzer follows |
| Temperature display | Powered DHT11 data GPIO plus powered OLED on supported SDA/SCL | Virtual temperature/humidity appears on OLED |
| BONK | ESP32 button, LED/resistor, buzzer and OLED | READY; press shows BONK!, lights LED and schedules two 120 ms beeps with a 100 ms gap; release restores READY/LED off |
| Explore signals | Any complete supported circuit | Static supplies and supported direct virtual inputs, without invented board behavior |

These are runtime demonstrations, not project logic or editable Visual Logic. They are never inferred from prompt text, persisted, or presented as firmware. The button switch derives its board pin and ground from nets; the LED output propagates over its verified 220 Ω series resistor path. PIR duration is a deterministic simulation assumption, not a promise about every HC-SR501 configuration. DHT11 and I²C are semantic data relationships, not wire-accurate waveforms. Voltage is known only for board supply nets; current, brightness, heating, battery behavior, and analog resistor networks are not calculated.

## Explain, X-Ray, and presentation

Each meaningful transition records a structured trace event with logical time, component/pin/net IDs, value and `causedBy`. Explain walks that recorded chain; it does not guess causes from visible state or request AI. The selected component and existing Slice 08 inspectors remain available. “Why?” opens the most recent output event. Trace history is capped at 1000 events.

Power X-Ray shows compiled supply/ground connectivity. Signals X-Ray shows supported GPIO paths and current HIGH/LOW when a runtime exists. Data X-Ray shows DHT11 and I²C relationships. All combines them. All modes consume the same compiled nets and runtime snapshot; 3D wire and pin highlighting is presentation only. The 3D LED, button, PIR, buzzer and OLED observe output state. DOM controls/status remain usable if WebGL fails. Sound is omitted; buzzer ON/OFF and pulse events are visible and testable.

Play, Pause, Reset, recipe selection, button, PIR and DHT11 controls, Explain, and X-Ray are keyboard and touch accessible. The panel sits below the workbench to keep the hardware visible. Rendering respects reduced motion; simulation time never depends on animation. Virtual input changes, runtime trace, selected X-Ray mode and recipe choice do not update project timestamps or cloud rows.

## Verification and limits

Unit tests cover topology caching, incomplete compatibility, clock equivalence, button pull-up and LED causality, PIR timing/buzzer, DHT11/OLED data, BONK pulses, X-Ray classification, runaway protection and persistence isolation. Playwright covers guest simulation, Explain, refresh isolation, mobile controls, incomplete circuit feedback, WebGL fallback and visual screenshots at 390×844, 768×1024, 1440×900, 1600×1000 and 1920×1080. Existing Slice 08 circuit and AI assembly tests remain regression gates. Hosted Supabase QA confirmed v3 restore/offline/reconnect and owner-only RLS; a separate authenticated simulation test confirmed that playback/actions left the cloud project document and timestamp unchanged. The local full Playwright suite passed 28 tests with 9 opt-in tests skipped; hosted tests were run separately. All eight final protected Preview browser checks passed, including six direct-route refreshes, Button LED, Motion Alarm, DHT11/OLED, BONK, Explain/X-Ray, WebGL fallback, mobile and hosted write isolation.

Preview URL: [kinetable-7pnme1dan-amaan-syeds-projects.vercel.app](https://kinetable-7pnme1dan-amaan-syeds-projects.vercel.app) (Vercel deployment `dpl_88kRUVrSeq3jaujXdJRFz6sSo2kQ`, READY).

Known limits: one canonical breadboard topology, one matching set of components per recipe, no analog current or firmware, no browser audio, no arbitrary user-authored logic, and no guarantee that a simulated result proves a physical build. Slice 10 owns editable behavior.
