# Kinetable AI Interaction Model

## 1. Principle

AI is a planner, explainer, and assistant. It is **not** the source of electrical truth.

The model may propose actions, but project mutations must pass through deterministic Kinetable tools and validation.

```text
User intent
   ↓
AI plan
   ↓
Structured tool calls
   ↓
Hardware-core validation
   ↓
Approved project commands
   ↓
Workbench / simulation update
```

## 2. Why structured tools matter

Do not let the model:

- directly edit React state;
- directly mutate arbitrary project JSON;
- invent pin capabilities;
- bypass voltage or topology checks;
- manipulate Three.js objects without corresponding project commands;
- silently change project intent.

The same command layer should serve both human UI actions and AI actions.

## 3. Core AI responsibilities

### Intent understanding

Examples:

- "Make a motion alarm."
- "Add an OLED."
- "Use only the parts I already own."
- "Make the buzzer beep three times instead."
- "Why is this wire here?"
- "Something is wrong with the LED."

### Planning

The AI can choose among compatible owned components and propose a project plan.

### Explanation

It can turn structured electrical/system state into beginner-friendly language.

### Debugging hypotheses

It can combine:

- project graph;
- validation results;
- simulation state;
- compile/upload results later;
- live runtime values later;
- camera observations later.

But the model should label uncertainty rather than asserting unverified physical facts.

## 4. Initial tool surface

Future full-product tool contracts; Slice 06 implements only the ProjectCommand subset documented in [Slice 06](SLICE-06.md):

```ts
addComponent(definitionId, preferredPlacement?)
removeComponent(componentId)
moveComponent(componentId, transform)
connect(fromEndpoint, toEndpoint)
disconnect(netId)
setComponentProperty(componentId, key, value)
setBehaviour(behaviourGraph)
validateProject()
runSimulation()
stopSimulation()
setSimulationInput(componentId, input)
inspectComponent(componentId)
inspectConnection(netId)
listOwnedComponents(filter?)
findCompatibleComponents(requirements)
```

Later:

```ts
compileProject(target)
flashBoard(target)
readRuntimeState(target)
readSerial(target)
startWorkbenchCamera()
getWorkbenchObservations()
reconcileDigitalTwin()
```

## 5. Tool-call example

User:

> Make a motion alarm using what I already own.

In a later inventory-aware slice, AI first queries inventory and board context. The following is a future behavior-planning sketch, not the implemented Slice 06 response contract.

Potential plan:

```json
{
  "goal": "motion-alarm",
  "components": [
    "board.esp32-devkit",
    "sensor.hc-sr501",
    "output.active-buzzer"
  ],
  "behaviour": {
    "trigger": "pir.motion",
    "actions": ["buzzer.on"]
  }
}
```

Then structured commands:

```json
[
  {
    "tool": "addComponent",
    "definitionId": "sensor.hc-sr501"
  },
  {
    "tool": "addComponent",
    "definitionId": "output.active-buzzer"
  },
  {
    "tool": "connect",
    "fromEndpoint": "pir-1:out",
    "toEndpoint": "esp32-main:gpio27"
  }
]
```

Each command is validated before commit.

## 6. Invalid-action flow

If the model proposes:

```text
LED → GPIO34
```

and the selected ESP32 definition marks GPIO34 input-only, `hardware-core` returns:

```json
{
  "status": "invalid",
  "code": "PIN_INPUT_ONLY",
  "message": "GPIO34 cannot drive an output.",
  "suggestions": ["gpio23", "gpio25", "gpio26"]
}
```

The AI may then revise the plan and explain:

> GPIO34 is input-only on this board, so I'll use GPIO23 for the LED instead.

## 7. AI response surfaces

Avoid a persistent chat transcript as the default product UI.

Responses should usually appear as one of:

- contextual action confirmation near the workbench;
- proposed component set;
- small explanation near a selected object;
- temporary build plan;
- visual highlight;
- logic change preview;
- concise warning/fix suggestion.

A full conversation history may exist behind an optional panel later.

## 8. Planning preview

For changes with meaningful consequences, show a compact preview:

```text
I'll add:
OLED display

I'll use:
GPIO21 → SDA
GPIO22 → SCL

[ Apply ]   [ Change ]
```

For trivial reversible actions such as moving a component, immediate execution is acceptable.

## 9. Personalization inputs

AI context may include:

- selected board;
- My Parts inventory;
- current project components;
- project graph;
- active selection;
- current workbench mode;
- user skill/learning preference if explicitly configured;
- verified component-library data;
- current simulation state.

Avoid sending unnecessary personal/account information to the model.

## 10. Component knowledge retrieval

Technical facts should be retrieved from Kinetable's verified component library and passed to the model as structured context.

