# Research: Large hubs: paged hub listing

Decisions for #342 (with #429 folded in). Spec decisions are in `decisions/`:
DM-01M84WZ7 (fold #429), DM-01M854WK (page size), DM-01M858BA (surfaces), DM-01M86VFX (`page` collision), DM-01M86VG3 (locales).
The operator confirmed the Engineering Alignment on 2026-11-24.

## R1. The route shape: an injected `/[...hub]/page/[page]/` through `StarlightPage`

- **Decision**: the toolkit injects one prerendered route with pattern `/[...hub]/page/[page]`. It renders `StarlightPage` from `@astrojs/starlight/components/StarlightPage.astro`.
- **Evidence (spike, 2026-11-24)**: the spike built a temporary `example/src/pages/[...hub]/page/[page].astro` on Astro 7.4.0 / Starlight 0.42.6 with one path, `guides/capped-hub/page/2`. It was removed afterwards. The build:
  - Succeeded, with no route-conflict warning for this route. The `presentations/*` conflict warnings come from existing pages.
  - Its page had `<link rel="canonical" href=".../guides/capped-hub/page/2/">` and `data-pagefind-body`.
  - Its page was listed in `sitemap-0.xml`.
  - Marked the capped "5 pages" sidebar entry `aria-current="page"` (`startsWith(dir/)`, route-shaping.ts:399).
  - Rendered no prev/next with `prev: false, next: false`.
- **Gotcha**: `StarlightPage` validates `frontmatter` against the toolkit's docs schema. The first spike failed with "description: Required". The route passes `title`, `description`, `doc_status`, `updated`, `kind`, `prev: false` and `next: false`.
- **Alternatives considered**:
  - A page file in each consumer site. Rejected: every adopter would need a file. The content-graph route is the injected precedent.
  - A query-string page (`?page=2`). Rejected: not static, not crawlable, and it breaks "no scripts".
  - A non-rest pattern per hub depth. Rejected: hubs nest at any depth.

## R2. One data set: widen the route-shaping hub data (#429)

- **Decision**: `routeShapingSource` always reads the pages, not only when `shapeSidebar` is on. It emits an entry for every published `kind: Hub` hub, keeping `HubCap`'s fields and adding `capped: boolean` and `pageSize: number`. The middleware builds its cap map from `capped` entries only, so shaping is unchanged. The hub page, the paged route, the agent API and `llms.txt` read the same module.
- **Rationale**:
  - C-001: one composition.
  - #429's acceptance: every hub, both sidebar modes, backward-compatible types.
  - The data is already served as a virtual module, so the Astro-side consumers need no filesystem access.
- **Alternatives considered**: each consumer composing from `getCollection` as `Hub.astro` does. Rejected: the cap and page-size resolution would be duplicated, and `Hub.astro` reads the registry from `cwd/docs` while the integration uses `options.docsDir` (#426 deferred item 7).
- **Note**: `Hub.astro` keeps its own composition for unpaged hubs, which stay byte-identical. For a paged hub it takes the slice of slugs from the hub data and looks up each card's details in the collection. The `docsDir` divergence in item 7 therefore cannot split a paged hub's order. A unit test pins that the two compositions agree on the fixture.

## R3. Settings names

- **Decision**:
  - The hub sets frontmatter `hub_page_size`.
  - A section sets `hub: { pageSize }` in `sections.yaml` or the charter's `sections.entries`.
  - The site sets `hub: { pageSize }` in `defineDocKittyIntegrations`.
  - The default is 50, and validation is `isChildCap` (a positive safe integer).
- **Rationale**: the page size is a property of the hub page, not the sidebar, so it gets its own `hub` key rather than going under `sidebar`. The `hub_` frontmatter prefix mirrors `sidebar_child_cap`.
- **Alternatives considered**: `sidebar.pageSize` (rejected: the setting is not sidebar behaviour) and reusing the cap (rejected by the operator, DM-01M854WK).

## R4. Which hubs are paged, and the page count

- **Decision**: a hub is paged when `capped && count > pageSize`. Its pages number `ceil(count / pageSize)`. Page 1 is the hub, and pages 2 to that number are `/<hub>/page/N/`. There is no `/page/1/` and no empty last page.
- **Edge**: a capped hub whose page size covers all its children has one page and no pagination.

## R5. Duplicate-entry handling (operator: "settle it in the plan and say how you chose")

The rule: every URL appears once on each surface, and a child is never listed again because of paging.

| Surface | What is added | Why it does not duplicate |
| --- | --- | --- |
| Sitemap | `/<hub>/page/N/` for N ≥ 2 (automatic from built HTML) | Distinct URLs; children are unchanged; `sortSitemapXml` only sorts |
| Agent API index | One record per paged page, appended after the docs records (the OpenAPI precedent, agent-index.ts), with `kind: "Listing"`, `listing_of` (hub slug), `page` and `of` | Children are not repeated in the index. The record points at its per-page JSON |
| Agent per-page JSON | `/api/pages/<hub>/page/N.json`, which lists that page's child slugs and URLs | The child pages keep their own records. This is the iterative-deepening path |
| `llms.txt` | One line per paged page, `- [<Hub>, page N](url): children A–B of C`, directly after the hub's line in its section | The title differs from every child title. Children keep their single line |
| Pagefind | Paged pages indexed like the hub page today, with no weighting change | A child's title is its own `<h1>`, which outweighs card text. This matches today's hub page, which already indexes all its card text. A Playwright search check proves the child ranks first |

- **Alternatives considered**:
  - `data-pagefind-ignore` on the cards. Rejected: the operator wants paged pages searchable, and the hub page precedent indexes the cards.
  - Listing children under each paged page in `llms.txt`. Rejected: that duplicates every child line.
  - Ranking listing records among the docs. Rejected: they are navigation, not content (OpenAPI precedent).

## R6. Locales (DM-01M86VG3)

- **Decision**: the data is keyed by the hub folder slug as on disk, so a locale's own hub index (`fr/missions/index.md`) is its own hub, with its own paged pages under `/fr/missions/page/N/`. `StarlightPage` infers the locale from the URL. The pagination strings resolve with `Astro.locals.t` and fall back to English. Fallback pages are not listed, as in #341, and this is documented.
- **Test**: a build-tier fixture with a second locale.

## R7. Pagination markup

- **Decision**: `HubPagination.astro` renders `<nav aria-label={t('dockitty.hub.pagination.label')}>`. Inside is a list with Previous, the numbered pages and Next. The current page is a `<span aria-current="page">`, not a self-link, and a disabled Previous or Next is plain text marked `aria-disabled`. The targets are at least 24×24 CSS px, with a visible `:focus-visible` outline from theme tokens.
  - On the hub page, the list follows the cards. That differs from Hub.astro's `section[role=navigation]` workaround: Pagefind should not index the pagination numbers, so a real `<nav>`, which Pagefind skips by default, is correct here.
  - With many pages, the list shows the first and last page, the current page with one neighbour on each side, and ellipses in the gaps, so its length is bounded.
- **UI strings (en)**:
  - `dockitty.hub.pagination.label` = "Pagination"
  - `.previous` = "Previous"
  - `.next` = "Next"
  - `.page` = "Page {page}"
  - `.title` = "{title}, page {page}"

## R8. `page` collision (DM-01M86VFX)

- **Decision**: while composing the hub data, a paged hub whose children include the slug `<hub>/page` (a file or a sub-folder) throws:
  `[dk-hubs] hub "<hub>" is paged, but its child "<hub>/page" would collide with the paged listing URLs; rename the child or raise the hub's page size or cap`.
  An unpaged hub with such a child builds.

## R9. ADR

- **Decision**: a new ADR-0086, "Paged hub listings, included in every surface". It cross-references ADR-0084 and records the reversal of #342's sitemap criterion and the R5 rule. 0086 is free on `main` (0080, 0082–0085 and 0087 taken) and in the open PRs (#405: 0081, #453: 0085, #454: 0087); check again when the ADR is written.

## R10. Measurements

- **Decision**: extend `src/tests/fixtures/large-hub/measure.mjs` with a paged mode: the 1,000-child hub at the default page size against the same hub with the page size raised above its child count. Three interleaved runs each. Record the median hub-page HTML and the median build time in `docs/plans/features/large-hubs.md` (NFR-001, NFR-002).
