# Kinetable Development Roadmap

Kinetable is built **outside to inside**, in the same order a new user experiences the product.

The rule for every slice:

> Ship one coherent user-visible capability, plus the real backend/persistence required by that capability, verify it completely, then move on.

Do not build the whole frontend first and defer the backend. Do not build unused backend infrastructure far ahead of the feature that needs it.

---

# Slice 01 — Public Landing ✅

Status: implemented.

Goal: establish the Kinetable visual language and public product story.

Includes:

- premium minimal landing page;
- continuous R3F product story;
- personalization and learning teaser;
- responsive visual QA;
- reduced-motion support;
- no fake application/backend claims.

See `docs/SLICE-01.md`.

---

# Slice 02 — Product Entry + Onboarding + Backend Foundation

Goal: let a new user enter the real product with one meaningful setup decision: choose a board.

User flow:

```text
Landing
→ Open Kinetable
→ /start
→ choose ESP32 / Pico / Arduino
→ Set up my table
→ /table
```

Frontend:

- real application routing;
- onboarding page;
- 3D board selection;
- keyboard-accessible selection;
- selected-board transition into `/table`;
- minimal empty-table handoff.

Data/backend foundation:

- canonical board definitions;
- local hardware profile;
- persistence boundary (not direct `localStorage` access from UI);
- IndexedDB/Dexie if appropriate;
- Supabase client/config boundary;
- `supabase/migrations/` foundation;
- `.env.example`;
- Vercel-ready environment configuration;
- typed repository/data access layer.

Do not implement full auth yet.

Exit criteria:

- landing is not regressed;
- board choice survives refresh;
- `/start` and `/table` work via direct navigation/back/forward;
- no fake connected-board success state;
- build/lint/tests pass;
- browser QA performed;
- backend config is real and documented even if production secrets are not present locally.

---

# Slice 03 — Sign In / Account Upgrade + Supabase Auth

Goal: add cloud identity without gating first use.

Build:

- Google / GitHub / email auth;
- continue locally/guest;
- session restore/logout;
- profile row;
- RLS policies;
- migration/schema tests where practical;
- preserve local onboarding/project data when account is created or connected.

Exit criteria:

- guest use remains possible;
- authenticated user data cannot be read by another user;
- local data is not silently lost on sign-in;
- production secrets are server/environment managed.

---

# Slice 04 — My Table / Home + Real Project Persistence

Goal: make the first real Kinetable home/workbench usable and persistent.

Frontend:

- selected board already present;
- `What do you want to make?` prompt;
- lightweight Table / Projects / Parts / Learn navigation;
- returning-user table restore;
- recent project spatial preview.

Backend/data:

- local project store in IndexedDB;
- Supabase `projects` table;
- versioned JSONB project document;
- cloud sync for signed-in users;
- ownership RLS;
- deliberate sync/checkpoint strategy.

---

# Slice 05 — New Build + Real Project Creation

Goal: create a real project from intent.

Build:

- prompt entry;
- generated editable project name;
- create local/cloud project document;
- owned-part awareness where available;
- `Show me first` preview;
- autosave/checkpoint boundary.

AI planning may still be mocked in this slice; project persistence may not be mocked.

---

# Slice 06 — AI Assembly + Real AI Backend

Goal: turn a natural-language idea into validated Kinetable project commands.

Build:

- Vercel Function AI endpoint;
- provider adapter;
- structured tool/command responses only;
- server-side secret handling;
- inventory/project context input;
- hardware-core validation;
- spatial assembly/loading choreography;
- clear unsupported-request behaviour.

AI must never mutate DOM/Three.js directly or bypass deterministic product rules.

---

# Slice 07 — Core 3D Workbench

Goal: make the table itself a serious editor.

Build:

- pan/orbit/zoom/focus;
- select/move/rotate;
- add/remove/replace parts;
- contextual controls;
- Build / Simulate / Explain shell;
- undo/redo foundation;
- local autosave of spatial state.

---

# Slice 08 — Wiring + Breadboard Intelligence

Goal: make visible connections electrically meaningful.

Build:

- machine-readable pin anchors;
- wire creation/routing;
- real nets/endpoints;
- breadboard A–E / F–J topology;
- rails/center gap;
- connected-hole highlighting;
- invalid-placement feedback;
- serialization and deterministic tests.

This slice is core Kinetable value and must not be faked.

---

# Slice 09 — Component Inspector

Goal: explain one selected hardware object without leaving the table.

Build:

- plain-language description;
- `Used here for` context;
- connection list;
- Try / Replace actions;
- technical details on demand;
- metadata sourced from canonical definitions.

---

# Slice 10 — Simulation

Goal: make supported virtual hardware actually behave.

Build:

- deterministic simulation clock;
- component driver API;
- digital/analog states;
- buttons/potentiometers/PIR/etc.;
- LED/OLED/buzzer/servo outputs;
- play/pause/reset;
- spatial event feedback;
- deterministic automated tests.

UI animation must not determine electrical/simulation correctness.

---

# Slice 11 — Explain / X-Ray

Goal: make invisible relationships visible.

Build:

- Power / Signals / Data modes;
- active-path isolation;
- signal animation;
- pin/component highlighting;
- concise beginner explanation;
- deeper technical explanation on demand.

