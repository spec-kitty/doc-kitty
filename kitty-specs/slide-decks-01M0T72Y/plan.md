# Implementation Plan: Slide Decks (reveal.js)

**Branch**: `feat/slide-decks` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/slide-decks-01M0T72Y/spec.md`

## Summary

M6 builds the presentations renderer: a `docs`-collection Markdown page
(`kind: Presentation`, under `presentations/`) is split at **build time** by a guarded
remark transform into reveal.js slide `<section>`s, served by an **out-of-frame** Astro
route (`src/pages/presentations/[...slug].astro`) that shadows Starlight's catch-all by
path specificity (ADR-0021). Self-hosted `reveal.js@6.0.1` (core + Notes) **enhances**
that server-rendered DOM from a browser-only import; with JS off the sections are a
readable linear fallback (ADR-0022). The deck is themed by a `--dk-*` → `--r-*` mapping
scoped to `.reveal`, discoverable in sitemap/llms/agent/Pagefind (not RSS), and proven
end-to-end by one published example deck. The technical approach is fixed by research
(`research.md`), grounded in the codebase, and hardened by a four-lens post-spec squad
(`reviews/post-spec-squad.md`); the two seam decisions are ADR-0021 and ADR-0022.

## Technical Context

**Language/Version**: TypeScript 5.x on Node ≥22 (ESM); Astro 5 / Starlight; remark/unified (mdast).
**Primary Dependencies**: `reveal.js@6.0.1` (new, self-hosted, core + Notes plugin only; `@types/reveal.js` absent — types bundled). No other new runtime/build dependency.
**Storage**: N/A — static SSG; deck content is Markdown in the `docs` collection under `presentations/`.
**Testing**: vitest (pure transform/directive/note logic, Astro-free); Playwright + `@axe-core/playwright` (a11y both light/dark + a keyboard/reduced-motion interaction test); build-time assertions in `assert-build-artifacts.mjs` / `assert-chrome-artifacts.mjs` (route-uniqueness, reveal-CSS non-leak, Pagefind index, generator↔route URL parity, count pins).
**Target Platform**: Static site (prerendered HTML), modern browsers; no-JS/reduced-motion linear fallback mandatory.
**Project Type**: single (the doc-kitty toolkit `src/` + the `example/` site).
**Performance Goals**: N/A (build-time; the deck route is static). Keep the reveal footprint minimal (core + Notes only).
**Constraints**: `ci-ok` (code-quality, doc-sanity, build-example, a11y) green at every WP boundary (C-007); reveal CSS/JS confined to the deck route (no leak to doc pages, SSR-safe); WCAG 2.2 AA on the deck surface; self-contained, no CDN.
**Scale/Scope**: One new remark transform + one out-of-frame route + one DeckLayout + one reveal theme sheet + generator wiring + one published + one draft example deck + assertions. ~6 implementation concerns.

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Charter present (`.kittify/charter/charter.md`, compact mode). Applicable doctrine and disposition:

- **Settled-design / new-ADR discipline (C-001)** — every genuinely new decision is an ADR. Satisfied: ADR-0021 (routing seam) and ADR-0022 (reveal integration) authored this phase; the one re-opening (ADR-0012's infeasible "anywhere") is chartered and recorded as an amendment in ADR-0021. **PASS.**
- **Supply-chain install safety (DIRECTIVE_051)** — a new dependency (`reveal.js@6.0.1`) is added. Disposition recorded in `research.md` (registry authenticity, freshness, lifecycle-script discipline, Node LTS). **PASS (advisory).**
- **Disciplined refactoring / locality of change** — M6 is almost entirely additive (new files); the few edits to shared code (`metadata.ts` SECTION_ORDER/LABEL, `rss` route exclusion, the two assert scripts) are localized and land atomically with what they protect (C-007). **PASS.**
- **Accessibility-by-construction** — the deck is a hard a11y gate; the plan splits static axe (FR-016/NFR-001) from a Playwright interaction test (FR-021/NFR-007) so keyboard/reduced-motion is actually enforced. **PASS.**
- Not a bulk edit (`meta.json change_mode` unset; new identifiers, not a cross-file rename) — no `occurrence_map.yaml`. **N/A.**

No violations to justify in Complexity Tracking.

## Project Structure

### Documentation (this mission)

```
kitty-specs/slide-decks-01M0T72Y/
├── plan.md              # This file
├── research.md          # Phase 0 — reveal integration, split algorithm, supply-chain, adversarial evidence
├── data-model.md        # Phase 1 — deck/slide/stack/directive/note/route/theme entities
├── quickstart.md        # Phase 1 — how an author writes a deck
├── contracts/           # Phase 1 — transform, deck-route, generator-URL, build-assertion contracts
├── reviews/post-spec-squad.md
└── tasks.md             # Phase 2 (/spec-kitty.tasks — NOT created here)
```

### Source Code (repository root)

```
src/
├── lib/
│   ├── remark/
│   │   ├── deck-split.ts          # NEW: guarded remark transform (kind===Presentation)
│   │   └── deck-split.internal.ts # NEW: pure, Astro-free helpers (grouping, stacks, directives, notes) — vitest target
│   ├── deck/
│   │   └── reveal-init.client.ts  # NEW: browser-only reveal init (core + Notes), reduced-motion, print-gate
│   ├── metadata.ts                # EDIT: add `presentations` to SECTION_ORDER / SECTION_LABEL
│   ├── routes/
│   │   └── rss.ts                 # EDIT: exclude kind: Presentation from the RSS route
│   └── theme.ts / styles/         # EDIT/NEW: --dk-*→--r-* mapping sheet (dk-reveal-theme.css); verify --dk-width-deck + AA pair
├── layouts/
│   └── DeckLayout.astro           # NEW: .reveal > .slides shell, browser-only reveal <script>, pagefind attrs, real <button> controls
├── pages/  (in example/src/pages/)
│   └── presentations/[...slug].astro  # NEW: out-of-frame deck route (getStaticPaths over docs∩Presentation, prerender)
├── scripts/
│   ├── validate-frontmatter.mjs   # EDIT: off-section Presentation = hard error (FR-022); optional expectedType case
│   ├── assert-build-artifacts.mjs # EDIT: count pins; route-uniqueness; URL parity; deck route present
│   └── assert-chrome-artifacts.mjs# EDIT: reveal-CSS non-leak; Pagefind index of deck; speaker-note aside ignored
docs/
├── adr/0021-deck-routing-seam-out-of-frame-override.md   # NEW (authored this phase)
├── adr/0022-reveal-integration-and-token-theme.md        # NEW (authored this phase)
└── architecture/slide-decks.md    # EDIT (docs of record): resolve Open Questions; amend "anywhere"→path+kind
example/docs/presentations/
├── README.md                      # NEW: overview page (kind: Hub) listing published decks
├── <showcase-deck>.md             # NEW: published deck (title/##/###/---/Note:/.slide/.element)
└── <draft-deck>.md                # NEW: doc_status: draft deck (exclusion demonstrator)
tests/
├── unit/ (src/tests/)             # NEW: deck-split.internal vitest suite
└── a11y/routes.ts + axe/interaction specs  # EDIT/NEW: deck route in ROUTES/AXE_PAGES; interaction spec
```

**Structure Decision**: Single toolkit repo (`src/` = the doc-kitty package, `example/` =
the demo site that CI builds and asserts). New logic is added as pure helpers in
`src/lib/remark/` + `src/lib/deck/` (unit-tested Astro-free), one Astro layout, and one
Astro page route in `example/src/pages/`; edits to shared code are localized to the
generator (`metadata.ts`, `rss.ts`), the validator, and the two assert scripts. This
mirrors the M2/M3 pattern (pure resolvers in `lib`, thin `.astro`, gates parity-checked).

## Implementation Concern Map

> Concerns are NOT work packages. `/spec-kitty.tasks` translates these into WPs; the
> Layered-landing note in `spec.md` and the sequencing below guide that split. The
> critical path is largely serial (a deck cannot render until both route and transform
> exist); IC-02 ‖ IC-03 and IC-05 ‖ IC-06 are the only genuine concurrency.

### IC-00 — Gating decision ADRs (done this phase)

- **Purpose**: Author the two seam ADRs before foundation so no seam is decided silently (C-001).
- **Relevant requirements**: FR-020 (ADR half), C-001, C-004.
- **Affected surfaces**: `docs/adr/0021-*.md`, `docs/adr/0022-*.md` (authored in this plan).
- **Sequencing/depends-on**: none — precedes IC-01.
- **Risks**: The ADR-0012 amendment note + `slide-decks.md` edits (docs of record) are an
  implementation task under IC-06, not a blocker for foundation.

### IC-01 — Foundation: route + layout + reveal dep + theme + guardrails

- **Purpose**: Stand up the out-of-frame deck route, the `DeckLayout` shell with browser-only reveal init, the reveal dependency, the `--dk-*`→`--r-*` theme sheet, and the off-section-Presentation error — the substrate every later concern needs, landing green with zero decks.
- **Relevant requirements**: FR-004, FR-005, FR-006, FR-009, FR-022; C-003, C-004, C-006, C-009; + verify/add `--dk-width-deck` and confirm the deck bg/text `--dk-*` pair is AA (pre-empts the M3 `--dk-color-tint-lilac` late failure).
- **Affected surfaces**: `example/src/pages/presentations/[...slug].astro`, `src/layouts/DeckLayout.astro`, `src/lib/deck/reveal-init.client.ts`, the reveal theme sheet, `package.json`/lockfile, `src/scripts/validate-frontmatter.mjs`.
- **Sequencing/depends-on**: IC-00.
- **Risks**: SSR-safety (top-level reveal import crashes build) and the route-override shadowing are only *verified* once a deck renders — land a minimal fixture deck here, or track the risk to IC-04's boundary.

### IC-02 — Split transform + directives + notes (pure, unit-tested)

- **Purpose**: The single guarded remark transform (title slide, `##` horizontal, `###` vertical stack, `---` headingless+`aria-label`, `.slide`/`.element` directives, `Note:` asides, unknown→warn) with its Astro-free vitest suite.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-007, FR-008, FR-018; NFR-005; C-002, C-005.
- **Affected surfaces**: `src/lib/remark/deck-split.ts`, `src/lib/remark/deck-split.internal.ts`, remark chain registration, `src/tests/deck-split*.test.ts`.
- **Sequencing/depends-on**: IC-01 (the section-node contract the layout expects). Runs ‖ IC-03.
- **Risks**: The horizontal→vertical-stack conversion (outer section contains only inner sections) is the fiddly rule; thematicBreak must be consumed only on decks (scope guard).

