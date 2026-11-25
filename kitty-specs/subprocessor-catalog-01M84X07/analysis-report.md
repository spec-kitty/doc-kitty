---
schema_version: 1
artifact_type: spec-kitty.analysis-report
command: /spec-kitty.analyze
mission_slug: subprocessor-catalog-01M84X07
mission_id: 01M84X07GSZS94MXX0RYYNMBJK
generated_at: '2026-11-25T12:48:36.090693+00:00'
analyzer_agent: unknown
input_artifacts:
  spec.md:
    path: .worktrees/subprocessor-catalog-01M84X07-coord/kitty-specs/subprocessor-catalog-01M84X07/spec.md
    sha256: ccce750262e4bfbb0489a892f587328a493d811ac66bb3f818eca32a8508cc63
  plan.md:
    path: .worktrees/subprocessor-catalog-01M84X07-coord/kitty-specs/subprocessor-catalog-01M84X07/plan.md
    sha256: 69ea52cb748c582005ad66443ce06cd4fbec111dc74694651960b5ffea665868
  tasks.md:
    path: .worktrees/subprocessor-catalog-01M84X07-coord/kitty-specs/subprocessor-catalog-01M84X07/tasks.md
    sha256: 953c8d4ef51ea7a562498493913202167aab70f3c523926ead08b9d88cc994af
  charter:
    path: .kittify/charter/charter.yaml
    sha256: 92e9e079284707d74cdd3581a99487c314195e1a1e4efa1a7445c75af2fcd07f
verdict: ready
issue_counts:
  low: 3
  critical: 0
  high: 0
  medium: 0
  info: 0
findings:
- id: C1
  severity: low
  category: coverage
  summary: 'FR-017 (generated list page) has no delivering WP: WP07 is canceled and the requirement is deferred to follow-up #461 by operator ruling (option B). The spec records the deferral in FR-017, C-004, C-005, US5 and IC-05.'
- id: U1
  severity: low
  category: underspecification
  summary: The findBaselessFeedUrls JSDoc and failure reason still name only rss.xml, llms.txt and api/** although the scan now covers subprocessors.xml (WP06 review nit), queued for R24.
- id: U2
  severity: low
  category: underspecification
  summary: The MCP corpus fixture carries the two sub-processor links and api/subprocessors.json by hand; a full re-mint is owed once a PlantUML render server is available. Record this in the PR body.
---

## Specification Analysis Report (re-run after the spec touch-up)

Mission `subprocessor-catalog-01M84X07`, coordination branch at the touch-up
commit 5cba2cde and the issue-matrix rows for #455 and #461.

### Status of earlier findings

| Earlier finding | State |
|-----------------|-------|
| I1: #445 described as unmerged | Resolved: the dependencies record ADR-0087 as merged, and FR-017 is deferred to #461. |
| U1: no-catalog dist byte comparison | Resolved in WP05: the fixture build test compares every stock file, masking only the glossary's build-time instant, plus the served bytes and a real rebuild. |
| U2: `pnpm lint` not named | Resolved in practice: root lint and typecheck ran clean before the WP05 hand-off, and eslint ran on every changed file. |
| D1: docs after the behaviour WPs | Resolved: WP06 delivered the guide and changelog, all in one PR. |
| F1: feed links to JSON | Remains by design until #461 passes `itemLink`. |
| F2: issue-matrix rows | Resolved: #403 in-mission; #359, #400, #402, #445, #455 and #461 not-applicable, each with evidence. |
| WP01 review: FR-006 biblio only | Resolved: FR-006 names `{type: biblio | tool, id}`. |
| WP04 review: F2, F3, F4 contract drift | Resolved: the feed element order, no trailing newline, and the ChangeEntry key order now match the code. |

### Current findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C1 | Coverage | LOW | spec.md FR-017, C-004; tasks WP07 (canceled) | FR-017 has no delivering WP in this mission. | Accept as deferred to #461 by operator ruling. No change. |
| U1 | Underspecification | LOW | src/scripts/assert-no-broken-links.mjs, JSDoc of `findBaselessFeedUrls` | The doc comment does not mention `subprocessors.xml`. | Fold at R24. |
| U2 | Underspecification | LOW | mcp/tests/corpus/fixtures/README.md | A partial carry-over, with a full re-mint owed. | Note in the PR body. |

### Coverage summary

| Requirement | Delivered by | Notes |
|-------------|--------------|-------|
| FR-001 to FR-007 | WP02 (approved) | |
| FR-008 | WP03, WP05 (approved) | Parity across 12 catalogs |
| FR-009 to FR-013 | WP04, WP05 (approved) | |
| FR-014 | WP01 (approved) | ADR-0086, Proposed |
| FR-015, FR-016 | WP06 (approved) | |
| FR-017 | none | Deferred to #461 (C1) |
| NFR-001 to NFR-005 | WP02 to WP06 | |
| C-001 to C-007 | WP01 to WP06 | C-004 now records the #461 deferral |

**Charter alignment**: no issues. The structural change is recorded in ADR-0086,
the docs ship in the same PR, and the doc-sanity gates pass.

**Metrics**: 29 requirements; 28 delivered by approved WPs; 1 deferred by
ruling. 28 of 34 subtasks done; WP07's 6 subtasks are canceled with it.
Ambiguity 0, duplication 0, critical 0.

## Next actions

- The verdict is ready: proceed to `spec-kitty accept`, then the consolidate dry run.
- Fold U1 at R24, and carry U2 into the PR body.
