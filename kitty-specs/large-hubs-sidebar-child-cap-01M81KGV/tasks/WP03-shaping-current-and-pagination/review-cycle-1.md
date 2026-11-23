---
affected_files: []
cycle_number: 1
mission_slug: large-hubs-sidebar-child-cap-01M81KGV
reproduction_command:
reviewed_at: '2026-11-23T08:40:08Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP03
---

# WP03 review, cycle 1: changes requested

Reviewer: claude::reviewer-renata. Reviewed: lane-c at a9029ef, against lane-b at f6f42a3.

## Blocking

### B1. FR-007 breaks on any site with the `openapi` option, including the deployed example

The `starlight-openapi` renderer's middleware runs after ours on every page. It rebuilds
prev/next from `route.sidebar`, the shaped and capped tree
(`starlight-openapi/middleware.ts:21`, `getPaginationLinks(sidebar, …)`). That throws away
the hub-order pagination `shapePagination(…, expandCappedGroups(…))` just computed. Our own
follow-up (`src/lib/openapi/route-middleware.ts`) only restores titles. The comment at
`src/lib/route-middleware.ts:73` names this middleware but does not handle it.

Evidence: an example build (`pnpm --filter example build`) with `sidebar_child_cap: 3` added to
`example/docs/guides/README.md`. The hub has 7 children.

| Page | With `openapi` on (the example as shipped) | With `openapi` removed |
|---|---|---|
| `guides/` | prev: `track-consignment`; **next: `/guides/` (itself, the "7 pages" entry)** | next: `guides/getting-started/` ✔ |
| `guides/install/` | **prev: `/guides/`, next: `/rhetoric/`** | prev: `github-alerts`, next: `markua-footnotes-showcase` ✔ |
| `guides/getting-started/` | **prev: `/guides/`, next: `/rhetoric/`** | prev: `/guides/`, next: `github-alerts` ✔ |
| `guides/scenarios-in-pages/` | **prev: `/guides/`, next: `/rhetoric/`** | prev: `markua-showcase`, next: `/rhetoric/` ✔ |

With `openapi` on, every child gets the same prev/next, and the hub page links to itself.
This fails US2 AS3, and it will fail the WP04 and WP05 browser checks on the deployed example.
The current marking is fine in both builds: exactly one `aria-current="page"` on every page.

Required:
- Make the hub-order pagination survive the renderer's rebuild. For example, stash the shaped
  pagination on `locals` in `route-middleware.ts`. Then re-apply it in
  `src/lib/openapi/route-middleware.ts` on pages that are not OpenAPI pages, or re-derive it
  there from the original tree and `expandCappedGroups`.
  - Keep the empty-`hubCaps` path unchanged.
  - Name the out-of-map file in the hand-off.
- Add a red-first test that covers the ordering. A pure helper the follow-up middleware calls
  is enough. It must fail on a9029ef.

## Non-blocking (please fold)

- **N1. Weak FR-005 tests.** Three FR-005 cases pass on the WP02 source for the wrong reason:
  - "marks the capped entry current on a child, and only it"
  - "marks the index, not the capped entry, on the hub page"
  - "does not mark it on a sibling folder"

  There, `capped()` returns `entries[1]`, which is the child link itself. Assert that the
  entry under test is the capped one, for example with
  `expect(capped(sidebar)).toMatchObject({ dkCappedHub: 'missions' })`. The hand-off's
  "10 uncapped controls" overstates this: these are FR-005 primaries that are not red first.
  - Note: with the new code, the current-marking mutants are still killed (see Evidence).
- **N2. T013 says to reuse the original tree's href when the child is present there.**
  `expandCappedGroups` derives every href from the capped entry's href by string slicing
  instead. That holds for directory-format URLs. Either reuse the original href as the WP
  says, or say in the JSDoc which URL forms are assumed.
- **N3. A hub whose index link is not in the tree is silently uncapped.** For example, an index
  with `sidebar: { hidden: true }`. That is defensible, but make sure WP05's guide states it,
  next to the index-less sub-folder rule.

## Verified and fine

- Red first: against f6f42a3 with a stub `expandCappedGroups`, 9 of 20 fail. The draft-index
  case in `hub-caps-data` fails on the old source. The export case fails with "Missing
  ./child-cap specifier" when `package.json` is reverted.
- Mutation testing: 10 of 11 mutants are killed. These include the flatten skip, the icon skip,
  the `dir/` prefix, current false, the `at === -1` branch, expand current, the one-page rule,
  the `followsSidebar.prev` gate, the label function and the expand trailing slash. The
  survivor, the `hubIndex.entry.type === 'link'` guard, is an equivalent narrowing mutant.
- Uncapped path: the example build at f6f42a3 and at a9029ef (88 pages) is byte-identical, with
  0 differing files. Every new middleware step is a no-op with an empty `hubCaps`. The relaxed
  `at === -1` branch cannot fire without a capped entry, because the shaped links are a subset
  of the original links.
- `currentSlug` uses `slugFromEntryId(route.id)`, the same as `Hub.astro`, so a README index
  normalises to its folder.
- Package export: `./child-cap` resolves to `./lib/child-cap.ts`. That file is already in
  `files` and has no Astro or fs imports. The change is additive and safe for consumers.
- Accessibility: the capped entry renders as a plain `<a>` with visible text ("7 pages") and
  `aria-current="page"` on children. The group stays open via `groupHasCurrent`.
- The fixture change in `route-shaping.test.ts` publishes the hub index that the new draft rule
  needs. The option-serving assertion is unchanged, so it masks no regression.
- The index-less sub-folder decision is consistent with `selectHubChildren` and the spec. Such
  pages are not counted, are dropped with the group, and mark the capped entry current.
- Scope: the out-of-map edits are named. The fix for B1 will add
  `src/lib/openapi/route-middleware.ts`.
- Gates: targeted tests 114/114; `pnpm lint` clean; `pnpm typecheck` clean. Fast suite 4084/4084.
