# Kinetable Design System

## Design philosophy: Playful Precision

Kinetable should feel fun because objects respond, systems become understandable, and progress feels satisfying — not because the interface is crowded or childish.

Use this balance as a directional guide:

- **70% restrained product design** — whitespace, hierarchy, calm surfaces, premium motion, low visual noise.
- **20% tactile industrial character** — physical controls, materiality, satisfying mechanical response, clear object affordances.
- **10% friendly learning psychology** — approachable language, immediate feedback, gentle hints, rewarding completion.

References are for design principles only. Kinetable must develop its own visual identity rather than copying another product's UI.

## Core rules

### 1. Minimal structure, playful interaction

The interface should often contain only:

- the workbench;
- the hardware;
- one contextual control;
- one clear next action.

Fun is produced by movement, physicality, simulation, cause/effect, and feedback.

### 2. Hardware is the visual hero

Do not decorate screens with unrelated illustrations when an actual component or project can carry the visual story.

### 3. UI appears when needed

Prefer contextual tools over permanently visible panels.

Examples:

- select component → inspector appears;
- select wire → connection details appear;
- enter simulation → authoring tools recede;
- ask for advanced detail → code/technical data slides in.

### 4. Progressive disclosure

Default copy should be understandable by a beginner.

```text
PIR Motion Sensor
Detects movement.
```

Advanced expansion may reveal:

```text
HC-SR501
VCC 4.5–20 V
Digital OUT
sensitivity / delay controls
```

### 5. No dashboard aesthetic

Avoid:

- KPI cards;
- feature grids;
- permanently dense side navigation;
- developer-console look as the default;
- charts without a direct hardware reason;
- large tables of properties when a spatial explanation works better.

## Color system

Initial direction. Final values should be tuned in coded prototypes.

```text
Canvas / warm paper       #F4F1E8
Surface / raised          #FBF9F3
Near black                #151515
Secondary graphite        #5C5C58
Hairline                   #D8D4C9
Electric lime accent      #B7F000
Warning orange            #F08A3C
Error / critical          #D94F45
Success                    derived carefully from lime/green family
```

Rules:

- lime is a state color, not wallpaper;
- use lime for selection, active signal, completion, and primary interactive emphasis;
- warning orange is sparse;
- avoid gradients unless tied to lighting/material behaviour;
- no neon-on-black cyberpunk palette.

Dark mode may exist later but should preserve warmth and tactile readability rather than becoming a glowing HUD.

## Typography

Desired qualities:

- highly legible;
- neutral enough for technical content;
- slightly editorial at large sizes;
- not "tech startup" by default;
- strong numerals and symbols.

Use one main sans family plus an optional mono face only for technical/code views.

Slice 01 uses self-hosted **Space Grotesk** for interface and editorial text, with regular-weight major statements. The existing Kinetable wordmark retains its Arial/Helvetica treatment. Font provenance and the bundled SIL OFL license are recorded in [Asset licensing](ASSET-LICENSING.md).

Typography hierarchy:

```text
Display      56–72 px   sparse landing / major empty states
H1           36–48 px
H2           28–36 px
H3           20–24 px
Body         15–17 px
UI           13–15 px
Micro        11–12 px
Code         13–15 px mono
```

Do not use all-caps labels excessively. Technical abbreviations such as GPIO, I2C, SPI are exceptions.

## Spacing

Base unit: 4 px.

Primary rhythm:

```text
4  8  12  16  24  32  48  64  96
```

Use substantially more whitespace on marketing/onboarding surfaces than inside technical views.

## Radius and geometry

Kinetable should not become a collection of rounded SaaS cards.

Guideline:

- buttons: moderate radius, not pills by default;
- floating prompt: larger soft radius allowed;
- contextual panels: 12–16 px;
- trays and physical UI may use geometry inspired by manufactured objects rather than generic rectangles.

## Material language

3D objects should be accurate enough to teach and build trust, while slightly simplified for clarity and performance.

Preferred materials:

- matte PCB solder mask;
- brushed/anodized metal where appropriate;
- soft molded plastic;
- rubber feet/cables;
- ceramic/stone-like table surface used sparingly;
- subtle transparent materials only when physically justified.

Avoid excessively glossy "product render" surfaces.

## Lighting

Default workbench lighting should make small components readable.

Use:

- soft large-area key light;
- restrained ambient fill;
- contact shadows;
- subtle environment lighting;
- no dramatic colored rim lighting by default.

Selection should primarily use outline/highlight and local illumination, not global glow.

## Motion principles

### Physical first

If an object represents a physical thing, motion should respect physical intuition.

Examples:

- board lifts slightly on hover;
- button depresses;
- knob rotates;
- wire bends rather than teleports;
- part settles into a breadboard;
- tray slides rather than fades randomly.

### Fast but readable

Most UI transitions: 120–240 ms.

Spatial assembly can be slower: 300–800 ms per meaningful stage.

Do not animate everything at once.

### Cause and effect

Simulation animation sequence should communicate causality:

```text
input changes
→ signal path activates
→ logic responds
→ output reacts
```

### Completion feedback

Use small, satisfying feedback:

- component snaps cleanly;
- path briefly illuminates;
- subtle check appears;
- object performs expected behaviour.

