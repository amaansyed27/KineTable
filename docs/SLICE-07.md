# Slice 07 — Core 3D Workbench

## Shipped surface

`/table` is the editing surface. The dedicated `WorkbenchStage` renders the saved v2 board and part instances; `BoardStage` remains the static onboarding and New Build preview. Three.js does not own the document. The `Workbench` React boundary owns only selection, tray, camera requests and error messages. Pointer movement changes a Three group temporarily; pointer release creates one `layout.move` command. No frame writes to Zustand, IndexedDB or Supabase.

CameraControls provides orbit, right-drag pan, wheel and pinch zoom, focus and reset. Zoom and orbit are bounded. Selection uses a subtle accent and compact controls placed away from the hardware on desktop and at the bottom on mobile. Any part or the board can be selected, dragged within the work surface, nudged with arrows and rotated in 15° steps. The board cannot be removed. Canvas click on empty space deselects; the DOM part list makes selection available without WebGL or a mouse. WebGL failure leaves the project name and parts readable and reports that spatial editing is unavailable.

The tray uses canonical virtual component definitions. Add creates a stable instance ID and deterministic free-space slot. Remove deletes its layout and attached connections. Replace creates a new instance, keeps the old transform and drops all attached connections rather than guessing a pin mapping. Each operation is one atomic command transaction and one local save. No owned-inventory claim, breadboard snap, visible wires, inspector, simulated behavior or fake explanation is present. Build is active; Simulate and Explain are visibly disabled.

## Document, validation and AI boundary

The persisted v2 `components`, `connections` and `layout` remain the truth. Project schema and endpoint checks reject corrupt documents before rendering. `validateElectricalSafety` rejects direct rail shorts, mismatched rails, prohibited pin roles, output conflicts, unsupported board relationships and conflicting pin use. `analyzeCircuit` returns structured `incomplete` diagnostics for unwired pins, missing LED resistor, incomplete I²C mapping and button grounding. Safe incomplete drafts are saved by Dexie and read/written through the owner-scoped Supabase repository. `validateCompleteCircuit` remains the strict AI acceptance gate, with the existing `validateHardware` name as an alias. The planner still accepts only a one-board intent project, and the Table hides AI Assembly after hardware or the board layout diverges.

Electrical rules use canonical `electricalModel` and capability metadata in the component library. `visualId` only selects geometry. This adds no project schema version: documents still reference stable definition IDs. Moving or rotating hardware leaves electrical connections unchanged. Bounds and transform shape checks prevent unusable or malformed saved coordinates.

Provider settings keep the existing localStorage key for migration. A version 2 runtime schema reads valid legacy unversioned settings, rejects unsupported versions and malformed route or credential metadata, and refuses unexpected secret fields. The credential vault remains separate in memory or encrypted IndexedDB. The provider page retains its existing UI and lets incomplete URL typing remain editable until valid settings can be saved.

## Revisions and persistence

The project store serializes manual command transactions. It validates a candidate, writes IndexedDB once, updates observable state, then schedules a 500 ms cloud checkpoint for signed-in users. Undo and redo use bounded (75 entry) in-memory snapshots per project. Each restore receives a new monotonic `metadata.updatedAt` and passes repository validation before it is saved. A new edit clears redo; changing projects resets history. Refresh retains the project but resets session history. Cloud failure leaves the local row dirty for reconnect or manual retry. Concurrent device edits still have the existing last-successful-write limit.

Keyboard: arrows nudge 0.1 world units; Shift+arrows nudge 0.5; Delete or Backspace removes a selected part; F focuses; Escape deselects; Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Shortcuts do not intercept text fields. Touch supports one-finger object drag, camera gestures and pinch zoom; controls have reachable DOM equivalents. Reduced-motion preference removes camera easing and selection lift while retaining editing.

## Verification

Unit tests cover validation layers, safe incomplete local/cloud documents, AI strictness, visual/electrical separation, provider settings migration and rejection, command atomicity, replacement, bounds and history. Chrome Playwright covers direct canvas drag, keyboard editing, add/remove/replace, undo/redo, refresh, real browser restart, mobile touch and pinch, five viewport sizes and WebGL fallback. Hosted Supabase QA inserted and read an incomplete draft, proved another account could neither read nor update it, and confirmed an offline manual move checkpointed after reconnect and restored in a fresh signed-in browser. Owner-only RLS and column grants were not changed.

The protected Vercel preview was verified through the automation bypass cookie. Direct refresh returned HTTP 200 for `/`, `/start`, `/auth`, `/table`, `/new` and `/settings/providers`. Deployed Playwright covered guest workbench editing, canvas drag, responsive layout, mobile touch and a hosted account's offline/edit/reconnect/fresh-browser journey. Preview URL: https://kinetable-jdrw1hswz-amaan-syeds-projects.vercel.app.

## Limits

History is session-local and camera state is not synced. Five added parts are supported by the current fixed placement catalog. Basic bounds allow minor overlap; there is no physical collision solver. Full browser WebGL failure permits reading/navigation, not spatial editing. Slice 08 owns breadboard topology and wires; Slice 09 owns the detailed inspector; Slices 10 and 11 own simulation and explanation; Slice 18 owns Run on Board. Local Bridge acceptance is machine-specific and remains documented in [Slice 06](SLICE-06.md).
