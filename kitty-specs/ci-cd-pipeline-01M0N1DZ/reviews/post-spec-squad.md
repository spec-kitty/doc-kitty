# Post-spec adversarial squad — convergent findings

**Mission**: ci-cd-pipeline-01M0N1DZ · **Point-cut**: post-spec · **Date**: 2026-08-22
**Lenses (read-only, profile-loaded)**: analyst-annie (testability), reviewer-renata
(anti-laziness/fidelity), architect-alphonso (design fidelity/gaps), planner-priti
(scope/sequencing).

Question: does the spec faithfully and completely translate the settled design into
testable, non-fakeable requirements, and what gaps would bite plan/tasks/implement?

## Convergent findings folded into spec.md

| # | Finding | Lenses | Fold |
|---|---------|--------|------|
| 1 | `ci-ok` + ignored-only PR deadlock: a required check that never reports blocks merge forever | all 4 | C-006 + FR-006 (lane-level skips, always-run detect-changes/ci-ok); US2.7; SC-005 |
| 2 | Happy-path-only DoDs; no-op stubs pass the whole surface | Renata, Annie | Failure-path scenarios US2.8–US2.12, US1.5, US4.4; SC-010 |
| 3 | FR-005 glob membership + first-match order dropped; paths-filter is multi-match | all 4 | Change-surface map section (binding oracle); FR-005 rewrite; US2.6 |
| 4 | Deploy "shares the build step with build-example" coupling dropped | Priti, Alphonso | FR-015; US3.1/US3 independent test; SC-007 |
| 5 | `ci-ok` blind to detect-changes failure → false green | Alphonso | FR-012 (depends on detect-changes); US2.12 |
| 6 | Branch-protection config unassigned (design hinges on requiring ci-ok) | Priti | FR-022 + Assumptions |
| 7 | Fork trigger not pinned (`pull_request` vs `pull_request_target`) | Alphonso, Annie | FR-020; US2.14; edge case |
| 8 | Nightly: thresholds, clean-run path, deployment-SHA source, marker perms | Annie, Alphonso | FR-017/018/019; US4.1/4.3/4.4; C-007 |
| 9 | Concurrency invariants had no scenarios | Annie | US3.4 (serialize), NFR-006/007 |
| 10 | US1.4 leaned on CI; local-green must be locally testable | Priti | US1.4 reworded; US1.2/1.3 tightened ("cleanly" defined) |
| 11 | FR-011 "well-formed/shape" undefined; design's "count" dropped | Annie, Renata, Alphonso | FR-011 restores shape+count, pins to today's output; US2.10 |
| 12 | Vale severity gate unspecified | Annie, Alphonso | FR-009 (Vale gated at `error`) |

## Adjudication notes

- None of the folds required a new ADR: each **restores** a design guarantee the
  draft under-specified, or closes a seam consistent with the settled intent
  (C-008 amend-via-ADR therefore not triggered).
- Randy's known duct-tape bias was not in this panel; no averaging was needed —
  all four converged on findings 1–3.
- Lighthouse perf/CWV (design mentions it; brief's locked M0 list omits it):
  resolved in favor of the brief — perf/CWV is explicitly *not* an M0 gate (C-009).

VERDICTS: analyst-annie NOT-handoff-ready→addressed; reviewer-renata REQUEST-CHANGES→addressed;
architect-alphonso fix-before-planning→addressed; planner-priti APPROVE-WITH-CHANGES→addressed.