Avoid confetti unless a very specific learning milestone genuinely justifies it.

## Sound

Sound can improve tactile feedback, but should be optional and restrained.

Potential sounds:

- soft component snap;
- switch/button click;
- relay click;
- actual simulated buzzer output;
- subtle completion tone.

Never make interface sound mandatory.

## Icons

- simple line icons;
- consistent optical weight;
- avoid generic AI sparkle icon as the primary representation of intelligence;
- hardware objects themselves should often replace icons.

## Buttons

Primary:

- near-black surface;
- light text;
- small lime state/accent allowed.

Secondary:

- transparent or raised warm surface;
- graphite text;
- subtle border.

Destructive:

- critical color only after explicit destructive intent.

Copy should be direct:

- `Build it`
- `Run on my ESP32`
- `Show me why`
- `Add to My Parts`

Avoid:

- `Submit`
- `Execute`
- `Initiate workflow`

## Prompt surface

The AI prompt is not a chat application.

Default state:

```text
Ask Kinetable...
```

It should support:

- short natural-language action;
- contextual suggestions;
- optional voice later;
- compact AI response surfaces attached to the resulting object/action.

Do not maintain a giant conversation column by default.

## Feedback language

### Preferred

> That LED doesn't have a path back to ground yet.

> GPIO34 can read signals, but it can't drive this LED. Try GPIO23.

> Everything you need is already on your table.

### Avoid

> INVALID CONNECTION ERROR

> You made a mistake.

> Operation failed due to incorrect topology.

The UI should explain the system rather than judge the user.

## Workbench modes

### Build

Visual emphasis: geometry, anchors, placement, ownership.

### Simulate

Visual emphasis: behaviour and response. Authoring chrome recedes.

### Explain

Visual emphasis: one causal path at a time. Unrelated geometry fades.

### Advanced Code

Visual emphasis: synchronized relationship between source and physical system.

## Accessibility

- never rely on color alone for signal type or validity;
- provide text labels/tooltips for technical states;
- keyboard-accessible top-level actions;
- respect reduced motion;
- sufficient contrast on warm backgrounds;
- target sizes appropriate for touch-capable desktop/tablet devices;
- simulation sounds must have visual equivalents.

## Anti-pattern checklist

Reject a screen if it looks like:

- a generic AI SaaS dashboard;
- a cyberpunk control room;
- a children's coding app;
- an ecommerce electronics catalog;
- a photographic maker-lifestyle advertisement;
- an IDE with a 3D viewport bolted on;
- a wall of cards;
- an AR movie prop full of meaningless overlays.

The target is a calm, personal, tactile engineering environment that reveals complexity only when the user asks for it.

## Implemented workbench interaction

Slice 07 keeps the 3D work surface dominant. Selection uses a restrained lime ring, contextual actions sit clear of the board on desktop and become a bottom strip on mobile, and the add-part tray appears only when requested. The DOM part list and camera controls remain keyboard/touch reachable; reduced motion removes nonessential easing. Incomplete circuits use one concise status rather than a warning panel. See [Slice 07](SLICE-07.md).

## Slice 08 circuit editor

The 400-hole breadboard is a quiet physical object with restrained rail markings and sparse labels. Pin markers appear on hover, selection or in Wire mode; connected holes use a subtle highlight rather than permanent label clouds. Actual wires use conventional muted colors and exact anchors, with a larger invisible hit target. An on-table inspector names the selected component, wire or hole and offers technical detail on demand. Text names and diagnostics carry electrical meaning even when color or WebGL is unavailable. On mobile, the same From/To controls and part list provide touch-friendly access. See [Slice 08](SLICE-08.md).

## Application material and themes — 2026-09-27

The September 28 screenshot follow-up adds the shared settings rail/cards, editable project title, one workbench tool dock, chevrons and themed native menus, hover/press/focus feedback, keyboard tooltips and reduced-motion-aware transitions. Jumper colors now follow electrical continuity with distinct colors per connected net. [Interaction refinement](UI-INTERACTION-REFINEMENT.md).

Current semantic CSS tokens supersede earlier application color examples: Light background #eeeadf, paper #f5f1e7, raised #faf7ef, ink #1a1b18; Dark background #181916, paper #20211d, raised #272822, ink #f0eee5. Restrained lime #b7f000. Muted/border/focus/error/selection adapt together. Static grain opacity 0.018/0.012. Persistent System/Light/Dark initializes before rendering. Landing keeps its own direction. Compact headers, native disclosures and mobile task sheets replace permanent sidebars. [Correction](PRE-SLICE-11-UX-CORRECTION.md).

Slice 11's Parts shelf uses the same theme tokens, object rows, tactile lightweight thumbnails, native search/select controls and a modal detail sheet. My Parts and Library are two contexts in one route. Ownership actions retain explicit text and keyboard labels; mobile stacks filters and quantity controls. [Slice 11](SLICE-11.md).

## Learn material

Learn uses editorial curriculum rows, restrained progress and the existing physical workbench. Desktop guidance sits beside hardware; mobile places a short canvas above a task sheet. Hints reveal progressively, Why expands on demand, and native keyboard controls/status announcements remain available. Theme bootstrap is a synchronous self-hosted script under unchanged CSP. [Visual evidence](SLICE-13.md).
