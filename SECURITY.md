# Security Policy

Kinetable is currently in early development.

## Reporting a vulnerability

Please do not publish sensitive vulnerability details in a public issue.

For now, report security concerns directly to the repository owner through a private communication channel associated with the project.

A formal security contact and disclosure process should be added before any public release.

## Security-sensitive areas

Special care is required around:

- AI tool execution;
- imported/community project data;
- local filesystem access in the future desktop app;
- serial and USB device access;
- firmware compilation and flashing;
- camera permissions;
- cloud sync and account data;
- third-party component/model downloads;
- project import/export parsing.

## AI safety boundary

AI-generated actions must pass through explicit Kinetable tool contracts and deterministic validation. Model output must never directly execute shell commands, flash devices, or mutate arbitrary project files without the product's controlled action layer.

## Desktop application

When Tauri/native capabilities are introduced:

- expose the minimum IPC surface required;
- validate all command arguments;
- restrict filesystem access;
- avoid arbitrary shell execution from renderer content;
- keep compiler/flash adapters explicit and auditable;
- treat imported projects and community assets as untrusted input.

## Dependency hygiene

Before public release, CI should include dependency and supply-chain checks appropriate to the final stack.

## Slice 11 owner and AI inventory boundaries

My Parts is owner-scoped in IndexedDB and in `public.inventory_items` RLS. The browser uses a publishable key and user JWT; database defaults `owner_id` to `auth.uid()` and grants no browser write access to that column. Authenticated remote owned-only AI reloads both project and inventory through the same JWT/RLS boundary, replacing the browser snapshot. Guest/Local Bridge snapshots are validated and bounded. External component source text remains data, and visual metadata cannot relax electrical validation. [Implementation and checks](docs/SLICE-11.md).
