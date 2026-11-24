---
schema_version: 1
artifact_type: spec-kitty.analysis-report
command: /spec-kitty.analyze
mission_slug: large-hubs-paged-hub-listing-01M84WYV
mission_id: 01M84WYVDYWGBH777TED2ZYGC8
generated_at: '2026-11-24T16:06:07.270966+00:00'
analyzer_agent: unknown
input_artifacts:
  spec.md:
    path: .worktrees/large-hubs-paged-hub-listing-01M84WYV-coord/kitty-specs/large-hubs-paged-hub-listing-01M84WYV/spec.md
    sha256: 8d2763f607cd2eecc1e6e24b8173692c31ad03e0551d28e6b74d9ee7bb8f3691
  plan.md:
    path: .worktrees/large-hubs-paged-hub-listing-01M84WYV-coord/kitty-specs/large-hubs-paged-hub-listing-01M84WYV/plan.md
    sha256: 9ad9b74e8554feac6fefc92b9cb1d0e52e464f1d8d35d9330b22c531dad82724
  tasks.md:
    path: .worktrees/large-hubs-paged-hub-listing-01M84WYV-coord/kitty-specs/large-hubs-paged-hub-listing-01M84WYV/tasks.md
    sha256: 1c67f088445280ec7d89c43f29fcff0767308ee57ce1a8e572481256d6c47e6e
  charter:
    path: .kittify/charter/charter.yaml
    sha256: 92e9e079284707d74cdd3581a99487c314195e1a1e4efa1a7445c75af2fcd07f
verdict: ready
issue_counts:
  critical: 0
  low: 4
  high: 0
  medium: 2
  info: 0
findings:
- id: U1
  severity: medium
  category: underspecification
  summary: FR-014 (search must not make a child harder to find) is only proven by a Playwright check (WP06 T028), and CI is authoritative for that lane, so local evidence may be partial.
- id: U2
  severity: medium
  category: coverage
  summary: "WP05 adds a kind: Listing agent record; the MCP package reads the agent API but sits outside every WP's ownership, so a client break would surface late."
- id: I1
  severity: low
  category: inconsistency
  summary: Spec FR-010 says a paged page shows the hub's 'lead'; plan, data-model and WP04 render the hub's description. Same intent, different word.
- id: I2
  severity: low
  category: inconsistency
  summary: WP04 registers the paged-hubs integration in src/lib/config.ts, which WP02 owns; it is a sequential, recorded out-of-map edit, not a parallel collision.
- id: D1
  severity: low
  category: duplication
  summary: FR-005 and NFR-005 both pin byte-identical output for unpaged hubs/sites; kept deliberately (behaviour vs regression gate) but overlapping.
- id: C1
  severity: low
  category: coverage
  summary: Edge case 'a draft hub index is not paged' relies on WP02 reusing the slice-1 published-hub filter; no new explicit paged-hub test is listed for it.
---

## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| U1 | Underspecification | MEDIUM | spec.md FR-014; WP06 T028 | Search ranking is proven only in the browser lane (CI authoritative) | Keep. The WP06 reviewer must see the CI a11y lane green before approval, not only a local run |
| U2 | Coverage | MEDIUM | WP05 Risks; `mcp/` | A new `kind: Listing` record may affect the MCP client, which no WP owns | The WP05 implementer runs the `mcp` tests (part of `pnpm test`) and reports. If one breaks, add a fold under WP05 with the out-of-map rationale |
| I1 | Inconsistency | LOW | spec.md FR-010; data-model "Listing page" | "lead" vs "description" | Treat the lead as the hub's `description`. The WP04 prompt already says so |
| I2 | Inconsistency | LOW | WP04 T017; WP02 owned_files | Out-of-map edit of `config.ts` | Acceptable: WP02 is approved before WP04 claims. Record it in the WP04 hand-off |
| D1 | Duplication | LOW | spec.md FR-005, NFR-005 | Overlapping byte-identity rules | None needed |
| C1 | Coverage | LOW | spec.md Edge Cases; WP02 | Draft hub not paged has no new test | WP02 adds one assertion: a draft hub over its cap has no entry, so it is not paged |

**Coverage Summary Table:**

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 hub data every hub | Yes | T007, T008, T011 | WP02 |
| FR-002 backward-compatible types | Yes | T002, T008 | WP01, WP02 |
| FR-003 page-size setting | Yes | T001, T003, T004, T005, T008 | WP01, WP02 |
| FR-004 invalid page size | Yes | T003, T004, T005 | |
| FR-005 only capped hubs paged | Yes | T008, T015 | |
| FR-006 first page on hub | Yes | T015 | |
| FR-007 static paged pages | Yes | T018, T020 | |
| FR-008 accessible pagination | Yes | T014, T020, T028 | |
| FR-009 localisable strings | Yes | T006, T015, T021 | |
| FR-010 frame | Yes | T018, T020 | |
| FR-011 self-canonical | Yes | T018, T020, T026 | |
| FR-012 sitemap | Yes | T020, T026 | |
| FR-013 agent surfaces | Yes | T022–T025, T026 | |
| FR-014 search | Yes | T028 | U1 |
| FR-015 gates | Yes | T025, T026, T027 | |
| FR-016 page collision | Yes | T009, T021 | |
| FR-017 consumer sidebar | Yes | T011, T021 | |
| FR-018 locales | Yes | T011, T021 | |
| FR-019 exported API | Yes | T001 | |
| FR-020 documentation | Yes | T026, T030–T033 | |
| NFR-001/002 measurements | Yes | T029 | |
| NFR-003 determinism | Yes | T011, T020 | |
| NFR-004 accessibility | Yes | T014, T016, T028 | |
| NFR-005 no regression | Yes | T011, T012, T021, T025 | |
| NFR-006 no scripts | Yes | T014 | |
| C-001..C-006 | Yes | across WPs | |

**Charter Alignment Issues:** none. The plan's Charter Check passes on every point: agent interoperability, separated axes, WCAG 2.2 AA, the Starlight frame, ADR-0063, living docs, changelog by fragment, and tests.

**Unmapped Tasks:** none.

**Metrics:**

- Total requirements: 20 FR + 6 NFR + 6 C + 6 SC
- Total tasks: 33 (T001–T033) in 7 WPs
- Coverage: 100% of FRs have at least one task (map-requirements: 20/20)
- Ambiguity count: 1 (I1)
- Duplication count: 1 (D1)
- Critical issues: 0

## Note

Re-recorded on 2026-11-24 after the ADR number moved from 0086 to 0089 (dispatcher allocation, research R9). The findings are unchanged.

## Next actions

There are no critical or high findings, so implementation may proceed. U1 and U2 are reviewer checkpoints: CI a11y green for WP06, and the `mcp` tests in WP05's `pnpm test` run. C1 is a one-line test that the WP02 implementer adds. No planning artifact needs editing.
