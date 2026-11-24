---
work_package_id: WP04
title: OKF export carries the annex
dependencies:
- WP03
requirement_refs:
- FR-011
- FR-004
- FR-012
- NFR-001
- NFR-004
- NFR-005
planning_base_branch: feat/401-tom-annex-export
merge_target_branch: feat/401-tom-annex-export
branch_strategy: Planning artifacts for this mission were generated on feat/401-tom-annex-export. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/401-tom-annex-export unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-tom-annex-export-01M84YDP
base_commit: b9f47620d2e5bc834f940ebf8c74103f3b4fa4a9
created_at: '2026-11-23T23:40:29.229180+00:00'
subtasks:
- T017
- T018
- T019
- T020
agent: claude
history:
- timestamp: '2026-11-23T21:18:04Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/okf-export/
create_intent:
- src/tests/okf-export-tom-annex.test.ts
execution_mode: code_change
owned_files:
- src/lib/okf-export/core.mjs
- src/lib/okf-export/disk.mjs
- src/lib/okf-export/integration.ts
- src/scripts/export-okf.mjs
- src/tests/okf-export-tom-annex.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP04 - OKF export carries the annex

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

When a build produced `dist/api/tom-annex.json`, the OKF bundle (ADR-0059)
carries it as `tom-annex.json`, and the bundle's root `index.md` links it with the
"evidence index, not the contractual annex" label. When there is no annex, the
bundle is byte-identical to today's.

Requirements: FR-011, FR-004, FR-012, NFR-001, NFR-004, NFR-005. Depends on: WP03.

## Branch strategy

- The planning branch and final merge target are both `feat/401-tom-annex-export`.
- The worktree comes from `lanes.json`.
- Run `spec-kitty agent action implement WP04 --agent claude --mission tom-annex-export-01M84YDP`.

## Context

- `okfExportIntegration` (`src/lib/okf-export/integration.ts`) runs in
  `astro:build:done`. It reads `dist/api/content-graph.json` (and throws if it is
  missing) and the docs tree, then calls `exportOkfToDisk` (`disk.mjs:55`), which
  calls `exportOkfBundle(graph, sourceFiles, options)` (`core.mjs:542`).
- `exportOkfBundle` is pure. It returns a `Map<bundlePath, text>`, sorted at the
  end with `compareCodeUnit`.
- The precedent for adding files is `addOpenApiDocuments` (`core.mjs:558`), which
  calls `out.set(path, text)` before the final sort.
- The root `index.md` carries the `okf_version` fence. Find where it is composed
  and how OpenAPI documents, if any, are listed there.
- The CLI `src/scripts/export-okf.mjs` reads `--dist`/`--graph` and `--docs`.

## Subtasks

### T017 — `exportOkfBundle` accepts the annex

**Steps**:
1. Red test (`src/tests/okf-export-tom-annex.test.ts`): calling `exportOkfBundle`
   with `options.tomAnnex = <serialised text>` puts `tom-annex.json` in the map,
   **byte-identical to the input**. Do not reserialise it: the bundle must carry
   the exact bytes the site serves, so a hash taken on one matches the other.
2. Implement: `if (options.tomAnnex !== undefined) out.set('tom-annex.json', options.tomAnnex)`,
   before the sort. Validate cheaply: the text parses as JSON with
   `format === 'doc-kitty/tom-annex'`. Otherwise throw a `[dk-okf]` error that
   names the problem.

### T018 — A labelled line in the root `index.md`

**Steps**:
1. Red test: with an annex, the root `index.md` contains one line linking
   `tom-annex.json` whose text includes `TOM_ANNEX_LABEL`, imported from
   `src/lib/tom-annex/core.mjs`. Without one, the line is absent.
2. Place it in a stable position, next to the other non-page entries such as the
   OpenAPI documents if they are listed. Keep the existing ordering rules.

### T019 — The integration and the CLI read the built artifact

**Steps**:
1. `integration.ts`: after reading the graph, read `dist/api/tom-annex.json` **if
   it exists**. Its absence is normal (FR-012); never throw for it. Pass it
   through `exportOkfToDisk` as `tomAnnex`.
2. `export-okf.mjs`: the same, under the `--dist` it already takes. If the CLI
   only has `--graph`, add an optional `--tom-annex <path>`, and default to
   `<dist>/api/tom-annex.json` when `--dist` is given. Update its `--help` text.
3. Red tests: drive `exportOkfToDisk` (or the CLI, through `execFileSync` as
   other CLI tests do) with a temp dist that has, and then lacks, the annex file.

### T020 — No-annex ratchet

**Steps**:
1. Ratchet test: for the existing OKF fixtures (see
   `src/tests/okf-export-measures.test.ts` and other okf tests), the bundle map
   with no `tomAnnex` option is deep-equal to the output before your change.
   Capture the expectation from the unchanged code first.
2. Positive control on the same fixture: adding the option changes exactly two
   entries, the new file and the root index.

## Definition of Done

- [ ] With an annex, the bundle has `tom-annex.json` with the same bytes, and a labelled root-index line.
- [ ] Without one, the bundle is unchanged (ratchet with a positive control).
- [ ] The integration and the CLI both pick it up from `dist`, and neither throws when it is absent.
- [ ] `pnpm test` passes in full.

## Risks

- **The `okf_version` fence and bundle ordering.** Keep the final
  `compareCodeUnit` sort as the single source of order.
- **Label drift.** Import the constant; never retype it.

## Reviewer guidance

- Compare `dist/api/tom-annex.json` and `dist/okf/tom-annex.json` bytes on an
  example build (`cmp`).
- Confirm the absent-file path has no try/catch that swallows other read errors.
