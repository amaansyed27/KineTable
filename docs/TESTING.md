# Kinetable Testing Strategy

## Goal

Kinetable combines UI, 3D interaction, electrical rules, simulation, AI tools and later real hardware. Testing keeps deterministic domain logic separate from visual/manual verification and external integration checks.

## Test layers

### 1. Pure unit/domain tests

Primary tool: **Vitest**.

Highest-priority areas:

- project schema parsing and migration;
- breadboard conductive groups;
- pin capability validation;
- net creation/removal;
- voltage/direction constraints;
- project command executor;
- simulation compilation/timing;
- Visual Logic schema/compilation/runtime;
- component-definition validation;
- AI tool-call validation.

These tests should not require a browser or Three.js canvas.

### 2. Browser UI and accessibility tests

Primary current tool: **Playwright**.

The repo does not currently depend on React Testing Library. Add a component-test library only when it provides clearer value than the existing pure-domain + browser split.

Cover:

- onboarding and board selection;
- contextual inspector visibility;
- Build / Logic / Simulate / Explain switching;
- logic editor controls and validation;
- keyboard/touch interaction;
- WebGL fallback;
- error/accessibility states.

### 3. Spatial interaction tests

Use a combination of:

- pure transform/anchor tests;
- deterministic hardware-core tests;
- Playwright for critical pointer flows;
- manual screenshot/visual inspection for rendering quality.

Do not rely only on screenshot snapshots for 3D correctness.

### 4. Hosted integration tests

Use opt-in Playwright/REST checks for:

- Supabase Auth;
- owner-only project RLS;
- old project version compatibility;
- local/offline → cloud reconciliation;
- fresh-browser restore;
- deployed Vercel routes;
- Local Bridge/real provider checks where environment-specific.

Do not make deterministic unit tests depend on external services.

## Canonical E2E flow

```text
fresh app
→ select ESP32
→ load/request BONK
→ inspect physical circuit
→ create/restore BONK Visual Logic
→ simulate
→ press button
→ LED ON / OLED BONK! / buzzer ×2
→ change beep count to ×3
→ rerun
→ exactly three pulses
→ refresh/restore
→ ×3 persists
```

Slice 09 recipe regressions retain their deterministic demonstration behavior. Slice 10 project-logic tests prove the persistent behavior IR supersedes hidden recipes once authored.

## Core deterministic fixtures

Keep small reference circuits/fixtures for concepts such as:

```text
empty-esp32-table
led-basic
button-led
bonk
motion-alarm
dht11-oled
```

Fixtures should use the same project models as real saved projects rather than parallel mock schemas.

## Breadboard tests

Minimum cases:

- A1–E1 connected;
- F1–J1 connected;
- both sides separated across the center trench;
- adjacent numbered rows not connected;
- power-rail grouping matches the selected breadboard definition;
- moving a lead to another strip changes connectivity;
- multiple leads in one conductive group share a net.

## Simulation tests

Use the deterministic logical clock.

Current examples:

### Button

- press/release state;
- supported pull-up semantics;
- authored button triggers use actual compiled physical bindings.

### BONK buzzer

- exactly two pulses for the initial rule;
- exact ON/gap timing;
- changing Visual Logic to three beeps produces exactly three;
- pause/reset behavior remains deterministic.

### OLED

- generic semantic display output;
- startup/release READY via authored rule;
- button-press BONK!;
- DHT condition output.

### PIR / DHT11

- deterministic PIR HIGH interval;
- DHT11 bounded virtual temperature/humidity;
- condition boundaries and AND semantics.

ADC/PWM/potentiometer tests belong with those future simulation drivers; they should not appear as current coverage until implemented.

## Project serialization tests

Every supported project schema version should test:

- parser acceptance/rejection;
- migration into current schema;
- stable project/entity IDs;
- invalid references;
- deliberate no-rewrite-on-read behavior for old cloud/local documents.

Current migration chain:

```text
v1 → v2 → v3 → v4
```

## Visual Logic tests

`src/logic/logic.test.ts` covers:

- v1/v2/v3 → v4 migration;
- strict language bounds;
- stale/capability/topology rejection;
- real GPIO/net binding;
- layout invariance;
- BONK ×2 → ×3 timing;
- timer/PIR/DHT behavior;
- causal chains;
- disabled logic;
- reorder and runaway bounds;
- conflicting board-pin roles;
- project-logic input initialization without legacy recipe trace leakage.

Project repository/store tests cover migration, local persistence, offline/reconnect and history.

## AI tests

Most tests use fixture planner responses/tool calls, not live models.

Examples:

- valid component command accepted;
- invalid pin/capability rejected by hardware core;
- unknown component rejected;
- arbitrary JSON mutation unavailable;
- unsupported goal returns explicit unsupported result;
- logic commands remain outside the current Slice 06 planner contract.

Live-provider/CLI tests are optional integration checks and are not deterministic CI gates.

