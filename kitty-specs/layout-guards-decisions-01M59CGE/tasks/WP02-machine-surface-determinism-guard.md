---
work_package_id: WP02
title: Machine-surface determinism guard
dependencies: []
requirement_refs:
- FR-001
- NFR-002
- SC-003
planning_base_branch: feat/layout-guards-decisions
merge_target_branch: feat/layout-guards-decisions
branch_strategy: Planning artifacts for this mission were generated on feat/layout-guards-decisions. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/layout-guards-decisions unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-layout-guards-decisions-01M59CGE
base_commit: 4002317505af1ddfec5a14fbe422d596877a1124
created_at: '2026-10-19T06:55:27.823344+00:00'
subtasks:
- T007
- T008
- T009
- T010
phase: Phase 1 - Foundation
history:
- at: '2026-10-19T06:40:32Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/tests/draft-publication-build.test.ts
create_intent: []
execution_mode: code_change
model: ''
owned_files:
- src/tests/draft-publication-build.test.ts
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP02 – Machine-surface determinism guard

## ⚡ Do This First: Load Agent Profile

Use the `/spk-charter-profile-load` skill to load the agent profile specified in the frontmatter (or any user-defined profile), and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `claude`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## ⚠️ IMPORTANT: Review Feedback

**Read this first if you are implementing this task!**

- **Has review feedback?**: Check the `review_ref` field in the event log (via `spec-kitty agent tasks status`).
- **You must address all feedback** before your work is complete. Feedback items are your implementation TODO list.
- **Report progress**: As you address each feedback item, record what you changed with `spec-kitty agent tasks add-history <WPID> --note "..."` (stored in the status event log).

---

## Review Feedback

*[If this WP was returned from review, the reviewer feedback reference appears in the status event log.]*

---

## Markdown Formatting

Wrap HTML/XML tags in backticks: `` `<div>` ``, `` `<script>` ``
Use language identifiers in code blocks: ````python`,````bash`

---

## Objectives & Success Criteria

