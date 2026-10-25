---
work_package_id: WP01
title: Overview page emission (#238)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- NFR-001
- NFR-002
- NFR-003
- C-001
- C-003
planning_base_branch: fix/index-page-bodies
merge_target_branch: fix/index-page-bodies
branch_strategy: Planning artifacts for this mission were generated on fix/index-page-bodies. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/index-page-bodies unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-index-page-bodies-01M5S2ET
base_commit: 976548d279dd0fe10f0fabd74f7cae14b6bfb2c1
created_at: '2026-10-25T08:59:21.536310+00:00'
subtasks:
- T001
- T002
- T003
- T004
history:
- '2026-10-25: created by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/okf-export/
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/okf-export/core.mjs
- src/tests/okf-export.test.ts
- src/tests/okf-export-links.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load the `implementer-ivan` profile with the `/spk-charter-profile-load` skill before you read anything else.

## Objective

Fix #238. The OKF export drops the body of section-index README pages. When a README's body is non-empty once its frontmatter is stripped (`matter(source).content.trim() !== ''`), the export should:
1. write a sibling concept page at `<id>.md` (for example `guides/README.md`, or `README.md` at the root);
2. list that page first in its `index.md`, as a strict OKF §8 entry.

`index.md` itself stays headings and entries only. Do NOT change conformance rule 4 (`conformance.mjs`) or link resolution (`links.mjs`).

Read first: `kitty-specs/index-page-bodies-01M5S2ET/spec.md` and `plan.md`.

## Context: `src/lib/okf-export/core.mjs`

- `exportOkfBundle` (~:430-462) loops over the exported `page` and `persona` nodes:
  - Non-index nodes are written by `conceptDocument(node, source, edges, nodes, indexNames, links)`.
  - The root index (`path === 'index.md'`) gets the `okf_version` fence plus `indexDocument(...)`.
  - Other indexes get `indexDocument(...)` plus a sidecar from `sidecarOf(source)`.
- `indexDocument(index, children, indexNames)` (~:314) builds `# title`, a blank line, then the entries sorted by `compareCodeUnit` on the path.
- `bundlePathOf` maps index ids to `index.md`. That is intentional, and links to a README must keep resolving to the index (#237). So build the overview page's path directly, as `` `${node.id}.md` ``, and don't change `bundlePathOf`.

## Subtasks

### T001 and T002: red-first tests

Write these first and confirm they FAIL on the current code. Record the failure output in your hand-off.
- A section README `guides/README` with a body:
  - **Body and links:** it links `./add-a-session-note.md` and `../other/README.md`. `guides/README.md` exists, with concept frontmatter and the body with frontmatter stripped. The links become `/guides/add-a-session-note.md` and `/other/index.md`.
  - **Index entry:** the first entry in `guides/index.md` is `- [<title>](/guides/README.md) - <description>`, followed by the children.
  - **Sidecar:** `guides/_index.meta.yaml` is unchanged.
- A byte-exact expectation (a literal) for `guides/index.md` and `guides/README.md` in one small fixture.
- **Root README with a body:** a `README.md` concept page is written, and the root `index.md` keeps `okf_version` as its only frontmatter and lists `/README.md` first.
- **Persona README:** a node with `kind: 'persona'` and id `context/audience/README` gets the same treatment.
- **Configured `indexBasename`** (for example `_index`): the sibling is `<dir>/_index.md`.
- **Body-less README** (frontmatter only, or whitespace only): no sibling file, and the index is byte-identical to the current output.

### T003: implementation

- Add a small `hasBody(source)` helper.
- Extend `indexDocument` with an optional leading overview entry. Without one, it must produce exactly the current bytes.
- In both index branches, when `hasBody(source)`, also `out.set(`${node.id}.md`, conceptDocument(...))`.
- Keep the complexity of every function at 15 or below. Add JSDoc in the file's existing style.

### T004: parity, conformance, CLI (scout findings folded)

- **Unbased snapshot.** The parity fixture (`okf-export-links.test.ts` ~:128-133, `graph.nodes.slice(0,4)`) includes the root `README` with the body `'Home body.'`, so the snapshot `__snapshots__/okf-export-unbased.txt` WILL change. Regenerate it as a reviewed, intended diff, and make sure the diff is purely ADDITIVE:
  - a new `README.md` file;
  - one new first entry line in `index.md`.

  Every pre-existing file and line must stay byte-identical. Show the snapshot diff in your hand-off.
- **Committed fixture.** `tests/fixtures/okf-export/docs/README.md` (`Welcome.`) and `guides/README.md` (`Original index prose.`) have bodies. In `okf-export.test.ts` they affect:
  - the expected key list (~:41-51), which gains `README.md` and `guides/README.md`;
  - the index assertions (~:66-73);
  - the CLI tests that use `FIX` (~:295).

  Update these as intended edits, not weakenings. Don't remove the fixture bodies, because they are now the positive control.
- **Collision guard.** If `` `${node.id}.md` `` equals the index's own bundle path (when the basename is `index`), write NO sibling and keep the current output. Add a test row with `indexBasename: 'index'`.
- **Frontmatter `type`.** Assert the overview page's frontmatter `type` in the byte-exact literal. `typeOf` falls back to `Concept` in synthetic graphs.
- **Relations.** Add a row where an index node has a `related` edge. The relation section appears on the overview page, and there are no self-links.
- Add a row showing that `checkOkfBundle` returns no violations for the overview fixture.
- Add a CLI row: export a docs dir whose README has a body, then confirm `--check` exits 0.
- **Brownfield hazard.** The base-hint test at ~:265 (`See [setup](/docs/setup/).`) is affected once README bodies are exported: its `single` case ("one stray link → no hint") may see two stray links. Keep the test's intent: make its README body link-free, and keep the assertions. Don't weaken the hint logic. Explain any test edit in your hand-off.

## Running tests

Each lane worktree needs its own install: `corepack pnpm install --frozen-lockfile` at the worktree root. Then, from `src/`, run `./node_modules/.bin/vitest run tests/okf-export.test.ts tests/okf-export-links.test.ts`. Also run the full fast suite, ESLint on the changed files, and `tsc`, and compare each against `main`.

## Definition of Done

- Every new row was red before the fix and is green after it.
- The snapshot diff is purely additive and reviewed.
- ESLint reports 0 errors.
- Commits use the message `fix(okf-export): export section README bodies as overview pages (#238)`, plus the test commit(s).

## Reviewer guidance

- The red-first evidence exists.
- Body-less output is byte-identical, and the snapshot diff is additive only.
- Rule 4 is untouched.
- Links to `.../README.md` still resolve to `index.md`.
- The base-hint test is not weakened.
