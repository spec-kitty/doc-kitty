---
schema_version: 1
artifact_type: spec-kitty.analysis-report
command: /spec-kitty.analyze
mission_slug: layout-guards-decisions-01M59CGE
mission_id: 01M59CGETVTAJTWKCJHATHXH2A
generated_at: '2026-10-19T07:18:01.020452+00:00'
analyzer_agent: unknown
input_artifacts:
  spec.md:
    path: kitty-specs/layout-guards-decisions-01M59CGE/spec.md
    sha256: 02739723c41dda656119b55626c5d0a47d3220309cdce0d67866c637f0db948a
  plan.md:
    path: kitty-specs/layout-guards-decisions-01M59CGE/plan.md
    sha256: bccf52675c73c6979cbeff1f76a9542f95ff31636847428289b627264b7e43aa
  tasks.md:
    path: kitty-specs/layout-guards-decisions-01M59CGE/tasks.md
    sha256: b5d2dc5af01a82745d83a4bb7073a57d6772c98842a3b0cc7599fb99d890cc7b
  charter:
    path: .kittify/charter/charter.yaml
    sha256: a31f288ab9518a3b391733e14850b07822b9c826d9549366b8dc2c232a008e20
verdict: ready
issue_counts:
  medium: 2
  low: 5
  high: 0
  critical: 0
  info: 0
findings:
- id: I1
  severity: medium
  category: inconsistency
  summary: C-001 baseline regeneration is an orchestrator step after lanes merge, not a work package; plan IC-07 still lists it as part of the concern.
- id: I2
  severity: medium
  category: inconsistency
  summary: WP07 writes the changelog entry for WP08's published lane but does not depend on WP08, so the entry is written from the prompt, not the diff.
- id: E1
  severity: low
  category: coverage
  summary: C-004 (the maintainer merges) maps to no work package; it is an orchestrator rule.
- id: E2
  severity: low
  category: coverage
  summary: SC-003 names six guards including the published lane and membership check, but WP08 does not list SC-003 in requirement_refs.
- id: F1
  severity: low
  category: inconsistency
  summary: Plan IC-03 places the stock-header switch in its own concern; tasks put it in WP03 (config.ts ownership), with WP04 depending on WP03.
- id: F2
  severity: low
  category: terminology
  summary: "'Published build' (Domain Language) and 'drafts-off build' are used interchangeably across spec, plan and WP08."
- id: U1
  severity: low
  category: underspecification
  summary: WP05 owns layout-geometry.spec.ts, which holds the FR-022 reveal and CLS tests that WP03's change must keep green; WP03 cannot edit them if they need adjusting.
---

## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| I1 | Inconsistency | MEDIUM | plan.md IC-07; tasks.md "After all lanes merge" | Baseline regeneration (C-001) moved out of the WPs into an orchestrator step; the plan still frames it as part of IC-07. | Keep it as the orchestrator step (it needs the merged branch pushed); track it in the mission PR checklist so it cannot be skipped. |
| I2 | Inconsistency | MEDIUM | tasks/WP07 dependencies | WP07's changelog bullet for #200 is written before WP08 lands. | Reviewer of WP07 re-checks the #200 bullet against WP08's final diff; or amend the bullet when WP08 merges. |
| E1 | Coverage | LOW | spec.md C-004 | No WP owns "the maintainer merges". | None needed; it is enforced by the orchestrator (PR ready for review, never merged by the agent). |
| E2 | Coverage | LOW | spec.md SC-003; tasks/WP08 requirement_refs | SC-003's published-lane and membership guards live in WP08, which does not reference SC-003. | Success criteria are tracked, not gating; note it for the WP08 reviewer. |
| F1 | Inconsistency | LOW | plan.md IC-03 vs tasks/WP03 T016 | The switch moved to WP03 because WP03 owns `src/lib/config.ts`. | Acceptable; ownership is exclusive by design. |
| F2 | Terminology | LOW | spec.md Domain Language; WP08 | Two names for the same build. | Prefer "published build" in user-facing docs (WP07); "drafts-off" is fine in CI and test code. |
| U1 | Underspecification | LOW | tasks/WP03 Context; tasks/WP05 owned_files | Cross-WP test ownership. | WP03 must keep those tests green without edits; if one needs a change, record it and hand it to WP05. |