Prove NFR-006 of mission `sidebar-frame-header-carrier-01M4T3CB` for every machine
surface: "two builds of the same tree with the same setting value produce
byte-identical sidebars and machine surfaces". Today only the sidebar of two pages
is compared (#201). When this WP is done:

- One exported manifest of globs names every machine surface.
- The drafts-off build and its repeat build are byte-identical over every file the
  manifest matches.
- Every glob matches at least one file, so a renamed surface cannot drop out
  silently.
- The drafts-on vs drafts-off comparison covers the same manifest. The draft pages'
  `api/pages/<draft>.json` files are the named expected differences.
- A positive control proves the check fails on a one-byte difference.
- No build is added (NFR-002), and the new assertions take at most 1 s.

Requirements: FR-001, NFR-002, SC-003.

## Context & Constraints

- **Research** (Alphonso, in `docs/architecture/research/layout-guards-and-decisions.md`,
  section #201):
  - Four scratch builds were byte-identical across the whole dist.
  - No surface carries a build clock: no `<lastmod>`, no `<lastBuildDate>`, and the
    RSS `<pubDate>` comes from frontmatter `updated`.
  - Drafts-on vs drafts-off: sitemaps, rss, llms, `api/index.json`, content-graph,
    `okf/**` and `pagefind/**` are identical. The draft pages exist only in
    drafts-on, including `api/pages/<draft>.json`.
- **The file you own**: `src/tests/draft-publication-build.test.ts`. Read it whole
  first. The parts you need:
  - `OUT` (about line 39) names four build output dirs, including
    `offRepeat: 'dist-wp05-drafts-off-repeat-test'`.
  - `MACHINE_SURFACES` (line 73) is today's short list.
  - `DRAFTS` and `SIDEBAR_DRAFTS` (lines 51 to 58) are the draft slugs.
  - `abs(mode, rel)` and `read(mode, rel)` (lines 112 to 119) are the path helpers.
  - A recursive `walk` already exists (about line 134); reuse or extract it.
  - `beforeAll` (line 156) runs the four builds once.
  - "are the same in both modes" (line 367) is the four-surface on/off check.
  - "two builds with the same value produce the same sidebar (NFR-006)" (line 375).
- The file runs in the serialized `build` Vitest project (`src/vitest.workspace.ts`,
  line 41). Do not move it.
- **No new dependency.** Use `node:fs` for globbing: the repo has no glob library in
  `src/`'s dependencies, and adding one is out of scope.

## Branch Strategy

- **Strategy**: Planning artifacts were generated on feat/layout-guards-decisions; completed changes must merge back into feat/layout-guards-decisions.
- **Planning base branch**: feat/layout-guards-decisions
- **Merge target branch**: feat/layout-guards-decisions

> Execution worktrees are allocated per computed lane from `lanes.json`.

```bash
spec-kitty agent action implement WP02 --agent claude --mission layout-guards-decisions-01M59CGE
```

## Subtasks & Detailed Guidance

### Subtask T007 – Declare one machine-surface manifest with a glob walker

- **Purpose**: One declared list, used by both comparisons, so they cannot drift
  apart (data-model.md, "Machine-surface manifest").
- **Steps**:
  1. Add and export a constant, for example:

     ```ts
     /** Every machine surface (data-model.md); each glob must match in every dist. */
     export const MACHINE_SURFACE_GLOBS = [
       'sitemap*.xml',
       'rss.xml',
       'llms*.txt',
       'api/**/*.json',
       'okf/**',
       'pagefind/**',
     ] as const;
     ```

  2. Write a small matcher that turns these globs into a list of relative file
     paths for a given dist. Support only what the list uses: `*` within one
     segment, and `**` for any depth. A 15-line function over the existing `walk`
     is enough. Sort the result so failures are stable.
  3. Keep `MACHINE_SURFACES` only if another test still needs those exact five
     files; otherwise replace its uses with the manifest. Do not leave two lists
     that mean the same thing.
- **Files**: `src/tests/draft-publication-build.test.ts`
- **Notes**: `pagefind/**` includes gzipped binary fragments. Compare with
  `Buffer.equals`, never as UTF-8 strings.

### Subtask T008 – Compare drafts-off and its repeat build byte for byte

- **Steps**:
  1. Add `it('two drafts-off builds produce byte-identical machine surfaces (NFR-006)', …)`.
  2. For each glob, assert it matches at least one file in `off` and in
     `offRepeat`. The message names the glob and the dist.
  3. Assert that the two matched file lists are equal. A file in one and not the
     other is a failure that names the file.
  4. For each file, compare `readFileSync` buffers. Collect every differing path and
     assert the list is empty, so one run reports them all.
  5. Keep the existing sidebar assertion: it covers the sidebar half of NFR-006.
- **Validation**: green against today's builds.

### Subtask T009 – Extend the drafts-on vs drafts-off comparison to the manifest

- **Steps**:
  1. Rewrite "are the same in both modes" to walk the manifest.
  2. Expected differences, named in one constant with a comment:
     `api/pages/<slug>.json` for each slug in `DRAFTS` exists only in `on`. Derive
     the names from `DRAFTS` rather than hard-coding them a second time.
  3. Any other file present in only one dist, or differing, fails.
  4. Keep the existing `<loc>` count assertion (line 371); it is a non-vacuity check
     on the sitemap.
- **Notes**:
  - `pagefind/**` may legitimately differ between drafts-on and drafts-off if
    drafts are indexed. The research found it identical. If a real difference shows
    up, report it in your history note and the review rather than widening the
    exception silently.
  - `rss.xml` was left out of the old list with no reason given (Robbie's finding).
    It is in the manifest now; if it differs, that is a finding.

### Subtask T010 – Prove the determinism check fails first (positive control)

- **Purpose**: `acceptance-criteria-non-vacuity`: a ratchet row needs a same-fixture
  positive control.
- **Steps**:
  1. Factor the comparison into a function, for example
     `diffSurfaces(rootA, rootB, expectedOnlyInA)`, that returns the list of
     differences.
  2. Add a test that copies one small matched file (for example `llms.txt`) from the
     `off` dist into a temp directory under `os.tmpdir()`, changes one byte, and
     asserts the function reports exactly that file. Use a temp copy; never mutate
     a dist the other tests read.
  3. Add a second control: a manifest glob that matches nothing makes the check
     fail.
  4. Measure the new assertions' run time with `performance.now()` around the
     comparison, and record it in your history note (NFR-002: at most 1 s).
- **Validation**: run the suite once with the mutation applied to the real
  comparison, by temporarily editing one byte in the `offRepeat` dist after the
  builds. Confirm it goes red, then revert. Paste the red output into your history
  note.

## Test Strategy

```bash
pnpm --filter @spec-kitty/doc-toolkit exec vitest run --project build tests/draft-publication-build.test.ts
pnpm --filter @spec-kitty/doc-toolkit exec tsc --noEmit -p .   # or the repo's typecheck for src/tests, see src/package.json
pnpm lint
```

The suite builds the example four times (about a minute). Run it whole once at the
end, not per edit.

## Risks & Mitigations

- **A flaky difference.** If a surface differs between the two drafts-off builds,
  that is a real NFR-006 defect. Stop and report it with the diff; do not exclude
  the file.
- **Binary files compared as text** hide differences, so use buffers.
- **Slowness.** `pagefind/**` holds many files. Read each once; do not re-walk per
  glob.

## Review Guidance

- The manifest is the single list; there is no second hand-written surface list.
- Every glob has a non-vacuity assertion.
- The positive-control test exists and the red output is in the history.
- No build was added; `beforeAll` still runs exactly four builds.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP02 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP02 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`
