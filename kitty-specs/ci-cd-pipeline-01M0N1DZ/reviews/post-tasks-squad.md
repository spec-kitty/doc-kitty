# Post-tasks adversarial squad — convergent findings

**Mission**: ci-cd-pipeline-01M0N1DZ · **Point-cut**: post-tasks · **Date**: 2026-08-22
**Lenses (read-only, profile-loaded)**: reviewer-renata (fakeable DoD), planner-priti
(decomposition/ownership), architect-alphonso (cross-WP seams).

## Convergent findings folded

| # | Finding | Lenses | Fold |
|---|---------|--------|------|
| 1 | No WP owns end-to-end acceptance (SC-001..010 never closed in-mission) | Priti, Renata | New **WP08** (acceptance & activation): offline-provable checks owned + executed; live checks a documented post-activation checklist |
| 2 | ci-ok + classifier negative proofs "reasoned", not committed | Renata | WP04 T019/T023/T025: extract classifier first-match + ci-ok decision into committed, table-tested helper scripts (`.github/scripts/**`) |
| 3 | Shared build action: no contract, missing `checkout`, assert-location deferred | Alphonso, Priti | New `contracts/build-example-action.contract.md`; composite = pure build; assert in build-example **job** (deploy never inherits it); WP04/WP05 add checkout |
| 4 | Change-surface globs duplicated in ci.yml + deploy.yml (drift/split-brain) | Alphonso, Priti | Extract `.github/filters.yml` owned by WP04, referenced by WP05 |
| 5 | `check-links` has no registered pnpm script | Alphonso | WP01 T003 adds `validate:links`; WP04 T021 calls `pnpm validate:links` |
| 6 | WP07 missing WP02 dependency (needs its validators) | Priti | WP07 dependencies += WP02 |
| 7 | WP05 missing SHA-pin guidance | Alphonso | WP05 T026 pins `dorny/paths-filter` to same SHA; reviewer line |
| 8 | WP01 test non-triviality self-graded | Renata | WP01 T005 adds a mutation-probe floor (mutate a route handler → a named test must fail) |
| 9 | WP03 pinned index count self-selected | Renata | WP03 T015 cross-checks count against an independent countable source |
| 10 | `ci-ok` required-check string not pinned | Alphonso | WP04 T023 pins job id = `ci-ok` (no divergent `name:`); WP07 documents that string |
| 11 | XML/link parsing needs a dep WP01 didn't provision | Priti | WP02 T009 / WP03 T014: zero new deps — string-level well-formedness |
| 12 | FR-020 nightly clause unreferenced on WP06 | Priti | WP06 requirement_refs += FR-020 |

## PASS (confirmed closed, not changed)

- ci-ok always()-false-green and detect-changes-failure seam is genuinely closed
  (detect-changes in `needs`, explicit result check, no bare `always()+exit0`) — Alphonso.
- Ownership disjoint, FR/IC coverage complete, DAG acyclic, WP sizes 3–7 — Priti.

## Adjudication

- All folds either restore fidelity, close a real cross-WP seam, or make a DoD
  non-fakeable — none re-open a settled decision; no new ADR triggered.
- WP08 honestly separates offline-provable acceptance (owned + run in-mission) from
  intrinsically-live acceptance (throwaway PRs, real deploy, first nightly), which
  requires branch protection + a live deployment and is a documented post-merge step.

VERDICTS: renata REQUEST-CHANGES(WP04)→addressed; priti sound-but-ship-blocked→addressed;
alphonso address-1..5→addressed.
