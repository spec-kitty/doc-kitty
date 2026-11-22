---
work_package_id: WP07
title: Measures relation section in the OKF export
dependencies: []
requirement_refs:
- FR-009
planning_base_branch: feat/406-tom-classification
merge_target_branch: feat/406-tom-classification
branch_strategy: Planning artifacts for this mission were generated on feat/406-tom-classification. During /spec-kitty.implement this WP runs in the lane worktree computed in lanes.json, and completed changes merge back into feat/406-tom-classification unless the human explicitly redirects the landing branch.
subtasks:
- T023
- T024
- T025
agent: claude
history:
- timestamp: '2026-11-22T13:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/okf-export/
create_intent:
- src/tests/okf-export-measures.test.ts
- src/tests/fixtures/okf-export-measures/graph.json
execution_mode: code_change
owned_files:
- src/lib/okf-export/core.mjs
- src/tests/okf-export-measures.test.ts
- src/tests/fixtures/okf-export-measures/**
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP07 - Measures relation section in the OKF export

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

The OKF export core reads only `graph.edges` (C-010). Give it a `## Measures` relation section, rendered from `classified-as` edges, so a classified page's concept document lists its measures. Work from the edge contract with a fixture graph. This WP does not need WP05's code.

Requirements: FR-009. Depends on: none (contract only; see `contracts/machine-surfaces.md`).

## Branch strategy

- Planning branch and final merge target: `feat/406-tom-classification`. The worktree comes from `lanes.json`. Run `spec-kitty agent action implement WP07 --agent claude --mission tom-classification-measures-catalog-01M81M7T`.

## Context

- `src/lib/okf-export/core.mjs`: `RELATION_SECTIONS` (ordered `[rel, heading]`), `relationLine(edge, target, indexNames)`, and `relationSections(edges, nodes, indexNames)`. A catalog node with a `url` already renders as a link. The `cites` branch collects unlinked targets into `sources`. For measures, an unlinked target renders as plain text instead (no `sources` entry).
- Conformance: `src/lib/okf-export/conformance.mjs` must still accept the bundle. Run the existing `okf-export*.test.ts` suites.
- Existing fixture: `src/tests/fixtures/okf-export/graph.json`. **Do not edit it**, because it belongs to other suites. Make a new fixture dir.

## Subtasks

### T023: Section and line rendering

1. Insert `['classified-as', 'Measures']` into `RELATION_SECTIONS` after `['cites', 'References']` and before `['derived-from', 'Derived from']`.
2. In `relationLine`, for `edge.rel === 'classified-as'` the suffix is ` (organisation)` when `edge.scope === 'organisation'`, followed by the note suffix (` - <note>`) when present. A target with an http(s) `url` renders `- [label](url)<suffix>`. A target without a URL renders `- <escaped label><suffix>` (not `null`).
3. Update the JSDoc `ExportGraph` edge typedef with `scope?: string`.
4. A graph with no `classified-as` edges must produce byte-identical output (the section is skipped when empty, as today).

### T024: Fixture graph

`src/tests/fixtures/okf-export-measures/graph.json` is a minimal valid graph, with source files as the existing okf tests need them (read `okf-export.test.ts` to see how it supplies `sourceFiles`). It has:

- page `security/audit-log`, with edges `classified-as` to `catalog:measure:events-logging` (note "Every admin action is logged.", scope system) and to `catalog:measure:accountability` (scope organisation);
- a measure node without `url` (`catalog:measure:custom-x`) and one edge to it;
- a page with no classified-as edges.

### T025: Tests (write first)

`src/tests/okf-export-measures.test.ts`:

- the `security/audit-log` concept document contains exactly:

  ```markdown
  ## Measures

  - [Events logging](https://w3id.org/dpv#ActivityMonitoring) - Every admin action is logged.
  - [Accountability](https://w3id.org/dpv#ComplianceMonitoring) (organisation)
  ```

  plus the plain-text `custom-x` line. Lines come in edge order (code unit by target, as the graph sorts).
- the section sits after `## References` when both exist (add a cites edge to prove the order);
- the page without edges has no `## Measures`;
- conformance check passes on the produced map;
- two runs give an identical map (determinism).

## Definition of done

- New and existing OKF tests green (red first); lint and typecheck clean (`// @ts-check` holds); no suppressions.

## Reviewer guidance

- No relation resolution in the export; everything comes from edges and nodes.
