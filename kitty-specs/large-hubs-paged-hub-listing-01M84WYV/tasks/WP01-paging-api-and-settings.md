---
work_package_id: WP01
title: Paging API and page-size settings
dependencies: []
requirement_refs:
- FR-002
- FR-003
- FR-004
- FR-009
- FR-019
- C-003
planning_base_branch: feat/342-paged-hub-listing
merge_target_branch: feat/342-paged-hub-listing
branch_strategy: Planning artifacts for this mission were generated on feat/342-paged-hub-listing. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/342-paged-hub-listing unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T006
history:
- timestamp: '2026-11-24T16:00:00Z'
  agent: planner
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/child-cap.ts
create_intent:
- src/tests/hub-page-size-settings.test.ts
execution_mode: code_change
owned_files:
- src/lib/child-cap.ts
- src/lib/schema.ts
- src/scripts/validate-frontmatter.mjs
- src/lib/sections.ts
- src/lib/i18n-plugin.ts
- src/tests/child-cap.test.ts
- src/tests/hub-page-size-settings.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP01 — Paging API and page-size settings

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Build the pure paging API every later WP shares, and read and validate the page size where a hub or a section sets it. Requirements: FR-003 (hub and section levels), FR-004, FR-009 (strings), FR-019, FR-002 (type compatibility). Plan: IC-01. Contract: `contracts/paging-api.md`.

## Shared context

