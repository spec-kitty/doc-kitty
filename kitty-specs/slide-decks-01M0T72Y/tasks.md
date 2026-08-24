# Tasks: Slide Decks (reveal.js) — M6

**Mission**: `slide-decks-01M0T72Y` | **Branch**: `feat/slide-decks` | **Merge target**: `feat/slide-decks`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Squads**: [post-spec](./reviews/post-spec-squad.md) · [post-tasks](./reviews/post-tasks-squad.md)

> Rev 2 (post-tasks squad): sidebar D5 now owned (WP04 T028), URL-parity via a shared
> `deckSlug` helper, config.ts remark seam is net-new plumbing, print/CSS-signature/no-JS-axe
> assertions made buildable, BA-8 proven by unit test, draft-deck Pagefind leak closed.

Six work packages, mapping the plan's Implementation Concern Map. The critical path is
largely **serial** (a deck cannot render until both the route and the transform exist);
**WP02 ‖ WP03** and **WP05 ‖ WP06** are the only genuine concurrency. Gating ADRs
(0021 routing, 0022 reveal integration) were authored in the plan phase.

```
WP01 foundation ──┬── WP02 transform ────┐
                  └── WP03 discovery ─────┤
                                          ├── WP04 deck+overview+pins+assertions ──┬── WP05 a11y
                                          │                                        └── WP06 print/docs
                       (WP02 ‖ WP03)                                                  (WP05 ‖ WP06)
```

Every WP boundary keeps `ci-ok` green (C-007): foundation emits zero decks (a11y
unscanned); transform + discovery are inert on an empty section; the published deck +
overview + count-pin recompute land **together**; the deck enters `AXE_PAGES` only in WP05.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Add `reveal.js@6.0.1` (self-hosted, no `@types`), verify no install scripts | WP01 | |
| T002 | Out-of-frame deck route `presentations/[...slug].astro` (path-scoped override) | WP01 | |
| T003 | `DeckLayout.astro` shell (`.reveal>.slides`, `<button>` controls, `data-pagefind-body`, reveal `<script>`) | WP01 | |
| T004 | `reveal-init.client.ts` (core+Notes, reduced-motion, `?print-pdf` gate) | WP01 | |
| T005 | `dk-reveal-theme.css` (`--r-*: var(--dk-*)` scoped `.reveal`); verify `--dk-width-deck` + AA pair | WP01 | |
| T006 | Validator: off-section `Presentation` = hard error (+ optional `expectedType` case) | WP01 | |
| T007 | Draft demonstrator deck (smoke-tests the route at foundation; FR-023 fixture) | WP01 | |
| T008 | Remark plugin scaffold + `kind==='Presentation'` guard + chain registration | WP02 | [P] |
| T009 | Pure grouping: title / `##` / `###` stack / `---`+`aria-label` / `####` in-slide | WP02 | [P] |
| T010 | Directive parsing: `.slide` / `.element` / unknown→warn / no-sibling→warn | WP02 | [P] |
| T011 | `Note:` → `<aside class="notes" data-pagefind-ignore>` direct child | WP02 | [P] |
| T012 | vitest suite (full matrix incl. non-Presentation guard) | WP02 | [P] |
| T013 | RSS: exclude `kind: Presentation` from the feed | WP03 | [P] |
| T014 | `metadata.ts`: add `presentations` to `SECTION_ORDER` / `SECTION_LABEL` | WP03 | [P] |
| T015 | vitest: `sectionRank`/label covers `presentations` (inert-on-empty proof) | WP03 | [P] |
| T016 | Published showcase deck (title/`##`/`###`/`---`/`Note:`/`.slide`/`.element`) | WP04 | |
| T017 | Overview page `README.md` (`kind: Hub`, lists published decks + `?print-pdf`) | WP04 | |
| T018 | Recompute `EXPECTED_INDEX_ENTRY_COUNT` + `EXPECTED_SITEMAP_URL_COUNT` (deck+overview), cross-check | WP04 | |
| T019 | build assertions: route-uniqueness, URL parity, RSS-absent, draft-absent+no-pin-move, print gated | WP04 | |
| T020 | chrome assertions: reveal-CSS non-leak (core+map), Pagefind deck indexed + note aside not | WP04 | |
| T021 | doc-sanity: deck passes markdownlint/Vale (path-scoped `presentations/` exceptions, rule IDs recorded) | WP04 | |
| T028 | Suppress deck's in-frame sidebar node (ADR-0021 D5) + assert absent from sidebar nav | WP04 | |
| T022 | Add deck route to `tests/a11y/routes.ts` `ROUTES` + `AXE_PAGES` (both modes) | WP05 | |
| T023 | Axe passes: section names, `<button>` labels, one region, AA size-aware contrast | WP05 | |
| T024 | Playwright interaction: keyboard reach / no-trap / visible focus | WP05 | |
| T025 | Interaction: reduced-motion `transition-duration:0s`; no-JS all-text-present | WP05 | |
| T026 | Resolve `slide-decks.md` Open Questions; amend "anywhere"→path+kind | WP06 | [P] |
| T027 | ADR-0012 superseded-in-part pointer (Status: amended by ADR-0021) | WP06 | [P] |

