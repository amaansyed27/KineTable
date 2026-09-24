# Slice 06 — validated AI hardware assembly

## Scope

An intent created in New Build becomes a version 2 hardware project through structured `ProjectCommand`s. A model proposes components and electrical connections; Kinetable validates the complete graph, places parts deterministically, saves one document to IndexedDB, and checkpoints to Supabase when signed in. A failed or unsupported plan leaves the intent intact. Firmware, simulation, interactive wires and breadboard topology remain outside this slice.

Kinetable provides no paid managed inference. Users configure their own API keys or run an optional localhost bridge for local models and authenticated CLIs. Guests can assemble with their own compute; cloud sync still requires Supabase authentication. The old Vercel AI Gateway route required customer verification and is no longer in the product path.

## Boundaries

| Module | Responsibility |
| --- | --- |
| `apps/web/src/component-library/catalog.ts` | Canonical supported definitions, pin IDs and supply metadata. |
| `apps/web/src/projects/v2.ts` | V2 parser and deterministic v1 migration. |
| `apps/web/src/hardware-core/` | Pure command executor, electrical validator and layout. No React, Three.js, browser, Zustand or AI SDK dependency. |
| `apps/web/src/ai/contract.ts`, `planner.ts`, `prompt.ts` | Strict plan contract, catalog-grounded prompt and provider-independent validation. |
| `apps/web/src/ai/routing.ts` | Ordered routes and keys, bounded fallback, sanitized diagnostics. |
| `apps/web/src/ai/providerSettings.ts`, `credentialVault.ts`, `providerTransport.ts` | Device settings, secret vault and browser transport. |
| `server/ai/remoteProvider.ts`, `safeEndpoint.ts` | Request-scoped BYOK adapters and public HTTPS endpoint guard. |
| `server/ai/localRuntime.ts`, `cliRuntime.ts`, `runtimeManager.ts`, `localBridge.ts` | Local inference, CLI isolation and explicit runtime permission. |
| `api/ai/{plan,test,models}.ts` | Vercel BYOK proxy, tiny structured probe and model discovery. |
| `apps/web/src/projects/projectCreation.ts`, `sync/projectSyncService.ts`, persistence repositories | Creation, local/cloud reconciliation and checkpoints. |
| `apps/web/src/state/projectStore.ts` | Observable selection, save and sync coordination; no AI/provider code. |
| `apps/web/src/spatial/` | Render saved board and component instances with arrival motion. |

The store was narrowed before AI behavior was added. The fallback title generator strips generic leading command words, normalizes whitespace and retains acronyms. It has no special OLED/temperature branch; user-edited names win.

## Documents and commands

Schema version 1 remains the original single-board, empty-connection document. `migrateProject` builds a v2 document in memory on load; a read alone does not rewrite storage. An intentional checkpoint writes v2. V2 stores typed board/component instances, electrical endpoint connections, layout, intent and metadata. The Supabase migration accepts v1 and v2 while preserving owner RLS. Cloud reads verify JSON and relational ID, name, board and version agreement.

Strict commands include `component.add`, `component.remove`, `connection.create`, `connection.remove` and `layout.move`. The planner schema offers component and connection commands only; the model cannot provide arbitrary coordinates or replacement project JSON. The executor checks the current document, applies all commands to a copy, assigns deterministic slots and validates the candidate. Any failure rejects the entire plan. The same executor runs at the server/bridge boundary and again in the browser against the current revision before one local save. A cloud failure leaves valid local work intact and dirty for retry.

The validator checks definitions, IDs, endpoints, pins, component pin completeness, board compatibility, supply and ground, rail shorts, output and GPIO conflicts, I²C mapping, and an LED's series 220 Ω resistor. It rejects unproven circuits within this intentionally narrow subset; it is not a general circuit solver. Electrical connections are independent of presentation curves and do not imply a breadboard graph.

