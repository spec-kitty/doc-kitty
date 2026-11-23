---
affected_files: []
cycle_number: 4
mission_slug: large-hubs-sidebar-child-cap-01M81KGV
reproduction_command: spec-kitty agent tasks move-task WP04 --to approved --mission large-hubs-sidebar-child-cap-01M81KGV --agent claude::reviewer-renata
reviewed_at: '2026-11-23T11:01:37Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP04
---

Approved by claude::reviewer-renata: approval:WP04

# WP04 re-review after the F1/F2 rework: approved

Reviewer: `claude::reviewer-renata`. I reviewed the delta `47bb7bc8..98b26ff9` on lane-d. That is one commit,
`98b26ff`, and it touches only these code files: `src/lib/{route-shaping,route-middleware}.ts`,
`src/lib/openapi-module.d.ts`, `src/tests/sidebar-child-cap.test.ts`, `src/scripts/assert-build-artifacts.mjs`,
`src/tests/fixtures/large-hub/measure.mjs` and `tests/a11y/routes.ts`. The commit message names all of them
(out-of-map where applicable). No dependency was added, and the commit messages carry no model identifiers.

## Red first: confirmed

I put `src/lib/{route-shaping,route-middleware}.ts` and `openapi-module.d.ts` from `47bb7bc8` under lane-d's tests.
`sidebar-child-cap.test.ts` then gave **2 failed and 30 passed**. Both failures are for the right reason:
- the normaliser test fails because `paginationFollow` does not exist on the old code;
- in the pre-hidden test, the old code gives the hub-order neighbour under its **own** label, not under "Read on".

The listed-page control passes on both versions, so it is a characterisation test. With the new source restored,
the file passes 32/32.

## Mutation testing (`paginationFollow`, and `take` in shapePagination)

The unit file **kills** these mutants:
- drop the `enabled` guard;
- unset gives `false`;
- a string gives `true`;
- ignore `'link' in side`;
- an object gives `true` instead of its label;
- the final `return false` becomes `return true`;
- `take` ignores the label;
- `take` ignores `follows === false`.

These mutants **survive**:
- **M9.** `take` ignores `current !== undefined`. This mutant is **equivalent**. At `at === -1` Starlight's
  `currentIndex` is -1, so its link is `undefined`. The only exception is a `{ link, label }` override, built by
  `makeLink`, and that override normalises to `false` and is kept before `current` is ever looked at.
