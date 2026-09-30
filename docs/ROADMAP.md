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

Status: complete; see [Slice 02](SLICE-02.md).

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

Status: complete with real email/password auth and cloud-profile sync; see [Slice 03](SLICE-03.md). Google/GitHub credentials, SMTP, email verification and reset emails are deferred under the updated user scope.

Goal: add cloud identity without gating first use.

Build:

- email/password auth now; Google/GitHub integration prepared but disabled until provider credentials are configured;
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

Status: complete; see [Slice 04](SLICE-04.md).

Goal: make the first real Kinetable home/workbench usable and persistent.

Frontend:

- selected board already present;
- `What do you want to make?` editorial heading; no submit action yet;
- working Table navigation; unavailable destinations omitted;
- returning-user table restore;
- current project represented by the board on its saved work surface.

Backend/data:

- local project store in IndexedDB;
- Supabase `projects` table;
- versioned JSONB project document;
- cloud sync for signed-in users;
- ownership RLS;
- deliberate sync/checkpoint strategy.

---

# Slice 05 — New Build + Real Project Creation

Status: complete; see [Slice 05](SLICE-05.md).

Goal: create a real project from intent.

Build:

- `/table` New Build entry and direct `/new` route;
- validated natural-language intent and deterministic editable name;
- factual `Show me first` preview with the selected board;
- pristine starter promotion, then independent project IDs;
- local IndexedDB save before authenticated Supabase checkpoint;
- offline dirty state and retry, with owner-only RLS.

No AI planning, inventory claim, generated part, wiring or logic is present. Slice 06 owns hardware planning and assembly.

---

# Slice 06 — AI Assembly + Real AI Backend

Status: implemented and verified with real Codex CLI planning, hosted Supabase, a guest Local Bridge browser build and a deployed Vercel Preview. Kinetable-managed inference is deferred. See [Slice 06](SLICE-06.md).

Goal: turn a natural-language idea into validated Kinetable project commands.

Build:

- BYOK Vercel Function and optional Local Bridge;
- ordered provider/key router with remote, custom, local HTTP and CLI adapters;
- structured tool/command responses only;
- request-scoped BYOK handling and device-local vault;
- owner-verified cloud project or validated guest project, board and intent input (inventory comes later);
- hardware-core validation;
- spatial assembly/loading choreography;
- clear unsupported-request behaviour.

AI must never mutate DOM/Three.js directly or bypass deterministic product rules.

The implemented subset creates direct electrical connection data and places canonical parts. Firmware, behavior logic, simulated function, and breadboard topology remain later work.

---

# Slice 07 — Core 3D Workbench

Status: implemented and verified with local editing, hosted Supabase persistence, Chrome Playwright and a protected Vercel preview. See [Slice 07](SLICE-07.md).

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

# Canonical roadmap from Slice 08

The former 22-slice plan is compressed to 15 slices. Slices 01–07 above retain their historical scope and records.

| Current slice | Earlier slices | Scope |
| --- | --- | --- |
| 08 — Physical Circuit Editor | 08 + 09 | Breadboard, physical wires, net-aware validation and inspectors |
| 09 — Living Circuit | 10 + 11 | Simulation, Explain and X-Ray |
| 10 — Visual Logic | 12 | Editable semantic behavior |
| 11 — Hardware Platform | 13 + 14 | Inventory and verified component knowledge |
| 12 — Personal Workspace | 15 + 16 | Project versions, sync and Explore |
| 13 — Learn | 17 | Topology-aware interactive lessons |
| 14 — Physical Runtime | 18 + 19 + 20 | Compile, flash, live data and advanced code |
| 15 — Digital Twin | 21 + 22 | Scan and live workbench |

## 08 — Physical Circuit Editor

Status: implemented; see [Slice 08](SLICE-08.md).

A project stores explicit pin and breadboard-hole endpoints, physical wires and component lead insertions. A deterministic 400-hole half-size breadboard topology derives nets; the workbench renders exact endpoints, allows manual wiring, inspects parts/wires/holes and saves edits locally and to owner-only cloud projects. Circuit validity is derived from the graph. The editor remains useful without simulation.

## 09 — Living Circuit

Status: implemented; see [Slice 09](SLICE-09.md). A deterministic compiled-circuit runtime, virtual inputs, topology-matched demonstration recipes, causal Explain and Power/Signals/Data/All X-Ray reveal supported behavior. Rendering observes runtime truth. This is semantic simulation, not firmware or physical verification.

## 10 — Visual Logic

Status: implemented; see [Slice 10](SLICE-10.md). Project v4 persists bounded WHEN/IF/DO rules, validates canonical capabilities and physical bindings, and compiles them into the existing logical runtime. Manual edits use project commands, history and local-first cloud checkpoints. BONK ×2 → ×3, timer Blink and DHT11 conditions are editable and deterministic.

## 11 — Hardware Platform

Status: implemented; see [Slice 11](SLICE-11.md). `/parts` combines local-first My Parts with a curated provenance-aware component library. Owner-only inventory sync and an optional quantity-checked owned-parts AI mode use the same supported definitions and hardware validator.

## 12 — Personal Workspace

Status: complete; production verification passed at `c90709d`. See [Slice 12](SLICE-12.md). Durable local/cloud project versions, atomic optimistic cloud checkpoints, persistent conflict resolution, fresh-device restore and deterministic My Parts matching power `/explore`. Production checkpoint writes resumed with migration `20260929000000`. Inventory's own timestamp sync remains a documented limitation.

## 13 — Learn

Status: implemented and locally accepted; see [Slice 13](SLICE-13.md). Six missions teach breadboard rows/gap/rails, protected LED paths, button pull-up inputs, honest qualitative brightness, OLED I²C/Logic and canonical BONK. Pure evaluation reuses physical topology and matching simulation evidence. Owner-scoped local progress and staged hints work without an account, network or provider. Cross-device progress and generated Learn explanations are deferred. Exact production deployment evidence accompanies the final release handoff.

## 14 — Physical Runtime

Support explicit device connection, isolated compilation and flashing, live board data, serial diagnostics and advanced code with clear code-to-visual rules.

## 15 — Digital Twin

Reconstruct a real bench from images with user confirmation, then compare an observed live setup against the intended circuit.

---

# Product milestones

- **Entry (01–04):** landing, onboarding, identity and persistent table.
- **Builder (05–08):** real project creation, AI assembly, spatial editing and physical circuits.
- **Living hardware (09–10):** supported simulation, explanations and visual logic.
- **Personal platform (11–13):** inventory, reusable projects, recommendations and learning.
- **Physical hardware (14):** compile, flash and inspect supported boards.
- **Digital twin (15):** observe and reconcile a real workbench.

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

Slices 01–13 complete.
Slice 14 — Physical Runtime next. Slice 15 — Digital Twin later.

## Unnumbered pre-Slice-11 correction

Slices 01–12 complete. **Pre-Slice-11 UX correction and Slice 11 Hardware Platform complete.** Project hierarchy, contextual workbench, appearance, physical visual improvements and bounded provider-backed Logic use existing commands. Slice 11 adds the canonical supported-profile library and My Parts. Run/Code/upload remain future Slice 14. [Correction record](PRE-SLICE-11-UX-CORRECTION.md); [Slice 11 record](SLICE-11.md).

Slice 12 adds append-only project history, revision-checked cloud sync, conflict preservation and resolution, and five deterministic Explore ideas based on My Parts. [Slice 12 record](SLICE-12.md). Slice 13 was not part of the Slice 12 release.
