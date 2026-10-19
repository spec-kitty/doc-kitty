---
work_package_id: WP03
title: Pin the anchor-collision case (#228)
dependencies: []
requirement_refs:
- FR-010
planning_base_branch: feat/dates-actors-anchors
merge_target_branch: feat/dates-actors-anchors
branch_strategy: Planning artifacts for this mission were generated on feat/dates-actors-anchors. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/dates-actors-anchors unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-dates-actors-anchors-01M5A01Z
base_commit: 683154d9a5c97ca360044cbf71d468ae93194c37
created_at: '2026-10-19T12:14:00.147332+00:00'
subtasks:
- T011
- T012
phase: Phase 1 - Behaviour
history:
- at: '2026-10-19T12:00:00Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/tests/
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- src/tests/single-h1.test.ts
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP03 – Pin the anchor-collision case (#228)

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile with the
`/spk-charter-profile-load` skill (profile: **node-norris**). Then run
`spec-kitty charter context --action implement` and apply it. DIRECTIVE_041 is in force:
**strengthen the existing test; do not add a new file or a new `it`.**

## Objective

`src/lib/rehype/single-h1.ts` drops a body `# Title` that repeats the page title, and
leaves an empty alias element carrying the dropped heading's id, so `#title` links keep
working. It **skips** the alias when a later heading would take the same id (for
example `# Title … ## Title`), to avoid two elements with one id (`single-h1.ts:100-113`,
`taken.has(id)`). No test covers that skip. Add the case to the existing test
"drops the first title H1 even when content precedes it, keeps its anchor, and demotes
the other H1s" (`src/tests/single-h1.test.ts:83-89`).

## Context

- **Spec**: FR-010, US3, SC-005. **Research**: R6.
- **Vacuity trap**: the harness `render()` (lines 22-29) runs only remark, `toHast` and
  `singleH1`. Heading ids come later in a real build, from Astro's `rehypeHeadingIds`.
  So a bare `## Title` has no `id` in the test tree, and counting `id="title"` without
  assigning ids proves nothing: a broken pass that emits the alias would also count 1.
- `rehypeHeadingIds` is importable in the test environment
  (`import { rehypeHeadingIds } from '@astrojs/markdown-remark';`). It reads
  `file.history[0]` (`isMDXFile`), so the harness file must carry `history`.

## Branch Strategy

- Planning branch: `feat/dates-actors-anchors`. Final merge target:
  `feat/dates-actors-anchors`.
- Your execution worktree is allocated per computed lane from `lanes.json`.
- Implement with `spec-kitty agent action implement WP03 --agent claude --mission dates-actors-anchors-01M5A01Z`.

## Subtasks

### T011 — Strengthen the existing test

**Steps**:
1. In the existing `it('drops the first title H1 even when content precedes it, …')`,
   after its current assertions, render a second body in the same test:
   `render('Intro.\n\n# Title\n\nMore.\n\n## Title\n', { title: 'Title' })`.
   If the test name no longer covers the case, extend it with a short clause, e.g.
   "…, and adds no anchor when a later heading takes its id".
2. Assert:
   - `headings(tree2)` equals `['h2: Title']` (the h1 is dropped, the h2 is kept);
   - no alias element exists. Find out what the pass emits for the alias (read
     `single-h1.ts`; it's an element with `properties: {id: 'title'}` and no text), and
     assert no element with that shape exists **before** ids are assigned;
   - then run ids as a real build does: build the file as
     `{ history: ['page.md'], data: { astro: { frontmatter } } }` (without `history` the
     plugin throws a TypeError), return it from `render()`, and call
     `rehypeHeadingIds()(tree2, file)`. Collect every element
     with `properties.id === 'title'`; there must be exactly one, and it must be the
     `h2`.
3. Keep helpers local and small (a `findAll(node, pred)` walker if one isn't already
   there). Match the file's style.
4. Run the file; it must pass on current code (the behaviour exists).

### T012 — Mutation proof (non-vacuity)

**Steps**:
1. Temporarily break the skip in `single-h1.ts`, e.g. replace `taken.has(id)` with
   `false`. Run the test; it must FAIL on the "exactly one `id="title"`" or "no alias"
   assertion. Record the failure output.
2. Revert the mutation (`git checkout src/lib/rehype/single-h1.ts`). Confirm `git diff`
   shows only the test file.
3. Run `pnpm lint` on the test file and the full `single-h1.test.ts`.

## Definition of Done

- The existing test covers the collision case; there are no new files and no new `it`
  blocks.
- The mutation proof fails as expected; it is recorded in the review note and not
  committed.
- Commit with `spec-kitty safe-commit src/tests/single-h1.test.ts -m "test(single-h1): pin the alias skip when a later heading takes the id (#228)"`.

## Risks

- `rehypeHeadingIds` needs `file.history[0]`: add `history: ['page.md']` to the file
  `render()` builds, and return the file (or add an optional "ids" flag). Keep the
  change minimal; the other tests must not change.

## Reviewer Guidance

- Re-run the mutation yourself.
- Confirm the id count runs after `rehypeHeadingIds`, not before.
