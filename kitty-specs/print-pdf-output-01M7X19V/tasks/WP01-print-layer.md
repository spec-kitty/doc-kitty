---
work_package_id: WP01
title: 'Print layer: print CSS, force-light hook, token fallback'
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-007
- FR-008
- FR-008a
- FR-009
- SC-001
- SC-005
- C-006
planning_base_branch: feat/print-pdf-output
merge_target_branch: feat/print-pdf-output
branch_strategy: Planning artifacts for this mission were generated on feat/print-pdf-output. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/print-pdf-output unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
history:
- timestamp: '2026-11-20T18:20:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/lib/print/
create_intent:
- src/styles/print.css
- src/lib/print/print.client.ts
- src/tests/print-tokens.test.ts
- src/tests/print-css.test.ts
- tests/a11y/print.spec.ts
execution_mode: code_change
owned_files:
- src/styles/print.css
- src/lib/print/print.client.ts
- src/lib/manifest.ts
- src/lib/theme.ts
- src/components/PageTitle.astro
- src/lib/diagram/diagram-render.client.ts
- src/virtual-modules.d.ts
- src/tests/print-tokens.test.ts
- src/tests/print-css.test.ts
- src/tests/fixtures/chrome/harness.mjs
- src/tests/chrome-baseline.test.ts
- tests/a11y/print.spec.ts
role: implementer
tags: []
tracker_refs: []
---
# Work Package Prompt: WP01 – Print layer: print CSS, force-light hook, token fallback

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `frontend-freddy`, or run
  `spec-kitty agent profile show frontend-freddy`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Branch Strategy

Planning branch, base and final merge target: `feat/print-pdf-output`. The mission topology is `single_branch`, so no lane worktree is allocated: implement in the repository root checkout on `feat/print-pdf-output`.

Implementation command:

```bash
spec-kitty agent action implement WP01 --agent claude --mission print-pdf-output-01M7X19V
```

## Objective