Preferred:

```text
AI receives:
GPIO34.capabilities = [analog-input, digital-input, input-only]
```

Avoid:

```text
AI is asked from memory: "what can GPIO34 do?"
```

## 11. Explain mode generation

AI explanation should be grounded in a causal trace produced by the project/simulation engine.

Example structured trace:

```text
button-1.pressed
→ gpio18 = LOW
→ behaviour bonk.triggered
→ oled.text = "BONK!"
→ led.state = ON
→ buzzer.beep count=2
```

The AI can translate that into beginner language while the spatial UI highlights each corresponding entity.

## 12. Debug mode

Suggested debugging pipeline:

```text
validate topology
→ inspect simulation/runtime state
→ inspect expected behaviour
→ inspect generated code/compile state later
→ inspect real-board telemetry later
→ inspect camera observations later
→ rank hypotheses
```

The model should distinguish:

- proven issue;
- likely issue;
- uncertain observation.

Example:

```text
Verified: GPIO23 is configured as output.
Likely: the LED is inserted one breadboard row away from the resistor.
Camera confidence: 0.72.
```

## 13. Provider abstraction

Do not hard-code product logic to one model provider.

Suggested interface:

```ts
interface KinetableAIProvider {
  plan(request: PlanRequest): Promise<PlanResult>
  explain(request: ExplainRequest): Promise<ExplainResult>
  debug(request: DebugRequest): Promise<DebugResult>
}
```

A frontier multimodal model may be used for complex planning/vision, while cheaper/smaller models can handle routine explanations later.

## 14. Prompt-injection and tool safety

When external project/community content is introduced later:

- treat descriptions and imported text as untrusted data;
- do not let imported content redefine tool permissions;
- validate every mutation independently;
- require explicit confirmation before physical deployment or destructive project changes where appropriate.

## 15. Deployment safety boundary

Before real hardware flashing, Kinetable should run deterministic checks relevant to the supported project model.

AI may explain the checks, but it cannot override them by wording alone.

Potential checks:

- target board match;
- unsupported pin usage;
- severe voltage/power warnings represented in project model;
- compile success;
- required dependency availability;
- project target confirmation.

## 16. AI feature rollout

### Stage A — constrained planner implementation

Slice 06 implements strict structured output, shared command validation, and a provider router across BYOK remote APIs and the optional Local Bridge. Real Codex CLI output passed four supported intents and one unsupported intent through the same hardware validator; mocks appear only in unit/browser failure tests. Kinetable-managed paid inference is deferred.

### Stage B — constrained real planner

Allow natural-language requests that map to supported components and behaviours.

The hardware contract covers component selection/connections. The separate behavior contract is documented below. The remote BYOK endpoint checks an authenticated owner's cloud project or a validated guest document; the bridge checks a validated local document. Both check intent, board and revision. The model sees the canonical catalog and returns only commands or an unsupported result. Hardware-core executes against a copy at the inference boundary and again in the browser. Only a fully validated document is saved. The browser cannot inject definitions or identity. A custom remote URL is allowed only after public HTTPS SSRF checks; local URLs stay behind the loopback bridge. See [Slice 06](SLICE-06.md).

### Stage C — explanation/debugging

Ground responses in project traces and validator evidence.

### Stage D — multimodal workbench assistance

Add camera observations and digital-twin reconciliation.

## 17. Success criterion

The best Kinetable AI interaction should often feel like **the table understood what the user meant**, not like the user had a long conversation with a chatbot.

## Slice 10 command boundary

Manual Visual Logic uses parsed `logic.rule.add/update/remove/enable/reorder` operations through the existing atomic project command/history/persistence pathway. Logic compilation validates canonical capabilities and physical topology. The Slice 06 planner contract remains hardware-only: AI responses containing logic commands are rejected. AI does not generate or bypass behavior validation in this slice. Project v4 stores the semantic IR; no executable code or raw model responses are persisted as logic.

## Pre-Slice-11 AI behavior contract

Hardware assembly retains its vocabulary. Separate task logic supports bounded logic.rule.add/update/remove over canonical physically bound components. Strict keys, 16-command/16000-character limits, revision/identity and deterministic compilation reject unsafe output. Unsupported requires zero commands. Requests/display text are untrusted data.

Natural preview requires Apply, which revalidates in the shared queue and creates one history checkpoint. Router/fallback, bridge token/origin, JWT/owner checks, SSRF and vault behavior remain. No raw response, secret or source code is saved as logic. Real Codex CLI behavior and browser initial assembly were verified. Incremental hardware AI and generated Explain/scenarios remain deferred. [Correction](PRE-SLICE-11-UX-CORRECTION.md).
