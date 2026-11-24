---
work_package_id: WP03
title: Hub page and pagination markup
dependencies:
- WP02
requirement_refs:
- FR-005
- FR-006
- FR-008
- FR-009
- NFR-004
- NFR-005
- NFR-006
planning_base_branch: feat/342-paged-hub-listing
merge_target_branch: feat/342-paged-hub-listing
branch_strategy: Planning artifacts for this mission were generated on feat/342-paged-hub-listing. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/342-paged-hub-listing unless the human explicitly redirects the landing branch.
subtasks:
- T012
- T013
- T014
- T015
- T016
history:
- timestamp: '2026-11-24T16:00:00Z'
  agent: planner
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/components/hub/
create_intent:
- src/components/hub/HubCardList.astro
- src/components/hub/HubPagination.astro
- src/lib/hub-pagination.ts
- src/tests/hub-pagination.test.ts
execution_mode: code_change
owned_files:
- src/layouts/Hub.astro
- src/components/hub/HubCardList.astro
- src/components/hub/HubPagination.astro
- src/lib/hub-pagination.ts
- src/styles/hub.css
- src/tests/hub-pagination.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP03 — Hub page and pagination markup

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

The hub's card list and a new pagination navigation become components that the hub page (this WP) and the paged route (WP04) both render. A paged hub's own page lists children 1 to `pageSize`, followed by the pagination. An unpaged hub renders **byte-identical** HTML.

- Requirements: FR-005, FR-006, FR-008, FR-009, NFR-004, NFR-005, NFR-006.
- Plan: IC-02. Research: R2 (note), R7. Contract: `contracts/surfaces.md` (the `/<H>/` row).

## Shared context

- `src/layouts/Hub.astro` (read it whole; around 170 lines): the `HubCard` interface, `selectHubChildren`, `composeHubChildren`, and the card markup with its Pagefind comments.
  - **Keep the `section[role=navigation]` card landmark as it is.** That choice is about Pagefind indexing the card text, and its comment explains why.
- `src/styles/hub.css`: the global, unscoped card classes (`dk-hub__*`).
- WP01: `HUB_PAGINATION_KEYS`, `resolveHubString`, `hubPageSlice`, `hubPageCount`, `isPagedHub`, `pagedHubSlug`.
- WP02: `routeShaping.hubCaps` lists every hub, with `capped` and `pageSize`.
- **Red first.** Before hand-off, run the full `pnpm test` (both tiers plus mcp), `pnpm lint` and `pnpm typecheck`.

## Branch strategy

Planning base and final merge target: `feat/342-paged-hub-listing`. The lane worktree comes from `lanes.json`. Start with:

```bash
spec-kitty agent action implement WP03 --agent <name> --mission large-hubs-paged-hub-listing-01M84WYV
```

## Subtasks

### T012 — Extract `HubCardList.astro`, byte-identical

**Steps**:

1. Move the `{children.length > 0 && (<section class="dk-hub" ...>...</section>)}` block, with its comments, into `src/components/hub/HubCardList.astro`.
   - Props: `cards: HubCard[]`, `navLabel: string`, `hrefFor: (slug: string) => string`. Export the `HubCard` type from `src/lib/hub-pagination.ts`.
2. `Hub.astro` renders `<HubCardList cards={children} navLabel={navLabel} hrefFor={hrefFor} />`.
3. **Byte identity.**
   - The component must not add a `<style>` block or scoped attributes. Astro adds `data-astro-cid-*` only when a component has scoped styles; it has none, so the markup is unchanged.
   - Check whitespace: Astro collapses component boundaries differently in some cases. Compare the built example hub pages before and after the change. Build `example/` on the WP02 head and on your head, then diff `dist/**/index.html` for every hub page. Expect zero differences.
   - The slice-1 goldens (`sidebar-child-cap-build.test.ts`, uncapped fixture) and `hub-block-order-build.test.ts` must pass unchanged.

### T013 — Card lookup for a listing slice (`src/lib/hub-pagination.ts`)

**Purpose**: a paged listing renders the cards for the slugs the hub data lists, in that order. The card details (title, description, kind, ADR status and date) come from the collection.

**Steps**: write the pure function `listingCards(slugs, cardsBySlug)`.

- It returns the cards in `slugs` order.
- It throws `[dk-hubs] listing child "<slug>" has no card` when a slug is missing. That would mean the hub data and the hub page disagree, which C-001 forbids, so fail loudly.
- Build `cardsBySlug` in `Hub.astro` from the same `composedAdrCards` and `otherCards` it already computes.

