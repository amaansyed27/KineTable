# Slice 10 — Visual Logic

Status: implemented. Slices 01–10 implemented. Slice 11 — Hardware Platform is next.

Production: [kinetable.vercel.app](https://kinetable.vercel.app). Logic lives in the workbench's **Build · Logic · Simulate · Explain** modes; there is no separate Logic route.

## Project v4 and migration

Project v4 retains the v3 physical document: canonical components, explicit wires, terminal placements, layout, intent and metadata. Its `logic` field contains an ordered array of semantic rules:

```ts
type LogicRule = {
  id: string
  enabled: boolean
  when: Trigger
  if: Condition[]
  do: Action[]
}
```

`projects/v4.ts` composes the historical v3 structural parser with the strict logic parser. The historical v3 parser still recognizes only v3 with empty logic. Migration is deterministic `v1 → v2 → v3 → v4`; old projects receive empty authored behavior and retain their identity and timestamps. A read migrates the editor view in memory; it does not rewrite the stored/cloud document. The next intentional mutation/checkpoint saves v4. Local repository validation preserves the original versioned row until that edit.

## WHEN / IF / DO

| Language | Supported values |
| --- | --- |
| WHEN Button | Momentary switch pressed or released |
| WHEN PIR | Virtual motion detected |
| WHEN DHT11 | Virtual temperature or humidity changes |
| EVERY | Integer logical interval, 100–60,000 ms |
| IF DHT11 | Temperature 0–50 °C or humidity 20–90%; finite numeric threshold |
| Comparison | `<`, `<=`, `==`, `>=`, `>`; all conditions ANDed |
| DO LED | ON, OFF, toggle |
| DO OLED | Show at most 32 characters, or clear; no control characters |
| DO Buzzer | 1–8 visible beeps, each ON and gap 20–2,000 ms |

Empty IF means unconditional. Limits are 16 rules, four conditions and eight actions per rule; each rule has at least one action. Unknown fields, tags, duplicate IDs, nonfinite/out-of-range values and executable source are rejected. There are no expression strings, OR trees, nested Boolean logic, scripts, functions or loops.

## Validation and compilation

`logic/schema.ts` validates tagged JSON without React. `logic/compile.ts` validates references and compiles a `CompiledBehaviorProgram`. It uses canonical electrical models and the existing driver registry, never `visualId`:

- momentary-switch input to a board GPIO with grounded opposite terminal;
- correctly powered/grounded PIR and DHT11 with resolved GPIO data paths;
- LED driven through the supported 220 Ω series topology;
- correctly powered/grounded buzzer with resolved signal GPIO;
- powered SSD1306 OLED with the supported board I²C SDA/SCL pair.

The physical circuit must be supported and complete. Missing parts, wrong capabilities, broken topology, mismatched cached circuit and conflicting GPIO roles are rejected. Moving layout preserves compiled behavior semantics. Hardware removal/replacement of a referenced component is blocked with a concise repair message. Wiring edits that would invalidate authored behavior are rejected atomically; original hardware and logic survive. Disabled rules retain references and validation.

```text
Project v4.logic + compiled physical circuit
→ strict validation and canonical bindings
→ CompiledBehaviorProgram + CompiledCircuit
→ existing SimulationRuntime
→ bounded causal trace and snapshot
→ hardware rendering / Explain / X-Ray
```

Human edits use parsed `logic.rule.add/update/remove/enable/reorder` commands in the existing copy-then-validate command boundary. Actions are updated/reordered within a rule update. The UI never edits project JSON directly. The Slice 06 AI planner remains hardware-only and rejects logic commands; no natural-language behavior planner was added.

## Runtime and demonstrations

Authored logic, including an entirely disabled rule set, runs as **Project Logic**. Hidden recipes never run beside it. Logic-empty projects retain Slice 09 demonstration recipes, and Start from BONK creates actual saved rules.

The same ordered inputs at the same logical times produce the same results. Timers first fire after their interval. Reset initializes outputs OFF/empty and virtual inputs at their defaults. Enabled released-button rules execute at initial released state; the trace explicitly records this, allowing a saved release rule to establish READY. DHT changes evaluate against the changed virtual environment; identical values do not retrigger authored rules. Beeps schedule GPIO ON/OFF events in the existing queue. Browser audio is not output truth.

Trace facts include input, GPIO input, condition true/false, rule match, action, board output/data and physical output. Stable rule IDs and action indices connect actions to authorship; scheduled beep events retain causal links. Explain formats those facts without AI. X-Ray continues to read the same physical nets and signals. Runtime protections remain 2,048 queued events, 4,096 events per advance, and 1,000 retained trace facts.

## Canonical BONK proof

ESP32 topology: Button GPIO18, LED GPIO23 through 220 Ω, buzzer GPIO19, OLED SDA GPIO21 / SCL GPIO22.

1. Press rule: OLED BONK!, LED ON, buzzer two 120 ms pulses with a 100 ms gap.
2. Release rule: OLED READY, LED OFF.
3. Initial released state: READY / LED OFF / buzzer OFF.

For a press at time zero, ×2 rising edges are 0 and 220 ms; falling edges are 120 and 340 ms. Editing only count to three produces rising edges 0, 220 and 440 ms and falling edges 120, 340 and 560 ms. Pure runtime tests assert these exact timings. Browser tests observe two then three visible pulses, reload and fully restart the local browser with ×3 from IndexedDB, and restore the same ×3 rules in a fresh authenticated browser from Supabase.

The actual DHT11/OLED physical fixture also proves `temperature >= 30`: at 29 °C the condition fails; at exactly 30 °C it shows HOT. All five comparison operators and AND behavior are tested against compiled physical bindings. Timer Blink and authored PIR behavior share the existing logical runtime.

## Persistence and cloud

The same IndexedDB project repository, undo/redo snapshots, serialized mutation queue and authenticated checkpoint mechanism handle logic. Successful authored edits update project timestamps. Runtime playback and virtual inputs do not mutate or save projects. Offline edits remain local/dirty, survive reload and retry on reconnect. There is no second localStorage store or cloud logic table.

Migration `20260925223344_visual_logic_project_v4.sql` extends only the existing projects schema-version constraint to include 4. It is applied to the existing hosted backend and recorded in migration history. Owner RLS, ownership checks, client column grants, project identity and database-controlled timestamps are unchanged.

Disposable A/B account checks prove v3 read compatibility without rewrite, intentional v4 saves, BONK ×3 checkpoint/fresh restore, offline logic reload/reconnect, runtime timestamp isolation and denied cross-owner SELECT/UPDATE. Test project rows are cleaned up. Credentials are generated in memory and never logged or committed.

## Verification

- `pnpm lint`: pass.
- `pnpm test`: 81 Vitest tests and one landing test pass; historical hosted test is opt-in and passes when enabled.
- `pnpm build`: pass; existing bundle-size advisory remains.
- `pnpm test:e2e`: 33 local browser scenarios pass, including manual logic, full browser restart and existing Slice 08/09 regressions; ten hosted/external scenarios are opt-in.
- Hosted v4 browser test and historical hosted v3 REST test pass against the existing Supabase project. Fourteen deployed candidate browser checks pass, including hosted physical-circuit restore, authored logic, runtime timestamp isolation and direct routes.
- UI checks cover add/delete, enable/disable, rule/action reorder, near-rule validation, hardware edit rejection, undo/redo, keyboard focus, touch controls, no-WebGL DOM editor and refresh.
- Visual QA covers 390×844, 768×1024, 1440×900, 1600×1000 and 1920×1080, with no horizontal overflow. The larger physical workbench stays beside the scrolling editor on desktop and above it on phones/tablets. Existing reduced-motion styles apply; reference highlights add no motion.
- Deployment checks require READY for final main and rendered direct-route refresh at `/`, `/start`, `/auth`, `/table`, `/new`, `/settings/providers`.

## Security and intentional limits

Persisted/imported JSON is parsed and physically validated at both local and cloud repository boundaries. No eval, embedded source, network, AI or React dependency exists in the logic/runtime domain. No RLS or credential handling protections were weakened.

This remains bounded semantic simulation: five catalog parts plus one breadboard, supported topology/driver models, one supported board, compact native editing controls, visible buzzer pulses, and short OLED text. Repeated beep actions may overlap deterministically; there is no cancellation/priority language. A full trace retains only the most recent 1,000 facts. Circuit edits that temporarily break compatibility require removing/updating related behavior first. There is no generic node editor, inventory platform, firmware compilation/flashing, physical-board execution or camera/digital-twin work. Slice 11 was not started.
