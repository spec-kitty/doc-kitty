# Post-tasks adversarial squad — M1 metadata model + chrome

**Point-cut**: post-tasks (anti-laziness) · **Mission**: metadata-model-and-chrome-01M0PFQT
**Squad** (bounded, profile-loaded, read-only): reviewer-renata (fakeable DoDs),
paula-patterns (decomposition/ownership), planner-priti (coverage/sequencing).
Verdicts: all three **NO — fold before implement**. Several findings empirically
verified against the live tree. All folded into the WPs, occurrence_map, spec,
plan, and data-model.

## Convergent findings + disposition

1. **[CRITICAL — renata; MED — priti] Depth-1 README glob blindness.** The DoD
   greps, T006 selection, and occurrence-map verification used `'docs/**/*.md'` /
   `'example/docs/**/*.md'`, which git pathspec **excludes** the depth-1
   `docs/README.md` and `example/docs/README.md` (proven: 71+12 vs the true 72+13).
   Both READMEs carry `status: active` + no `kind` — the exact FR-002 in-scope
   pages. WP01 could leave them unmigrated with every plan-level check green (build
   count is the only backstop). **Folded**: WP01 T006 + DoD, WP05 T029, and the
   occurrence-map verification now use depth-inclusive pathspecs, name both READMEs,
   add a positive doc_status+kind check, and correct the count to **85** (72+13).
   spec C-006/C-010 and plan updated 84→85.
2. **[HIGH — paula + priti] Hub `kind→layout` wiring seam.** WP02's map would
   reference `Hub.astro` (nonexistent until WP04) while 6 live `kind: Hub` pages
   exist post-WP01 → WP02 build red; the safe fix (omit Hub) makes WP04 edit
   WP02-owned `kind-layouts.ts` undeclared. **Folded**: WP02 T012 ships an **empty
   Default-only** map (green with Hub pages → Default); WP04 T023 registers the Hub
   key as a **declared recorded out-of-map edit**. data-model.md map note updated.
3. **[HIGH — renata] Token-catalog completeness unverifiable.** Only presence was
   asserted; `theme.css` has zero `--dk-*` today, so "complete" had no ratchet.
   **Folded**: WP05 T027 asserts **every token name** from an enumerated
   `REQUIRED_DK_TOKENS` list (theming.md) — completeness, not presence.
4. **[HIGH — renata] Parity corpus missed the warn-side + related-no-ref.** The
   "observably printed warning" criterion was tested nowhere. **Folded**: WP01 T009
   adds warn-side fixtures (unknown kind/type, mismatch, under-50) with a
   **stdout-message assertion**, plus the related-object-without-ref error fixture.
5. **[HIGH — renata] No `social_thumb` fixture for the 3-branch share test.** No
   example page sets `social_thumb`, so "og:image differs across three branches"
   was un-satisfiable. **Folded**: WP03 T022 re-tags a second page with
   `social_thumb` (recorded out-of-map); WP05 asserts three distinct `og:image`.
6. **[MED — renata] WP03/WP04 chrome verified in prose only** at their own
   boundary. **Folded**: WP03 DoD states WP05 (T027) is the binding machine gate.
7. **[MED — renata] WP05 anti-laziness "any" stub, not per-class.** **Folded**:
   WP05 DoD now requires stub-and-confirm-fail **per assertion class**, recorded in
   acceptance.md.
8. **[MED — renata] AA by-construction + manual checklist absent.** **Folded**:
   WP05 T027 greps the emitted CSS for `≥24px` + `:focus-visible`; T031 adds a
   manual AA contrast checklist.
9. **[MED — priti] NFR-006 unowned.** **Folded**: WP05 T028 adds a lockfile-diff
   check; NFR-006 added to WP05 `requirement_refs`.
10. **[MED — paula/priti] `assert-build-artifacts.mjs` three writers.** Accepted on
    the sequential spine; **folded**: WP05 T030 is now an explicit no-dead/no-dup
    reconciliation gate.
11. **[LOW — renata] `starlightRoute` positive check.** **Folded**: WP02 DoD +
    WP05 assertion now positively require `Astro.locals.starlightRoute`.
12. **[LOW — priti] Traceability refs.** **Folded**: added FR-021/FR-022 to WP01,
    NFR-001 to WP04, NFR-006 to WP05 `requirement_refs`.

## Confirmations (squad validated the design)

- **WP01 atomic cutover is SOUND and correctly not splittable** (paula, priti):
  schema+validator+gating+migration are facets of one contract; splitting breaks
  atomicity or scatters the contract.
- **WP01→WP02 green boundary is CORRECT** (paula, verified vs the assert script):
  WP01 keeps the sitemap assertion well-formedness-only; WP02 lands filter +
  tightened assertion together.
- **Dependency chain otherwise correct**; demonstrators consistent; decoy
  protections sound; full FR/NFR coverage after the NFR-006 fold.

No divergence needed a second-opinion delegate; the three lenses were
complementary. The two independently-verified findings (README glob, Hub seam)
carried the most weight.