### IC-03 — Discovery wiring (before the deck)

- **Purpose**: Wire discovery so a deck lands into correctly configured surfaces: exclude `kind: Presentation` from RSS, add `presentations` to `SECTION_ORDER`/`SECTION_LABEL`. Inert on an empty section → green.
- **Relevant requirements**: FR-011; SC-005.
- **Affected surfaces**: `src/lib/routes/rss.ts`, `src/lib/metadata.ts` (:144-173).
- **Sequencing/depends-on**: IC-01. Runs ‖ IC-02. **Must precede IC-04** so the count pins compute once and nothing leaks to RSS (squad P-01).
- **Risks**: Key the RSS exclusion on frontmatter `kind`, not section path (robust regardless of file location; squad A-05).

### IC-04 — Published deck + overview + pins + build assertions (atomic)

- **Purpose**: Land the published showcase deck **and** the overview Hub (both move counts) under **one** count recompute, plus the retained draft deck, plus the route-uniqueness / reveal-CSS-non-leak / Pagefind-index / URL-parity assertions.
- **Relevant requirements**: FR-010, FR-012, FR-014, FR-015, FR-017, FR-019, FR-023; SC-004, SC-005; C-007.
- **Affected surfaces**: `example/docs/presentations/{README.md, <deck>.md, <draft-deck>.md}`, `src/scripts/assert-build-artifacts.mjs`, `src/scripts/assert-chrome-artifacts.mjs`.
- **Sequencing/depends-on**: IC-01, IC-02, IC-03. **All count-pin-affecting published pages land here** (squad P-02).
- **Risks**: doc-sanity on deck syntax (repeated `---`/MD035, HTML-comment directives, `Note:`) — author within rules or scope `presentations/` lint/Vale exceptions in this concern (FR-019). a11y stays green because the deck is not yet in `AXE_PAGES`.

