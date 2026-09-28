# UI interaction refinement — 2026-09-28

Follow-up to the screenshot feedback. Slice 11 remains unstarted.

## Implemented

- Account, Appearance and AI providers share one responsive settings rail. `/settings/account` shows real session identity, guest storage, sign-out and sync recovery; `/auth` remains the sign-in flow.
- Shared field/action alignment, chevrons, focus treatment, hover/press feedback, animated disclosures and page fades. Tooltips work on pointer hover and keyboard focus; reduced motion removes nonessential animation.
- Native selects use `appearance: base-select` where supported, with bounded, themed menus and native keyboard handling. Other browsers retain their native picker and a styled closed control. Provider search narrows the catalogue before opening a menu.
- The workbench has one mutually exclusive tool dock. Selecting a part, wire or pin closes the tools; opening tools clears the inspector. Panels stay above the dock on desktop and phones.
- Clicking the project title edits its name. Enter or blur saves; Escape cancels. Strict `project.rename` commands use existing atomic validation, local persistence, undo/redo and cloud checkpoints. The local row name follows the document through saves and history. AI hardware and behavior plans cannot rename projects.
- Vented DHT11 PCB/housing/header geometry, taller ESP32/Pico header posts and smaller visual pin markers. Curved jumpers meet the canonical transformed anchors and have connector housings at modeled headers. Colors derive from electrical nets; separate nets differ and breadboard continuations share a color. Stored electrical endpoints and legacy wire color fields are preserved.
- The root/page backgrounds match in dark mode, including short pages and scroll boundaries.

## Verification

`spatial/jumpers.test.ts` covers continuity colors, distinct nets, exact curved endpoints and manual/AI rename boundaries. `interaction-refinement.spec.ts` covers rename cancel/save/history/refresh/retrieval, settings navigation/alignment, dark root background, provider filtering, inspector/dock clearance, and keyboard tooltips at 390, 768 and 1440 px. It renders a real manually wired DHT11 circuit. Hosted auth acceptance verifies the Account page and renamed row/document restoration in a fresh browser.

Run the existing full lint, deterministic/hosted unit, build, type and browser gates. The product correction screenshot run includes Account settings alongside the other surfaces at five widths. QA screenshots and disposable credentials remain in ignored `output/`.

Local acceptance: lint, root type check and production build passed; 90 Vitest cases and the landing test passed; the complete opt-in browser run passed 50 tests with one deployment-only skip. The final UI pass reran hosted auth, provider security and five-width rendering. Its timing-sensitive BONK observation was corrected and passed independently, alongside all three final refinement tests.

Impeccable v4.3.1 was applied to the existing interface: simplified settings hierarchy, consistent native controls and floating surfaces, readable provider setup and reduced-motion behavior. Its single manual detector pass flagged a project-row padding animation; that layout-changing hover was removed. Desktop and phone screenshots were inspected separately from the detector. BONK browser observation starts before pressing the button and uses Playwright's browser clock to fire each animation frame consistently, retaining exact pulse-count and LED assertions. Other simulation browser tests keep real time.

The models are illustrative geometry, not dimensionally accurate CAD; electrical truth remains in the compiled topology. Native menu styling and disclosure interpolation depend on browser support.

## Fluid controls and Behavior workspace

- `/start` replaces the full green selection wash with a moving check marker and hardware lift/tilt feedback. Board labels no longer intercept native radio clicks. The selected button keeps a readable foreground/background pair through hover, including its inner label. Mobile board art and labels occupy separate columns.
- Route changes enter immediately without waiting on an outgoing page. Workbench mode changes move one underline and use a short panel entrance; reduced-motion preferences disable those effects.
- Behavior has AI chat and Manual tabs. Manual preserves the validated rule editor and its undo/redo commands in a proper toolbar. AI chat shows the real provider route, a bottom composer, messages, saved device-local history per project/account, New chat, and recent conversational context. Provider output still passes the strict behavior schema and atomic apply validation; replies never mutate the project until Apply. Chats do not sync between devices.
- The browser acceptance checks the actual inner Continue label contrast, board interaction, keyboard/reduced-motion paths, local chat persistence after refresh and a new chat, and manual rule editing. Phone and desktop screenshots are in ignored `output/playwright/`.
