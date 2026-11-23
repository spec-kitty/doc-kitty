---
schema_version: 1
artifact_type: spec-kitty.analysis-report
command: /spec-kitty.analyze
mission_slug: tom-annex-export-01M84YDP
mission_id: 01M84YDPJCBFNXNWKGGVX39KCX
generated_at: '2026-11-23T21:41:47.932019+00:00'
analyzer_agent: unknown
input_artifacts:
  spec.md:
    path: .worktrees/tom-annex-export-01M84YDP-coord/kitty-specs/tom-annex-export-01M84YDP/spec.md
    sha256: 8a0e89f7b7998c8a62ec1c92614252c26b78ee715bf9b517b1e4d46b0d74ca0f
  plan.md:
    path: .worktrees/tom-annex-export-01M84YDP-coord/kitty-specs/tom-annex-export-01M84YDP/plan.md
    sha256: 93bc943e0665ab307f4d28266318996eae01bc74249eef0c81a90e7d81dcf4e2
  tasks.md:
    path: .worktrees/tom-annex-export-01M84YDP-coord/kitty-specs/tom-annex-export-01M84YDP/tasks.md
    sha256: 36fa1ffc0eef74e69b698ba26dfc8e46c16ebd66946e4abde6677717e56ccb26
  charter:
    path: .kittify/charter/charter.yaml
    sha256: 92e9e079284707d74cdd3581a99487c314195e1a1e4efa1a7445c75af2fcd07f
verdict: blocked
issue_counts:
  medium: 3
  high: 2
  critical: 0
  low: 4
  info: 0
findings:
- id: I1
  severity: high
  category: inconsistency
  summary: US4 scenario 1 (no snapshot configured -> drift check passes, writes nothing) contradicts WP07 T032 (no --snapshot/--hub -> exit 2 usage error).
- id: I2
  severity: high
  category: inconsistency
  summary: US5 scenarios say the hub page appears or is absent when the site is built with an option on/off; plan and WP07 make the hub a committed page written by the CLI --hub flag, not a build option.
- id: I3
  severity: medium
  category: inconsistency
  summary: quickstart.md puts the example hub at docs/compliance/evidence-index/; WP07 and tasks put it at docs/context/evidence-index/ (no compliance section exists in the example).
- id: I4
  severity: medium
  category: inconsistency
  summary: 'data-model and spec start the format at 1.0 with generated optional; WP06 bumps to 1.1 inside the same mission, so 1.0 would never ship and #404 would see two versions for one release.'
- id: U1
  severity: medium
  category: underspecification
  summary: WP06 plans out-of-map edits to WP03/WP05 files (route, artifact gate, shipped schema) and WP07 to src/package.json; ownership map does not record them.
- id: C1
  severity: low
  category: coverage
  summary: C-006 (no history rewrite; clean history on a new branch) is mapped to no WP; it is a process constraint for the R24 close-out.
- id: I5
  severity: low
  category: inconsistency
  summary: research R-05 and WP06 take at from updated and verified[].at; ADR-0087 D5 names generated.at and updated.
- id: U2
  severity: low
  category: underspecification
  summary: plan.md Project Structure omits src/lib/tom-annex/scan.mjs (WP03) and check.mjs (WP07).
- id: C2
  severity: low
  category: coverage
  summary: NFR-002 (build-time budget) is measured and reported in WP05 but not asserted anywhere.
---

## Specification Analysis Report

