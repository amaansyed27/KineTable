# Pre-Slice-14 Prompt-to-Project correction

An unnumbered product correction after Slice 13. Slice 14 Physical Runtime is next and has not started; Slice 15 Digital Twin remains later.

## Why this exists

The trailer asks “What do you want to make?” and turns an idea into hardware. Production at `7a9d3cf45c83b8b0634a001edb37876d44475cb3` instead emphasized continuing a project or creating a blank board before asking for assembly. The validated machinery already existed, but the product entry did not clearly express that promise.

Starting local and remote main matched that SHA. Tracked files were clean; the supplied `videos/` directory was already untracked and is preserved. Slice 13 production deployment `dpl_5Rk6qr5Uoap4tvhBydig16moXDMt` was READY at that exact SHA and remains the rollback candidate. README, roadmap/spec/architecture/AI/design/decisions, Slices 06/11/12/13 and the pre-Slice-11 correction were reviewed alongside the actual routes and implementation. Production Home, Projects, New, Parts and Explore were inspected; incumbent Assembly, contextual Ask, responsive shell and tokens were traced in code and browser regression coverage.

## Product principle

“I have these parts. I want this behavior. Build it with me.”

Intent → validated proposal → user approval → real project → Workbench.

The prompt is the fastest way into a project. **Workbench remains primary. There is no permanent AI chat sidebar.** Build, Logic, Simulate and Explain keep their existing responsibilities. AI is horizontal assistance for entry and subsequent contextual changes.

## Home and New Project

Home exposes “What do you want to make?” beside the existing hardware preview. A labelled, bounded native textarea submits on Enter; Shift+Enter inserts a line break. Examples fill the input for review. An explicit arrow submits. Board context, optional My Parts and the provider setup link remain quiet.

Home, Projects → New and `/projects/new` share `ProjectIntent` and `proposeBuild`. New provides board/name controls and the existing Create blank project escape. The draft survives visiting provider settings. Neither React rendering nor an example click requests a plan. A synchronous single-flight guard blocks double Enter/click; unmount discards late results; failures finish without an automatic UI retry loop.

## Proposal and approval

The transient proposal contains an ordinary Project v4 base plus domain commands. It is not a new persisted schema. Hardware commands are executed on a copy for validation before presenting a heading, short summary and canonical parts list. Raw JSON, model HTML and chain-of-thought are never shown. No project is saved before approval.

Approval validates again through `executeCommands` and `createFromProposal`, queues the transaction and saves one ordinary local project through the existing repository. Repeated approval of the same proposal ID cannot create another project. Owner checks reject a proposal when authentication identity changes. Normal history records creation, undo returns to the board, and redo restores the build. Existing cloud checkpoints, RLS and conflict handling remain authoritative.

“Preparing your table…” reports the real save operation. The standard scene appears on the ordinary project route. Its arrival reuses the existing `workspace-arrive` motion and reduced-motion override; there is no fabricated progress meter or separate assembly animation system.

## Board and My Parts

ProfileGate hydrates the persisted primary board before entry. New's explicit board control uses canonical board metadata. ESP32, Pico and Uno are passed into the same planner; UI code does not choose pins.

The existing Slice 11 owner-scoped inventory supplies exact quantities. Proposal requirements count board, breadboard and components without assuming ownership. “You already have everything” or “You have N of M parts” is accompanied by missing names/counts. Virtual building remains available and approval never decrements or reserves stock.

New proposals use advisory `prefer-owned` context so missing parts do not prohibit virtual building. Existing contextual “Use my parts only” retains strict `owned-only` validation. Inventory errors do not produce an ownership claim. No shopping flow or new database migration was added.

## Deterministic starters and unsupported requests

Narrow reviewed BONK phrases, including “Press a button. Make it go BONK.”, use the existing canonical ESP32 builder rather than a model. Wiring, terminal placement and saved button/LED/OLED/two-beep rules come from `bonkCommands`. Extra clauses and negation do not silently select the demo. BONK on Pico/Uno returns an explicit zero-command unsupported proposal; it never silently switches boards.

Other ideas use existing provider routing. Unsupported results carry zero commands and concise alternatives. Invalid structured output, unknown definitions and rejected electrical connections cannot produce a project. Without providers, BONK still works on ESP32 and other ideas have a setup link and optional blank creation path.

## Existing AI boundary

Intent → deterministic matcher or shared `planAssembly` → strict structured plan → hardware-core validation → user approval → ProjectCommands → Project v4 → existing Workbench.

