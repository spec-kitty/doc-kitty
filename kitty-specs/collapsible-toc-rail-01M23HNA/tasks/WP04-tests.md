---
work_package_id: WP04
title: Tests — interaction + a11y + no-flash + scoping
dependencies:
- WP03
requirement_refs:
- FR-004
- NFR-003
- NFR-004
planning_base_branch: feat/collapsible-toc-rail
merge_target_branch: feat/collapsible-toc-rail
branch_strategy: Planning artifacts for this mission were generated on feat/collapsible-toc-rail. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/collapsible-toc-rail unless the human explicitly redirects the landing branch.
subtasks:
- T013
- T014
- T015
- T016
history:
- created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: tests/
create_intent:
- src/tests/toc-rail-build-html.test.ts
- tests/a11y/toc-rail.interaction.spec.ts
execution_mode: code_change
owned_files:
- src/tests/toc-rail-build-html.test.ts
- tests/a11y/toc-rail.interaction.spec.ts
- tests/a11y/routes.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its identity, boundaries, and charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Relevant: DIRECTIVE_030 (tests are the gate), DIRECTIVE_010, and the anti-vacuity discipline (guard roots).

## Objective

Prove collapse/restore + recenter + persistence + no-flash + desktop scoping + a11y, all green in CI.
The full feature (WP01-WP03) is present in this lane.

Read first: `../contracts/toc-rail-contract.md` (**C-5**), `../plan.md` (IC-05), and the harness: `tests/a11y/{routes.ts,mode.ts,deck.interaction.spec.ts,axe.spec.ts}`, `playwright.config.ts` (viewport 1280x800), `src/vitest.workspace.ts`.

## Subtasks

### T013 — Structural no-flash build assertion (`src/tests/toc-rail-build-html.test.ts`)
Against a built example page (build project / read example/dist HTML): assert the pre-paint `<script>` node exists in `<head>`, appears before `<body>`, and has NO `type="module"`/`defer`/`async`; AND `toc-rail.css` appears as `<link rel="stylesheet">` in `<head>` (render-blocking). This proves zero-flash by construction (C-5).

### T014 — Playwright interaction (`tests/a11y/toc-rail.interaction.spec.ts`)
On a NAMED has-TOC route (`home` or `guides/getting-started/`, viewport 1280x800 ≥72rem), model on `deck.interaction.spec.ts`: click the toggle → outline hidden AND `page.evaluate` computed `.main-pane` width == full content width (recenter — NOT just the attribute); click again → restored; `aria-expanded` flips true↔false; the button activates with Enter AND Space; `page.reload()` → still collapsed with NO expanded-outline frame (assert `html[data-toc-collapsed]` present at first evaluation).

### T015 — Scoping / non-regression (same or a sibling spec)
FRESH-load the route at a <72rem viewport (e.g. 1024px) → the toggle is not visible/present; the mobile TOC (`mobile-starlight-toc`) and left `nav.sidebar` are unchanged (assert they exist and the feature added no attributes/rules to them). (NFR-003 / SC-003)

### T016 — routes.ts guard + baseline note
Add a `guardRoots` entry for the chosen route asserting `.right-sidebar` + `[data-has-toc]` so the interaction test fails LOUDLY if the page loses its TOC. Add a comment that `home-{light,dark}.png` visual baselines must be regenerated via the CI `update-a11y-baselines.yml` workflow (the new toggle shifts home pixels) — do NOT attempt a local baseline regen.

## Definition of Done
- Structural no-flash test + interaction spec + scoping spec all pass (`pnpm test` + `pnpm test:a11y`).
- Recenter asserted by computed width; persistence across reload with no flash; below-72rem absence on fresh load; aria/keyboard covered.
- guardRoots entry added; baseline-regen note present.

## Reviewer guidance
Confirm the recenter assertion checks computed WIDTH (not just the attribute) — the whole point. Confirm the below-breakpoint test loads fresh (not a resize-down). Confirm the guardRoot makes TOC-presence non-vacuous.

## Branch Strategy
Planning + merge target: `feat/collapsible-toc-rail`. Depends on WP03. Worktrees per lanes.json. Implement with `spec-kitty agent action implement WP04 --agent claude`.
