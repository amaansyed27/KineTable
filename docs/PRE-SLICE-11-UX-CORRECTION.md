# Pre-Slice-11 product correction

Date: 2026-09-27. Starting main: `23a6f2f64d7a08fe15567761b00c928dae9fc824`.

Slices 01–10 complete. Pre-Slice-11 UX correction complete. Slice 11 — Hardware Platform next. **SLICE 11 WAS NOT STARTED.**

## Why and authority

The [UX audit](reviews/2026-09-27-product-ux-audit.md) found duplicate navigation, permanent panels and technical forms obscuring the working engine. All 11 audit images and [20 approved mockups](design/2026-09-27-application-mockups/README.md) were reviewed. Mockups guide hierarchy, material and task layouts. Canonical definitions, project endpoints, breadboard topology, validation and simulation govern electrical truth. Generated image pins/conductors were never imported as wiring data.

## Routes and compatibility

| Route | Purpose |
|---|---|
| `/` | Marketing landing; CTA enters Home |
| `/home` | Continue a real project, create one or save BONK |
| `/projects` | Search all eligible saved/restored projects |
| `/projects/new` | Optional intent/name; usable blank board without AI |
| `/projects/:id` | Exact eligible project; missing-ID recovery |
| `/start` | Virtual board setup, completes into Home |
| `/auth` | Password/available OAuth, guest continuation, safe return |
| `/settings/appearance` | System, Light, Dark |
| `/settings/providers` | Local/cloud routes, keys and advanced bridge |
| `/table` | Redirect to remembered/current project |
| `/new` | Redirect to `/projects/new` |

Documents remain in the existing IndexedDB repository. Cloud reconciliation restores eligible projects; optional navigation preferences use localStorage. v1–v4 parsers/migrations remain, with historical documents upgrading on edit. Supabase tables/policies/checkpoints are unchanged. Guest use stays ungated. Board changes preserve populated circuits by creating a new starter. Explicit IDs never silently open an unrelated project.

## First run and project surfaces

ESP32/Pico/Uno setup explains virtual building and requires no hardware/provider. Home offers explicit deterministic BONK: ESP32, button, LED/resistor, buzzer and OLED; press shows BONK and two beeps, release shows READY. It saves through validated commands. Home's read-only preview uses a real graph. Projects folio rows derive previews/metadata from saved documents. New Project records intent honestly and creates a blank board. Existing first-starter promotion is compatible; later builds preserve earlier projects.

## Workbench and onboarding

The compact header holds Projects, name, actual save state, Build/Logic/Simulate/Explain and avatar. Hardware dominates. Build has + Part, Wire, Breadboard, undo/redo, camera, exclusive native parts/connection drawers and contextual inspector. One persisted coach appears at a time with Got it/Skip. Keyboard manipulation, touch, zoom and WebGL fallback remain.

Logic uses natural WHEN/DO sentences. Conditions, trigger variants, enable/delete, timing and ordering use advanced disclosures. Hover/focus references hardware; mobile shows one selected rule body. Simulate has compact play/pause/reset and contextual inputs/outputs. Slice 09 recipes remain. Explain retains deterministic Power/Signals/Data/All, path highlights, optional technical nets and causal events. Simulate/Explain retains unchanged runtime identity and never persists runtime output.

## Horizontal AI and shared commands

AI is contextual, not a fifth mode or permanent chat. Build previews initial supported assembly and requires Apply; incremental populated-project assembly is honestly unavailable. Logic uses the existing router/vault/cloud proxy/Local Bridge for short behavior requests.

The separate strict behavior contract accepts only bounded `logic.rule.add/update/remove`, exact identity/revision, canonical physically bound components and zero-command unsupported results. Extra fields, executable code, unsafe bindings, oversized output and stale revisions fail. Request/display strings are untrusted data. A complete candidate is compiled before preview. Apply checks identity/revision inside `applyTransaction`, then uses `executeCommands`, existing history, local save and cloud checkpoint. Manual editing follows that same path. Hardware planning still rejects behavior commands.