Make every in-frame page print clean and light from either theme (#378, tasks #385–#390). Requirements: FR-001–FR-009, FR-008a, SC-001, SC-005.

## Context

Read `research/code-grounding.md` §"Stylesheet delivery", §"Root cause", §"Diagrams", §"Leaks". Decisions D-01, D-02, D-03, D-11, D-16 in `research.md`.

## Subtasks

### T001 `src/styles/print.css`

One `@media print` block plus `@page { size: A4; margin: 18mm 16mm; }` (outside the media block, theme overridable).

- Hide: `header.header`, `.sidebar`, `starlight-menu-button`, `.right-sidebar-container`, `site-search`, `starlight-theme-select`, `.pagination-links`, `.dk-lightbox__trigger`, `dialog.dk-lightbox`, `.expressive-code .copy`, `.dk-machine-links`, `.dk-page-formats`, `.dk-print-control`, `.dk-hub__aux`, `.dk-toc-rail*` toggles, skip link.
- Keep: `.dk-page-hero`, `h1#_top`, `.dk-metadata-band`.
- Surfaces: `html, body { background: #fff !important }`; content full width (`.main-frame`, `.content-panel` paddings, `--sl-content-width: 100%`); `print-color-adjust: exact` only on `.starlight-aside`, `.dk-callout`, `.expressive-code`, `.dk-diagram`.
- Diagrams: `.dk-diagram { overflow: visible }`, `.dk-diagram svg { max-width: 100% !important; height: auto; max-height: 240mm }` (A4 printable height 261 mm minus margins), JSON trees too.
- Breaks (#387): `h1–h4 { break-after: avoid }`, `figure, .dk-diagram, .starlight-aside, .dk-callout, .expressive-code, tr { break-inside: avoid }`, `p, li { orphans: 3; widows: 3 }`, `.expressive-code pre, .expressive-code code { white-space: pre-wrap; overflow-wrap: anywhere }`.
- Link URLs (#388): `.sl-markdown-content a[href^="http"]:not(:has(img)):not([data-dk-print-link])::after { content: " (" attr(href) ")"; font-size: 0.85em; word-break: break-all }`. Print-document links rewritten to absolute URLs carry `data-dk-print-link` and print no URL (D-08). A theme turns the suffix off with `.sl-markdown-content a::after { content: none }`. Hero and band links are outside `.sl-markdown-content`.
- Tabs (#389): `starlight-tabs [role="tablist"] { display: none }`, `starlight-tabs [role="tabpanel"] { display: block !important }`. The per-panel label and the browser assertion are descoped (FR-008a): no tabs component exists here.
- Print documents: `.dk-print-page, .dk-print-section { break-before: page }`, `.dk-print-cover { break-after: page }` (used by WP03).

### T002 Print-token fallback

`emitPrintTokenSheet(resolved: ResolvedTheme): string` in `src/lib/theme.ts`, beside `emitTokenSheet`, → `@media print { :root:root[data-theme='dark'] { <name>: <resolved light value>; … color-scheme: light; } }`. Uses the module's `MODE_VARYING` list. Light value = `resolved.tokens[name]` (falls back to Default base). Serve as `virtual:doc-kitty/print-tokens.css` from `docKittyManifest` on both themed and unthemed paths; declare the module in `src/virtual-modules.d.ts`.

### T003 Force-light hook

`src/lib/print/print.client.ts` imports `../../styles/print.css` and `virtual:doc-kitty/print-tokens.css`. On `beforeprint`: remember `document.documentElement.dataset.theme`, set `light` (only if not already), never touch `localStorage`. On `afterprint`: restore. Independent of the disclosure handler (different state, no shared listener). Before forcing light it sets `data-dk-printing` on `<html>` and clears it one task after `afterprint` (D-03a). Loaded from `PageTitle.astro` with `<script>import '../lib/print/print.client.ts';</script>`. *(Superseded 2026-11-25: the layer is opt-in and loaded by `PrintLayer.astro` through the manifest; see research.md "Rework for SC-004".)*

### T004 Diagram completion signal

In `diagram-render.client.ts` `render()`'s `.finally`, when no pending scope remains, set `document.documentElement.setAttribute('data-dk-diagram-theme', currentTheme)` where `currentTheme` is `document.documentElement.dataset.theme ?? 'light'` captured when the run started. The `[data-theme]` observer returns early while `<html>` has `data-dk-printing`, so a browser print never snapshots a node reset to its Mermaid source (D-03a). *(Superseded 2026-11-25, see research.md "Rework for SC-004": the renderer carries no signal or pause; `dockitty-pdf` waits on `pre.mermaid[data-processed]` holding an `<svg>`, and the hook skips pages with client-mode diagrams.)*

### T005 Consolidation

`print.css` also hides the lightbox triggers; the existing rule in `dk-components.css` stays (no golden churn there). Keep `disclosure.css` and `dk-openapi.css` print rules in place (behaviour unchanged, FR-008). Astro emits `print.<hash>.css` as a file and links it: add a literal normaliser to the chrome harness that removes exactly that file block from `emittedCss` and its `<link>` from the page (plus the print-client `<script>` if one appears), mirroring `FOOTER_CSS_RULES`, with a control test that a changed non-print rule still fails.

### T006 Unit tests

`print-tokens.test.ts`: emits every mode-varying token; values equal the resolved light values; a brand override flows through; selector specificity (0,3,0). `print-css.test.ts`: parses `print.css` and asserts the required selectors are hidden, the break rules exist, `@page` is A4.

### T007 Playwright print spec

`tests/a11y/print.spec.ts` on the drafts-on example dist: pages `architecture/diagram-demonstrator/`, `guides/markua-showcase/` (or the Markua page), a behaviour feature page, an OpenAPI operation page. For each theme (`light`, `dark` via `starlight-theme` localStorage), dispatch `beforeprint`, `emulateMedia({ media: 'print' })`, then assert header/sidebar/TOC rail `display: none`, no `.dk-lightbox__trigger` with a box, `body` background luminance > 0.9, and a diagram node fill resolves to the light `--dk-diagram-node-fill`. Also a no-event case: dark, print media, no `beforeprint` → background still light (fallback).

## Definition of Done

- Unit tests and the chrome-baseline test pass; `pnpm lint` clean on changed files; the Playwright print spec passes locally.
- Deck route output unchanged (no new global sheet).

## Risks

- Emitted CSS file set changes (inline vs file); the harness normaliser must stay literal and narrow.

## Reviewer guidance

Check the fallback is generated (no hand-written colour) and that `localStorage` is never written.