- Mission documents: `kitty-specs/large-hubs-paged-hub-listing-01M84WYV/spec.md`, `plan.md`, `research.md` (R3, R4, R7), `data-model.md`, `contracts/paging-api.md`, `decisions/`.
- Slice 1 (merged, PR #426): `src/lib/child-cap.ts`, ADR-0084, `docs/guides/sidebar-child-cap.md`. Copy its patterns (`resolveChildCap`, `isChildCap`, `CAPPED_LABEL_KEY` and the i18n plugin).
- Stack: Node 22+, TypeScript 5.9 and JSDoc-typed `.mjs`, Astro 7.4, Starlight 0.42.6. Add, upgrade or remove no dependency.
- **Red first**: write each test, run it, see it fail for the right reason, then implement.
- Before hand-off, run the full `pnpm test` (both tiers plus mcp), `pnpm lint` and `pnpm typecheck`. The operator requires the full suite, not just the fast tier.

## Branch strategy

Planning base and final merge target: `feat/342-paged-hub-listing`. Your execution worktree and lane branch come from `lanes.json`, computed by `finalize-tasks`; do not choose a base yourself. Start with:

```bash
spec-kitty agent action implement WP01 --agent <name> --mission large-hubs-paged-hub-listing-01M84WYV
```

## Subtasks

### T001 — Page-size resolver, paging arithmetic and listing pages (`src/lib/child-cap.ts`)

**Purpose**: one pure definition of how a hub pages, so the hub page, the route, the agent API and `llms.txt` can never disagree (C-001).

**Steps**:

1. Add, beside the slice-1 exports, keeping the module fs-free and Astro-free:
   - `DEFAULT_HUB_PAGE_SIZE = 50`.
   - `resolveHubPageSize({ hub, section, site })`: the most specific level first, else the default. It mirrors `resolveChildCap`; validation happens where each value is read.
   - `isPagedHub(hub)`: `hub.capped === true && hub.count > (hub.pageSize ?? DEFAULT_HUB_PAGE_SIZE)`.
   - `hubPageCount(hub)`: `Math.ceil(count / pageSize)` when paged, else `1`.
   - `hubPageSlice(children, page, pageSize)`: children `(page-1)*pageSize` to `page*pageSize`. Throws `RangeError` when `page` is not a whole number from 1 to `ceil(children.length / pageSize)`; when `children.length === 0`, only page 1 is valid.
   - `pagedHubSlug(hub, page)`: `hub` for page 1, `${hub}/page/${page}` otherwise. Throws `RangeError` for `page < 1` or a non-integer.
   - `hubListingPages(hubs: HubCapMap | Iterable<[string, HubCap]>)`: an array, in hub-folder order then page order, of `{ hub, page, of, slug, children }` for every paged hub and every page **≥ 2**. This is the one list the route (WP04) and the agent surfaces (WP05) iterate.
2. Document each function with a JSDoc comment in the slice-1 style: plain sentences, citing #342.

**Tests** (`src/tests/child-cap.test.ts`, extend it; do not rewrite the slice-1 cases):

- `resolveHubPageSize`: hub beats section beats site beats default, and each level alone wins over the default.
- `isPagedHub`: capped with `count` = `pageSize` is false; `pageSize + 1` is true; uncapped with a huge count is false; `capped` undefined is false.
- `hubPageCount`: 200/50 gives 4; 120/50 gives 3; 100/50 gives 2 (exact multiple, no empty page); unpaged gives 1.
- `hubPageSlice`: the union over all pages equals the input, in order, each item once; page 0, page n+1 and 1.5 throw.
- `pagedHubSlug`: `('missions', 1)` gives `'missions'`; `('a/b', 3)` gives `'a/b/page/3'`.
- `hubListingPages`: two hubs, one paged and one not, give the paged hub's pages 2 to n only, sorted by hub folder, with the right `children` slices.
- Mutation guard: a test that reds if the `>` in `isPagedHub` becomes `>=`.

### T002 — Widen the `HubCap` type (FR-002)

**Purpose**: #429 adds `capped` and `pageSize` without breaking slice-1 code.

**Steps**: in `HubCap`, add `capped?: boolean` and `pageSize?: number` with JSDoc ("optional in the type so slice-1 producers still type-check; the build always sets it"). Update the `HubCapMap` comment: since #429 it holds every published `kind: Hub` hub, capped or not.

**Tests**: a type-level test in `child-cap.test.ts`, such as `const legacy: HubCap = { cap: 1, count: 2, children: [] }`, that compiles, plus `expectTypeOf` checks on the new optional fields. `pnpm typecheck` must pass.

### T003 — Frontmatter `hub_page_size` (`src/lib/schema.ts`, `src/scripts/validate-frontmatter.mjs`)

**Purpose**: a hub sets its own page size (FR-003), and an invalid value is caught (FR-004).

**Steps**:

- `schema.ts`: next to `sidebar_child_cap` (around line 317), add `hub_page_size: z.number().int().positive().optional()` with a comment citing #342.
- `validate-frontmatter.mjs` (around line 263): add the same key with the same messages as `sidebar_child_cap` ("must be a positive whole number").

**Tests** (`src/tests/hub-page-size-settings.test.ts`, new): the docs schema accepts `hub_page_size: 2` and rejects `0`, `-1`, `1.5` and `"10"`. Run the frontmatter gate on a temporary tree with an invalid value: it fails and its message names `hub_page_size`. Copy how the existing `sidebar_child_cap` tests do this (search `src/tests` for `sidebar_child_cap`).

### T004 — Section `hub.pageSize` (`src/lib/sections.ts`)

**Purpose**: a section sets the page size for all its hubs (FR-003).

**Steps**:

- Add `hub?: { pageSize?: number }` to the section entry type, with a JSDoc paragraph like the one on `sidebar.childCap` (line 80).
- In the parser (near lines 187–195, the `sidebar` block), validate `hub`: it must be a mapping, and `pageSize`, when present, must satisfy `isChildCap`. Throw `${src}: section "${id}" hub.pageSize must be a positive whole number` and `${src}: section "${id}" "hub" must be a mapping`.
- The charter's `sections.entries` goes through the same parser, so check that it gets the same validation and add a case for it.

**Tests** (`hub-page-size-settings.test.ts`): the registry accepts `hub: { pageSize: 10 }`; rejects `0`, `"10"` and `hub: []`; and an absent `hub` leaves the entry without the key, so existing snapshots are unchanged.

### T006 — Pagination UI strings (`src/lib/i18n-plugin.ts`, `src/lib/child-cap.ts`)

**Purpose**: the pagination's name and labels are translatable (FR-009, research R7).

**Steps**:

- In `child-cap.ts`, export `HUB_PAGINATION_KEYS` and `HUB_PAGINATION_STRINGS`, the English defaults:
  - `dockitty.hub.pagination.label` = "Pagination"
  - `.previous` = "Previous"
  - `.next` = "Next"
  - `.page` = "Page {page}"
  - `.title` = "{title}, page {page}"
- In `i18n-plugin.ts`, inject them in `en` together with `SIDEBAR_UI_STRINGS`.
- Add `resolveHubString(key, vars, translate?)`. Following `resolveCappedLabel`, it treats an echoed key as missing (i18next returns the key itself) and replaces every `{name}` in the template.

**Tests**: the plugin injects all five keys, so it reds if one is missing; `resolveHubString` substitutes, falls back to English, and ignores an echoed key.

## Definition of Done

- All new exports are in `src/lib/child-cap.ts` and reachable as `@spec-kitty/doc-toolkit/child-cap` (the existing export map entry, no change needed).
- Every new test was seen red first; record the red run in the hand-off.
- `pnpm test` (both tiers plus mcp), `pnpm lint` and `pnpm typecheck` are green; quote the counts in the hand-off.
- No change in behaviour: no consumer reads the new settings yet, so the build output is unchanged.

## Risks

- Do not reuse `sidebar_child_cap` for the page size: the operator chose a separate setting (DM-01M854WK).
- Keep `child-cap.ts` free of `node:` imports, `astro:` imports and filesystem access.

## Reviewer guidance

- Check the `isPagedHub` boundary (`>` and not `>=`), the exact-multiple case and the `RangeError` cases.
- Check that the frontmatter gate and the zod schema accept and reject the same values.
- Check that the slice-1 tests are unchanged and still pass.
