# Tasks: Reveal-deck remediation (#12 / #15)

**Branch**: `fix/reveal-deck-remediation` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

6 work packages remediating the shipped M6 slide-deck feature: the #15 slide-aware
render engine (WP01), the #12 chrome + wiring + theme CSS (WP02), the #12 title-slide
metadata suppression (WP03), the example deck fixtures + build-count pins (WP04), the
non-fakeable behaviour lock (WP05), and the #12 QOL hub guidance (WP06). The deck
architecture (client-side Mermaid, reveal.js 6.0.1 pinned, out-of-frame route) is
preserved unchanged — this is a bounded remediation, not a redesign. Verification is
DOM/behaviour assertions in the Playwright deck suite only (C-001); no visual/a11y
snapshot baseline is added or regenerated.

The single coordination point three files must agree on is the **`DeckController`
facade** (WP01 authors it; WP02 consumes it). Everything else is file-disjoint and
parallelizable.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | `DeckController` facade in `reveal-init` (`onSlideChange`/`isPrintView`/`currentSlide`), NOT raw Reveal; single print-state owner | WP01 | [P] |
| T002 | Parameterize `render(scope)` in `diagram-render`; keep the SINGLE `mermaid.run` call site + whole-document footprint guard | WP01 | |
| T003 | Deck-mode driver: ready-render of `currentSlide()` (hash deep-link, not slide 1) + `onSlideChange` per-slide render + `data-processed` skip | WP01 | |
| T004 | `print-pdf` all-nodes one-pass driven by `controller.isPrintView`; preserve in-flight coalescing guard | WP01 | |
| T005 | Theme observer scoped to the RENDERED/VISITED set (INV-SCOPE, never `allCachedNodes`); update reveal-init header comment (IC-07/DIRECTIVE_037) | WP01 | |
| T006 | EMPIRICALLY confirm C6/R4: transparent-viewport (token-map non-resolution) vs underdeveloped-rules, against the built deck, BEFORE writing CSS | WP02 | |
| T007 | Add `<footer class="dk-deck-footer">` (sibling of `main.reveal`) carrying the deck title (IC-03) | WP02 | |
| T008 | Wire `initDeck()→controller→initDiagrams(controller)` as a PURE wire (no slide state); preserve `.reveal.ready` gate + `.finally` fallback | WP02 | |
| T009 | Fill `dk-reveal-theme.css` look rules ONLY (hero height, slide/list/code, footer band, brand-token resolution); preserve the BA-4 sentinel line | WP02 | |
| T010 | Drop the description paragraph from `titleChildren()`; keep description as `<meta>` only | WP03 | [P] |
| T011 | Fix `deck-split.test.ts`: remove the description assertion AND the positional hero index `title.children[2]→[1]` (finding D1) | WP03 | |
| T012 | Add a POSITIVE unit assertion: no title-slide paragraph equals the `description` | WP03 | |
| T013 | Add a diagram to a NON-first horizontal slide (slide 2) with a DISTINGUISHABLE identity (C2); preserve the quokka/armadillo BA-5 sentinels | WP04 | [P] |
| T014 | Add a diagram to an INNER-STACK (vertical) slide with a distinguishable identity (D5) | WP04 | |
| T015 | Create a diagram-free PUBLISHED deck fixture `roadmap-deck.md` for the NFR-002 footprint test (C7) | WP04 | |
| T016 | Bump `EXPECTED_INDEX_ENTRY_COUNT` + `EXPECTED_SITEMAP_URL_COUNT` 25→26 + update the derivation comment (atomic, BA-1) | WP04 | |
| T017 | FR-002 Playwright: `description` present in `head meta`, ABSENT from `.slides` text | WP05 | |
| T018 | FR-003 Playwright: `.dk-deck-footer` `toBeVisible()` + non-empty text CONTAINS `entry.data.title` + top-edge geometry + stable across nav | WP05 | |
| T019 | FR-004: navigate to the distinguishable non-first node → box>0 AND sane geometry (C1); vertical-nested (D5); PROVE RED pre-fix | WP05 | |
| T020 | FR-004 print-pdf completeness: `?print-pdf` → EVERY `pre.mermaid` (title+non-first+inner) has box>0 in one pass (C3) | WP05 | |
| T021 | FR-005: away-and-back one `<svg>`; theme-toggle palette-change (C4, not the weak twin); toggle-while-unvisited then navigate (B3); rapid-nav coalesce (E3) | WP05 | |
| T022 | NFR-002 MANDATORY network assertion: on `roadmap-deck` 0 request URLs match `/mermaid/i`; add its route constant to `routes.ts` | WP05 | |
| T023 | FR-001 promoted computed-style token assertions (C6): bg/heading/font/footer-surface equal resolved `--dk-*`; hero ≤ stage height | WP05 | |
| T024 | `routes.ts` housekeeping: keep deck `renderCount:1` (D2); update `slideSentinels` only if slide structure changed (D6) | WP05 | |
| T025 | Purpose banner on the presentations hub (README body, living docs) explaining what the hosted decks are | WP06 | [P] |
| T026 | "How to use": vertical-slide nav + reveal hotkeys (`Esc`/`S`/`F`/arrows/space) + PDF export via print dialog incl. background-graphics | WP06 | |
| T027 | New `tests/a11y/presentations-hub.spec.ts`: cheap DOM `toContainText` for the banner + its three topics (E2); reuse the existing hub route read-only | WP06 | |