## Work Packages

### WP01 — Foundation: deck route, layout, reveal, theme, guardrails

- **Goal**: Stand up the out-of-frame route, the `DeckLayout` shell + browser-only reveal init, the reveal dependency, the `--dk-*`→`--r-*` theme, the off-section-error validator, and a draft demonstrator deck that smoke-tests the route — landing green with no published deck.
- **Priority**: P1 (foundation). **Independent test**: build the example; the route renders the draft demonstrator as `.reveal>.slides` out-of-frame; all four lanes green; a11y unscanned; reveal CSS/JS absent from doc pages.
- **Subtasks**: T001, T002, T003, T004, T005, T006, T007
- **Dependencies**: none (ADR-0021/0022 authored in plan). **Est.**: ~340 lines.
- **Risks**: SSR-safety (top-level reveal import crashes build) and route-override shadowing are verified once the draft deck renders here (P-08 discharged).

### WP02 — Split transform + directives + notes (pure, unit-tested)

- **Goal**: The single guarded remark transform and its Astro-free vitest suite.
- **Priority**: P1. **Independent test**: vitest matrix green; a non-Presentation page is untouched (`---`→`<hr>`).
- **Subtasks**: T008, T009, T010, T011, T012
- **Dependencies**: WP01 (section-node contract the layout consumes). Runs ‖ WP03. **Est.**: ~320 lines.
- **Risks**: the horizontal→vertical-stack conversion (outer contains only inner sections); consume `---` only on decks.

### WP03 — Discovery wiring (before the deck)

- **Goal**: Exclude `kind: Presentation` from RSS; label `presentations` in llms/agent grouping — so the deck later lands into pre-configured surfaces and the count pins compute once.
- **Priority**: P1. **Independent test**: unit tests green; inert with an empty `presentations/` section.
- **Subtasks**: T013, T014, T015
- **Dependencies**: none (touches only `rss.ts` + `metadata.ts`). Runs ‖ WP01/WP02. **Must precede WP04** — enforced because WP04 depends on WP03 (squad P-01/PT-07). **Est.**: ~180 lines.
- **Risks**: key the RSS exclusion on frontmatter `kind`, not section path (A-05).

### WP04 — Published deck + overview + pins + build assertions (atomic)

- **Goal**: Land the published showcase deck **and** the overview Hub under **one** count recompute, plus all the build/chrome assertions that discharge the routing/search risks.
- **Priority**: P1. **Independent test**: `build-example` + `doc-sanity` green with the published deck live; every assertion (BA-1..BA-8) passes; a11y still green (deck not yet in `AXE_PAGES`).
- **Subtasks**: T016, T017, T018, T019, T020, T021, T028
- **Dependencies**: WP01, WP02, WP03. **All count-pin-affecting published pages land here** (P-02); owns the ADR-0021 D5 sidebar suppression (T028). **Est.**: ~470 lines.
- **Risks**: doc-sanity on deck syntax — author within rules or scope `presentations/` lint/Vale exceptions here (FR-019).

### WP05 — Deck a11y (static axe + interaction test)

- **Goal**: Scan the deck with axe (both modes) and add the Playwright interaction test axe cannot provide.
- **Priority**: P1. **Independent test**: axe clean light+dark; interaction test proves keyboard reach, no trap, visible focus, reduced-motion `0s`, and no-JS text presence.
- **Subtasks**: T022, T023, T024, T025
- **Dependencies**: WP04. Runs ‖ WP06. **Est.**: ~300 lines.
- **Risks**: reveal's client enhancement vs. the lane's static-`dist` + reduced-motion posture.

### WP06 — Print + docs of record

- **Goal**: Resolve `architecture/slide-decks.md`'s Open Questions in place and record the ADR-0012 "anywhere"→path+kind amendment. (The `?print-pdf` gate ships in WP01's `reveal-init`; its assertion is in WP04.)
- **Priority**: P2. **Independent test**: doc-sanity green over the edited docs; ADR-0012 carries the amendment pointer; slide-decks.md Open Questions are resolved.
- **Subtasks**: T026, T027
- **Dependencies**: WP04. Runs ‖ WP05. **Est.**: ~150 lines.
- **Risks**: ADR-0012 is Accepted — use a Status "amended by ADR-0021" pointer, not a decision-body rewrite (immutable-ADR discipline).
