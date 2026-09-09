# Tasks: Collapsible on-this-page TOC side rail

Mission: `collapsible-toc-rail-01M23HNA` · Branch: `feat/collapsible-toc-rail`
Derived from plan.md (IC-01..IC-06) + contracts/toc-rail-contract.md (C-1..C-5),
refined by the post-plan brownfield squad (research.md dispositions).

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | `preference.ts` — read/write `dk-toc-collapsed` (localStorage, try/catch on read AND write, blocked-safe) + `TOC_BREAKPOINT` (72rem) + `isCollapsed`/`setCollapsed` | WP01 | |
| T002 | `pre-paint.ts` — export the pre-paint inline **script source string** (classic, no `type=module`/`defer`/`async`; reads the key in try/catch, sets `html[data-toc-collapsed]` before paint) | WP01 | |
| T003 | vitest **node**: breakpoint const value; pre-paint string shape (a string; contains no `type="module"`/`defer`/`async`) | WP01 | [P] |
| T004 | vitest **jsdom**: executing the pre-paint sets the attribute for a collapsed value / no-op otherwise; preference read+write with a throwing-storage stub (private mode) | WP01 | [P] |
| T005 | `toc-rail.client.ts` — guard on `.right-sidebar`; inject ONE fixed `<button>` (idempotent by stable id); `sr-only`/`aria-label` + `title` + `aria-expanded`; toggle `html[data-toc-collapsed]` + persist via WP01 API | WP02 | |
| T006 | Toggle a11y + placement wiring — native `<button>` (Enter/Space), `position:fixed` vertically centered, horizontal anchor via CSS class hooks; module-scope (inert) `astro:page-load` re-init | WP02 | |
| T007 | `toc-rail.css` — `@media(min-width:72rem)` `html[data-toc-collapsed]`: 1px hairline column, `display:none` panel, recenter `.main-pane` at **≥(0,3,0)** to full width; toggle button styling via `--sl-*`/`--dk-*`; hide toggle below breakpoint; WebKit scrollbar pseudo | WP02 | |
| T008 | Verify tokens-only (zero hard-coded hex) in both light + dark | WP02 | [P] |
| T009 | `config.ts` — append the pre-paint `{tag:'script',content}` (from WP01) to the Starlight `head[]` array | WP03 | |
| T010 | `config.ts` — add `tocRailIntegration` (`injectScript('page', import toc-rail.client)`) appended **UNCONDITIONALLY** to the integrations array (mirror only diagrams' mechanics, not its opt-in gate) | WP03 | |
| T011 | `theme.ts` — register `toc-rail.css` in `GLOBAL_COMPONENT_SHEETS`; `DeckLayout.astro` — add the matching `?url` import (build-throw coupling) | WP03 | |
| T012 | Local build verify — example builds; toggle renders on a has-TOC page ≥72rem; `data-toc-collapsed` applied pre-paint; no PlantUML/Chromium needed | WP03 | |
| T013 | Structural **no-flash** build assertion — built `<head>` has the pre-paint `<script>` before `<body>` with no async attrs; `toc-rail.css` is a render-blocking `<link rel=stylesheet>` in `<head>` | WP04 | [P] |
| T014 | Playwright interaction spec (named has-TOC route ≥72rem) — collapse hides outline + computed `.main-pane` width == full content width (recenter); restore; `aria-expanded` flips; Enter/Space; reload persists with no expanded flash | WP04 | |
| T015 | Playwright scoping — FRESH load <72rem: no toggle; mobile TOC + left `nav.sidebar` unchanged (NFR-003) | WP04 | |
| T016 | `routes.ts` — add a rail `guardRoots` entry on the chosen has-TOC route; note home-{light,dark}.png baseline regen via CI | WP04 | |
| T017 | Chrome-behavior docs note — behavior + four-carrier-lock rationale + enumerated Starlight selectors + pinned `0.32.6` (upgrade tripwire) | WP05 | [P] |
| T018 | Validate the note against the docs convention (frontmatter, links) | WP05 | |

## Work Packages

### WP01 — Preference core + pre-paint (foundation)

- **Goal**: Own the collapse preference as pure, blocked-safe logic and the pre-paint no-flash script string.
- **Priority**: P1 (foundation). **Independent test**: `pnpm test` — the node + jsdom units pass.
- **Subtasks**: T001 T002 T003 T004
- **Dependencies**: none
- **Risks**: real try/catch on read AND write (private-mode throws); pre-paint stays a classic sync string; dedicated `data-toc-collapsed` (not `data-has-toc`).
- **Est.**: ~200 lines. **Requirements**: FR-005, NFR-001

### WP02 — Toggle client + rail CSS

- **Goal**: The accessible fixed toggle + the token-driven collapsed-rail CSS (the visible feature).
- **Priority**: P1. **Independent test**: build the example and toggle on a has-TOC page ≥72rem; outline hides, main recenters full-width, hairline remains.
- **Subtasks**: T005 T006 T007 T008
- **Dependencies**: WP01
- **Risks**: recenter selector MUST be **≥(0,3,0)** (`html[data-toc-collapsed][data-has-sidebar][data-has-toc] .main-pane`) or it loses to Starlight; 1px hairline column (not 0); `display:none` panel; NO `overflow:visible`; zero hard-coded hex; idempotent injection; button not inside the `display:none` panel.
- **Est.**: ~320 lines. **Requirements**: FR-001, FR-002, FR-003, FR-006, FR-007, NFR-002

### WP03 — Build integration wiring

- **Goal**: Wire the pre-paint head script, the client island, and the CSS sheet through existing seams.
- **Priority**: P1. **Independent test**: `pnpm build` succeeds; built page carries the pre-paint script + the render-blocking sheet.
- **Subtasks**: T009 T010 T011 T012
- **Dependencies**: WP01, WP02
- **Risks**: `tocRailIntegration` added UNCONDITIONALLY; `GLOBAL_COMPONENT_SHEETS` + DeckLayout `?url` are build-coupled (build throws if the import is missing — self-correcting); pre-paint must be a classic `{tag:'script',content}` head entry.
- **Est.**: ~180 lines. **Requirements**: FR-005, NFR-001

### WP04 — Tests (interaction + a11y + no-flash + scoping)

- **Goal**: Prove collapse/restore + recenter + persistence + no-flash + scoping + a11y, all green in CI.
- **Priority**: P1. **Independent test**: `pnpm test` (structural no-flash) + `pnpm test:a11y` (interaction) pass.
- **Subtasks**: T013 T014 T015 T016
- **Dependencies**: WP03
- **Risks**: pin a NAMED has-TOC route + guardRoot (TOC presence is otherwise flaky); assert computed recenter width (not just the attribute); fresh-load below 72rem; the new toggle shifts `home-*.png` → regenerate baselines via CI `update-a11y-baselines.yml`.
- **Est.**: ~260 lines. **Requirements**: FR-004, NFR-003, NFR-004

### WP05 — Chrome-behavior docs

- **Goal**: Briefly document the collapsible-rail chrome behavior + the Starlight-internals upgrade tripwire.
- **Priority**: P3. **Independent test**: the note builds/validates under the docs convention.
- **Subtasks**: T017 T018
- **Dependencies**: WP03
- **Risks**: chrome-behavior only (no convention change); enumerate the depended-on Starlight selectors + pinned `0.32.6`.
- **Est.**: ~120 lines. **Requirements**: FR-008

## Dependency graph

```
WP01 ── WP02 ── WP03 ──┬── WP04
                       └── WP05
```

MVP scope: **WP01→WP02→WP03** (the working feature). WP04 (tests) + WP05 (docs) parallelize after WP03.
