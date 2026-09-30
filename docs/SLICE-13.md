# Slice 13 — Learn

Implementation and local acceptance record from `c90709dda7cd3bd1a6c39b0b07b51690d73c9ed0`. The exact release commit, Git-triggered deployment and deployed smoke evidence are recorded in the final release handoff after this local gate.

## Product and architecture

`/learn` lists six reviewed missions, quiet earned progress and Continue. `/learn/:missionId` opens an explicit starter choice or resumes the same normal project. Fresh guests can learn without onboarding, sign-in, inventory, network or AI. Unknown mission routes fail clearly. Suggested prerequisites guide ordering without locking learners out.

`learn/missions.ts` owns version-1 content, stage goals and canonical component references. `starters.ts` creates unconnected ordinary Project v4 documents through the existing command executor. Component instance IDs are unique; semantic roles belong to progress metadata. BONK reuses the canonical assembled starter and its saved Visual Logic. Supported boards derive from component compatibility; BONK retains its canonical ESP32 boundary. A persisted unsupported primary board is shown explicitly, requiring an intentional supported choice without changing the preference.

`evaluate.ts` is a pure function of the committed document, role references and matching runtime snapshot. It uses canonical breadboard holes/strips, `compileCircuit`, `sameNet`, `bindDriver`, `analyzeCircuit`, `causalChain` and `describeTrace`. No DOM correctness, duplicated netlist, GPIO table or analog model exists. Equivalent valid net paths pass. Simulation evidence is accepted only for the same project and document revision. Camera motion does not trigger project evaluation. Check goal re-evaluates committed state at the action boundary and never accepts a UI or AI verdict.

`MissionPage`, `MissionGuide` and `LearnPage` separate project orchestration, guidance and curriculum. They reuse AppShell, ProfileGate, Workbench modes, the normal physical editor, simulation, Explain, history and account namespaces. No new global store or dependency was added. Learning suppresses generic introductory coaching; breadboard teaching leads use a neutral connectivity status instead of irrelevant incomplete-circuit diagnostics. Electrical transaction validation remains intact.

## Missions

| Mission | Learner action and deterministic proof | Runtime / Explain | Boundary |
|---|---|---|---|
| Breadboard | Insert A leads of two teaching resistors on one terminal strip, across its center gap, then on one rail. Actual placement, canonical strips and derived net membership must agree. | Inspect highlights existing nets. Why states observed shared/separate nets. | Two independent teaching leads; not a complete powered circuit. Exact supported 400-hole model has four continuous 25-hole rails; real models vary. |
| LED | Wire GPIO → series 220 Ω resistor → LED anode, cathode → ground. Canonical driver binding rejects direct/reversed/wrong-net wiring. | Blink must produce actual ON and OFF trace entries. Existing Explain shows signal/power evidence. | Logical HIGH/LOW only; no measured current or physical certification. |
| Button | Wire separate button contacts between GPIO and ground; observe press and release. Canonical driver binding and causal input traces prove LOW press and HIGH release. | Real simulation input controls and causal Explain. | Supported pull-up semantics; contact bounce not modeled. |
| Brightness | Build the protected LED path and observe ON/OFF while learning qualitatively about resistance/current limiting. | Same existing LED runtime. Visible limitation is present throughout the mission. | Only the supported 220 Ω profile; no numeric brightness, alternative-resistance simulation, analog current or PWM claim. |
| OLED | Wire supported supply/ground and canonical SDA/SCL; author a normal Timer → OLED Show HELLO rule. | Actual current HELLO output plus semantic I²C trace; normal Visual Logic/Explain. | ESP32/Pico supported; Uno's 5 V signal profile is unsupported. No physical I²C waveform or invented pins. |
| BONK | Inspect canonical assembled input/output paths and saved Button pressed rule; simulate a press. | Actual BONK! OLED text, LED ON and at least two timed buzzer ON traces, alongside existing Explain. | Deliberately assembled capstone; ESP32 only. Not a from-scratch wiring exam or hardware deployment. |

## Guidance and AI boundary