---

# Slice 12 — Visual Logic

Goal: represent programming as understandable behaviour.

Canonical BONK logic:

```text
WHEN button pressed
DO OLED "BONK!"
AND LED ON
AND BEEP ×2
```

Build:

- semantic behaviour graph;
- events/conditions/actions;
- physical-object mapping;
- editable action properties;
- simulation IR;
- validation;
- immediate simulation sync.

---

# Slice 13 — My Parts + Real Inventory Persistence

Goal: make Kinetable personal to the hardware the user owns.

Build:

- Boards / Sensors / Displays / Outputs / Components / Tools;
- quantities;
- add/search;
- local inventory persistence;
- Supabase inventory table;
- ownership RLS;
- signed-in sync;
- project/recommendation queries use this same model.

---

# Slice 14 — Component Library

Goal: establish the canonical hardware knowledge base.

Each component can include:

- GLB model;
- dimensions/anchors;
- pins/capabilities;
- voltage/current constraints;
- protocols;
- simulation driver;
- framework/library metadata;
- common mistakes;
- provenance/license data.

Cloud:

- metadata in PostgreSQL;
- canonical models/thumbnails in Supabase Storage;
- version/provenance tracked explicitly.

Do not optimize for raw component count; optimize for correctness and usefulness.

---

# Slice 15 — Projects + Cloud Sync / Versioning

Goal: make projects reliable across sessions/devices.

Build:

- Recent / Saved;
- miniature 3D previews;
- rename/duplicate/archive;
- project versions/checkpoints;
- cloud restore;
- conflict-safe sync rules;
- signed-out local projects remain usable.

---

# Slice 16 — Explore

Goal: answer `What can I build with what I already own?`

Build:

- Build Now;
- Everything Required;
- One Part Away;
- deterministic inventory requirement matching;
- saved examples/templates;
- AI action: `Use something I already own instead`.

---

# Slice 17 — Learn

Goal: teach hardware by interaction rather than courses.

Initial missions:

1. understand breadboard rows;
2. make an LED light;
3. use a button;
4. control brightness;
5. show text on OLED.

Requirements:

- topology-aware validation;
- staged hints;
- no answer dump by default;
- explain why success works;
- progression without childish gamification.

---

# Slice 18 — Run on Board + Compile Infrastructure

Goal: move from simulation to supported real hardware.

Browser:

- explicit Web Serial/WebUSB connection where supported;
- target confirmation;
- friendly `Preparing → Sending → Running` UX;
- technical details optional.

Backend:

- compile-job API;
- replaceable isolated worker interface;
- Arduino CLI / ESP-IDF / Pico SDK toolchains;
- binary/UF2 artifact delivery;
- job errors mapped to user-friendly states;
- no compiler/toolchain secrets or commands exposed to normal users.

Do not run heavy compilation in Supabase Edge Functions.

---

# Slice 19 — Live Data

Goal: inspect the running physical system visually.

Build:

- sensor values;
- GPIO state;
- board status;
- mapping to 3D objects;
- raw serial as an advanced option.

---

# Slice 20 — Advanced Code

Goal: provide a serious developer escape hatch without changing the default workflow.

Build:

- generated firmware editor;
- physical pin ↔ source highlighting;
- code ↔ visual-logic synchronization rules;
- build/library details;
- raw serial/debug logs.

---

# Slice 21 — Real Workbench Scan — later

Goal: create a digital twin from a real desk.

Build:

- camera/photo import;
- detect board/breadboard/components;
- geometry calibration;
- reconcile observations with Kinetable entities;
- confidence-aware user confirmation;
- media upload/processing backend only when needed.

---

# Slice 22 — Live Workbench — later

Goal: close the loop between Kinetable and the physical build.

Build:

- continuous camera mode;
- next-connection overlay;
- intended vs observed topology comparison;
- physical-action verification;
- spatial debugging;
- combine visual observations with runtime/firmware state.

---

# Product milestones

## Milestone A — Entry

Slices 01–04.

A new user can discover Kinetable, choose a board, optionally create an account, and return to a persistent personal table.

## Milestone B — AI Builder

Slices 05–09.

A user can describe a build, receive a validated assembly, manipulate it spatially, wire it, and inspect each part.

## Milestone C — Living Hardware

Slices 10–12.

The virtual project behaves, explains itself, and exposes editable visual logic without requiring code.

## Milestone D — Personal Platform

Slices 13–17.

Inventory, component knowledge, projects, recommendations and learning are persistent and useful.

## Milestone E — Physical Hardware

Slices 18–20.

Kinetable can compile, flash and inspect supported real boards while still keeping code optional.

## Milestone F — Digital Twin

Slices 21–22.

The real workbench becomes part of the same Kinetable project model.

---

# Slice completion template

Every implementation slice should report:

```text
What this slice adds
What it deliberately does not add
Routes/screens added
Backend/data added
Schema/migrations added
Architecture changed
User-visible interaction
Test checklist
Visual/browser QA
Security/privacy considerations
Known limitations
```

A slice is not complete because the screen renders. The intended user flow, persistence/server behaviour, and failure paths must work end-to-end.
