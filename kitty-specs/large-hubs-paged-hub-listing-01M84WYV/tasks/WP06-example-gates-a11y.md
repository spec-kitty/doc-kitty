---
work_package_id: WP06
title: Example, gates, accessibility and measurements
dependencies:
- WP04
- WP05
requirement_refs:
- FR-012
- FR-014
- FR-015
- FR-020
- NFR-001
- NFR-002
- NFR-004
- SC-002
- SC-003
- SC-004
- SC-006
planning_base_branch: feat/342-paged-hub-listing
merge_target_branch: feat/342-paged-hub-listing
branch_strategy: Planning artifacts for this mission were generated on feat/342-paged-hub-listing. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/342-paged-hub-listing unless the human explicitly redirects the landing branch.
subtasks:
- T026
- T027
- T028
- T029
history:
- timestamp: '2026-11-24T16:00:00Z'
  agent: planner
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: example/docs/guides/paged-hub/
create_intent:
- example/docs/guides/paged-hub/README.md
- tests/a11y/paged-hub-listing.spec.ts
- src/tests/no-broken-links-pagination.test.ts
execution_mode: code_change
owned_files:
- example/docs/guides/paged-hub/**
- src/scripts/assert-build-artifacts.mjs
- src/tests/no-broken-links-pagination.test.ts
- tests/a11y/paged-hub-listing.spec.ts
- tests/a11y/routes.ts
- src/tests/fixtures/large-hub/measure.mjs
- docs/plans/features/large-hubs.md
role: implementer
tags: []
tracker_refs: []
---
# WP06 — Example, gates, accessibility and measurements

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

The deployed example has a paged hub. The artifact gates, the broken-link gate, axe, keyboard and search checks pass on it. NFR-001 and NFR-002 are measured and recorded.

- Requirements: FR-012, FR-014, FR-015, FR-020 (example part), NFR-001, NFR-002, NFR-004; SC-002, SC-003, SC-004.
- Plan: IC-05. Research: R5 (search), R10.

## Shared context

- **The example's capped hub** is `example/docs/guides/capped-hub/` (cap 3, 5 children; see slice 1). Model the paged hub on it.
- **Pinned counts** in `src/scripts/assert-build-artifacts.mjs`: `EXPECTED_INDEX_ENTRY_COUNT` (~:162) and `EXPECTED_SITEMAP_URL_COUNT` (~:201). Each has a derivation comment. Update both, extending the derivation comment the way slice 1 did ("+ N").
- `assert:no-broken-links` (`src/scripts/assert-no-broken-links.mjs`) walks `dist/**/*.html` hrefs.
- Playwright:
  - `tests/a11y/routes.ts` (`AXE_PAGES`, `PUBLISHED_AXE_PAGES`);
  - `tests/a11y/axe.spec.ts`;
  - `tests/a11y/sidebar-child-cap.spec.ts`, the slice-1 model to copy;
  - `tests/a11y/serve-dist.mjs`.
  - The local Chromium differs from CI's pinned one. Screenshots and two existing checks fail locally on `main`, so CI is authoritative for the a11y lane (#426 note).
- `src/tests/fixtures/large-hub/measure.mjs`, the slice-1 measurement script.
- **Red first.** Before hand-off, run the full `pnpm test` (both tiers plus mcp), `pnpm lint`, `pnpm typecheck` and the example gates.

## Branch strategy

Planning base and final merge target: `feat/342-paged-hub-listing`. The lane worktree comes from `lanes.json`. Start with:

```bash
spec-kitty agent action implement WP06 --agent <name> --mission large-hubs-paged-hub-listing-01M84WYV
```

## Subtasks

### T026 — Example paged hub and pins

**Steps**:

1. Create `example/docs/guides/paged-hub/README.md` (`kind: Hub`, `sidebar_child_cap: 3`, `hub_page_size: 2`) with 7 children, so the hub has 4 listing pages (2+2+2+1).
   - The children are short, real how-to pages that explain the feature, the way the slice-1 example children do: what a paged hub is, the page size, where to set it, the paged URLs, what the agent API lists, search, and accessibility.
   - Each has full frontmatter. Use `updated: 2026-11-24T00:00:00Z` and `doc_status: active`.
2. Build the example (`pnpm --filter example build` or `cd example && pnpm build`). Update the pins:
   - index: +1 hub +7 children +3 listing records;
   - sitemap: +1 hub +7 children +3 paged URLs.
   - Write each delta in the derivation comment, and check the totals on a fresh build.
3. Add assertions in `assert-build-artifacts.mjs`:
   - `guides/paged-hub/page/2/` to `/4/` exist, and `/page/5/` does not;
   - each has a self canonical and `nav[aria-label="Pagination"]`;
   - the sitemap holds those three URLs once each;
   - `api/index.json` has three `kind: "Listing"` records with `listing_of: "guides/paged-hub"`;
   - `llms.txt` has the three listing lines.
4. Run `pnpm assert:artifacts` and `pnpm validate:example` (and `validate:docs` if the example docs count). Both must pass.

### T027 — Broken-link gate proof (FR-015, SC-004)

**Steps**: with a test in `src/tests/no-broken-links-pagination.test.ts`, show that `assert-no-broken-links.mjs`:

- passes on a tiny `dist` with a hub page whose pagination links to existing `page/2/index.html`;
- **fails** when `page/2/index.html` is removed.

Run the script as a child process on a temporary `dist`; see how existing tests drive the `assert-*.mjs` scripts. Then run `pnpm assert:no-broken-links` on the real example build: it must pass.

### T028 — Playwright: axe, keyboard and search (NFR-004, FR-014, SC-002)

Create `tests/a11y/paged-hub-listing.spec.ts`, modelled on `sidebar-child-cap.spec.ts`:

1. **Axe**: add `guides/paged-hub/` and `guides/paged-hub/page/2/` to `AXE_PAGES`, so `axe.spec.ts` covers them in light and dark. 0 violations.
2. **Keyboard**: from page 1, Tab until the pagination's "Next" has focus, check that the focus is visible (a non-`none` outline or box-shadow), press Enter, and land on `page/2/`. Every pagination link is reachable by Tab. Each link's bounding box is at least 24×24.
3. **Landmark**: `getByRole('navigation', { name: 'Pagination' })` exists once per listing page. The current page's item has `aria-current="page"` and is not a link.
4. **Search ranking (FR-014)**: on any page, open Starlight search, type a child's exact title, and check that the first result is the child page, not a listing page. Paged pages are indexed: a query for "page 2" text, or the hub title, returns a listing page somewhere in the results. Use the Pagefind UI as Starlight renders it; check `tests/a11y` for an existing search helper first.

Run the spec locally (`pnpm test:a11y -- tests/a11y/paged-hub-listing.spec.ts` against the built example served by `serve-dist.mjs`), and quote the result. If a check fails only because of the local Chromium, as described above, say so; CI decides.

### T029 — Measurements and the plan doc (NFR-001, NFR-002)

**Steps**:

1. Extend `measure.mjs` with a paged mode: a 1,000-child hub at the default cap and page size (paged), against the same hub with `hub_page_size: 2000` (capped but unpaged).
   - Run three builds each, interleaved.
   - Report the median hub-page HTML size, the HTML size of all pages, and the median build time.
2. Update `docs/plans/features/large-hubs.md`:
   - Add a "Slice 2 measurements" section in the slice-1 style, with the date, Node version, method and table. NFR-001 needs the hub page at most 25% of the unpaged hub page; NFR-002 needs the build at most 10% slower. If either threshold is missed, report it in the hand-off; do not adjust it.
   - Edit slice 2's description to record the operator's ruling (DM-01M858BA): paged URLs **are** in the sitemap, agent API, `llms.txt` and search, each self-canonical. "The hub and sidenav exclusions are for human navigation ease purposes, not as a means to hide content."
   - Set `updated:` to today.

## Definition of Done

- The example has a paged hub; the pins and new assertions pass on a fresh build; `assert:no-broken-links` passes.
- The link-gate negative test reds when a paged page is missing.
- The Playwright spec and the axe entries pass locally, or are explained as Chromium-only; CI is green before the PR.
- The measurements are recorded, with the NFR verdicts stated.
- `pnpm test` (both tiers plus mcp), `pnpm lint` and `pnpm typecheck` are green, with counts quoted.

## Risks

- Example pages are deployed, so write them as real documentation, not filler, and keep the prose rules: sentence-case headings, no AI-writing tells.
- `validate:docs` and Vale run in CI. Run markdownlint locally on the new pages.

## Reviewer guidance

- Rebuild the example and check the pins yourself.
- Check that the search check uses an exact child title and asserts the first result.