Each stage has two authored hints followed by explicit Show answer. Answers reveal board-derived connections; they never mutate the project. Hint depth persists. Diagnostics and actual traces supplement hints. Wrong edits remain the learner's work and use normal undo/redo. Previous inspection retains earned progress; forward navigation requires an earned current stage. Merely navigating, viewing hints or asking Why cannot earn completion.

Why? · Ask Kinetable expands reviewed concept text and actual deterministic observations. It explicitly says generated AI explanations are unavailable in Learn. No provider request, account context, database or chain-of-thought is sent. Learn works with no provider. Optional generated paraphrasing is **deferred with reason**: deterministic evidence covers the initial teaching flow without another provider/mutation surface. Existing workbench Logic AI remains within its existing preview/Apply command validation; it has no access to learning completion. All completion writes pass the deterministic evaluator.

## Persistence

Dexie version 6 adds only `learningProgress`, keyed by `[ownerId+missionId]`, indexed by owner/updatedAt. It stores mission/version, project ID, semantic roles, current stage, earned stage prefix, per-stage hint depth and updatedAt. Mission complete is derived from the earned stages. No selection, camera, runtime or AI conversation is stored. Parse validation rejects unknown versions/stages, skipped/duplicate completion, malformed roles/hints/IDs and invalid timestamps. A mismatch preserves the old project in Projects and offers explicit new mission creation. Unknown or obsolete list entries cannot crash the curriculum.

Guest and signed-in user records are distinct; sign-out hides account progress and restores guest visibility. No automatic guest-progress adoption occurs. Account learning metadata stays on this device. Normal signed-in mission projects use existing project cloud checkpoint/conflict handling. Progress and simulation never create project versions; real edits do. Restore recomputes evidence while retaining previously earned progress. Cross-device learning metadata is **deferred with reason**: normal projects already preserve hardware work, while a small local record is sufficient for this slice. No Supabase migration, table, RLS change or service-role use was added.

## Gate 0

Slice 12's local-candidate paragraphs remain historical; current README, roadmap, architecture and backend now record its production completion. Preflight independently confirmed deployment `dpl_5whgh3Rpr2Snjb72QAVpeX933jN9`, READY, exact `c90709d…`, production alias `https://kinetable.vercel.app`, and migration `20260929000000_resume_slice12_checkpoint` among ten applied migrations. Production had one user, the existing QA user.

The production console warning came from inline synchronous theme bootstrap under `script-src 'self'`. The same bootstrap now lives in self-hosted `/theme-bootstrap.js` and loads synchronously before the application. System/light/dark behavior is preserved; CSP is unchanged. A local browser test injects the exact production CSP and verifies theme startup with no inline-script violation. Deployed confirmation is pending release.

## Local evidence and self-review

On 2026-09-30: lint, root TypeScript, web TypeScript and production build passed. Vitest: **125 passed, 1 environment opt-in skipped**. Separate Node landing check: **1 passed**. Final full local Playwright: **59 passed, 14 opt-ins skipped** (73 discovered); all eight new Learn tests passed. The guarded local-account Learn test also passed separately against local Supabase.

The 14 default skips cover hosted auth/circuit/logic/build/parts/workbench/simulation, the persistent-account hosted check, local Supabase integration, external preview routes and real CLI bridge. They require explicit environment fixtures and are not default local failures. No hosted suite or production load test ran. **Both local Supabase browser tests passed** (account Learn isolation and existing revisions/RLS/conflict regression), with all ten existing migrations applied. Docker was recovered by moving aside three stale runtime sockets through its WSL distribution; data/settings were preserved and no factory reset occurred. The normal production-configured build was restored afterward. `git diff --check` passed; no mandatory failure was waived.

Rendered light/dark mission screenshots were inspected at 390×844, 768×1024, 1440×900, 1600×1000 and 1920×1080. Desktop keeps hardware beside guidance; mobile stacks a shorter hardware canvas above guidance. Visual review fixed a starter board overlapping breadboard holes and an oversized mobile canvas hiding the first task. The board-position fix applies to new starters; saved project geometry remains the learner's work. Breadboard completion, LED/Button completion and OLED HELLO/Explain screenshots were inspected. Manual local browser interaction also exercised Hint and Why. Existing physical hover/net highlights, camera controls and reduced-motion behavior are reused; no continuous decorative animation was added.

