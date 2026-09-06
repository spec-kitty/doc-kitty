---
schema_version: 1
artifact_type: spec-kitty.analysis-report
command: /spec-kitty.analyze
mission_slug: markua-decks-01M1TTMB
mission_id: 01M1TTMBDJKYDDJHRX56CTAWEM
generated_at: '2026-09-06T08:08:29.088634+00:00'
analyzer_agent: unknown
input_artifacts:
  spec.md:
    path: kitty-specs/markua-decks-01M1TTMB/spec.md
    sha256: 657253e4d7f83a984338c457266c6d63e2223eefc2622c755cb918e8d5e72a47
  plan.md:
    path: kitty-specs/markua-decks-01M1TTMB/plan.md
    sha256: a5b4653cb9c63363b1a5c1416760c95f5ac0252eb29a022de46e82863de070d0
  tasks.md:
    path: kitty-specs/markua-decks-01M1TTMB/tasks.md
    sha256: ab3c2f2c3aeccb7eef99f608f10144604b5ff2a32aaecaa84ddf6a0a4e21b90a
  charter:
    path: .kittify/charter/charter.yaml
    sha256: 4dfc1be02167adb7fc10cce16eac90d0e6fd0aa6f22b90e7a0cb0f38055697de
verdict: ready
issue_counts:
  low: 2
  critical: 0
  high: 0
  medium: 0
  info: 0
findings:
- id: C1
  severity: low
  category: coverage
  summary: FR-003's ordering-registration assertion (fail loudly if a Markua pass is registered after deckSplit) is implied by WP03/T011 but not a named subtask.
- id: I1
  severity: low
  category: inconsistency
  summary: WP04 fixture may need an image asset under example/docs/presentations/resources/ that is outside its owned_files list.
---

## Specification Analysis Report

Cross-artifact consistency check across `spec.md`, `plan.md`, `tasks.md` (+ `research.md`, `data-model.md`, `contracts/`) for mission `markua-decks-01M1TTMB`. All three core artifacts present and internally coherent; every functional requirement maps to at least one work package. No charter conflicts. Two low-severity coverage nuances noted below; neither blocks implementation.

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage | LOW | contracts/deck-markua-composition.md (C-COMPOSE-01); tasks WP03/T011 | FR-003's "fail loudly if a Markua pass is registered after `deckSplit`" registration-order assertion is covered in spirit by T011 (rewrites the C36a block to the FR-003 contract) and by the existing `remarkAsides`-order lock, but is not called out as its own subtask. | During WP03, explicitly add or confirm a registration-order assertion mirroring the existing `remarkAsides` lock, so a future array reorder fails loudly. No spec/plan change needed. |
| I1 | Inconsistency | LOW | tasks WP04/T013 (`owned_files`) | The fixture figure needs a real image; if a new asset is added under `example/docs/presentations/resources/`, that path is outside WP04's `owned_files`. | WP04 already permits a justified out-of-map edit with a one-line rationale, or reuse an existing example asset. No blocker. |

**Coverage Summary Table:**

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 deck-capable content passes | Yes | WP01 (T001-T004) | callouts/asides render on slides |
| FR-002 enforced composition with deckSplit | Yes | WP01 (T001), WP03 (T011) | ordering + wrapper safety |
| FR-003 ordering enforced by a gate | Yes | WP03 (T011), WP04 (T015) | see finding C1 |
| FR-004 hero-image re-solved | Yes | WP02 (T005-T007) | tag + skip |
| FR-005 full-surface deck contract | Yes | WP01 (T001-T002), WP03 (T008) | no per-construct carve-outs |
| FR-006 markuaTocDemote stays agnostic | Yes | WP03 (T008) | guarded predicate retained |
| FR-007 shipped fixture | Yes | WP04 (T013) | published deck |
| FR-008 deck-route a11y/behaviour gate | Yes | WP04 (T014-T016) | Playwright+axe |
| FR-009 guard removal + test update | Yes | WP03 (T008-T012) | membership/inertness flips |
| FR-010 docs + ADR-0038 | Yes | WP05 (T017-T020) | supersede ADR-0030 amendment |
| NFR-001 slide-construct a11y | Yes | WP01/T003, WP02, WP04/T015 | zero axe violations |
| NFR-002 off-deck byte-identical | Yes | WP03 (parity tests) | regression-covered |
| NFR-003 Markua-free deck unchanged | Yes | WP03 (T011) | slide count preserved |
| NFR-004 gate determinism | Yes | WP04 (T016) | CI-serial |

**Charter Alignment Issues:** None. The plan's Charter Check maps DIRECTIVE_001/003/010/018/024/025/051 to concrete mission behaviours (delegation-only deck awareness, ADR-0038 supersession, FR-003 assertion, no dependency change).

**Unmapped Tasks:** None. All 20 subtasks (T001-T020) belong to exactly one WP and trace to a requirement.

**Metrics:**

- Total Requirements: 14 (10 FR + 4 NFR)
- Total Tasks: 20 subtasks across 5 WPs
- Coverage %: 100% (every FR and NFR has ≥1 task)
- Ambiguity Count: 0
- Duplication Count: 0
- Critical Issues Count: 0

## Next Actions

- No CRITICAL/HIGH findings → clear to proceed to implementation.
- Optionally fold C1 into WP03 (confirm/extend the registration-order assertion) — cheap and worthwhile.
- I1 is already handled by WP04's out-of-map-edit allowance.
