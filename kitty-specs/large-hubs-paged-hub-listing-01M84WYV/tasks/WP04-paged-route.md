---
work_package_id: WP04
title: Paged route /<hub>/page/N/
dependencies:
- WP03
requirement_refs:
- FR-007
- FR-010
- FR-011
- FR-012
- FR-016
- FR-017
- FR-018
- C-005
- SC-001
- SC-003
- SC-005
planning_base_branch: feat/342-paged-hub-listing
merge_target_branch: feat/342-paged-hub-listing
branch_strategy: Planning artifacts for this mission were generated on feat/342-paged-hub-listing. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/342-paged-hub-listing unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-large-hubs-paged-hub-listing-01M84WYV
base_commit: 0aa0210f67381ed7958102f5eec48c0f200ef0b5
created_at: '2026-11-24T19:48:30.330272+00:00'
subtasks:
- T017
- T018
- T019
- T020
- T021
history:
- timestamp: '2026-11-24T16:00:00Z'
  agent: planner
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/integrations/paged-hubs.ts
create_intent:
- src/lib/integrations/paged-hubs.ts
- src/lib/routes/paged-hub.astro
- src/tests/paged-hub-build.test.ts
- src/tests/paged-hubs-integration.test.ts
execution_mode: code_change
owned_files:
- src/lib/integrations/paged-hubs.ts
- src/lib/routes/paged-hub.astro
- src/package.json
- src/tests/fixtures/large-hub/site.mjs
- src/tests/paged-hub-build.test.ts
- src/tests/paged-hubs-integration.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP04 — Paged route `/<hub>/page/N/`

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

The toolkit injects a prerendered route that renders pages 2 onwards of every paged hub inside the Starlight frame. A 200-child built fixture proves the user stories end to end.

- Requirements: FR-007, FR-010, FR-011, FR-012, FR-016, FR-017, FR-018, C-005; SC-001, SC-003, SC-005.
- Plan: IC-03. Research: R1 (the spike, including the schema gotcha), R4, R6, R8. Contract: `contracts/surfaces.md`.

## Shared context

- **The spike (research R1).** A page file `[...hub]/page/[page].astro` that rendered `StarlightPage` built cleanly on Astro 7.4.0 / Starlight 0.42.6, and its page:
  - had a self canonical and `data-pagefind-body`;
  - was in the sitemap;
  - marked the capped entry current;
  - had no prev/next with `prev: false, next: false`.
- **The gotcha.** `StarlightPage` validates `frontmatter` against the toolkit docs schema, so you must pass `title`, `description`, `doc_status`, `updated` and `kind`.
- **Precedent for an injected route**: `src/lib/integrations/content-graph.ts`, whose entrypoint is a package export.
- WP01: `hubListingPages`, `hubPageCount`, `resolveHubString`, `HUB_PAGINATION_KEYS`. WP02: the hub data. WP03: `HubCardList`, `HubPagination`, `listingCards`.
- The fixture helper `src/tests/fixtures/large-hub/site.mjs` builds sites under `example/.dk-test-sidebar-cap-*`, which is already git-ignored. Keep that prefix.
- **Red first.** Before hand-off, run the full `pnpm test` (both tiers plus mcp), `pnpm lint` and `pnpm typecheck`.

## Branch strategy

Planning base and final merge target: `feat/342-paged-hub-listing`. The lane worktree comes from `lanes.json`. Start with:

```bash
spec-kitty agent action implement WP04 --agent <name> --mission large-hubs-paged-hub-listing-01M84WYV
```

## Subtasks

### T017 — `src/lib/integrations/paged-hubs.ts`

**Steps**:

1. `pagedHubsIntegration()` returns an `AstroIntegration` named `doc-kitty:paged-hubs`. In `astro:config:setup` it calls `injectRoute({ pattern: '/[...hub]/page/[page]', entrypoint: '@spec-kitty/doc-toolkit/routes/paged-hub', prerender: true })`.
2. Add the export `"./routes/paged-hub": "./lib/routes/paged-hub.astro"` to `src/package.json` (next to `./routes`).
3. **Registration, an out-of-map edit.** Add `pagedHubsIntegration()` to the integrations list in `src/lib/config.ts`, right after `contentGraphIntegration(...)`, which is around line 1020. `config.ts` belongs to WP02, which is approved before this WP starts. Record this one-line edit with its rationale in your hand-off.
4. A site without paged hubs gets an empty `getStaticPaths`, so it builds no extra page (NFR-005).

**Tests** (`src/tests/paged-hubs-integration.test.ts`): the integration injects exactly that pattern, entrypoint and `prerender`; `defineDocKittyIntegrations(...)` includes it; and the export map entry resolves to an existing file.

### T018 — `src/lib/routes/paged-hub.astro`

**Steps**:

