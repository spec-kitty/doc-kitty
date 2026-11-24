---
work_package_id: WP05
title: 'Build gates: artifact gate, drafts, byte stability, empty site'
dependencies:
- WP03
- WP04
requirement_refs:
- FR-005
- FR-006
- FR-007
- FR-012
- NFR-001
- NFR-002
- NFR-004
- NFR-005
- SC-001
- SC-003
- SC-004
planning_base_branch: feat/401-tom-annex-export
merge_target_branch: feat/401-tom-annex-export
branch_strategy: Planning artifacts for this mission were generated on feat/401-tom-annex-export. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/401-tom-annex-export unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-tom-annex-export-01M84YDP
base_commit: 5dfb044213d344d3f6c7e14dff6883476906c145
created_at: '2026-11-24T00:27:17.513796+00:00'
subtasks:
- T021
- T022
- T023
- T024
- T025
agent: claude
history:
- timestamp: '2026-11-23T21:18:04Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/tests/tom-annex-build.test.ts
create_intent:
- src/tests/tom-annex-build.test.ts
- src/tests/assert-build-artifacts-tom-annex.test.ts
execution_mode: code_change
owned_files:
- src/scripts/assert-build-artifacts.mjs
- src/tests/tom-annex-build.test.ts
- src/tests/draft-publication-build.test.ts
- src/vitest.workspace.ts
- src/tests/assert-build-artifacts-tom-annex.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP05 - Build gates: artifact gate, drafts, byte stability, empty site

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Prove on **real builds** what the unit tests in WP01, WP03 and WP04 only model,
and keep it proven in CI:

- the artifact gate checks the annex and its link (FR-005);
- drafts never count as evidence (FR-006);
- two builds give the same annex bytes with no mask (FR-007, NFR-001, SC-003);
- a site with no classified pages gains nothing and fails nothing (FR-012, SC-004);
- the build cost stays within budget (NFR-002).

Requirements: FR-005, FR-006, FR-007, FR-012, NFR-001, NFR-002, NFR-004, NFR-005,
SC-001, SC-003, SC-004. Depends on: WP03, WP04.

## Branch strategy

- The planning branch and final merge target are both `feat/401-tom-annex-export`.
- The worktree comes from `lanes.json`.
- Run `spec-kitty agent action implement WP05 --agent claude --mission tom-annex-export-01M84YDP`.

## Context

- **Artifact gate**: `src/scripts/assert-build-artifacts.mjs`.
  - `assertAgentLinksResolve` (lines 415-510) already follows every in-site `_links` href and fails if the file was not built (line 494). The link existence check is therefore free.
  - `assertTomClassification` (lines 588-633) checks the example's measure node and its `classified-as` edges. Add the annex checks beside it, and call them where it is called (about line 2545).
  - `loadContentGraph` is at line 515.
- **Two-builds harness**: `src/tests/draft-publication-build.test.ts`.
  - It builds `off` and `offRepeat`, and compares them with `diffSurfaces()` (line 191) over `MACHINE_SURFACE_GLOBS`.
  - The tests are "two drafts-off builds produce byte-identical machine surfaces (NFR-006)" (line 467) and the page-HTML variant (line 471).
- **Build suites must be serialised**: register every new file that spawns `astro build` in `BUILD_SUITES` in `src/vitest.workspace.ts`.
- **The example has classified pages**: `example/docs/architecture/audit-logging.md` and `example/docs/context/incident-handling.md`.

## Subtasks

### T021 — Artifact gate checks the annex

**Steps**:
1. Add `assertTomAnnex(distDir, graph)` to `assert-build-artifacts.mjs`:
   - **When the graph has `classified-as` edges**:
     - `api/tom-annex.json` exists;
     - `_links.tomAnnex` is in `api/index.json`;
     - the file parses, with `format === 'doc-kitty/tom-annex'` and `format_version` matching `^1\.\d+$`;
     - `label` is exactly the constant. Import it from `../lib/tom-annex/core.mjs`, as the script imports other lib modules;
     - every evidence `url` path is a built page;
     - **the annex agrees with the graph**: the set of `(measure, scope, page)` triples in the annex equals the set of `classified-as` edges in the graph, both mapped to ids. This is what makes FR-006 hold end to end.
   - **When the graph has none**: the file is **absent** and the link is absent.
