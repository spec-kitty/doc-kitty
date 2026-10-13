---
schema_version: 1
artifact_type: spec-kitty.analysis-report
command: /spec-kitty.analyze
mission_slug: generated-page-and-link-integrity-01M4VB0N
mission_id: 01M4VB0NPEBCH4163JZ3RE252K
generated_at: '2026-10-13T20:12:41.663150+00:00'
analyzer_agent: unknown
input_artifacts:
  spec.md:
    path: kitty-specs/generated-page-and-link-integrity-01M4VB0N/spec.md
    sha256: 1588f7fc950ab447553b1e2815786242444908129d3845106deefc9b6708e541
  plan.md:
    path: kitty-specs/generated-page-and-link-integrity-01M4VB0N/plan.md
    sha256: dd2d02cdb910a8294e90df6f00770debd2b87c9f0919732ec36283ebfe44053a
  tasks.md:
    path: kitty-specs/generated-page-and-link-integrity-01M4VB0N/tasks.md
    sha256: fb54083d4c80f62485db0bc4061c745c894c81f83ef7f5df020667eed012c887
  charter:
    path: .kittify/charter/charter.yaml
    sha256: a31f288ab9518a3b391733e14850b07822b9c826d9549366b8dc2c232a008e20
verdict: ready
issue_counts:
  low: 3
  high: 0
  critical: 0
  medium: 2
  info: 1
findings:
- id: E1
  severity: medium
  category: coverage
  summary: NFR-001, NFR-004 and SC-006 (built example byte-identical and deterministic) have no work-package check; the mission driver compares CI builds and records the result in the pull request.
- id: E2
  severity: medium
  category: coverage
  summary: WP06 (consumer proof) and every build-level gate can only be verified by CI on the draft pull request, not inside a work package.
- id: E3
  severity: low
  category: coverage
  summary: SC-005 and C-005 appear in no requirement_refs; SC-005 follows from SC-003 and C-005 is a sequencing constraint carried in tasks.md.
- id: F1
  severity: low
  category: inconsistency
  summary: The source check assumes index names README,index without --index-basename while the site default is README; deliberate for compatibility and documented in the plan and guide task.
- id: C1
  severity: low
  category: underspecification
  summary: FR-021 holds on a build or dev-server start; a rename while the dev server runs needs a restart. Stated in the spec; no automated check for the dev-server case.
---

## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| E1 | Coverage | MEDIUM | spec.md NFR-001, NFR-004, SC-006; tasks.md Notes | The built example must be byte-identical and deterministic, but no work package can build it locally. | Driver compares the example build from CI on `main` and on the head and records the result, or that it could not be compared, in the pull request. |
| E2 | Coverage | MEDIUM | tasks/WP06; plan.md Technical Context | The consumer proof and all build-level gates are verified only by CI. | Open the draft pull request early enough to iterate on CI; treat a red Consumption test as WP06 rework. |
| E3 | Coverage | LOW | spec.md SC-005, C-005 | Neither is in a work package's `requirement_refs`. | None needed: SC-005 is a consequence of SC-003; C-005 is carried by the cut note in tasks.md. |
| F1 | Inconsistency | LOW | plan.md Design (source check); tasks/WP05 T024 | CLI default index names differ from the site default. | Keep; documented, and WP07 T032 tells adopters to pass their own setting. |
| C1 | Underspecification | LOW | spec.md FR-021; tasks/WP04 T020 | The dev-server rename case has no check. | Accept; state the limit in ADR-0047 (already in WP07 T030). |

**Info (resolved before this report was recorded).** The first draft of WP07 told the implementer to add `## Update` notes to accepted ADR-0046 and ADR-0026. The charter says ADRs are immutable once accepted, so that was a charter conflict. WP07, the plan and the spec were changed first: the Gherkin and glossary changes are recorded in a new ADR-0048 that amends both, and no accepted ADR is edited (C-001 widened to say so).

**Coverage Summary Table:**

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001, FR-002, FR-005 | yes | T006, T007, T010 | red-first from the existing warn-and-delete test |
| FR-003, FR-004, FR-004a | yes | T008, T009, T010 | hook-level arm proves the `config.ts` pass-through |
| FR-006, FR-007, FR-009 | yes | T011, T012, T015 | file name asserted per setting |
| FR-008 | yes | T013, T014, T015 | stop on authored target; guarded prune |
| FR-010 | yes | T001 to T005 | agreement test with a draft in a two-index folder |
| FR-011 to FR-014 | yes | T016 to T019 | through the real Markdown processor |
| FR-021 | yes | T018, T020 | route table in the config digest |
| FR-015 to FR-017 | yes | T021 to T025 | flags have their own tests |
| FR-020 | yes | T026 to T029 | CI only |
| FR-018, FR-019 | yes | T030 to T034 | two new ADRs, guide, changelog |
| NFR-002, NFR-005, NFR-006 | yes | per-package definition of done | |
| NFR-001, NFR-004, SC-006 | driver | none | see E1 |
| NFR-003 | driver | none | observation in the pull request |

**Charter Alignment Issues:** none open. One was found and fixed before recording (see Info).

**Unmapped Tasks:** none. All 34 subtasks belong to a work package with requirement refs.

**Metrics:**

- Total requirements: 22 functional, 6 non-functional, 7 constraints, 6 success criteria
- Total tasks: 34 subtasks in 7 work packages
- Coverage (functional requirements with at least one task): 100%
- Ambiguity count: 0
- Duplication count: 0
- Critical issues: 0

**Re-recorded after the WP05 review (cycle 1).** The spec and plan changed in one respect: a link to an unpublished draft page is reported only on a strict root, like a link to a file outside the docs tree, and the root index page is never treated as unpublished. The WP05 review found that reporting draft targets on every root broke the existing CI link step for this repository's unbuilt `docs/`. No finding above changes.

**Next actions:** proceed to implementation. E1 and E2 are discharged on the draft pull request, not in a work package.