Natural before/after preview and one-step undo preserve control. Provider failure leaves the document unchanged. Simulate/Explain provide contextual access to Logic assistance and accurately describe deterministic paths/runtime; generated scenarios or AI explanations are deferred.

## Physical layout and safeguards

The catalog is unchanged. OLED housing/header detail and buzzer PCB improve recognition. Bounded shelf placement avoids current footprints for new free parts, preserves saved transforms, and separates the default breadboard from the board. BONK explicitly seats through-hole leads in canonical rows.

All conductors terminate at `endpointWorld`, including rotated/scaled pins and holes. Lead placement uses exact anchors. Stable smooth lifted curves use thin conventional colors and a separate translucent highlight; Explain dims unselected paths. Grouped wiring chooses part, row/rail, terminal. Compatible targets use real safety validation and commit validates again. Fit uses bounds; moving hardware preserves the camera. Drag/wire previews update Three.js directly without React workspace renders per pointer move.

## Appearance, account and responsive tasks

Semantic paper/raised/ink/muted/border/focus/error/selection tokens govern light warm ivory and dark warm charcoal. System follows OS changes; explicit choices persist and initialize before rendering. Static procedural paper grain is opacity 0.018 light / 0.012 dark, without animation/network assets. Landing retains its art direction.

Account uses real initials/identity, muted email, actual sync, appearance/providers/auth/sign-out; Escape restores focus and outside click closes. Provider rows group Local/Cloud and collapse advanced controls; untested status is honest. Existing route order, fallback, custom endpoints, key management and bridge remain. Credentials never enter projects/cloud JSON.

Mobile 390×844 and tablet 768×1024 use compact headers/task sheets; desktop 1440×900, 1600×1000, 1920×1080 keeps hardware dominant and restrained Logic. Browser checks inspect rendered canvases, geometry, keyboard and touch.

## Verification and deployment

See [TESTING](TESTING.md). Ignored `output` holds screenshots/logs, not product assets. Acceptance covers lint, unit/security/planner checks, both TypeScript projects, build, full local E2E, disposable hosted auth/restore/offline/RLS, real Codex CLI assembly/behavior, and deployed direct refresh. No dependency or schema was added.

Final local acceptance: lint, root/web TypeScript and production build passed; 88 Vitest tests plus the landing choreography check passed. All 47 local E2E checks passed with hosted and real Codex CLI opt-ins enabled; the one deployment-only route check is run against production. The five-width visual sweep has no page errors or horizontal overflow. Hosted auth, fresh restore, offline reconnect, owner RLS and unchanged simulation timestamps passed. No failures were waived.

Production browser acceptance: 21 distinct checks passed (19 in the main run, then the hosted layout and authenticated no-runtime-write checks with their opt-ins enabled). Direct refresh covered all new routes, valid project identity and both legacy aliases. Production also passed five-width/theme/vault screenshots, real CLI assembly/behavior, hosted auth/restore/offline/RLS and simulation. One initial five-second navigation timeout was resolved using the existing twenty-second project-opening allowance and rerun successfully.

Deployment: [Kinetable](https://kinetable.vercel.app). Final READY status, exact main SHA and a final deployment smoke pass are verified in the delivery report.

## Known limitations

- Incremental hardware AI, generated AI scenarios/explanations are deferred and labelled honestly.
- Free parts need explicit lead placement; supported starter seating is explicit. Geometry is illustrative, not mechanical CAD.
- Bounded shelf placement suits this small catalog; larger builds need footprint packing.
- Simulation is semantic, not analog/SPICE, waveform or firmware execution.
- No inventory/platform, Run/Code, compile/upload/flashing was added; auth recovery/verification and expanded board behavior remain deferred.
- Undo history remains bounded/session-local; vault/browser security limits remain documented in AI-TOOLS.