2. Unit-test the assertion in `src/tests/assert-build-artifacts-tom-annex.test.ts`
   with small temp `dist` trees: a good tree passes; a tree with a missing file,
   a wrong label, an extra evidence triple, or a file without edges each fails
   with a clear message. This is the same-fixture positive and negative control.

### T022 — Drafts are absent (FR-006)

**Steps**:
1. In `src/tests/tom-annex-build.test.ts`, build a small fixture site. Prefer
   copying the example to a temp dir, as `exclude-folders-build.test.ts` and
   `draft-publication-build.test.ts` do: read how they create `tmp-site-*`
   fixtures and clean up.
2. In the copy, set one classified page to `doc_status: draft`, keeping it
   classified, and leave the other classified page published.
3. Assert:
   - the draft's route is in no `evidence[].url`;
   - the measure only the draft listed is in `uncovered`;
   - the published page is still present. This is the positive control, in the
     same build.

### T023 — Two builds, identical annex bytes, no mask (FR-007)

**Steps**:
1. Add `api/tom-annex.json` to `MACHINE_SURFACE_GLOBS` in
   `draft-publication-build.test.ts`, so the existing NFR-006 two-builds test
   covers it.
2. Check that the drafts-off fixture there actually has classified pages, so the
   glob matches a file. Add an explicit `expect(existsSync(...))` so the glob
   cannot silently match nothing; that is the non-vacuity guard.
3. Check that the masking code in that test does not mask anything inside the
   annex. If it masks ISO timestamps globally, exclude the annex from the mask
   and say why in a comment: NFR-001 requires no mask.

### T024 — No classified pages: nothing changes (FR-012)

**Steps**:
1. In `tom-annex-build.test.ts`, build a copy of the example with
   `tom_classification` stripped from both pages. Use a tiny frontmatter rewrite
   in the temp copy, not a new fixture tree.
2. Assert:
   - no `dist/api/tom-annex.json`;
   - no `_links.tomAnnex`;
   - no `okf/tom-annex.json`;
   - the build exits 0;
   - `pnpm assert:artifacts`-equivalent (call the script on that dist) passes.
3. Positive control: the unmodified example build in the same test file has all
   three outputs.

### T025 — Registration and the build-time budget

**Steps**:
1. Add `tests/tom-annex-build.test.ts` to `BUILD_SUITES` with a comment, as the
   other entries have.
2. NFR-002 (no more than 2% or 1 s): measure the example build time with the
   annex route and with it forced off (an env toggle is not wanted, so compare
   against the classified-stripped copy from T024). Report both numbers in the
   hand-off.
   - Do **not** add a timing assertion to CI, because it is flaky.
   - If the overhead exceeds the budget, the shared graph (WP02) is not working:
     investigate before handing off.

## Definition of Done

- [ ] The artifact gate checks shape, label, link and graph agreement, and absence when there are no edges. Unit-tested with controls.
- [ ] The build tests for drafts, empty site and two builds pass. Each has a same-build or same-file positive control.
- [ ] The annex is in `MACHINE_SURFACE_GLOBS` and is not masked.
- [ ] The new build suite is registered in `vitest.workspace.ts`.
- [ ] Build-time numbers are reported.
- [ ] `pnpm test` passes in full, and `pnpm assert:artifacts` passes on an example build.

## Risks

- **Build-test runtime.** Reuse one temp copy per variant, and build each variant
  once per file.
- **Shared `example/.astro` cache races.** Build into your own out dir, as the
  existing build suites do (see the comments in `vitest.workspace.ts`).

## Reviewer guidance

- Run the gate unit tests and read each negative case's message.
- Confirm the graph-agreement check compares sets of triples, not counts.
