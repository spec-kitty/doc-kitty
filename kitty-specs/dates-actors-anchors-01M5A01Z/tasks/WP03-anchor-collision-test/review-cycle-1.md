---
affected_files: []
cycle_number: 1
mission_slug: dates-actors-anchors-01M5A01Z
reproduction_command:
reviewed_at: '2026-10-19T12:21:13Z'
reviewer_agent: claude
wp_id: WP03
---

# WP03 review feedback (reviewer-renata) — REQUEST CHANGES

## Issue 1 (blocking): existing coverage was removed, and a mutation now survives
Commit 4055e98 rewrote the existing test's input from `...# Second` to `...# Title` and deleted two assertions:
- `expect(headings(tree)).toEqual(['h2: Second'])`: a *different* later H1 is demoted after the title H1 is dropped;
- `expect(JSON.stringify(tree)).toContain('"properties":{"id":"title"}')`: the alias anchor IS emitted when no later heading takes the id.
No other test in the file asserts either one. Mutation proof: replace `id && !taken.has(id)` with `false` in `src/lib/rehype/single-h1.ts`, so no alias is ever emitted. With the HEAD test file, all 11 tests pass (the mutation survives). With the base test file, the test fails. The test name still says "keeps its anchor", but the test now asserts that no anchor exists.

## Issue 2 (blocking): the specified case `# Title … ## Title` is not tested
FR-010, #228 and T011 specify a later **h2** (`render('Intro.\n\n# Title\n\nMore.\n\n## Title\n', ...)`). The commit tests a later h1 that gets demoted instead. That does reach the `taken.has` branch, but it is not the case the spec names.

## Fix (same `it`, no new `it` or file, per DIRECTIVE_041)
1. Restore the original first render `'Intro.\n\n# Title\n\nMore.\n\n# Second\n'` and its assertions: `h1s === 0`, `['h2: Second']`, and that exactly one element has `id === 'title'` and it is the alias (e.g. `elementsWithId(tree,'title')` has length 1 with tagName `span`).
2. Add a second render in the same `it`, `renderWithFile('Intro.\n\n# Title\n\nMore.\n\n## Title\n', { title: 'Title' })`, and assert: headings `['h2: Title']`; `elementsWithId(tree2,'title')` has length 0 before ids; after `rehypeHeadingIds()(tree2, file2)`, exactly one holder, and it is the `h2`.
3. Optionally extend the name: "..., and adds no anchor when a later heading takes its id".
4. Re-run both mutations: `!taken.has(id)`→`!false` must fail on the second render, and `id && !taken.has(id)`→`false` must fail on the first render.

## Passing items
Net src diff vs lane base is only `src/tests/single-h1.test.ts` (the file modes were restored). vitest passes 11/11. eslint is clean. tsc single-h1 errors are 2 (baseline). The `taken.has` mutation is killed. No new file or `it`. The harness `history: ['page.md']` change is fine.