**Tests** (`src/tests/hub-pagination.test.ts`):

- The order follows `slugs`.
- A missing slug throws.
- A C-001 guard: on a fixture tree, the slug order `composeHubChildren` gives `Hub.astro` equals the order in the route-shaping hub data (`routeShapingSource`) for the same hub. Mix ADR and non-ADR children to exercise both paths.

### T014 — Pagination window and `HubPagination.astro`

**Pure function** `paginationItems(current, total)` in `hub-pagination.ts`:

- It returns `Array<{ type: 'page', page, current } | { type: 'gap' }>`.
- When `total <= 7`, it lists every page.
- Otherwise it lists page 1, `current - 1` to `current + 1`, and page `total`, with a gap wherever pages are skipped. The result is never longer than 9 items.
- Tests: totals 1, 2, 7, 8 and 100, with current at the start, the middle and the end; no duplicate pages; the gaps are placed correctly.

**Component** `src/components/hub/HubPagination.astro`:

- Props: `hub` (the slug), `current`, `total`, `labels` (already-resolved strings), `hrefFor`.
- When `total < 2` it renders nothing.
- Markup (research R7):

  ```html
  <nav class="dk-hub-pagination" aria-label="{label}">
    <ul class="dk-hub-pagination__list" role="list">
      <li><a class="dk-hub-pagination__link" href="…" rel="prev">Previous</a></li>  <!-- or <span aria-disabled="true"> on page 1 -->
      <li><a class="dk-hub-pagination__link" href="…" aria-label="Page 1">1</a></li>
      <li><span class="dk-hub-pagination__current" aria-current="page" aria-label="Page 2">2</span></li>
      <li><span class="dk-hub-pagination__gap" aria-hidden="true">…</span></li>
      <li><a … rel="next">Next</a></li>
    </ul>
  </nav>
  ```

- Hrefs: page 1 is the hub, and page N is `hrefFor(pagedHubSlug(hub, N))`, which goes through `hrefOfSlug`, so the base and the trailing slash are correct.
- It is a real `<nav>`: Pagefind skips `<nav>`, so the page numbers are not indexed.
- It adds no client script (NFR-006).

### T015 — `Hub.astro` paged rendering

**Steps**:

1. `import { routeShaping } from 'virtual:doc-kitty/route-shaping'` (typed by `route-shaping-module.d.ts`). Look up `currentSlug`.
2. If `entry && isPagedHub(entry)`:
   - cards = `listingCards(hubPageSlice(entry.children.map(c => c.slug), 1, entry.pageSize), cardsBySlug)`;
   - then `<HubPagination current={1} total={hubPageCount(entry)} … />` after the card list.
3. Otherwise, the existing path, unchanged.
4. Resolve the labels through `resolveHubString(key, vars, Astro.locals.t)`.

**Tests**: these Astro components have no unit harness in this repo. Pin the pure helpers here; WP04's build suite proves the rendered markup. Add one build-tier assertion to `hub-pagination.test.ts` only if the existing build fixtures make it cheap: the 200-child capped fixture's hub lists exactly 50 cards and contains `nav[aria-label="Pagination"]`. Otherwise leave it to WP04 and say so in the hand-off.

### T016 — Pagination styles (`src/styles/hub.css`)

- Use theme tokens only (`--dk-color-*`, `--sl-*`), no raw colours, so the theme layer stays swappable (C-005).
- Links and the current item have a minimum target of 24×24 CSS px, with a visible `:focus-visible` outline, using the token the hub cards already use.
- The current item is distinct by weight or border as well as colour, never colour alone.
- Narrow screens wrap the list with a gap and no horizontal scroll.

## Definition of Done

- An unpaged hub's built HTML is byte-identical: the example diff is empty, and the slice-1 goldens and `hub-block-order-build` pass unchanged.
- A paged hub lists `pageSize` cards followed by the pagination.
- The pure helpers are fully tested, and no client JavaScript is added.
- `pnpm test` (both tiers plus mcp), `pnpm lint` and `pnpm typecheck` are green, with counts quoted.

## Risks

- Astro whitespace at component boundaries can break byte identity, so verify with the example diff, not by eye.
- The hub page's `navLabel` ("In this section") and the pagination's label ("Pagination") are two different landmarks. Both must keep distinct accessible names.

## Reviewer guidance

- Rebuild the example and diff it yourself.
- Check the pagination markup against research R7: `aria-current` on a non-link, a disabled side as `aria-disabled` text, and `rel` on Previous and Next.