Definitions: ESP32 Dev Module, Raspberry Pi Pico, Arduino Uno, LED, 220 Ω resistor, push button, [Grove Buzzer V1.1](https://wiki.seeedstudio.com/Grove-Buzzer/), HC-SR501 PIR, 3.3 V SSD1306 I²C OLED and DHT11 module. The buzzer is the transistor-driven module, not a bare buzzer. PIR supply assumes a USB-powered board. OLED on Uno is rejected without level shifting. BONK's semantic direct connections fit the graph; physical breadboard wiring waits for Slice 08.

## Provider routing and secrets

`RoutingProfile.routes` holds priority, transport, provider, model and ordered credential IDs. Each key has its own ID, label, priority, enabled state, masked suffix and optional model restrictions. Remote routes try enabled keys in order, then the next route. Local HTTP and CLI routes have no key loop. Diagnostics contain provider/model, masked label and failure code, never the key. Network, timeout, rate/quota, credential, model and availability errors can advance. Safety refusal, unsupported hardware, invalid request, stale revision or hardware failure stops routing. A malformed structured answer consumes one attempt, then may advance; there is no retry storm.

`/settings/providers` holds keys in session memory by default. “Remember on this device” encrypts a key with WebCrypto AES-GCM and a non-exportable device CryptoKey in a separate IndexedDB vault. Only metadata goes to `localStorage`; secrets never go into projects, Supabase, URLs, analytics or logs. This does **not** protect against malicious same-origin JavaScript. For remote BYOK, the browser sends the selected key over TLS to the Vercel function for one request; the function uses it in memory and neither stores nor logs it. The 34 remote presets and official links are in [PROVIDERS.md](PROVIDERS.md). A preset needs a compatible model and passing structured probe; merely listing it does not assert that all models work.

Remote presets share OpenAI-compatible or Anthropic adapters. Custom and tenant endpoints use public HTTPS, DNS checks and a pinned public address; the proxy rejects literal/private/reserved/link-local IPs, localhost, userinfo, redirects and unexpected ports. Local endpoints use only the bridge. `/api/ai/plan` accepts a validated request, provider choice and request-scoped credential; it never accepts a browser hardware catalog. With a Supabase bearer, the server verifies the user and reads that owner's unarchived project through RLS. A guest sends its current validated document. Request, intent, response and time bounds apply. There is no managed provider credential or production billing dependency. Shared distributed rate limiting and encrypted cross-device key sync are future work.

The optional [Local Bridge](LOCAL-BRIDGE.md) binds only `127.0.0.1`, requires a random token and allowlisted Origin, and exposes a version/capability handshake. It supports Ollama native JSON schema, LM Studio and vLLM localhost OpenAI-compatible APIs, model discovery and probes. Installed Ollama or LM Studio servers may be started/stopped only after an explicit per-runtime toggle; vLLM startup is manual. CLI adapters use `spawn()` with fixed executable/argument shapes, an empty temporary directory, no-tools/read-only controls, time/output limits and no shell endpoint. Codex, Antigravity, Claude Code, Kimi Code, OpenCode and Continue CLI are wired where their documented modes support safe headless planning. The bridge document records platform and verification limits and omitted unsafe adapters.

## UX and verification

The table offers “Build with Kinetable” to guests and signed-in users with an unassembled intent. Statuses reflect actual planning, validation and local save phases. Components animate from saved instances; no timer fakes work. Unsupported output shows a reason and preserves the intent. The response revision must match `metadata.updatedAt`; stale plans cannot apply. No provider overrides hardware validation.

Hardware tests cover command parsing, unknown parts/pins, duplicate IDs, endpoint and board pin errors, valid connections, atomic rejection, layout, v1 migration and v2 serialization. AI tests cover contract parsing, malformed output, unsupported requests, unknown hardware, staleness, priority/fallback, refusal stops and sanitized diagnostics. Security tests cover endpoint blocking, bridge token/Origin, no shell route and process limits.

Real authenticated Codex CLI (`gpt-6-luna`) returned validated plans for LED blink (LED/resistor, 3 connections), motion alarm (PIR/Grove buzzer, 6), temperature on OLED (DHT11/OLED, 7), and button controls LED (button/LED/resistor, 5). It returned `unsupported` with zero commands for a drone flight controller. A real bridge call tried a missing Ollama model (`MODEL_UNAVAILABLE`), fell back to Codex and produced a valid motion alarm. Guest browsers on both localhost and the protected Vercel Preview assembled a motion alarm through the running Local Bridge and Codex CLI, then restored it from IndexedDB after refresh. Chrome's Local Network Access permission was granted to the Preview origin for automated QA. Installed Ollama `qwen3.5:9b` answered real structured requests but its full hardware commands failed deterministic validation, so it is not claimed compatible for assembly. Authenticated Antigravity attempted a denied tool; Claude Code was installed but unauthenticated. No CLI permission bypass was used for model planning.

Hosted Supabase QA used disposable users. A v2 project was inserted and read with matching JSON/relational identity, name, board and version; another user could neither read nor update it. Deployed browser QA restored the hosted assembled project, saved a second command-validated v2 project locally and to Supabase, restored it in a fresh browser, restored it offline from IndexedDB, and verified unsupported/provider-failure paths left projects intact. Five viewport sizes (390×844, 768×1024, 1440×900, 1600×1000 and 1920×1080) were checked before and after assembly. Planning, unsupported and provider-failure states were captured separately. The final preview is [kinetable-7u4kbrxrk-amaan-syeds-projects.vercel.app](https://kinetable-7u4kbrxrk-amaan-syeds-projects.vercel.app). Direct-refresh routes `/`, `/start`, `/auth`, `/table`, `/new` and `/settings/providers` returned successfully. Deployed API rejected malformed input; a valid owner request reached project validation and a different user's request returned `PROJECT_NOT_FOUND`. Vercel Preview remains protected by Vercel Authentication; automated browser checks used a project automation bypass header scoped to that origin. No provider secret is configured in Vercel Preview or Production.

Final checks: `pnpm lint`, `pnpm test` (landing check and 45 Vitest cases), `pnpm build`, TypeScript type check, hosted Supabase v2 test, 13 local Playwright passes including a real CLI browser build, and four Playwright passes against the final Preview. The final Preview's six browser routes returned HTTP 200; all three AI endpoints rejected malformed POST bodies with `INVALID_REQUEST`. An assembled owner project returned `INVALID_PROJECT` before any provider call, while the other user received `PROJECT_NOT_FOUND`.

## Limits

No firmware, flashing, simulation, current/thermal proof, breadboard graph, visible or editable wires, shared rate limiter or cross-device key vault exists. Connection data is saved, but visible wires wait for reliable part pin anchors and Slice 08. Some preset models cannot satisfy strict JSON Schema and fail a connection probe. CLI compatibility depends on version and authentication. Hosted HTTPS browser access to a localhost bridge requires browser Local Network Access permission and must be checked on the target machine. Vercel has no managed AI credential in Preview or Production.