### IC-05 — Deck a11y (static axe + interaction test)

- **Purpose**: Add the deck to `ROUTES`/`AXE_PAGES` (axe both modes) and add the Playwright interaction test (keyboard/trap/visible-focus/reduced-motion) — the enforcement axe cannot provide.
- **Relevant requirements**: FR-016, FR-021; NFR-001, NFR-003, NFR-007.
- **Affected surfaces**: `tests/a11y/routes.ts`, a new interaction spec, axe config.
- **Sequencing/depends-on**: IC-04. Runs ‖ IC-06.
- **Risks**: reveal's client enhancement vs. the lane's static-`dist` + reduced-motion posture; assert computed `transition-duration: 0s` under emulated reduced motion.

### IC-06 — Print + docs of record

- **Purpose**: The `?print-pdf` bundled/gated stylesheet, and the docs-of-record resolution — `architecture/slide-decks.md` Open Questions resolved in place and the ADR-0012 "anywhere"→path+kind amendment note.
- **Relevant requirements**: FR-013, FR-020 (docs half).
- **Affected surfaces**: `src/lib/deck/reveal-init.client.ts` (print gate), `docs/architecture/slide-decks.md`, `docs/adr/0012-*.md` (superseded-in-part note).
- **Sequencing/depends-on**: IC-04. Runs ‖ IC-05.
- **Risks**: Editing an Accepted ADR (0012) — use a Status "amended by ADR-0021" pointer, not a rewrite of the decision body (immutable-ADR discipline).