- **M10/M11.** The listed-page branch uses `!!followsSidebar.x` instead of `=== true`. This mutant is **not
  equivalent**. Take a listed page with a label-only override on a side where Starlight has no neighbour (first or
  last in Starlight's order), but where the shaped tree gives it one. The mutant adds a link there under the
  neighbour's own title. The `=== true` guard carries the "uncapped output does not change" claim, and no unit test
  pins it. See nit N2.
- **M5.** Dropping the `typeof label === 'string'` check survives. It is not worth killing on its own, but it is
  tied to F3 below.

## Uncapped build: byte-identical

To avoid noise from the checkout path (scoped class names hash it), I built both versions in one worktree:
1. Raised the example's `guides/capped-hub` to `sidebar_child_cap: 100`, so nothing on the site is capped. OpenAPI
   stays on, as in the example.
2. Ran `pnpm build` at `47bb7bc8`.
3. Swapped in `src/lib` from `98b26ff`, the only code that reaches the build, and rebuilt.

Each build gave 94 pages. `diff -r` over the two `dist` trees (649 files) was **empty**. The capped hub was confirmed
uncapped: all five children are in the sidebar, and there is no "5 pages" entry.

## End to end, OpenAPI on and off

I wrote a probe (scratch only, not committed). It builds an 8-child `missions` hub with site `childCap: 3` and a
6-child uncapped `guides` hub. Each site is built four ways: children visible or `sidebar.hidden`, and
`starlight-openapi` on or off. It goes through the pnpm `.bin/astro` shim, as the OpenAPI helper does. The probe
ran at `47bb7bc8` and at `98b26ff`. Hub order is by title, so it is the reverse of slug order.

| page | override | visible: on vs off (old → new) | hidden: on vs off (old → new) |
|---|---|---|---|
| m-0002 | `next: "Read on"` | = → = | **≠ → =**. Off now gives `m-0001` under "Read on"; before, it gave no link (F2) |
| m-0003 | `prev: { label }` | **≠ → =**. On now gives `m-0004` under "Back up"; before, it gave the hub (F1) | **≠ → =**. Off before gave no link (F2) |
| m-0004 | `next: { link, label }` | = → = | = → = |
| m-0005 | `next: false` | = → = | = → = |
| m-0001, m-0008 | unset | = → = | = → = |
| guide-0002 (uncapped hub) | `next: "Read on"` | = → = | = → = |
| guide-0003 (uncapped hub) | `prev: { label }` | **≠ → =**. Fixed through the hand-off on a site that has a capped hub | **≠ → =** |
| guide-0005 (uncapped hub) | `next: false` | = → = | = → = |
| m-0007 | `prev: true` | ≠ → ≠ (unchanged, see F3) | ≠ → ≠ (unchanged, see F3) |
| m-0006 | `next: {}` | ≠ → ≠ (unchanged, see F3) | ≠ → ≠ (unchanged, see F3) |

No row went from equal to different. The only off-mode changes are on hidden children, which is the capped-only
`at === -1` branch, as the commit says. `false`, `{ link, label }` and unset are unchanged everywhere. **F1 and F2
are fixed.**

## Follow-up (non-blocking, pre-existing): F3

In Starlight 0.42.6, `applyPrevNextLinkConfig` also follows the sidebar in two cases that `paginationFollow`
treats as the author's (`false`):
- `prev: true`: `config === true` returns the generated link. This happens even with site-wide `pagination: false`.
- `next: {}`: an object with no `link` and no `label` keeps the neighbour's href and label.

The probe shows the F1/F2 symptoms for both:
- With OpenAPI on, m-0007 `prev: true` gets the hub (`/site/missions/`), and m-0006 `next: {}` gets `/site/ops/`.
  Those are the capped entry's neighbours.
- With OpenAPI off, a hidden child with either override gets no link.

This behaviour was already in `47bb7bc8`, and the old `prev === undefined` check had it too, so it is not a
regression. It is also outside F1/F2, which were about label-only overrides. Both forms are rare, and `{}` is mostly
theoretical. Suggested fix: in `paginationFollow`, return `true` for `side === true`, and for an object with neither
`link` nor `label`. Add both to the normaliser test, which also kills M5. Also decide whether `true` should override
`enabled === false` the way Starlight does.

## Nits (non-blocking)

- **N1.** The new `PaginationFollow` and `paginationFollow` declarations were inserted between `shapePagination`'s
  JSDoc ("Re-derive prev/next after the sidebar has been reordered…") and `shapePagination` itself. That docblock
  now sits orphaned above the type's docblock, so `shapePagination` has no doc comment in editors or generated docs.
  Move the new declarations above it.
- **N2.** Pin the listed-page `=== true` guard (it kills M10/M11) with a unit case: a listed page, label-only on a
  side with no Starlight neighbour that shaping gives one, expecting `undefined`.
- **N3.** Coordination log: the dispatcher brief says 116 events, and I count **119**. The difference is the three
  events at 10:42 for the for_review move (mark-status, transition, annotation), so this is not a defect.

## Cycle-2 nits: folded

- AXE_PAGES: the #250 comment sits directly above its entry again, and the #341 entries follow it.
- The sitemap fail message drops the stale arithmetic and points to the derivation.
- `measure.mjs` runs in ABBA order. `order.reverse()` mutates a fresh `Object.entries` each round, which is safe.
- The out-of-map files are named in the commit message, `sidebar-child-cap.test.ts` (WP03-owned) included.

## Gates (at `98b26ff`)

- Full `pnpm test`: exit **0** — **src 216/216 files, 4347/4347 tests**; **mcp 23/23 files, 181/181 tests** (the `assert-changelog-page: FAILED` lines in the log are expected stdout of negative-path tests).
- `pnpm lint`: exit 0.
- `pnpm typecheck`: exit 0 (0 errors, 137 files).
- `spec-kitty agent status validate`: **PASS** (in the materialised coord worktree at `c168325`). The log has 119
  events:
  - no duplicate `event_id`s, and no duplicate content;
  - timestamps and ULIDs are monotonic;
  - the WP04 transition chain is coherent. The forced approved → planned rewind at 10:26 is the dispatcher-requested
    move-back, with `review-cycle-3.md` as its rationale.
