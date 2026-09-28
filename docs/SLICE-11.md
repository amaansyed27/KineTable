# Slice 11 — Hardware Platform

Slice 11 adds `/parts` with My Parts and Library, a canonical supported-profile component domain, and optional owned-parts-only AI hardware assembly. It retains the eleven existing definition IDs and Project v4 documents. Virtual placement does not consume physical inventory. Manual editing can use every supported Library component.

## Canonical hardware knowledge

`apps/web/src/component-library/schema.ts` validates identity, pins, electrical model, supported variant, verification class, source records, procedural/GLTF asset metadata, supply, interface and simulation status. `definitions/` groups boards, components and the breadboard. `catalog.ts` validates and indexes them at load time. `compatibility.ts` derives board fit from logic voltage, supply and modeled interface pins; `search.ts` powers Parts and the workbench tray. Hardware validation and simulation read the same electrical metadata. `visualId` only selects presentation. The AI planner receives supported-profile metadata generated from these definitions; the validator still decides whether proposed commands are safe and complete.

Definitions are deliberately curated. A source for a controller does not verify an arbitrary breakout module. `verified` requires manufacturer or datasheet evidence for the named variant; `profiled` names Kinetable assumptions and limits. Source type, publisher, URL and access date are recorded separately from 3D asset rights. Generic passives, switches and breadboards have no invented manufacturer. Manufacturer documentation consulted includes [Espressif](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32/schematic-checklist.html), [Raspberry Pi](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html), [Arduino](https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf), [Seeed](https://wiki.seeedstudio.com/Grove-Buzzer/), [Solomon Systech SSD1306](https://docs.sparkfun.com/SparkFun_Qwiic_OLED_1.3in/assets/board_files/SSD1306.pdf), and [Aosong DHT11](https://akizukidenshi.com/goodsaffix/DHT11_20180119.pdf). The [HC-SR501 vendor description](https://www.addicore.com/products/pir-infrared-motion-sensor-hc-sr501) is secondary evidence; clone variation remains explicit.

| Stable ID | Supported profile | Verification |
| --- | --- | --- |
| `esp32-dev-module` | Kinetable GPIO subset of a generic ESP32 development board | Profiled |
| `raspberry-pi-pico` | Raspberry Pi Pico, modeled pin subset | Verified |
| `arduino-uno` | Arduino Uno Rev3, modeled pin subset | Verified |
| `led-5mm` | Generic indicator LED requiring a 220 Ω series resistor | Profiled |
| `resistor-220r` | Generic through-hole 220 Ω resistor | Profiled |
| `push-button` | Generic normally open two-terminal switch | Profiled |
| `grove-buzzer-v1-1` | Grove Buzzer V1.1 used at 3.3 V | Profiled |
| `hc-sr501` | Conservative HC-SR501 style PIR module, 5 V supply | Profiled |
| `oled-ssd1306-i2c-3v3` | Generic four-pin 3.3 V SSD1306 I²C breakout, no level shifter assumed | Profiled |
| `dht11-module` | Generic DHT11 module used at 3.3 V | Profiled |
| `breadboard-half-400` | Kinetable 400-hole topology with continuous rails | Profiled |

No additional electrical definitions were added without a representable model. Current visual assets remain original procedural geometry. Metadata permits future GLTF assets but does not load external models or claim physical dimensional accuracy.

## My Parts and ownership

IndexedDB `inventoryItems` stores one row per `(ownerId, definitionId)` with bounded integer quantity 0–999, timestamps and a dirty bit. Zero is a retained removal tombstone for sync. Technical facts stay in the Library. The `/parts` shelf supports search, category and board filters, details, quantity editing and provenance; it works for guests without network or AI. Guest rows use the `guest` namespace. Signed-in rows use the Supabase user ID. Sign-out hides account rows without deleting them, and sign-in restores the correct account's cache. Existing project-cache reads now use the same exact owner boundary. A guest project is adopted only for an empty new account; guest inventory requires explicit import of definitions absent from the signed-in account, so quantities are never silently summed.

Authenticated rows sync to `public.inventory_items` via migrations `20260928064547_inventory_items.sql` and `20260928070528_inventory_definition_ids.sql`. The database sets `owner_id` from `auth.uid()`; browser insert and update grants exclude that column. Separate owner-only SELECT, INSERT, UPDATE and DELETE RLS policies enforce isolation. A database constraint rejects IDs outside the eleven curated definitions; a new canonical ID therefore needs a matching migration. Local edits work offline. Sync compares row timestamps, retains unsent local edits, and retries on reconnect. This is a client-clock row-level last-write policy; clock skew or concurrent edits can choose an unexpected winner. Slice 12 can add server versions/conflict UI if real usage requires it.

## AI and security

New Build offers an optional “Use my parts for AI planning” choice when owned components exist; the workbench assistant exposes the same mode. Guest and Local Bridge snapshots are parsed against known component IDs and bounded quantities. For authenticated remote planning, the server verifies the user, loads the owned project and reads inventory through that user's Supabase token and RLS; it replaces the browser-supplied inventory snapshot before planning. The planner deterministically rejects unowned definitions or plans exceeding quantities. The Apply action checks quantities again. A plan still passes normal atomic hardware command and complete-circuit validation. No email or inventory notes are sent to a model; no notes are stored. External source text is data and cannot redefine planning permissions.

## Scope and acceptance

This slice does not add stock allocation, serial numbers, arbitrary user hardware definitions, third-party meshes, firmware, flashing, telemetry, recommendations, or project version history. It retains existing provider vault, Local Bridge, and project command boundaries. See `docs/TESTING.md` for test commands and hosted opt-ins.

### Verification record

- `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm exec tsc -p tsconfig.json --noEmit` passed. Vitest reported 98 passed and one documented opt-in skip; the separate landing story Node test passed.
- The complete local Playwright run reported 46 passed and 11 environment-specific opt-in skips. The final Parts-only run passed 3/3 after tightening the test's onboarding wait. Hosted opt-ins reported 9 passed, including disposable-account inventory CRUD, two-account RLS, fresh-browser restore, guest import, offline edit/reconnect and project isolation. The final hosted Parts rerun passed 1/1 after the known-definition database constraint was applied. The real Codex CLI/Local Bridge hardware and behavior browser regression passed 1/1.
- Library was captured and manually inspected at 390×844, 768×1024, 1440×900, 1600×1000 and 1920×1080 in light and dark. My Parts and the detail sheet were captured and inspected at mobile and desktop sizes in both themes. A dark-theme screenshot initially caught a CSS transition mid-frame; settled captures confirmed the intended contrast. Keyboard tab switching, dialog Escape/focus behavior, horizontal fit and owned controls were exercised in Playwright. The Impeccable detector reported no findings on the final Parts, New Build and workbench UI.
- Security review checked owner-only local cache lookup, authenticated inventory replacement at the planning API, the bounded guest/bridge snapshot parser, atomic command validation, browser-safe publishable key use, owner-only RLS, non-writable `owner_id`, Local Bridge and BYOK boundaries, and static provenance URLs. The hosted database rejected an unknown definition ID. Supabase's advisor reported only an existing leaked-password-protection setting warning, unrelated to these migrations.
- Inventory sync uses client timestamps and has no cross-device conflict UI. Procedural previews do not claim physical dimensions. The curated eleven-profile catalogue omits components the electrical engine cannot represent honestly. Production deployment evidence is recorded in the release handoff.