**Coverage Summary Table:**

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 machine-surface determinism | Yes | T007–T010 | WP02 |
| FR-002 header fixture stamp | Yes | T020 | WP04 |
| FR-003 carrier-free capture | Yes | T016, T018, T019 | WP03 switch + WP04 |
| FR-004 sidebar reveal before first paint | Yes | T011–T014, T017 | WP03 |
| FR-005 search tracks the column | Yes | T022, T027 | WP05 |
| FR-006 toggle clearance | Yes | T023, T028 | WP05 |
| FR-007 120rem default cap | Yes | T024, T026, T036–T038 | WP05 + WP07 |
| FR-008 band-width persona card | Yes | T025, T026 | WP05 |
| FR-009 accepted column shift recorded | Yes | T004 | WP01 |
| FR-010 recentre guard | Yes | T006, T030, T031 | WP01 + WP06 |
| FR-011 target-size check | Yes | T032–T034 | WP06 |
| FR-012 published-sidebar lane | Yes | T041, T043, T044 | WP08 |
| FR-013 draft-mode server check | Yes | T040 | WP08 |
| FR-014 sidebar membership | Yes | T042 | WP08 |
| FR-015 stale comments and docs | Yes | T004, T005, T021, T026–T028, T036, T037 | WP01, WP04, WP05, WP07 |
| FR-016 changelog | Yes | T038 | WP07 |
| NFR-001 lane cost | Yes | T041, T043 | WP08; measured after baselines |
| NFR-002 determinism cost | Yes | T010 | WP02 |
| NFR-003 stamp cost | Yes | T020 | WP04 |
| NFR-004 no a11y regression | Yes | T029, T034 | WP05, WP06 |
| NFR-005 reveal at first paint | Yes | T011 | WP03 |
| NFR-006 narrow layouts unchanged | Yes | T024 | WP05 |
| C-001 baselines from CI only | Partial | T044 + orchestrator step | see I1 |
| C-002 one new carrier | Yes | T001, T014, T015 | WP01, WP03 |
| C-003 no fixture pages | Yes | T030 | WP06 |
| C-004 maintainer merges | No | — | orchestrator, see E1 |

**Charter Alignment Issues:** none. ADR immutability is respected (new ADR-0061 and ADR-0062; ADR-0045 is not edited). Living documentation is met inside the same PR (WP01, WP07). The WCAG 2.2 AA target gains an explicit guard. Path-scoped CI keeps one `ci-ok` aggregate.

**Unmapped Tasks:** none. All 45 subtasks belong to exactly one WP and trace to at least one requirement.

**Metrics:**

- Total Requirements: 26 (16 FR, 6 NFR, 4 C), plus 5 success criteria
- Total Tasks: 45 subtasks in 8 work packages
- Coverage: 25 of 26 requirements have at least one task (96%); C-004 is orchestrator-owned
- Ambiguity Count: 0
- Duplication Count: 0
- Critical Issues Count: 0

## Next Actions

- No critical or high findings: implementation may start.
- I1: carry the baseline-regeneration step into the mission PR checklist.
- I2: the WP07 reviewer checks the #200 changelog bullet against WP08's diff.

## Re-run note (2026-10-19, after WP01 review cycle 1)

Planning inputs changed by commit 3f6cdf8:
- spec.md: the edge case no longer says a cap below 117rem brings back a shift;
  that holds only for the declined #204 option 2. The rule that remains is that
  the search lines up with the column under any cap.
- WP01 and WP07 prompts: the same claim is corrected, and WP07 now carries the
  `docs/architecture/markua.md` "five carriers" fix as a recorded out-of-map edit.

Re-checked against the detection passes: no new duplication, ambiguity or coverage
gap. Findings I1, I2, E1, E2, F1, F2 and U1 stand unchanged.