`assembleProject` and intent entry share `planAssembly`, `routePlan`, `invokeProvider`, BYOK/vault settings, Local Bridge transport and strict request/response validation. Configured finite provider fallback is retained; the UI never performs an uncontrolled repeat request. Unsaved proposals use the existing guest-document/BYOK boundary, even for signed-in users, so no cloud project is required or uploaded before approval. Existing authenticated inventory planning continues to reload owned inventory server-side.

Contextual Ask Kinetable remains the existing temporary workbench sheet. Hardware and Logic modifications retain their existing preview/Apply boundaries; explanation remains contextual. This correction adds no direct model-to-DOM/Three.js mutation and no parallel orchestration, project engine, simulation engine or project model.

## Trailer integration

No file named `KineTable.mp4` was found, but the actual supplied film existed at `videos/kinetable-trailer/renders/kinetable-trailer.mp4`. It is 22 seconds, 1920×1080, 60 fps H.264 with AAC audio. Streams were copied losslessly with MP4 fast-start metadata to `apps/web/public/media/kinetable-trailer.mp4`; the WebP poster is an extracted frame from the same film. Original files were untouched. See [asset provenance](ASSET-LICENSING.md).

The landing's editorial section says “An idea. A real project.” and describes intent, proposal, approval and table handoff. The physical 16:9 frame displays a lazy WebP poster. Only a manual Play action mounts the video source and starts playback. `preload="none"`, native keyboard-accessible controls and `playsInline` avoid unsolicited playback or audio. There is no autoplay/offscreen animation to suspend and no reduced-motion-dependent playback. The 10 MB film is not part of initial page loading.

## Testing and design review

Local gate: lint, root `tsc --noEmit`, web `tsc -b`, production build and diff whitespace checks. Unit coverage includes bounded intent, proposal shape, narrow BONK matching, canonical topology/behavior, all boards, quantity context, malformed provider output, provider absence, unknown hardware, unsupported results, approval deduplication, identity changes, inventory non-consumption and normal history/undo/redo.

Browser coverage exercises Home → BONK → proposal → approval → standard Workbench → all modes → contextual Ask → refresh/History; back/cancel; double submit with one planning operation; persisted ESP32/Pico/Uno; inventory complete/missing and quantities; provider setup draft retention; unsupported output without persistence; mobile navigation and real trailer lazy-loading/manual playback. Provider response fixtures test trust boundaries and are not a live-model quality claim.

Dedicated rendered review covered 390×844, 768×1024, 1440×900, 1600×1000 and 1920×1080 in Light/Dark: Home, focused/content prompt, proposal, absent provider, unsupported mobile, complete/missing inventory, Workbench handoff and trailer desktop/mobile. A first pass removed unnecessary proposal glyphs to keep mobile approval compact and corrected the trailer's explicit Play loading. Final review preserves the warm paper/charcoal palette, editorial typography, restrained lime focus and existing header navigation. The mechanical design detector reported no findings. Evidence screenshots remain ignored under `output/playwright/prompt-to-project/`.

Final local gates passed: **135 Vitest tests, 1 Node test and 66 Playwright tests**. Vitest has one hosted opt-in skip; Playwright has 14 unchanged fixture-gated skips (80 discovered). No mandatory failure was waived. Local Supabase integrations were not run here because Docker was stopped; no production substitute was used. Account proposal approval/checkpoint behavior is covered locally with the existing repository/store and a cloud fixture. Production deployment identity is recorded in the completion report. Default external/hosted/local-Supabase/real-CLI opt-ins are reported separately from failures; production Supabase is never used as CI.

## Known limits and Slice 14 handoff

- Deterministic prompt matching currently covers the canonical ESP32 BONK only. Curated Explore entries and Learn exercises are not fabricated general-purpose starters.
- General provider assembly validates supported hardware and wiring. It does not guarantee arbitrary requested behavior; the proposal labels this explicitly, and normal Logic/contextual Ask supplies supported behavior changes. BONK includes its canonical behavior.
- Unsupported hardware/systems remain unsupported. This correction adds no GPS/LiDAR/drone implementation or automatic shopping/reservation.
- Proposal state is transient; refreshing before approval preserves the draft but requires a fresh explicit submission. Approved projects persist normally.
- Contextual incremental hardware AI and generated Explain remain the incumbent explicitly unavailable features. Bounded Logic preview/Apply remains usable; this correction does not promise those deferred editing capabilities.
- Browser provider fixtures do not establish quality for every real BYOK or Local Bridge model. Existing finite routing, timeout and validation limits still apply.
- Existing large Three.js/main build chunks remain; the trailer creates no video request until the user plays it.

No production migration, new QA user, production load test, compile/flash/serial bridge, physical runtime, generated-code upload or Digital Twin work is included. Slice 14 starts later from the same validated Project v4 and existing Build/Logic/Simulate/Explain systems.
