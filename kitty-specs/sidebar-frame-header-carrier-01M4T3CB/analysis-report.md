---
schema_version: 1
artifact_type: spec-kitty.analysis-report
command: /spec-kitty.analyze
mission_slug: sidebar-frame-header-carrier-01M4T3CB
mission_id: 01M4T3CBJCDTQ7Q5NGVRN5SBHD
generated_at: '2026-10-13T07:55:20.200293+00:00'
analyzer_agent: unknown
input_artifacts:
  spec.md:
    path: kitty-specs/sidebar-frame-header-carrier-01M4T3CB/spec.md
    sha256: acd4e09063d7f590da1b21e82dafb202f52cbb3c64cb8927d3640c27d5e787e9
  plan.md:
    path: kitty-specs/sidebar-frame-header-carrier-01M4T3CB/plan.md
    sha256: e902f8e96e09f707343a925e84818c7891acdd602481da6dd1baae6e354ae555
  tasks.md:
    path: kitty-specs/sidebar-frame-header-carrier-01M4T3CB/tasks.md
    sha256: e4cab32d886c331e66a9caa34a7c9acb654b9cf0539ac4e6fa5a4907191db184
  charter:
    path: .kittify/charter/charter.yaml
    sha256: a31f288ab9518a3b391733e14850b07822b9c826d9549366b8dc2c232a008e20
verdict: ready
issue_counts:
  medium: 4
  critical: 0
  low: 4
  high: 0
  info: 0
findings:
- id: I1
  severity: medium
  category: inconsistency
  summary: SC-006 demands zero raw directory labels, but WP04 T024 defers the three generated glossary-context labels to a follow-up.
- id: U1
  severity: medium
  category: underspecification
  summary: The fail-closed draft default is an assumption the owner has not confirmed; FR-014 and scenario 3.3 flip if it is wrong.
- id: C1
  severity: medium
  category: coverage
  summary: NFR-005 (no layout shift) is assigned to WP02 and WP04 but no task measures it.
- id: I2
  severity: medium
  category: inconsistency
  summary: WP05 and WP06 both edit src/lib/config.ts, which WP04 owns; safe only because the lane is serial.
- id: I3
  severity: low
  category: inconsistency
  summary: SC-004 (toggle focus order) is mapped to WP07 but delivered by WP02.
- id: I4
  severity: low
  category: inconsistency
  summary: Plan IC-05 places the decision record with the Header carrier; tasks put both records in WP07, after the carrier lands.
- id: C2
  severity: low
  category: coverage
  summary: FR-012 (right-to-left parity) is mapped to WP01 only, though WP02 implements half and WP03 tests it.
- id: U2
  severity: low
  category: underspecification
  summary: WP06 owns a fixture glob that matches no file yet and is not listed in create_intent.
---

## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| I1 | Inconsistency | MEDIUM | spec.md SC-006; tasks/WP04 T024 step 3 | SC-006 requires zero raw directory labels (down from 8). Three of the eight (`hr`, `rhetoric`, `shipping`) are generated glossary-context pages that T024 tells the implementer not to hand-edit and to defer if the generator has no title field. | During WP04, set the title in the glossary generator if it is a small change; otherwise record the three as a named follow-up and report SC-006 as 5 of 8. |
| U1 | Underspecification | MEDIUM | spec.md Assumptions; FR-014 | "Build drafts, but do not publish on live" was read as default off, on for local dev through an env file. The owner has not confirmed the default. | Confirm at PR review. Flipping it changes one default in the resolver, one test and the deploy comment. |
| C1 | Coverage | MEDIUM | spec.md NFR-005; tasks/WP02, WP04 | The prompts state the constraint but no subtask measures layout shift. | In WP03, record reading-column position before and after toggle mount and sidebar reveal on one page; assert no change. |
| I2 | Inconsistency | MEDIUM | tasks/WP04, WP05, WP06 frontmatter | Two packages make named out-of-map edits to a file a third owns. The dependency chain WP04 → WP05 → WP06 serialises them. | Keep the chain; reviewers check each edit is small and recorded. |
| I3 | Inconsistency | LOW | requirement mapping | SC-004 sits on WP07; the tab-order test is WP02 T011. | Reviewer of WP02 checks SC-004; WP07's scenario walk confirms it. |
| I4 | Inconsistency | LOW | plan.md IC-05; tasks.md WP07 | The record that supersedes the four-carrier clause lands after the code, within the same pull request. | Acceptable: FR-027 is satisfied at merge. ADRs were grouped to avoid two lanes editing the generated ADR index. |
| C2 | Coverage | LOW | requirement mapping | Right-to-left parity spans three packages. | No change needed; WP03 T014 is the proof. |
| U2 | Underspecification | LOW | tasks/WP06 frontmatter | `src/tests/fixtures/header-theme/**` matches nothing yet; finalize reported a warning. | Harmless; the fixture is created by T036. |

**Coverage Summary**

| Requirement group | Has task? | Work package | Notes |
|---|---|---|---|
| FR-001 to FR-006, FR-012 | Yes | WP01 | T001–T005 |
| FR-007 to FR-010 | Yes | WP02 | T007–T011 |
| FR-011, FR-019 to FR-023 | Yes | WP04 | T018–T025 |
| FR-013 to FR-018 | Yes | WP05 | T026–T032 |
| FR-024, FR-025 | Yes | WP06 | T033–T036 |
| FR-026, FR-027, FR-029, FR-030 | Yes | WP07 | T037–T040 |
| FR-028 | Yes | WP03 | T012–T016 |
| NFR-001, NFR-003 | Yes | WP03 | |
| NFR-002 | Yes | WP01, WP03 | |
| NFR-004 | Yes | WP02 | T010 |
| NFR-005 | Partial | WP02, WP04 | see C1 |
| NFR-006 | Yes | WP04, WP05 | |
| NFR-007 | Yes | WP06 | T036 |
| C-001 to C-007 | Yes | WP01, WP02, WP03, WP04, WP07 | |

**Charter Alignment Issues:** none unaddressed. The carrier-count amendment is deliberate, tracked in plan.md Complexity Tracking, and covered by FR-027.

**Unmapped Tasks:** none.

**Metrics**

- Total requirements: 30 functional, 7 non-functional, 7 constraints, 8 success criteria
- Total subtasks: 42 in 7 work packages
- Coverage: 100% of functional requirements have at least one task; NFR-005 is partial
- Ambiguity count: 1 (U1)
- Duplication count: 0
- Critical issues: 0

**Next Actions**

No critical or high findings; implementation may start. Carry C1 into WP03 and I1 into WP04 as reviewer checks. U1 is for the owner at PR review.
