---
schema_version: 1
artifact_type: spec-kitty.analysis-report
command: /spec-kitty.analyze
mission_slug: operating-model-templates-01M84X0R
mission_id: 01M84X0RH8AJE7NXQK093SGRF0
generated_at: '2026-11-23T23:29:27.796670+00:00'
analyzer_agent: unknown
input_artifacts:
  spec.md:
    path: .worktrees/operating-model-templates-01M84X0R-coord/kitty-specs/operating-model-templates-01M84X0R/spec.md
    sha256: 1c516e3274ef547a06d2c73a86ceb24c9b6deb6252475515432024a237915b71
  plan.md:
    path: .worktrees/operating-model-templates-01M84X0R-coord/kitty-specs/operating-model-templates-01M84X0R/plan.md
    sha256: 3117110c096368f3326faf6c49b9fc1d06e87637f4a5eb83c61d0c49a74edc64
  tasks.md:
    path: .worktrees/operating-model-templates-01M84X0R-coord/kitty-specs/operating-model-templates-01M84X0R/tasks.md
    sha256: d3fa9b327ea1493b1ca6771a167c4112ebfb15ece55764975732ecfd8ee3f6c1
  charter:
    path: .kittify/charter/charter.yaml
    sha256: 92e9e079284707d74cdd3581a99487c314195e1a1e4efa1a7445c75af2fcd07f
verdict: ready
issue_counts:
  high: 0
  low: 3
  critical: 0
  medium: 1
  info: 0
findings:
- id: I1
  severity: medium
  category: inconsistency
  summary: NFR-004 allows a one-line 'not legal advice' notice outside comments, but research D8 and WP03 T012 require that notice inside a comment, so the stripped body must be empty.
- id: C1
  severity: low
  category: coverage
  summary: The spec edge case of a consumer catalog dropping a preset measure id has no dedicated test; it relies on existing ADR-0080 behaviour.
- id: U1
  severity: low
  category: underspecification
  summary: The preset writes operating-model/roles/accountable-role.md with no section index for operating-model/roles/; the sidebar and graph effect is unstated.
- id: T1
  severity: low
  category: traceability
  summary: Bare '#402' citations in spec, tasks and the planned ADR will need an issue-matrix row before WP approval.
---

## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| I1 | Inconsistency | MEDIUM | spec.md NFR-004; research.md D8; tasks/WP03 T012 | The spec allows a one-line notice outside comments. The plan puts it inside a comment and asserts an empty remainder. | The stricter plan reading satisfies the spec, since it is a subset of it. During implementation, follow WP03; align the NFR-004 wording if the spec is touched again. |
| C1 | Coverage | LOW | spec.md Edge Cases | A consumer catalog dropping a preset measure is not tested by this mission. | Acceptable: the behaviour is ADR-0080's and is already tested. Mention it in the guide (WP05). |
| U1 | Underspecification | LOW | data-model.md (role path); WP04 T015 | There is no index for `operating-model/roles/`. | Check during WP04 or WP05 whether the build or sidebar expects one. If it does, the preset writes a roles index (count 14) and SC-002 is updated. |
| T1 | Traceability | LOW | spec.md, tasks.md, WP01 | Bare `#402` references. | Add the issue-matrix row for #402 at review time. |

**Coverage summary**

| Requirement | Has task? | Task IDs | Notes |
|---|---|---|---|
| FR-001 | yes | T004, T005 | |
| FR-002 | yes | T004, T006 | |
| FR-003 | yes | T004, T006 | Persona-without-goals fixture |
| FR-004 | yes | T001 | |
| FR-005 | yes | T009, T011 | |
| FR-006 | yes | T008, T010 | |
| FR-007 | yes | T013, T014 | |
| FR-008 | yes | T013, T015 | |
| FR-009 | yes | T013 | sentinel bytes plus a positive control |
| FR-010 | yes | T017 | |
| FR-011 | yes | T008, T009 | |
| FR-012 | yes | T012 | |
| FR-013 | yes | T018, T020 | |
| FR-014 | yes | T013 | pinned output |
| NFR-001 | yes | T004, T008, T013, T017 | red-first commits |
| NFR-002 | yes | T007, T012, T016, T021 | |
| NFR-003 | yes | T012 | |
| NFR-004 | yes | T011, T012 | see I1 |
| NFR-005 | yes | T001, T021 | |
| C-001 to C-007 | yes | WP01, WP02, WP03, WP05 | |

**Charter alignment issues**

None.

- Emitted pages carry `title`, `description`, `doc_status`, `updated`, `type` and `kind`, as the documentation policy requires.
- The convention change is recorded in an ADR (ADR-0085), as amendment and exceptions requires.
- The docs ship in the same change, as living documentation requires.
- Templates hold no authored content, matching the scope.

**Unmapped tasks**

None.

**Metrics**

- Total requirements: 33 (14 FR, 5 NFR, 7 C, 4 SC, plus 3 Decision Moments).
- Total tasks: 21.
- Coverage: 100% of FR and NFR have at least one task.
- Ambiguity count: 0. Duplication count: 0. Critical issues: 0.

## Re-run note (after review cycle 1)

Re-recorded after the cycle-1 corrections:

- The WP01 prompt now asks for a Proposed ADR.
- The spec (C-003), the plan's Charter Check and research D1 now state that the gate reads `KINDS`, while the build schema keeps `kind` an open string.

These corrections change wording only. Requirements, coverage and the findings above are unchanged.

## Next actions

- No critical or high findings, so implementation may proceed.
- I1 needs no planning edit: the WP03 test is the stricter, compliant reading.
- U1: the WP04 implementer checks whether the build or sidebar expects a roles index, and reports it at hand-off.