## Visual QA checklist

For each major spatial slice verify manually:

- object scale feels physically coherent;
- selection is obvious without excessive glow;
- labels do not cover important hardware;
- shadows aid depth instead of obscuring pins;
- wires remain attached while objects move;
- camera orbit/zoom cannot easily lose the project;
- UI chrome does not dominate the table;
- Logic/Simulation panels remain secondary to the workbench;
- reduced-motion remains usable;
- common desktop/tablet/mobile viewports do not overflow.

## Performance checks

Track at minimum:

- first useful scene time;
- model load time;
- frame rate on canonical BONK;
- selection response latency;
- wire update cost while moving components;
- memory use after repeated project/simulation opens;
- build chunk-size warnings before the component/platform catalog grows substantially.

## Release gate for each roadmap slice

A slice is ready when:

- deterministic tests pass;
- lint/build pass;
- relevant Playwright/integration tests pass;
- visual/browser QA passes;
- product behavior matches the slice spec;
- known limitations are documented;
- no temporary fake state has become a hidden dependency for later slices.

Core commands:

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

External hosted/provider checks remain explicit opt-in runs. Earlier Slice 10 evidence is in [SLICE-10.md](SLICE-10.md); future production Supabase QA is designed for one persistent account and project and is awaiting approval.

## Pre-Slice-11 correction acceptance

The screenshot follow-up adds `interaction-refinement.spec.ts` and `spatial/jumpers.test.ts`: click-to-rename persistence/history, real Account settings, aligned/bounded menus, responsive dock/inspector clearance, keyboard tooltips and physical wire continuity. Hosted auth also verifies renamed row/document cloud restore. See [interaction refinement](UI-INTERACTION-REFINEMENT.md).

Build before E2E: Playwright serves compiled output. Required gates: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm exec tsc --noEmit`, `pnpm --filter @kinetable/web exec tsc -b`, `pnpm test:e2e`.

`product-correction.spec.ts` checks real BONK, exact/missing/legacy routes, project retrieval, blank creation, persisted guidance, System/explicit themes, account focus, AI Logic preview/Apply, unchanged failure paths and masked vault credentials outside project storage. Rendered screenshots cover 390×844, 768×1024, 1440×900, 1600×1000, 1920×1080 and dark Home/Build/Logic. Physical anchors/safety, logic compilation/pulse timing, history/offline/auth/owner and provider security remain regression gates.

Hosted opt-ins: `KINETABLE_HOSTED_QA=1` runs only `hosted-personal-workspace.spec.ts`, with the persistent account from ignored `KINETABLE_QA_EMAIL` and `KINETABLE_QA_PASSWORD`. Earlier suites that sign up users now require `KINETABLE_LOCAL_SUPABASE_QA=1` and a localhost Supabase URL. `KINETABLE_REAL_CLI_BROWSER_QA=1` invokes the configured default Codex CLI through a temporary authenticated loopback bridge. `E2E_BASE_URL` enables deployed direct-route refresh checks with existing protected-preview handling. Screenshots, credentials and raw provider output stay ignored.

Deployed checks allow 20 seconds for assertions and 120 seconds per multi-route test to cover network/auth hydration and full refreshes. Local deadlines remain unchanged; behavior, status, identity and persistence assertions are identical.

## Slice 11 checks

`pnpm lint`, `pnpm test`, both TypeScript checks and `pnpm build` cover the canonical definitions, compatibility, inventory validation, account namespace and planner quantity gate. `pnpm --filter @kinetable/web test:e2e` covers guest Parts, persistence, detail, filtering, New Build choice, workbench owned-first tray and five viewports in both themes. Cross-user hosted-parts checks now run only against local Supabase. Hosted migrations `20260928064547_inventory_items.sql` and `20260928070528_inventory_definition_ids.sql` add storage/RLS and the reviewed-ID constraint. [Slice 11 acceptance](SLICE-11.md).

## Slice 12 checks

`slice12.test.ts` covers owner-scoped local versions, append-only restore, two-device stale-write detection and persistence, all three resolution actions, retry bounds, exact owned quantities and workspace sync interpretation. `personal-workspace.spec.ts` covers guest Explore → real BONK → History → restore, reload and five viewport widths in Light/Dark. `local-personal-workspace.spec.ts` verifies atomic RPC revision increments, tagged stale results, owner RLS, direct-write denial, fresh authenticated routes and browser conflict resolution against local Supabase. Run it only after building with local URL/key overrides. `hosted-personal-workspace.spec.ts` is one bounded same-account production check after local gates and the final migration. See [Slice 12](SLICE-12.md).

`parts-cold-route.spec.ts` saves ESP32, Pico and Uno profiles separately, then opens `/parts` in a fresh page for each. It checks the Board filter before and after direct reload and verifies a compatibility result against that saved board without visiting `/start` in the new page.