Mission `tom-annex-export-01M84YDP`. Inputs: `spec.md`, `plan.md`, `tasks.md`,
`tasks/WP01–WP08`, `data-model.md`, `research.md`, `quickstart.md`, and
`.kittify/charter/charter.md`.

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| I1 | Inconsistency | HIGH | spec.md US4 scenario 1 (L127-128); WP07 T032 | "No snapshot configured → check passes, writes nothing" contradicts the CLI exiting 2 when neither `--snapshot` nor `--hub` is given. | Reword US4.1 as "Given a site that has not opted in, no drift check runs and the build is unaffected". That is true by construction, since there is no `validate:tom-annex` script. Keep exit 2 for a bare CLI call. |
| I2 | Inconsistency | HIGH | spec.md US5 scenarios 1–2 (L151-154); plan.md IC-03; WP07 T030/T033 | The spec says the hub appears "when the site is built" with an option on. The plan and WP07 make it a committed page written by `tom-annex --hub`, with no site option. | Reword US5 so that "opt in" means running the CLI with `--hub` and committing the page. The page is then built like any other page, and is absent when never generated. Alternatively, change the plan to a site option, which contradicts R-04 and the codegen precedent; not recommended. |
| I3 | Inconsistency | MEDIUM | quickstart.md L31, L34; WP07 owned_files and T033 | The hub path differs (`compliance/` versus `context/`). | Align the quickstart to `example/docs/context/evidence-index/index.md`. |
| I4 | Inconsistency | MEDIUM | data-model.md L1, L11; contracts schema `format_version`; WP06 T029.3 and DoD | 1.0 and 1.1 both appear within one release. | Ship 1.0 with `generated` required. WP06 makes it required without a version bump, because no 1.0 is released before it. Update data-model, the contract schema and WP06 together. |
| U1 | Underspecification | MEDIUM | WP06 T029; WP07 T032.5 | The planned out-of-map edits are noted in prose only. | Keep them sequential (WP06 runs after WP03 and WP05 are approved), and require the one-line rationale in the hand-off, which the prompts already state. Optionally list them in tasks.md under each WP. |
| C1 | Coverage | LOW | spec.md C-006 | A process constraint with no WP. | No WP needed. Track it in the R24 close-out after accept. |
| I5 | Inconsistency | LOW | research.md R-05; WP06 T027; ADR-0087 D5 | `verified[].at` is used as an input instant, but D5 does not name it. | Either drop `verified[].at`, or note that a verification instant is also an input instant, as an ADR-0087 D5 reading in the guide. |
| U2 | Underspecification | LOW | plan.md Project Structure | Two new modules are not listed. | Informational. The WP owned_files are authoritative. |
| C2 | Coverage | LOW | spec.md NFR-002; WP05 T025 | The budget is reported, not enforced. | Accept: a timing assertion would be flaky. The reviewer checks the reported numbers. |

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
| FR-008 generated stamp | yes | T026, T027, T029 | gated |
| FR-009 snapshot and check | yes | T031, T032, T034 | gated |
| FR-010 hub page | yes | T030, T033 | gated; see I2 |
| FR-011 OKF export | yes | T017–T020 | |
| FR-012 no classified pages | yes | T010, T020, T024 | |
| FR-013 documented format | yes | T006, T036 | |
| NFR-001 byte stability | yes | T023, T029 | |
| NFR-002 build cost | yes | T008, T025 | measured only (C2) |
| NFR-003 format stability | yes | T036 | see I4 |
| NFR-004 test-first | yes | all code WPs | |
| NFR-005 full suite | yes | all WPs (DoD) | |
| C-001…C-005 | yes | WP03, WP06, WP07, WP08 | |
| C-006 | no | none | process (C1) |

**Charter Alignment Issues:** none. Structure, maintainability, agent
interoperability and flexibility are each served, as plan.md's Charter Check
shows, and no artifact contradicts a charter principle.

**Unmapped Tasks:** none. T001 (fixtures) and T007 (ratchet) support FR-001 and
NFR-002 respectively.

**Metrics:**

- Total requirements: 29 (13 FR, 5 NFR, 6 C, 5 SC)
- Total tasks: 38
- Coverage: 28 of 29 requirements have at least one task (97%). The exception is C-006, which is a process constraint.
- Ambiguity count: 0
- Duplication count: 0
- Critical issues: 0. High issues: 2 (I1, I2).

## Next Actions

- **Blocked on I1 and I2.** Both are wording fixes in spec.md's User Stories 4
  and 5. They align the acceptance scenarios with the CLI design that the
  operator kept (R-04). No plan or task change is needed for them.
- Fix I3 (quickstart path) and I4 (ship format 1.0 with `generated` required) in
  the same pass, then re-run `/spec-kitty.analyze`, which is required because
  editing the artifacts makes this report stale.
- U1, C1, I5, U2 and C2 are informational, or are handled at hand-off and
  close-out.
