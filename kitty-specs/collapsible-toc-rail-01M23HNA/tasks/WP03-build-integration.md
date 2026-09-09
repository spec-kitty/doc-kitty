---
work_package_id: WP03
title: Build integration wiring
dependencies:
- WP01
- WP02
requirement_refs:
- FR-005
- NFR-001
planning_base_branch: feat/collapsible-toc-rail
merge_target_branch: feat/collapsible-toc-rail
branch_strategy: Planning artifacts for this mission were generated on feat/collapsible-toc-rail. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/collapsible-toc-rail unless the human explicitly redirects the landing branch.
subtasks:
- T009
- T010
- T011
- T012
history:
- created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/config.ts
- src/lib/theme.ts
- src/layouts/DeckLayout.astro
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Relevant: DIRECTIVE_001 (respect the four-carrier lock — no components carrier), DIRECTIVE_010, DIRECTIVE_024 (locality).

## Objective

Wire the pre-paint head script (WP01), the client island (WP02), and the CSS sheet (WP02) into
the build through the EXISTING seams — no Starlight `components` carrier added.

Read first: `../contracts/toc-rail-contract.md` (C-1/C-5 no-flash), `../plan.md` (IC-04), `../research.md` (D5). The seams: `src/lib/config.ts` `head[]` array + `injectScript('page', …)` (mirror `diagramsIntegration`), `src/lib/theme.ts` `GLOBAL_COMPONENT_SHEETS`, `src/layouts/DeckLayout.astro` `?url` iteration. WP01/WP02 files are present in this lane.

## Subtasks

### T009 — pre-paint head entry (config.ts)
Append to the Starlight `head` array (the same array as `discoveryHead(...)`) a classic inline script entry: `{ tag: 'script', content: PRE_PAINT_SCRIPT }` importing `PRE_PAINT_SCRIPT` from `./toc-rail/pre-paint`. It MUST render as a synchronous classic `<script>` (no module/defer/async) so it runs before `<body>` (NFR-001).

### T010 — tocRailIntegration (config.ts)
Add an Astro integration `tocRailIntegration` whose `astro:config:setup` calls `injectScript('page', `import { initTocRail } from ${JSON.stringify(clientPath)}; initTocRail();`)` where `clientPath = fileURLToPath(new URL('./toc-rail/toc-rail.client.ts', import.meta.url))` (mirror the diagrams/glossary owner shape). Append it **UNCONDITIONALLY** to the integrations array returned by `defineDocKittyIntegrations` — NOT gated behind an option (D2 always-on).

### T011 — sheet registration + Deck coupling
`src/lib/theme.ts`: add `'@commondocs-kitty/toolkit/styles/toc-rail.css'` to `GLOBAL_COMPONENT_SHEETS`. `src/layouts/DeckLayout.astro`: add the matching static `?url` import for the new sheet (the layout iterates the list and THROWS at build without it — build-enforced, self-correcting). The sheet survives brand token-sheet replacement precisely because it is in this list.

### T012 — local build verify
Run `pnpm build`. Confirm: the example builds green; a has-TOC page ≥72rem renders the toggle; the built `<head>` contains the pre-paint `<script>` and the render-blocking `toc-rail.css` `<link>`. No PlantUML/Chromium needed.

## Definition of Done
- Pre-paint classic script in `head[]`; tocRailIntegration unconditional; toc-rail.css in GLOBAL_COMPONENT_SHEETS + DeckLayout ?url import.
- `pnpm build` green; built head carries the pre-paint script + render-blocking sheet.
- No Starlight `components` carrier added (four-carrier lock intact).

## Reviewer guidance
Confirm the head script is classic (not module/defer/async), the integration is unconditional, and the DeckLayout ?url import matches the new GLOBAL_COMPONENT_SHEETS entry (else build throws). Confirm carriers map unchanged.

## Branch Strategy
Planning + merge target: `feat/collapsible-toc-rail`. Depends on WP01, WP02. Worktrees per lanes.json. Implement with `spec-kitty agent action implement WP03 --agent claude`.
