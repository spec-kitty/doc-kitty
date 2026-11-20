---
work_package_id: WP06
title: Print control
dependencies:
- WP05
requirement_refs:
- FR-026
- NFR-002
planning_base_branch: feat/print-pdf-output
merge_target_branch: feat/print-pdf-output
branch_strategy: Planning artifacts for this mission were generated on feat/print-pdf-output. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/print-pdf-output unless the human explicitly redirects the landing branch.
subtasks:
- T031
- T032
- T033
history:
- timestamp: '2026-11-20T18:20:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/components/
create_intent:
- src/components/slots/PrintControl.astro
- tests/a11y/print-control.spec.ts
execution_mode: code_change
owned_files:
- src/lib/chrome-options.ts
- src/components/slots/PrintControl.astro
- src/tests/chrome-options.test.ts
- tests/a11y/print-control.spec.ts
role: implementer
tags: []
tracker_refs: []
---
# Work Package Prompt: WP06 – Print control

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `frontend-freddy`, or run
  `spec-kitty agent profile show frontend-freddy`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Branch Strategy

Planning branch, base and final merge target: `feat/print-pdf-output`. The mission topology is `single_branch`, so no lane worktree is allocated: implement in the repository root checkout on `feat/print-pdf-output`.

Implementation command:

```bash
spec-kitty agent action implement WP06 --agent claude --mission print-pdf-output-01M7X19V
```

## Objective

An opt-in "Print / Save as PDF" control with a conditional section-PDF download (#379). Requirements: FR-026, NFR-002.

Out-of-map: `src/components/PageTitle.astro` (WP01) gets the render line; `src/lib/config.ts` (WP02) passes `printControl` through `validateChromeOptions`; and the test dist (D-13): either `example/astro.config.mjs` (WP03) when no visual baseline shows the control, or `src/tests/fixtures/chrome/harness.mjs` `CHROME_DISTS` (WP01) + `playwright.config.ts` + the `ci.yml` artifact steps (WP05). Each is recorded in the commit message.

## Subtasks

### T031 Option

`ChromeOptionsInput.printControl?: boolean` (default false), validated as boolean, carried by `chromeOptions()`.

### T032 Component

`PrintControl.astro`: `<div class="dk-print-control">` with `<button type="button" data-dk-print>Print / Save as PDF</button>` (inline script `window.print()`) and, when `pdfOptions().sections` includes the page's section, `<a href="<base>/pdf/<section>.pdf" download>Download section PDF</a>`. Rendered by `PageTitle.astro` after the band, not on Persona pages, not on print routes. 24×24 px minimum targets, focus-visible ring, tokens only (AA both themes). Hidden in print by `print.css`.

### T033 Spec

Read `tests/a11y/visual.spec.ts` first: if the control would change a visual baseline, carry it on a chrome fixture dist (`CHROME_DISTS` + CI upload/download) instead of the example (D-13). `tests/a11y/print-control.spec.ts`: on a page in `architecture` both links/button present with accessible names; on a page outside a PDF section no download link; keyboard Tab reaches it; axe 0 violations in light and dark; print media hides it; activating calls `window.print` (stubbed).

## Definition of Done

Spec passes on the chosen dist (example or chrome fixture, D-13); chrome-options tests pass.