## Work Packages

### WP01 — Slide-aware diagram render engine  *(~380 lines)*
- **Goal**: Make a diagram on slide 2+ render correctly when its slide first becomes
  active, exactly once, without a second `mermaid.run`. Author the narrow
  `DeckController` facade and the per-slide render *scope*.
- **Priority**: P1 (root — the #15 mechanism; highest-complexity concern IC-04).
- **Depends on**: none.
- **Independent test**: the deck suite's FR-004/FR-005 cases (WP05) exercise it live;
  at this WP's own boundary, `typecheck` + `eslint` + `vitest` stay green and the
  built deck renders a slide-2 diagram on navigation (manual/quickstart).
- **Subtasks**: T001–T005. **Prompt**: [tasks/WP01-slide-aware-render-engine.md](./tasks/WP01-slide-aware-render-engine.md)
- **requirement_refs**: FR-004, FR-005, NFR-001, NFR-002

### WP02 — Deck chrome + wiring + theme CSS  *(~340 lines)*
- **Goal**: Add the missing footer, wire the controller into the render owner as a
  pure wire, and fill the theme look-rule gaps so the deck is presentable — after
  first confirming the real CSS root cause (transparent-viewport vs thin rules).
- **Priority**: P1 (the #12 "first thing an adopter sees" defects).
- **Depends on**: WP01 (consumes `DeckController` + the `initDiagrams(controller)` signature).
- **Independent test**: built deck shows a positioned footer with the deck title and
  branded styling (manual + WP05 computed-style + geometry assertions); `ci-ok` green.
- **Subtasks**: T006–T009. **Prompt**: [tasks/WP02-deck-chrome-wiring-theme.md](./tasks/WP02-deck-chrome-wiring-theme.md)
- **requirement_refs**: FR-001, FR-003, NFR-003, NFR-004

### WP03 — Title-slide metadata suppression  *(~150 lines)*
- **Goal**: Stop the front-matter `description` appearing as title-slide body text
  while keeping it as page metadata; update the coupled unit tests in the same change.
- **Priority**: P1 (#12b).
- **Depends on**: none.
- **Independent test**: `vitest` — `splitDeck` on a deck with a `description` produces
  a title slide whose children include NO paragraph equal to the description, and the
  hero image is still located (at the corrected positional index).
- **Subtasks**: T010–T012. **Prompt**: [tasks/WP03-title-metadata-suppression.md](./tasks/WP03-title-metadata-suppression.md)
- **requirement_refs**: FR-002

### WP04 — Deck example fixtures + build-count pins  *(~180 lines)*
- **Goal**: Provide the FR-004 render targets (a non-first + an inner-stack diagram
  with distinguishable identities) and the NFR-002 diagram-free PUBLISHED deck, and
  keep the build-count gate green atomically.
- **Priority**: P1 (fixtures gate WP05's non-fakeable assertions).
- **Depends on**: none (but WP05 consumes these).
- **Independent test**: `assert:artifacts` / `build-example` green with the bumped
  count pins; the built showcase deck shows the two new diagram nodes; the
  `roadmap-deck` route builds and is diagram-free.
- **Subtasks**: T013–T016. **Prompt**: [tasks/WP04-deck-example-fixtures.md](./tasks/WP04-deck-example-fixtures.md)
- **requirement_refs**: FR-004, NFR-002

### WP05 — Behaviour assertions (the non-fakeable lock)  *(~420 lines)*
- **Goal**: Lock #12/#15 with DOM/behaviour assertions in the Playwright deck suite,
  every mandatory-per-squad assertion, no snapshot baselines (C-001). FR-001 is
  promoted into the FR-008 locked set.
- **Priority**: P1 (FR-008 + the regression gate for every fix).
- **Depends on**: WP01, WP02, WP03, WP04 (asserts their behaviour; needs the fixtures).
- **Independent test**: the full a11y lane green with the new assertions; the FR-004
  test proven RED against the pre-fix build (recorded in the WP note).
- **Subtasks**: T017–T024. **Prompt**: [tasks/WP05-behaviour-assertions.md](./tasks/WP05-behaviour-assertions.md)
- **requirement_refs**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-008, NFR-001, NFR-002, NFR-004

### WP06 — Presentations-hub instructional banner + how-to  *(~200 lines)*
- **Goal**: Give first-time readers on-page guidance to operate and export the hosted
  decks (vertical nav, reveal hotkeys, PDF export), plus a cheap DOM test so SC-004 is
  not purely manual.
- **Priority**: P2 (#12 QOL — valuable but secondary to the rendering defects).
- **Depends on**: none.
- **Independent test**: the new `presentations-hub.spec.ts` asserts the banner and its
  three topics are present via `toContainText`.
- **Subtasks**: T025–T027. **Prompt**: [tasks/WP06-hub-instructional-banner.md](./tasks/WP06-hub-instructional-banner.md)
- **requirement_refs**: FR-006, FR-007

## Dependencies

```
WP01 ──► WP02 ──┐
WP03 ───────────┤
WP04 ───────────┼──► WP05
                │
WP06 (independent, any time)
```

- **WP01, WP03, WP04, WP06** have no dependencies — all four may start in parallel.
- **WP02** starts once WP01's `DeckController` + `initDiagrams(controller)` signature exist.
- **WP05** is terminal — it asserts the behaviour of WP01+WP02+WP03 and consumes WP04's fixtures.

## Parallelization

| Wave | Runs in parallel |
|------|------------------|
| Wave 1 | WP01, WP03, WP04, WP06 |
| Wave 2 | WP02 (after WP01) |
| Wave 3 | WP05 (after WP01, WP02, WP03, WP04) |

## Requirement coverage

Every FR-001..FR-008 maps to ≥1 WP (behaviour is locked in WP05):

| Requirement | Owning WP(s) |
|---|---|
| FR-001 Deck theme CSS applies | WP02 (mechanism), WP05 (computed-style lock) |
| FR-002 No description on slides | WP03 (transform), WP05 (Playwright lock) |
| FR-003 Footer renders | WP02 (element+CSS), WP05 (geometry lock) |
| FR-004 Diagrams on non-first slides | WP01 (render), WP04 (fixtures), WP05 (lock) |
| FR-005 Exactly one render per diagram | WP01 (INV-SCOPE), WP05 (lock) |
| FR-006 Hub instructional banner | WP06 |
| FR-007 "How to use" content | WP06 |
| FR-008 Behaviour assertions | WP05 |
| NFR-001 Zero mis-rendered diagrams | WP01, WP05 |
| NFR-002 Single loop / footprint | WP01, WP04, WP05 |
| NFR-003 Deck CSS route-scoped | WP02 |
| NFR-004 A11y stays green | WP02, WP05, WP06 |

## Ownership map (file-disjoint — finalize-tasks validates)

| WP | owned_files |
|----|-------------|
| WP01 | `src/lib/deck/reveal-init.client.ts`, `src/lib/diagram/diagram-render.client.ts` |
| WP02 | `src/layouts/DeckLayout.astro`, `src/styles/dk-reveal-theme.css` |
| WP03 | `src/lib/remark/deck-split.internal.ts`, `src/lib/remark/deck-split.ts`, `src/tests/deck-split.test.ts` |
| WP04 | `example/docs/presentations/showcase-deck.md`, `example/docs/presentations/roadmap-deck.md` (NEW), `src/scripts/assert-build-artifacts.mjs` |
| WP05 | `tests/a11y/deck.interaction.spec.ts`, `tests/a11y/diagram.spec.ts`, `tests/a11y/routes.ts` |
| WP06 | `example/docs/presentations/README.md`, `tests/a11y/presentations-hub.spec.ts` (NEW) |

No two WPs share any glob. WP04 owning `assert-build-artifacts.mjs` keeps the
count-pin bump atomic with the new published deck (BA-1). WP06 reads `routes.ts`
(read-only import of `BASE`) but does NOT own or edit it — WP05 owns it.
