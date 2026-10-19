---
schema_version: 1
artifact_type: spec-kitty.analysis-report
command: /spec-kitty.analyze
mission_slug: gherkin-authoring-aids-01M59A5E
mission_id: 01M59A5EFK2ZEGNDZ61GAQTZS8
generated_at: '2026-10-19T06:39:00.923113+00:00'
analyzer_agent: unknown
input_artifacts:
  spec.md:
    path: kitty-specs/gherkin-authoring-aids-01M59A5E/spec.md
    sha256: f04511abda31ddee8fe72b9ea369fbab4c2ef11311ec4a7daf87eb6b4589bf57
  plan.md:
    path: kitty-specs/gherkin-authoring-aids-01M59A5E/plan.md
    sha256: de4b1e49c2f1fcedc6590913721c00ef3106b52bfe47cede07ad3cbf48add0c6
  tasks.md:
    path: kitty-specs/gherkin-authoring-aids-01M59A5E/tasks.md
    sha256: 7930b385e826b2112d26269303b5fab069115b0605f51dd9065c2d012a368567
  charter:
    path: .kittify/charter/charter.yaml
    sha256: a31f288ab9518a3b391733e14850b07822b9c826d9549366b8dc2c232a008e20
verdict: ready
issue_counts:
  high: 0
  low: 5
  medium: 2
  critical: 0
  info: 0
findings:
- id: F1
  severity: medium
  category: inconsistency
  summary: plan.md says the card styles go in dk-components.css; WP06 puts them in a new specification.css (WP05 owns dk-components.css).
- id: F2
  severity: low
  category: inconsistency
  summary: plan.md says feature-core reads the allow key at Feature, Rule and Scenario level; tasks split it (feature-core reads Feature, the lint core reads Rule and Scenario).
- id: F3
  severity: low
  category: inconsistency
  summary: data-model.md says an unused folder key warns 'as titles does' (exact match), while WP02 counts a key as used when a feature directory lies beneath it, which the inheritance rule requires.
- id: F4
  severity: low
  category: underspecification
  summary: WP03 T015 leaves open which path warns about a bad Feature-level @dk:allow value inside an in-page fence, though it fixes the rule of one warning per bad tag per surface.
- id: F5
  severity: low
  category: coverage
  summary: plan.md's source tree omits docs/architecture/theming.md, which WP08 owns and updates.
- id: F6
  severity: medium
  category: coverage
  summary: The fence lint is best-effort in dev (content-layer cache hits skip it), so FR-011's fence coverage is not guaranteed on incremental builds; covered only by documentation (WP08), not by a test.
- id: F7
  severity: low
  category: ambiguity
  summary: NFR-006's 5% build-cost budget is guarded by a lenient timing test (WP03 T016) whose bound the implementer chooses; the threshold is stated, the measurement method is not.
---

## Specification Analysis Report

Analysed `spec.md`, `plan.md`, `tasks.md`, the eight WP prompts, `data-model.md`,
`contracts/*`, `research.md` and `.kittify/charter/charter.md`.

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| F1 | Inconsistency | MEDIUM | plan.md:114, :255; tasks/WP06 | The card styles are said to go in `dk-components.css`, but WP06 creates `specification.css` | Treat WP06 as authoritative (it avoids two owners of one file). Correct plan.md in a later plan touch-up; no WP change |
| F2 | Inconsistency | LOW | plan.md:102; tasks/WP01 T005, WP03 T015 | Where `allow` is read below Feature level | Follow the tasks; the plan line is a summary |
| F3 | Inconsistency | LOW | data-model.md (FolderDefaultMap, Warnings); tasks/WP02 T007 | Unused-key semantics: exact vs beneath | WP02 is right (it follows from longest-prefix inheritance); ADR-0061 (WP08) states it |
| F4 | Underspecification | LOW | tasks/WP03 T015 | The warning path for a bad Feature-level `@dk:allow` in a fence | The implementer decides and tests, under the stated rule; the reviewer checks there is one warning |
| F5 | Coverage | LOW | plan.md Project Structure; tasks/WP08 | `theming.md` is missing from the plan tree | No action; WP08 covers it |
| F6 | Coverage | MEDIUM | spec FR-011; plan IC-05; tasks/WP04, WP08 | Fence lint can be skipped on dev cache hits | Accepted limitation (research R-10). WP08 documents it; production builds re-render every page |
| F7 | Ambiguity | LOW | spec NFR-006; tasks/WP03 T016 | The timing-guard bound is left to the implementer | The reviewer checks the bound is meaningful and not flaky |

**Coverage summary**

| Requirement key | Has task? | Task IDs | Notes |
|---|---|---|---|
| FR-001 folder default | Yes | T001, T004, T006, T009 | |
| FR-002 nearest folder | Yes | T006 | |
| FR-003 tag precedence | Yes | T004 | |
| FR-004 unmapped unchanged | Yes | T010 | Ratchet, with a same-fixture control |
| FR-005 CLI parity | Yes | T003 | |
| FR-006 unknown context warning | Yes | T008, T009 | Build only (research R-02) |
| FR-007 unused key warning | Yes | T007 | See F3 |
| FR-008 opt-in lint | Yes | T002, T013, T014 | |
| FR-009 warn-only, output-neutral | Yes | T016, T017, T019 | |
| FR-010 configurable list and scope | Yes | T002, T013 | |
| FR-011 lint surfaces | Yes | T018, T019 | See F6 |
| FR-012 suppression | Yes | T005, T012, T015 | |
| FR-013 English only | Yes | T014, T016 | |
| FR-014 card | Yes | T024, T025, T027 | Results summary stays in the body (operator decision) |
| FR-015 TOC is the scenario list | Yes | T027 | |
| FR-016 draft notice | Yes | T020–T023 | |
| FR-017 default with opt-out | Yes | T026 | |
| FR-018 test lanes | Yes | T028 | |
| FR-019 docs and ADRs | Yes | T034–T039 | |
| NFR-001 dormancy | Yes | T010, T031 | |
| NFR-002 false positives | Yes | T016, T033 | |
| NFR-003 accessibility | Yes | T028 | |
| NFR-004 geometry | Yes | T028 | |
| NFR-005 tokens only | Yes | T022, T029 | |
| NFR-006 build cost | Yes | T016 | See F7 |
| C-001–C-006 | Yes | T006, T013–T019, T002, T025, tasks.md order, WP08 | |

**Charter alignment issues**: none.
- ADRs are new and amend by reference; no accepted ADR is edited.
- The metadata contract adds no frontmatter field.
- Tests use Vitest, the example build and Playwright.
- WCAG 2.2 AA is addressed (labelled region, text status, axe lane).
- Docs change in the same PR.

**Unmapped tasks**: none. Every task carries a requirement through its WP.

**Metrics**

- Total requirements: 31 (19 FR, 6 NFR, 6 C); 5 success criteria
- Total tasks: 39 in 8 work packages
- Coverage: 100% of requirements have at least one task
- Ambiguity count: 1
- Duplication count: 0
- Critical issues: 0

## Next actions

No CRITICAL or HIGH findings, so the mission may proceed to implementation.
F1–F5 are bookkeeping drift in `plan.md` and `data-model.md`. The WP prompts
are authoritative and correct. F6 and F7 are accepted, documented limits that
reviewers should check.
