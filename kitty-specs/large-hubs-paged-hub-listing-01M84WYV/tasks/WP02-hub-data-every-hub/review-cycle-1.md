---
affected_files: []
cycle_number: 1
mission_slug: large-hubs-paged-hub-listing-01M84WYV
reproduction_command:
reviewed_at: '2026-11-24T17:49:15Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP02
---

# WP02 review, cycle 1: REJECT

Reviewer: `claude::reviewer-renata`. Implementer: `claude::implementer-ivan`.
Reviewed range: `2728734396a1..4905291f` on lane-b.

## Verdict

**One blocking finding.** Everything else checked out.

## What was verified

- The route-middleware map is unchanged. On `example/docs` and on a synthetic tree, I generated the module from lane-a's approved head and from lane-b. The tree has a capped hub, a nested capped hub, an uncapped hub, a locale hub, a draft hub index and a withheld draft child. `cappedHubCaps(new.hubCaps)` equals `old.hubCaps` in `cap`, `count` and `children`. Every other module key is identical in both sidebar modes. In consumer mode the old map was empty, and every middleware use of `hubCaps` sits inside `if (routeShaping.shapeSidebar)`, so consumer sites see no change.
- "Missing flag means capped" is safe. `hubData` always sets `capped`, and only a module from before #429 lacks it, and that module listed capped hubs only. The filter matters: `shapeSidebar` caps any hub that is in the map, whatever its count.
- The flipped expectations follow from #429 and FR-001. The draft-hub and non-`Hub` "no entry" expectations still hold. The slice-1 goldens were not touched (no diff under `src/tests/fixtures`). The build-tier uncapped golden passes, and it kills the "middleware unfiltered" mutant.
- Page-size precedence holds at all four levels. A section registry with no `hub` key falls through to the site value. With a section value and no site value, the section wins. Config validation rejects `0`, `-1`, `1.5`, `"5"`, `1`, `[]` and unknown keys. The value reaches the module.
- The collision check works for a `page.md` / `page.mdx` file, a `page/` folder with a `README.md` or `index.md`, a nested hub and a locale hub. The `isPagedHub` boundary is right: count = pageSize builds, and count = pageSize + 1 throws. The exact message is tested.
- `directoryMeta` is still empty in consumer-sidebar mode.
- The WP01 folds are correct and minimal (RangeError guard, `Object.hasOwn`, first duplicate wins, pinned mutants). They don't change WP01's approved behaviour on valid input.
- Mutation testing used 27 hand-made mutants. 25 were killed. M26 (the `hubListingPages` guard) and M27 (a no-op) are equivalent mutants.
- Tests, lint and typecheck are green. See the report for counts.

## Blocking

### 1. The `page` collision guard misses routes that are not listed children (FR-016)

`hubData` only throws when `listed.includes(`${hub.slug}/page`)`. `listed` holds the children the hub page *lists*. But every published page under the hub gets a route, listed or not. FR-016 exists "so that no route is silently shadowed". These trees build with no error (probed against 4905291f):

- **An index-less `page/` folder.** The paged hub `missions` has `sidebar_child_cap: 2`, `hub_page_size: 2`, 4 children and `missions/page/2.md`. That page's route is `/missions/page/2/`, the **exact URL** of listing page 2. This is the one case where the URLs truly collide, and it is the case the guard does not catch.
- **A routed but unlisted `page` child.** A paged ADR hub with `adr/page.md` of `type: Template` (left out of the listing, but still routed at `/adr/page/`). Also `missions/PAGE.md`, whose route slug is lowercased.

**Fix.** Check the hub's published pages, not just its listed children. `pages` is already in scope in `hubData`. Throw when a paged hub has any published page whose slug is `<hub>/page` or starts with `<hub>/page/`, compared case-insensitively. Name the first such page as the child in the existing message. Add tests for:

- the index-less `page/2.md` case;
- an unlisted routed `page` child (the template ADR is enough);
- a positive control: the same trees under an unpaged hub must still build.

## Non-blocking (fold if cheap)

2. `cappedHubCaps` is a new **public** export of `@spec-kitty/doc-toolkit/child-cap`. It sits in `child-cap.ts`, outside WP02's owned files and outside the WP01 fold list. It isn't in `contracts/paging-api.md`. Either add it to the contract, or say in the hand-off that it is a deliberate public addition.
3. T010 asked for a middleware-level test: one capped hub and one uncapped hub, with the uncapped group rendered as before. Only a `cappedHubCaps` unit test was added. The build-tier uncapped golden covers the wiring (it kills the "unfiltered middleware" mutant), so this is a nit. A `shapeSidebar(…, { hubCaps: cappedHubCaps(both) })` unit assertion would make the fast tier catch it as well.
4. Commit 4905291 is unsigned. That matches the charter's DIRECTIVE_029. Its trailers name no model.
