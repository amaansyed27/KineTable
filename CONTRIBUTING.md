# Contributing to Kinetable

## Development philosophy

Build one coherent product slice at a time.

Each change should:

- have a clear user-visible purpose;
- respect package boundaries;
- avoid speculative abstractions unrelated to the current slice;
- include tests for deterministic logic;
- include a manual verification checklist for interaction work;
- avoid fake or duplicated state where a real project model should exist.

## Branch naming

Recommended examples:

```text
feat/slice-01-spatial-foundation
feat/breadboard-topology
fix/wire-anchor-drift
docs/component-schema
```

## Commit style

Use concise prefixes where practical:

```text
feat: add breadboard conductive groups
fix: preserve wire endpoints after component move
test: cover ESP32 input-only pin validation
docs: clarify simulation boundary
refactor: split spatial selection from project state
```

## Pull requests

A PR should contain:

- what the change adds;
- what it deliberately does not add;
- user-visible behaviour;
- architecture changes;
- tests run;
- manual verification steps;
- screenshots or short video for visual/interaction work;
- known limitations.

Do not combine multiple roadmap slices in one large PR unless there is a strong technical reason.

## Code quality

Once the codebase is initialized, expected root checks should include:

```bash
pnpm lint
pnpm test
pnpm build
```

End-to-end flows should use Playwright when they become stable enough to automate.

## TypeScript

- strict mode;
- avoid `any` unless isolated and documented;
- prefer discriminated unions for project commands and simulation state;
- runtime-validate persisted/imported data;
- keep domain types out of React components where possible.

## Architecture boundaries

### hardware-core

Must remain independent of React, Three.js, and AI SDKs.

### simulation

Must remain deterministic and independent of animation frame rate.

### spatial

May render and manipulate geometry, but must ask the hardware layer to validate electrical actions.

### ai

May propose structured commands, but cannot bypass core validation.

## UI expectations

Prefer:

- contextual controls;
- direct manipulation;
- spatial explanation;
- minimal visible chrome;
- progressive disclosure.

See `docs/DESIGN-SYSTEM.md`.

## Component additions

Every production component requires:

- canonical ID;
- visual asset or approved placeholder;
- pin/endpoint definition;
- electrical metadata;
- anchor positions;
- provenance/source metadata;
- asset licensing record;
- validation tests where applicable;
- simulation driver if the component needs interactive behaviour.

Do not merge a copied 3D asset without a clear redistribution license.

## Tests

Prioritize deterministic tests for:

- breadboard topology;
- pin capabilities;
- net creation/removal;
- project serialization;
- simulation timing;
- visual-logic compilation;
- AI tool validation.

For spatial interactions, combine unit tests for transforms/state with focused Playwright/manual interaction checks.

## Documentation

Update docs when a change modifies:

- product behaviour;
- project schema;
- component schema;
- package boundaries;
- command/tool contracts;
- roadmap assumptions.

The repository documentation should describe the product that actually exists.