1. `getStaticPaths()` reads `routeShaping.hubCaps` from `virtual:doc-kitty/route-shaping`. It returns `hubListingPages(...)`, mapped to `{ params: { hub, page: String(page) }, props: { hub, page, of, children } }`.
2. Rendering:
   - Look up the hub's own entry with `getEntry('docs', <hub index id>)`, to get its title, description, `doc_status` and `updated`.
     - Find how `Hub.astro` and `page-formats-route.ts` map a slug to a collection id (`slugFromEntryId` and `ROOT_ENTRY_ID`). Remember the index basename can be `README` or `index`.
     - Collect the docs entries once (`collectDocEntries({ withBody: true })`) and find the hub by `slugFromEntryId(entry.id) === hub`.
   - Build `cardsBySlug` with the same composition `Hub.astro` uses (WP03's helpers). Render `HubCardList` for `listingCards(childSlugs, cardsBySlug)`.
   - Wrap it in `StarlightPage` with this frontmatter:
     - `title`: `resolveHubString('dockitty.hub.pagination.title', { title, page })`, giving "Missions, page 2";
     - `description`: the hub's description;
     - `doc_status` and `updated`: the hub's values;
     - `kind: 'Hub'`;
     - `prev: false`, `next: false`.
     - **Do not set `pagefind: false`**: the operator ruled these pages are indexed (DM-01M858BA).
   - Show the hub's description as the lead paragraph above the cards, then `HubPagination` with `current = page`.
3. Locale: `StarlightPage` infers it from the URL. Pass `Astro.locals.t` to `resolveHubString`.
4. Canonical: Starlight emits a self canonical (research R1), so add no override.

### T019 — Fixture options (`src/tests/fixtures/large-hub/site.mjs`)

Extend `siteFiles` with these options, keeping the defaults so existing callers are unchanged:

- `pageSize` (site `hub.pageSize`);
- `hubPageSize` (frontmatter `hub_page_size` on the `missions` hub);
- `customSidebar: true` (pass a Starlight `sidebar` array, so the toolkit does not shape it);
- `locale: 'fr'` (a Starlight `locales` config with root `en` and `fr`, plus a translated `docs/fr/missions/README.md` and N `fr` children);
- `pageChild: true` (adds `docs/missions/page.md`).

Read how slice 1's options are threaded into `astro.config.mjs` and copy the pattern. Check that `sidebar-child-cap-build.test.ts` and `measure.mjs` still pass with the defaults.

### T020 — Build suite: the user stories (`src/tests/paged-hub-build.test.ts`)

Build a 200-child site with the default cap of 50 and the default page size of 50. Assert on `dist`:

1. `missions/` lists children 1–50 (by the hub's listing order, `missionChildren` reversed by title), and `missions/page/2/`, `/3/` and `/4/` list 51–100, 101–150 and 151–200.
2. The union of the card hrefs over the four pages is exactly the 200 children, each once (SC-001). Following only the pagination hrefs from `missions/` reaches all four pages.
3. `missions/page/1/` and `missions/page/5/` do not exist.
4. Each paged page has:
   - `<link rel="canonical" href="https://example.test/site/missions/page/N/">`;
   - `<title>` starting "Missions, page N";
   - the Starlight frame (header, `#starlight__sidebar`);
   - the capped "200 pages" entry as the only `aria-current="page"` sidebar entry;
   - no Starlight prev/next links (`rel="prev"`/`rel="next"` appear only inside `.dk-hub-pagination`);
   - `data-pagefind-body`.
5. The pagination on page 3:
   - `nav[aria-label="Pagination"]`;
   - the current item is a `span[aria-current="page"]` with text 3;
   - Previous links to page 2 and Next to page 4;
   - on page 1 Previous is `aria-disabled` text, and on page 4 Next is.
6. `sitemap-0.xml` holds all 200 children and `missions/page/2/` to `/4/`, each once (SC-003, FR-012).
7. Two builds give byte-identical paged pages (NFR-003). Reuse the second build if one already exists in a slice-1 suite; otherwise build once more and say what it costs in time.

Keep the build timeout at 300 s per build, like slice 1.

### T021 — Build suite: variants

- **Exact multiple**: 100 children, page size 50. There is exactly one paged page (`page/2`) and no `page/3`.
- **Page size levels**: frontmatter `hub_page_size: 30` with site `hub.pageSize: 80` gives 7 pages for 200 children (frontmatter wins).
- **Consumer sidebar** (FR-017): with `customSidebar: true`, the same 200-child tree gives the same paged pages and card lists as the shaped build, compared ignoring the sidebar markup, and the consumer sidebar is unchanged.
- **Locale** (FR-018): `fr/missions/page/2/` exists with `lang="fr"`, and the pagination label falls back to English.
- **Collision** (FR-016): a build with `pageChild: true` and a paged hub fails, and its output contains `[dk-hubs] hub "missions" is paged, but its child "missions/page"`. The same tree with the cap raised above 201 builds (the positive control).
- **Unpaged identity** (NFR-005, SC-005): the slice-1 uncapped goldens still pass. That suite runs unchanged; check it is green and say so.

Keep the variant builds small (for example 120 children) to bound the suite's time, and report the total build-tier time in the hand-off.

## Definition of Done

- The route is injected for every consumer, and sites without paged hubs build byte-identical output.
- The build suite proves US1, US3, US6 and the listed edge cases on built output.
- `pnpm test` (both tiers plus mcp), `pnpm lint` and `pnpm typecheck` are green, with counts and the build-tier time quoted.

## Risks

- **A route pattern conflict.** If Astro reports a conflict between `/[...hub]/page/[page]` and Starlight's `[...slug]` for some path, that path must be a real child named `page/N`. T021's collision rule covers a direct `page` child. A deeper collision means a nested hub, which then has its own data entry and the same check.
- **Format and source links.** `currentPageLinks` finds no collection entry for these pages, so the page shows no format or source links. That is correct; do not add any.

## Reviewer guidance

- Open a built paged page and a hub page side by side: the frame, the cards and the pagination must be consistent.
- Re-run the collision variant and its positive control.
