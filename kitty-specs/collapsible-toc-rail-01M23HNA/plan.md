# Implementation Plan: Collapsible on-this-page TOC side rail

**Branch**: `feat/collapsible-toc-rail` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/collapsible-toc-rail-01M23HNA/spec.md`

## Summary

Add a desktop-only control that collapses Starlight's right-hand on-this-page outline,
re-centering the article to full width, with the preference remembered (no flash) and
mobile + the left sidebar untouched. A brownfield seam-map ([research.md](./research.md))
found that doc-kitty enforces a **four-carrier Starlight `components` lock**
(ADR-0013/0015: only `Head`, `PageTitle`, `MarkdownContent`, `Footer` may be overridden),
so a `PageSidebar` component override is prohibited and the theme's `dk:toc` slot is
declared-but-unwired. The plan therefore uses the spec's sanctioned "or the Kitty
equivalent" path: **chrome-only client-side DOM augmentation + a token-driven CSS sheet +
a pre-paint inline head script**, injected exactly like the existing diagram/glossary
client islands — no component override, no convention change.

## Technical Context

**Language/Version**: TypeScript/JavaScript (ESM) client module + CSS; Astro 5.18 / `@astrojs/starlight` 0.32.6 integration seam
**Primary Dependencies**: **none new** — vanilla client JS + CSS over Starlight (`--sl-*`) tokens (DIRECTIVE_051: no dependency added)
**Storage**: `localStorage` (per-browser) mirrored to `document.documentElement` `data-toc-collapsed`; tolerant of blocked storage
**Testing**: Vitest pure-logic units (`src/tests/toc-rail-*.test.ts`) for the preference read/write + breakpoint gating; Playwright interaction + a11y specs in `tests/a11y/` (modeled on `deck.interaction.spec.ts`) for collapse/expand, recenter, persistence, below-breakpoint absence, keyboard/`aria-expanded`; visual baselines regenerated via the `update-a11y-baselines.yml` workflow
**Target Platform**: modern browsers; the `example/` docsite is the test venue
**Project Type**: web — Astro/Starlight chrome (toolkit `src/` + example harness)
**Performance Goals**: **zero** frames of expanded outline on load with a collapsed preference (pre-paint attribute); no layout jank on toggle
**Constraints**: honor the four-carrier lock — **no PageSidebar override**, DOM-augment `.right-sidebar` at runtime instead (C-001 "Kitty equivalent"); desktop-only at Starlight's `min-width: 72rem` two-column breakpoint; mobile `MobileTableOfContents` + left docs sidebar byte-unchanged; token-driven (no hard-coded brand palette); layout driven by `html[data-toc-collapsed]` + CSS scoped to `html[data-has-toc]` at the breakpoint
**Scale/Scope**: 1 client module + 1 CSS sheet + 1 head pre-paint script entry + 1 integration wiring + tests + one docs note

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Charter present (`software-dev-default`). No violations:

- **DIRECTIVE_001 (Architectural Integrity)**: the four-carrier `components` lock is
  **respected** — the feature adds no 5th carrier; it augments the rendered DOM from a
  client island (the same seam diagrams/glossary use), keeping the chrome override
  boundary intact. ✅
- **DIRECTIVE_010 (Spec Fidelity)**: spec C-001 explicitly allows "the Kitty equivalent
  component slot"; the client-augmentation path is that equivalent, chosen because the
  literal PageSidebar override is foreclosed by the lock (documented in research D1). ✅
- **DIRECTIVE_024 (Locality of Change)**: net-new `src/lib/toc-rail/**` + `src/styles/toc-rail.css`
  + a scoped edit to `src/lib/config.ts` (head entry + integration) + `src/lib/theme.ts`
  (`GLOBAL_COMPONENT_SHEETS`) + `src/layouts/DeckLayout.astro` (the sheet `?url` coupling)
  + tests + one docs note. No touch to mobile/left-nav code. ✅
- **DIRECTIVE_051 (Supply-chain)**: **no dependency added**. ✅
- **Accessibility**: the control must satisfy the repo's WCAG 2.1/2.2 AA axe gate (name,
  `aria-expanded`, keyboard, focus ring). ✅
- **Brownfield point-cut squad** runs post-plan (and pre-PR) per operator direction;
  dispositions recorded in research.md.

## Project Structure

### Documentation (this mission)

```
kitty-specs/collapsible-toc-rail-01M23HNA/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/toc-rail-contract.md   # attribute state machine + a11y + CSS override contract
└── tasks.md                         # /spec-kitty.tasks (NOT created here)
```

### Source Code (repository root)

```
src/lib/toc-rail/
├── preference.ts            # NEW pure logic: read/write the collapse pref (localStorage, blocked-safe), breakpoint const
├── preference.test-helpers  # (if needed) — otherwise tested directly
├── toc-rail.client.ts       # NEW client island: guard → inject fixed toggle button, toggle html[data-toc-collapsed], persist, idempotent
└── pre-paint.ts             # NEW: the inline head-script SOURCE STRING (so it is unit-testable + reused by config head entry)

src/styles/toc-rail.css      # NEW: collapsed-state overrides @media(min-width:72rem) keyed on html[data-toc-collapsed]; toggle button styling via --sl-*

src/lib/config.ts            # EDIT: append pre-paint {tag:'script',content} to the head[] array; add tocRailIntegration (injectScript('page', …)) mirroring diagramsIntegration
src/lib/theme.ts             # EDIT: register toc-rail.css in GLOBAL_COMPONENT_SHEETS (survives brand token-sheet replacement)
src/layouts/DeckLayout.astro # EDIT: add the toc-rail.css ?url import (the GLOBAL_COMPONENT_SHEETS build coupling — inert on decks, required or build throws)

src/tests/toc-rail-preference.test.ts   # NEW vitest: pref read/write, blocked storage, breakpoint gating, pre-paint string
tests/a11y/toc-rail.interaction.spec.ts # NEW playwright: collapse/expand + recenter + persistence + below-breakpoint + keyboard/aria
tests/a11y/routes.ts                     # EDIT: add a rail guard root + a known-has-TOC route entry
docs/architecture/…                      # NEW/EDIT: one chrome-behavior note (FR-008)
```

**Structure Decision**: A self-contained `src/lib/toc-rail/` island (pure-logic `preference.ts`
+ `pre-paint.ts` string + `toc-rail.client.ts`) plus one token-driven `toc-rail.css`, wired
through the existing `injectScript`/`head[]`/`GLOBAL_COMPONENT_SHEETS` seams — the same
pattern diagrams and glossary use — so nothing touches the four-carrier component lock.

## Complexity Tracking

*No Charter Check violations — table intentionally empty.*

## Implementation Concern Map

> Concerns, not work packages. `/spec-kitty.tasks` translates these into WPs.

### IC-01 — Preference + pre-paint state (no flash)

- **Purpose**: Own the collapse preference as pure, testable logic and apply it to
  `<html>` before first paint so a collapsed preference never flashes the outline.
- **Relevant requirements**: FR-005, NFR-001
- **Affected surfaces**: `src/lib/toc-rail/preference.ts`, `src/lib/toc-rail/pre-paint.ts`
- **Sequencing/depends-on**: none (foundation)
- **Risks**: blocked storage must not throw (try/catch, in-session fallback); the pre-paint
  script is a plain string emitted verbatim into `<head>` (mirror Starlight's ThemeProvider
  `is:inline`) — keep it dependency-free and tiny; set a dedicated `data-toc-collapsed`
  (NOT reuse `data-has-toc`, which also zeroes `--sl-mobile-toc-height`).

### IC-02 — Token-driven collapsed-rail CSS

- **Purpose**: Express the collapsed layout + the toggle button visually, all via `--sl-*`
  tokens, scoped so it only acts on desktop, has-TOC pages.
- **Relevant requirements**: FR-002, NFR-002, C-004, C-005
- **Affected surfaces**: `src/styles/toc-rail.css`
- **Sequencing/depends-on**: none (parallel to IC-01)
- **Risks (post-squad — 3 lenses converged)**: Starlight uses `:where()` scoping (zero
  specificity), so the cascade is decided by human selector specificity, NOT load order.
  - **Recenter (the one real bug in the first draft)**: Starlight's `[data-has-sidebar][data-has-toc] .main-pane`
    is (0,3,0); the collapse override MUST be **≥(0,3,0)** — use
    `html[data-toc-collapsed][data-has-sidebar][data-has-toc] .main-pane` (0,4,1) (or override the
    calc inputs `--sl-content-width:100%; --sl-sidebar-width:0px`). A weaker `html[data-toc-collapsed] .main-pane`
    (0,2,1) loses and leaves the article narrow with dead right space (worse than a no-op). Contract C-2.
  - **Hairline**: collapse `.right-sidebar-container` to a **1px hairline column**
    (`width:1px; background:var(--sl-color-hairline)`), NOT 0 — a 0-width container relies on the
    off-screen `position:fixed` `.right-sidebar` border landing at ~100vw where it is clipped.
  - **Panel hide**: `display:none` the `.right-sidebar-panel` (so axe skips the off-screen TOC links).
  - **No `overflow:visible`**: unnecessary/harmful — the fixed toggle is not clipped by ancestor
    overflow (no transform/contain in the chain); Starlight already hides the TOC scrollbar
    (`scrollbar-width:none`; add only the WebKit pseudo). Zero hard-coded hex (NFR-002).

### IC-03 — Toggle control + client behavior

- **Purpose**: Inject the accessible, fixed, edge-mounted toggle and flip the preference.
- **Relevant requirements**: FR-001, FR-003, FR-006, FR-007
- **Affected surfaces**: `src/lib/toc-rail/toc-rail.client.ts`
- **Sequencing/depends-on**: IC-01 (uses the preference API)
- **Risks**: **idempotency** — injected via `injectScript('page', …)`, runs on every full load;
  bail on a stable unique id if the button already exists (prevents double buttons). doc-kitty ships
  **no** ViewTransitions router (confirmed 0 hits), so FR-006's "rebind on client nav" is satisfied by
  fresh full-page loads; the defensive `astro:page-load` listener is **inert today** (only a ClientRouter
  emits that event) — keep it, but register it **once at module top-level** (never inside the re-run
  init, or listeners accumulate) and label it "inert until a ClientRouter exists". Guard on
  `.right-sidebar` presence so no button appears on no-TOC/mobile. Button (contract C-3): native
  `<button>`, circular ~2rem, chevron in/out, non-empty `sr-only`/`aria-label`, `title`+`aria-expanded`,
  accent focus ring; **placement** `position:fixed` vertically centered, horizontal anchor = CSS `calc`
  of the rail column width when expanded → `right:0` when collapsed (no JS measurement); mount as a
  sibling of `.right-sidebar-panel`/on `<body>` (not inside the `display:none` panel) so
  `pointer-events:auto` keeps it clickable when the rail is collapsed.

### IC-04 — Integration wiring

- **Purpose**: Wire IC-01/02/03 into the build through existing seams without touching the
  component lock.
- **Relevant requirements**: FR-005 (head), FR-006 (page script), NFR-001
- **Affected surfaces**: `src/lib/config.ts` (append the pre-paint `{tag:'script',content}` to
  `head[]`; add a `tocRailIntegration` with `injectScript('page', …)` mirroring
  `diagramsIntegration`), `src/lib/theme.ts` (`GLOBAL_COMPONENT_SHEETS` += toc-rail.css),
  `src/layouts/DeckLayout.astro` (the `?url` import coupling for the new sheet)
- **Sequencing/depends-on**: IC-01, IC-02, IC-03
- **Risks**: `tocRailIntegration` is appended **unconditionally** to the integrations array
  (only the `injectScript`/hook *mechanics* mirror `diagramsIntegration` — NOT its `diagrams ? [...] : []`
  opt-in gating; D2 = always-on, runtime-gated). `GLOBAL_COMPONENT_SHEETS` is iterated by DeckLayout
  with a build-time `?url` import — a new entry without the matching DeckLayout import **throws at
  build** (self-correcting footgun: the build fails fast, so it cannot ship broken). The sheet
  survives brand token-sheet replacement precisely because it is in this list (not in `theme.css`).

### IC-05 — Tests (unit + interaction + a11y + visual)

- **Purpose**: Cover expand/collapse, persistence (reload + client-nav-equivalent), recenter,
  below-breakpoint absence, and keyboard/`aria-expanded`, all green in CI.
- **Relevant requirements**: FR-004, NFR-003, NFR-004, SC-001..005
- **Affected surfaces**: `src/tests/toc-rail-preference.test.ts`, `tests/a11y/toc-rail.interaction.spec.ts`, `tests/a11y/routes.ts`
- **Sequencing/depends-on**: IC-01..IC-04
- **Risks (post-squad)**: pin the interaction spec to a **named** known-has-TOC route (`home` or
  `guides/getting-started/` — both verified to carry `data-has-toc`+`.right-sidebar` in `example/dist`)
  and add a `guardRoots` entry so it fails loudly, not vacuously, if the page loses its TOC. Assert the
  recenter by **computed `.main-pane` width == full content width**, not just the attribute flip. Split
  vitest: **node** for the 72rem const + pre-paint string shape; **jsdom** for the pre-paint's
  attribute-setting behavior + preference read/write with a throwing-storage stub. Below-breakpoint test
  loads FRESH at <72rem (a resize-down leaves the injected button in the DOM). No-flash gets the
  structural build-HTML assertion (contract C-5), not only a runtime check. The new toggle shifts
  `home-{light,dark}.png` → regenerate via CI `update-a11y-baselines.yml` (cannot regen deterministically
  off the pinned container locally). Confirm NFR-003: no selector/script touches `mobile-starlight-toc`
  or left `nav.sidebar`.

### IC-06 — Docs (chrome behavior note)

- **Purpose**: Briefly document the collapsible-rail chrome behavior in the toolkit
  architecture/authoring notes (behavior only, no convention change).
- **Relevant requirements**: FR-008
- **Affected surfaces**: `docs/architecture/…` (a short note or ADR-style entry)
- **Sequencing/depends-on**: IC-01..IC-04 (documents their result)
- **Risks**: keep it chrome-behavior only; note the four-carrier-lock rationale for the
  client-augmentation approach so a future maintainer doesn't "fix" it into a PageSidebar override.
  **Enumerate the depended-on Starlight internals + pinned version** (upgrade tripwire): the
  `.right-sidebar-container`, `.right-sidebar`, `.right-sidebar-panel`, `.main-pane` selectors, the
  `[data-has-sidebar][data-has-toc] .main-pane` right-bias rule, and the `72rem` breakpoint —
  verified against `@astrojs/starlight@0.32.6`; a Starlight bump must re-verify this list (the
  Playwright gate is the tripwire).
