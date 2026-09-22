# Kinetable Decision Log

This file records major decisions so future implementation does not silently drift from the product thesis.

## D-001 — Visual-first, code-optional

**Status:** accepted

Kinetable's default interface is spatial hardware + visual behaviour. Source code is an advanced layer.

Reason: the product is intended to make hardware creation understandable before requiring programming syntax.

## D-002 — Workbench, not dashboard

**Status:** accepted

The Table is the home screen. Avoid replacing it with charts, project counts, activity feeds, or generic SaaS cards.

## D-003 — Select board as the only mandatory onboarding step

**Status:** accepted

Initial setup should ask for the user's board and then create the table. USB detection may make this easier but cannot be required.

## D-004 — Personal inventory is first-class

**Status:** accepted

Kinetable maintains `My Parts` and should prefer owned components when generating or recommending projects.

## D-005 — Deterministic hardware core

**Status:** accepted

AI is not allowed to define electrical truth. Pin capabilities, topology, power rules, and compatibility come from structured component data and validators.

## D-006 — React/Vite web-first

**Status:** accepted

Use React + TypeScript + Vite for the first application rather than making the workbench depend on a server-rendered web framework.

Reason: the product behaves more like a spatial desktop application than a content site.

## D-007 — React Three Fiber for the spatial layer

**Status:** accepted

Use Three.js through React Three Fiber/Drei for the first 3D workbench.

## D-008 — Tauri later, not first

**Status:** accepted

Prove the virtual workbench, hardware model, and simulation in the web app first. Add Tauri/Rust when local hardware access, compilation, flashing, serial, and camera workflows justify it.

## D-009 — Local-first persistence

**Status:** accepted

Use local persistence for onboarding, inventory, layouts, and projects. Account/cloud sync should enhance rather than gate core use.

## D-010 — Nets are separate from wire visuals

**Status:** accepted

Electrical connections live in the core graph. 3D jumper wires are only one representation of those relationships.

This is required for breadboard connectivity and future camera reconstruction.

## D-011 — Breadboard topology is real, not decorative

**Status:** accepted

Supported breadboards define hole geometry and internal conductive groups. Off-by-one placement must actually alter project connectivity.

## D-012 — Command-based project mutations

**Status:** accepted

Human UI and AI use the same validated project commands for add/remove/connect/change operations.

This enables undo/redo, validation, replay, and future collaboration.

## D-013 — Simulation is practical, not full SPICE in V1

**Status:** accepted

The first simulator focuses on digital state, common sensor inputs, simple analog values, display/output behaviour, timing, and visual explanation.

## D-014 — BONK is the canonical first demo

**Status:** accepted

ESP32 + OLED + LED + button + buzzer is the first complete end-to-end project because it exercises multiple core concepts while remaining understandable.

## D-015 — AI responses should live in the world

**Status:** accepted

Avoid a permanent chatbot column. Prefer contextual previews, highlights, explanations, and physical changes attached to the workbench.

## D-016 — Design direction: playful precision

**Status:** accepted

The UI should combine strong restraint, tactile physical character, and friendly feedback. Fun comes from interaction rather than visual density.

## D-017 — Proprietary by default

**Status:** accepted for current private repository

The repository is not open source unless the owner explicitly changes the license later. Third-party dependencies and assets retain their own licenses.

## D-018 — 3D asset provenance is mandatory

**Status:** accepted

Every external model, texture, font, or major visual asset must have recorded provenance and redistribution terms before release.

## D-019 — Camera/digital twin uses the same core model

**Status:** accepted

Future vision observations should map into existing component instances, breadboard holes, endpoints, and nets rather than creating a parallel circuit model.

## D-020 — Product slices remain independently verifiable

**Status:** accepted

Do not ask an implementation agent to "build Kinetable" as one task. Follow `docs/ROADMAP.md` and complete/test one slice at a time.

## D-021 — Landing choreography stays presentation-only

**Status:** implemented for Slice 01

The landing uses one persistent R3F scene from the hero through the motion-alarm story and personal parts tray. A shared normalized scroll value drives DOM and spatial interpolation without per-frame React state updates. The learning teaser and final composition use separate demand-rendered scenes.

Hardware geometry, wiring, signal playback, ownership and lesson outcomes are illustrative fixtures. They do not implement or replace the electrical graph, simulation engine, inventory or AI architecture described above. See [Slice 01 implementation and QA](SLICE-01.md) for verification and remaining limits.
