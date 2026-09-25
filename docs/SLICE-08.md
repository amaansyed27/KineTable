# Slice 08 — Physical Circuit Editor

Slice 08 merges the former Wiring + Breadboard Intelligence and Component Inspector slices. The [roadmap](ROADMAP.md) now has 15 canonical slices; historical records for 01–07 remain intact. Simulation, Explain and X-Ray belong to Slice 09.

## Project and electrical model

`schemaVersion: 3` stores components, `wires`, `terminalPlacements`, and the existing layout/metadata. Endpoints are explicit discriminated values: `{kind: "pin", componentId, pinId}` or `{kind: "breadboard-hole", breadboardId, holeId}`. A wire joins two endpoints. A terminal placement inserts a supported component lead into one hole without inventing a jumper. Derived nets are never stored.

Version 1 migrates through version 2 to version 3. Existing v2 direct connections become physical pin-to-pin wires with the same IDs; layout, project ID, timestamps, name and intent survive. Loading an older row migrates in memory. An edit or deliberate checkpoint saves v3. Invalid documents and dangling endpoints fail validation instead of silently losing circuit data. The Supabase migration `20260925035621_physical_circuit_editor.sql` expands the `projects.schema_version` constraint to 1, 2 and 3; owner RLS stays in force.

## Canonical breadboard

`breadboard-half-400` has 400 generated holes: A–J × 30 terminal columns plus L+, L−, R+, R− × 25 rail holes. A–E at a number are one strip, F–J at that number are another, and the center trench separates them. Each of the four rail rows is continuous from position 1 through 25 **in this model**; neither rail side nor polarity is implicitly linked to another rail. Other commercial breadboards may segment rails differently. Hole IDs, local coordinates and conductive strips all come from the pure `hardware-core/breadboard.ts` definition. The renderer instances 400 holes from it.

`resolveNets` joins strip holes, wires and terminal placements with a deterministic disjoint-set graph. Components such as resistors and LEDs retain separate terminals; their internal behavior is not mistaken for a copper strip. Electrical safety rejects shorts, mismatched supplies, conflicting outputs, occupied holes/pins and duplicate wires. Safe incomplete editor drafts save; AI assembly still requires a complete supported circuit. LED series-resistor and ground, module supply, signal and OLED I²C rules inspect derived nets.

## Workbench interaction

Visual pin anchors reference the same stable electrical pin IDs as the catalog but live outside electrical definitions. `endpointWorld` transforms those anchors and breadboard holes from saved layout. Physical wire curves derive from project endpoints, use a modest height and have larger invisible hit volumes. Moving a component updates the curve visually without changing its electrical graph. Hover/selection and Wire mode reveal pin targets; tapping a hole highlights its strip and full connected net. Pointer wiring shows a transient curve; selecting the second endpoint runs one validated command and autosaves. Invalid connections return local feedback and leave history untouched. Accessible From/To selectors provide the same command path without precise canvas clicks.

LED, 220 Ω resistor and push-button leads can be placed into free breadboard holes through the inspector. Placement uses canonical hole coordinates and snaps the part so the actual lead anchor coincides with the hole; a second placed lead determines the part's orientation and span. Occupied or invalid holes are rejected. Removing or moving a part and removing a breadboard clean dependent placements and wires atomically. Wires, placements and component/layout edits all use project-scoped undo/redo and local-first save; signed-in checkpoints sync the same v3 document.

The inspector derives component descriptions, pin roles/connections and technical details from the catalog and current nets. Wire inspection names exact endpoints and connected pins; hole inspection lists its strip, connected holes and pins. Touch and keyboard controls remain available, and project/part lists remain readable if WebGL fails. No simulated voltage/current, firmware execution or physical collision solver is claimed.

## Verification

- Pure tests cover topology, deterministic nets, migration, anchors, commands/history, inspection and net-aware safety. The hosted Supabase test uses disposable accounts to verify v3 full and incomplete documents, relational metadata, owner read and cross-user read/update denial, then removes QA rows.
- Chrome Playwright covers the complete guest circuit, actual canvas pin/hole selection and pointer preview, invalid wiring, legacy AI assembly, touch, accessible controls, refresh/restart and WebGL failure.
- Visual QA screenshots are stored under ignored `output/playwright/` at 390×844, 768×1024, 1440×900, 1600×1000 and 1920×1080; source, preview, complete circuit, inspector and mobile states were inspected.
- Protected Vercel Preview: [kinetable-ol3f2dsdk-amaan-syeds-projects.vercel.app](https://kinetable-ol3f2dsdk-amaan-syeds-projects.vercel.app). Direct refresh of `/`, `/start`, `/auth`, `/table`, `/new` and `/settings/providers`, deployed guest wiring and hosted fresh-browser/offline/reconnect QA passed through the project automation bypass. The Vercel build included the API TypeScript check.

## Scope limits

One specific half-size breadboard topology is supported. The editor has deterministic curves rather than manual bend points or a router; lead insertion is a deliberate inspector action, not drag-to-hole physics. Adding the breadboard to a crowded existing layout may require moving parts to clear overlap. Only the canonical Slice 06/07 component subset has verified electrical rules and wire anchors. A circuit marked ready meets these supported connectivity rules, not an analog current, thermal or firmware proof.