Keyboard hints/controls, reduced motion, responsive geometry, client-side navigation, unknown routes, WebGL fallback regressions, meaningful labels, status announcements and disabled completion gates are covered. This is browser/accessibility evidence, not an exhaustive screen-reader certification. Existing large Three.js/main build-chunk warning remains; Learn is lazy loaded.

Diff review checked TODO/FIXME/TEMP/HACK, debug output, URLs, generated artifacts and secrets. No new hit exists in Learn source/tests/bootstrap. React renders explanation text without HTML injection. Auth destinations remain allowlisted. Repository writes validate learning metadata; normal safety/Logic validation protects project edits. No new remote execution, provider credentials, public backend or security-policy exception exists. Test screenshots, output and local secrets remain ignored. Preexisting untracked `videos/` is preserved and excluded.

## Requirement classification

| Requirement group | Classification | Evidence / reason |
|---|---|---|
| Gate 0 production truth and stale docs | IMPLEMENTED | Live deployment/migrations/user preflight; corrected current status with historical evidence retained. |
| Theme CSP root fix | IMPLEMENTED | External synchronous script; unchanged CSP; local exact-policy browser check. Deployed check pending. |
| Six missions, normal projects, board support | IMPLEMENTED | Versioned definitions/starters; canonical compatibility and v4 validation; domain/browser tests. |
| Deterministic topology/runtime correctness and Explain | IMPLEMENTED | Canonical compiler/drivers/validation/trace reused; invalid/equivalent path tests. |
| Staged hints, explicit answers, no silent fix | IMPLEMENTED | Three-depth persistent hints; normal editor only. |
| Guest/offline learning and scoped progress | IMPLEMENTED | IndexedDB domain/browser evidence plus real localhost account sign-out/sign-in isolation. |
| Cross-device learning progress | DEFERRED WITH REASON | Small local metadata sufficient; normal project cloud sync reused. |
| Optional generated AI explanations | DEFERRED WITH REASON | Grounded deterministic Why covers required flow; no new provider or mutation surface. |
| AI evaluator or new AI mutation surface | NOT APPLICABLE | Explicitly excluded; deterministic completion only. |
| Supabase migration/RLS changes | NOT APPLICABLE | No server model changes. Existing project persistence still requires local regression acceptance. |
| Inventory availability/purchases | NOT APPLICABLE | Optional owned-parts badge omitted; virtual parts never gated/decremented; no shopping. |
| Desktop/mobile/themes, reduced motion, visual inspection | IMPLEMENTED | Five viewport widths, both themes and rendered/manual evidence; fixes above. |
| Analog/PWM/numeric brightness | NOT APPLICABLE | Unsupported capability excluded and taught honestly. |
| Local Supabase gate and account lifecycle | IMPLEMENTED | Two localhost integration tests passed; no production users created. |
| One local commit/push/Git deployment/smoke | Release handoff | Performed only after mandatory local acceptance; exact evidence in final handoff. |
| Slice 14 physical runtime | NOT APPLICABLE | Not started. Begin from validated canonical hardware/compiler/Logic/Explain boundaries after Slice 13 acceptance. |

## Release handoff fields

Starting SHA: `c90709dda7cd3bd1a6c39b0b07b51690d73c9ed0`. This document records the implementation and local gate; final SHA, deployment ID, exact deployed revision, READY/alias, smoke/console results, push/deployment counts and postflight user count belong to the final release handoff. Production preflight: 1 total / 1 QA user. No production Supabase test run is needed because no new server behavior exists. Preexisting untracked `videos/` remains excluded from this slice's commit.

No new production QA account was created. No production load test ran. No fake analog/PWM capability was added. AI does not determine mission correctness. Slice 14 was not started.
