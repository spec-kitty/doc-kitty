---
schema_version: 1
artifact_type: spec-kitty.analysis-report
command: /spec-kitty.analyze
mission_slug: tom-annex-export-01M84YDP
mission_id: 01M84YDPJCBFNXNWKGGVX39KCX
generated_at: '2026-11-23T21:43:40.246600+00:00'
analyzer_agent: unknown
input_artifacts:
  spec.md:
    path: .worktrees/tom-annex-export-01M84YDP-coord/kitty-specs/tom-annex-export-01M84YDP/spec.md
    sha256: 6827dd35ab2ef62c2c8580abffb10e41580d0e961f0f2bbbffeda5fd5527a15a
  plan.md:
    path: .worktrees/tom-annex-export-01M84YDP-coord/kitty-specs/tom-annex-export-01M84YDP/plan.md
    sha256: 93bc943e0665ab307f4d28266318996eae01bc74249eef0c81a90e7d81dcf4e2
  tasks.md:
    path: .worktrees/tom-annex-export-01M84YDP-coord/kitty-specs/tom-annex-export-01M84YDP/tasks.md
    sha256: 630e1390a2a19900fcb19fbbc24e726fd81e12975f76a680c08d3d23bab900fb
  charter:
    path: .kittify/charter/charter.yaml
    sha256: 92e9e079284707d74cdd3581a99487c314195e1a1e4efa1a7445c75af2fcd07f
verdict: ready
issue_counts:
  low: 4
  medium: 1
  critical: 0
  high: 0
  info: 0
findings:
- id: U1
  severity: medium
  category: underspecification
  summary: WP06 plans out-of-map edits to WP03/WP05 files (route, artifact gate, shipped schema) and WP07 to src/package.json; sequential by dependency and the prompts require a one-line rationale at hand-off.
- id: C1
  severity: low
  category: coverage
  summary: C-006 (no history rewrite; clean history on a new branch) is mapped to no WP; it is a process constraint for the R24 close-out.
- id: I5
  severity: low
  category: inconsistency
  summary: WP06 takes at from updated and verified[].at, but ADR-0087 D5 names generated.at and updated; recorded under Deferred as an ADR-0087 D5 follow-up.
- id: U2
  severity: low
  category: underspecification
  summary: plan.md Project Structure omits src/lib/tom-annex/scan.mjs (WP03) and check.mjs (WP07); WP owned_files are authoritative.
- id: C2
  severity: low
  category: coverage
  summary: NFR-002 (build-time budget) is measured and reported in WP05 but not asserted; a timing assertion would be flaky.
---

## Specification Analysis Report (re-run after remediation)

Mission `tom-annex-export-01M84YDP`. This report supersedes the blocked report
at 8164d4f. The dispatcher approved the I1–I4 remediation on 2026-11-23
(commit 5682ca7).

### Resolved since the previous report

| ID | Was | Resolution |
|----|-----|------------|
| I1 | HIGH | spec.md US4.1 now reads: a site that never passes a snapshot or hub path has no drift check, and nothing is written or failed. A bare CLI call is a usage error. This matches WP07 T032. |
| I2 | HIGH | spec.md US5 now defines opting in as running the CLI with a hub path and committing the page. This matches plan IC-03 and WP07 T030/T033. |
| I3 | MEDIUM | The quickstart hub path is `example/docs/context/evidence-index/index.md`, matching WP07. |
| I4 | MEDIUM | Format 1.0 ships with `generated` required. The contract requires it, WP01's shipped copy leaves it optional until WP06, WP06 keeps 1.0, and WP08 documents 1.0 with the stamp. |

### Remaining findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| U1 | Underspecification | MEDIUM | WP06 T029; WP07 T032.5 | Planned out-of-map edits to files owned by earlier WPs. | Accept. The dependencies make them sequential, and each prompt requires a one-line rationale at hand-off. The reviewer checks it. |
| C1 | Coverage | LOW | spec.md C-006 | A process constraint with no WP. | Handled at the R24 close-out. |
| I5 | Inconsistency | LOW | WP06 T027; ADR-0087 D5 | `verified[].at` is used as an input instant. | Tracked in tasks.md Deferred as an ADR-0087 D5 follow-up. |
| U2 | Underspecification | LOW | plan.md Project Structure | Two modules are not listed. | Informational. |
| C2 | Coverage | LOW | NFR-002; WP05 T025 | The budget is measured, not asserted. | Accept. The reviewer checks the reported numbers. |

### Consistency re-check of the edited passages

- US4.1 against WP07: the CLI requires at least one of `--snapshot` and `--hub`,
  and exits 2 otherwise. The example opts in through `generate:tom-annex` /
  `validate:tom-annex`. Consistent.
- US5 against FR-010: the FR says "opt-in … off by default". US5 now defines
  opting in as the CLI call, so "off by default" means a site that never
  generated the page. Consistent.
- Contract `required` against WP01, WP05 and WP06:
  - WP01 builds no stamp, and its shipped schema leaves `generated` optional.
  - WP05's artifact gate (T021) does not require `generated`; WP06 T029.2 adds
    that.
  - The contract describes the final 1.0.
  Consistent.

**Coverage Summary Table:**

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 per-measure records | yes | T002 | |
| FR-002 grouping by scope | yes | T002 | |
| FR-003 uncovered measures | yes | T003, T022 | |
| FR-004 labelling | yes | T004, T018, T021, T030, T035 | |
| FR-005 discovery link | yes | T013, T014, T021 | |
| FR-006 drafts excluded | yes | T010, T022 | |
| FR-007 determinism | yes | T005, T006, T023 | |
| FR-008 generated stamp | yes | T026, T027, T029 | gated on #445 |
| FR-009 snapshot and check | yes | T031, T032, T034 | gated on #445 |
| FR-010 hub page | yes | T030, T033 | gated on #445 |
| FR-011 OKF export | yes | T017–T020 | |
| FR-012 no classified pages | yes | T010, T020, T024 | |
| FR-013 documented format | yes | T006, T036 | |
| NFR-001 byte stability | yes | T023, T029 | |
| NFR-002 build cost | yes | T008, T025 | measured (C2) |
| NFR-003 format stability | yes | T036 | |
| NFR-004 test-first | yes | all code WPs | |
| NFR-005 full suite | yes | all WPs (DoD) | |
| C-001…C-005 | yes | WP03, WP06, WP07, WP08 | |
| C-006 | no | none | process (C1) |

**Charter Alignment Issues:** none.

**Unmapped Tasks:** none.

**Metrics:**

- Total requirements: 29 (13 FR, 5 NFR, 6 C, 5 SC)
- Total tasks: 38
- Coverage: 28 of 29 (97%). C-006 is a process constraint.
- Ambiguity count: 0
- Duplication count: 0
- Critical: 0. High: 0.

## Next Actions

- **Ready.** WP01 and WP02 can start now, in parallel lanes `lane-a` and `lane-b`.
- WP06 and WP07 stay gated until PR #445 merges (C-002).
- U1 is checked at review. C1 is handled at close-out (R24).
