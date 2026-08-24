# Post-spec adversarial squad — M6 Slide Decks

Four profile-loaded, read-only lenses reviewed spec rev 1 in parallel. All findings
were folded into **rev 2**. Verdicts: architecture CONDITIONAL, quality
remediate-then-ship, decomposition remediate-then-ship, terminology ship-after-tighten.

## architect-alphonso — architectural soundness (routing seam)

- **A-01 (BLOCKER)** — ADR-0012's "a Presentation page **anywhere** routes to the
  deck renderer" is architecturally infeasible: Starlight owns a single `[...slug]`
  catch-all, and the only clean out-of-frame mechanism is a path-prefixed
  higher-specificity route (`src/pages/presentations/[...slug].astro`) that shadows
  Starlight only under `/presentations/*`. **Fix:** narrow the switch to **path+kind**,
  amend ADR-0012 decision 1 + `slide-decks.md:39-40` this mission (FR-020), and make a
  `kind: Presentation` filed off-section a hard error (FR-022).
- **A-02 (MAJOR)** — "Starlight-exclusion" is a misframing; Starlight has no API to
  drop an entry. The deck wins by **Astro route-override shadowing**, not removal.
  **Fix:** reword FR-004/C-004; assert one HTML at the deck URL contains `.reveal >
  .slides`, not the Starlight shell (FR-017).
- **A-03 (MAJOR)** — generator↔route URL parity assumed, never enforced (llms/agent
  build URLs from the collection slug on a different path than the deck route).
  **Fix:** assert the listed URL is byte-identical to the emitted deck path (FR-017);
  ADR-0021 fixes the trailing-slash/base contract.
- **A-04..A-07 (MINOR)** — sidebar decision (exclude presentations from in-frame
  sidebar → ADR-0021); RSS exclusion keyed on `kind` not path (FR-011); reveal
  **core** sheet isolation, not just the map (FR-010); SSR init contract recorded in
  ADR-0022.

## reviewer-renata — requirement quality / testability

- **R-01 (BLOCKER)** — FR-016 credited the axe lane with keyboard/trap/reduced-motion
  verification axe cannot perform. **Fix:** new Playwright **interaction** test
  (FR-021/NFR-007); FR-016/NFR-001 narrowed to axe's real checks.
- **R-02 (MAJOR)** — reveal controls/progress/slide-number are injected client-side,
  absent from static `dist`; asserting their text "not indexed" is vacuous. **Fix:**
  narrow FR-012 to the speaker-note `<aside class="notes">` (the only build-present
  chrome inside `.slides`).
- **R-03 (MAJOR)** — draft-deck exclusion (US5.4) untestable while the draft deck was
  optional. **Fix:** mandate a retained draft-deck fixture (FR-023), cross-checked not
  to move the count pins.
- **R-04 (MAJOR)** — FR-001 never mandated **emitting** the `aria-label` on headingless
  slides; a to-the-letter impl fails its own axe test. **Fix:** added to FR-001/US1.3.
- **R-05..R-09 (MINOR)** — print verifiability (FR-013); markdownlint/Vale deck-syntax
  scoping (FR-019); size-aware AA contrast (NFR-001); reveal-chunk identification
  (FR-010); route-uniqueness assertion (FR-017).

## planner-priti — decomposition / sequencing

- **P-01 (BLOCKER)** — discovery wiring (FR-011) was sequenced **after** the deck it
  configures, forcing a double-pin or an RSS leak. **Fix:** land FR-011 **before** the
  deck (inert on an empty section); pins compute once.
- **P-02 (BLOCKER)** — the overview Hub (FR-014) is a published page that moves the
  count pins; scheduling it after the pin step reds `build-example`. **Fix:** co-land
  it **with** the deck under one recompute (as M3 did its Audiences hub).
- **P-03..P-05 (MAJOR)** — split FR-020 (decision ADRs 0021/0022 gate foundation; only
  slide-decks.md open-question resolution is last); split the a11y verification into
  its own WP after the deck (unscanned ≠ red keeps C-007 legal); verify `--dk-width-deck`
  + AA deck pair in foundation (the M3 `--dk-color-tint-lilac` lesson).
- Suggested 6-WP shape (adopted into the Layered-landing note): ADR gate → foundation
  → transform ‖ discovery → deck+overview+pins → a11y ‖ print/docs.

## lexical-larry — terminology

- **L-01 (MINOR)** — bare "controls" overloaded → **authoring controls** vs
  **navigation controls**.
- **L-02 (MINOR)** — `###` = **vertical slide** (inner); **vertical stack** = the outer
  container. Locked in FR-002/Key Entities/Domain Language.
- **L-03..L-05** — deck vs Presentation vs presentations/; three-cascade and "enhance"
  discipline. **Fix:** added a **Domain Language** section (pasted from Larry's proposal).
