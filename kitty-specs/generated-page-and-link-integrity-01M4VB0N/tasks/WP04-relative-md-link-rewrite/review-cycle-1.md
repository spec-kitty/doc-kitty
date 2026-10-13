---
affected_files: []
cycle_number: 1
mission_slug: generated-page-and-link-integrity-01M4VB0N
reproduction_command:
reviewed_at: '2026-10-13T20:35:56Z'
reviewer_agent: claude
wp_id: WP04
---

# WP04 review feedback (cycle 1)

Verdict: changes requested. The plugin, its wiring and its tests are sound; one consequence of the shared `routeOfSlug` change is not.

## MAJOR 1 — `draftRoutesOf` now reports a published folder route as a draft route

`src/lib/vocabulary-core.mjs:913-916` (`routeOfSlug`) now maps the id `x/index` to `/x/`. That matches Starlight 0.32.6 (`utils/slugs.ts` `slugToParam`; `utils/routing/index.ts:96,108`) and is correct as a route rule. But `draftRoutesOf` (`src/lib/draft-publication.mjs:304-313`) turns each draft FILE into its route with no check that another, published file holds the same route.

Reproduction (any tree with `x/README.md` published and `x/index.md` draft; `indexBasename` either `'README'` or `['README','index']`, the example's real setting, where this is the supported warn-only collision E-05):

| | routes | `draftRoutesOf` |
|---|---|---|
| before 446acf5 | `x/README.md -> /x/`, `x/index.md -> /x/index/` | `{'/x/index/'}` |
| after 446acf5 | `x/README.md -> /x/`, `x/index.md -> /x/` | `{'/x/'}` |

With `DK_PUBLISH_DRAFTS=off` the draft entry is dropped by the loader, so `/x/` is unambiguously the published README page, yet every consumer of the draft set now treats it as a draft:

- `sitemapDraftFilter` (`src/lib/config.ts:419-420`) drops `/x/` from the sitemap;
- `draftPublicationIntegration` (`src/lib/config.ts:1618-1620`) puts `x` in `routeShaping.unpublishedDirs` (the sidebar group for the published section loses its metadata, `config.ts:1501-1507`) and withholds redirects that lead to `/x/`;
- the `astro:build:done` check (`config.ts:1659-1675`) warns that draft page `/x/` was built;
- `check-redirect-coverage.mjs:417` reports redirects to `/x/` as unpublished.

Before the change none of this happened (the set held `/x/index/`, which matched nothing). The doc comment at `src/lib/draft-publication.mjs:294-296` ("of two index files in a folder, the demoted one is a draft at its own route, not at the folder's") is now false. The agreement test in `src/tests/route-table.test.ts` (`the loader, route table, draft routes and sidebar agree`) cannot see it: it derives the expected draft set from the same table.

Required:
1. In `draftRoutesOf`, a route is a draft route only when no non-draft file resolves to the same route (compute the routes of the non-draft files and exclude them). `unpublishedDraftPaths` works on file paths and needs no change.
2. Correct the doc comment at `draft-publication.mjs:294-296` to say what now holds (a demoted or stray `index.md` shares its folder's route; it is a draft route only if the folder's other page is a draft too).
3. Pin it with a literal expectation, not one derived from the table: for the existing `FILES` fixture in `route-table.test.ts` (`guides/README.md` active, `guides/index.md` draft) under `'README'` and `['README','index']`, `draftRoutesOf` must not contain `/guides/`. Under `['index','README']` (draft wins the folder) it must contain `/guides/`.
4. Record both out-of-map edits (`vocabulary-core.mjs`, `draft-publication.mjs`) in the hand-off.

## MINOR 2 — the hook's `indexBasename` wiring is unpinned

Removing `indexBasename` from the `buildRouteTable` call (`src/lib/config.ts:478-479`) or the third argument of `unpublishedDraftPaths` (`config.ts:480`) leaves all eight test files green: the freshness test (`src/tests/relative-md-links.test.ts:139-143`) passes `indexBasename: 'README'`, the default. Change that one test to a non-default setting whose table differs from the default's (for example `indexBasename: 'index'` with a `g/README.md` in the tree, and assert the captured `routes['g/README.md']` is `/g/README/`); no new test.

## MINOR 3 — inert token in the two-pass test

`src/tests/base-absolute-links.test.ts:147` renders `[root](/guides/x/)` but nothing asserts on it. Either assert it stays `href="/guides/x/"` (the pre-existing skip rule) or remove it.

## Notes (no change required)

- Duplicate routes: on a README-only site `x/README.md` and `x/index.md` both map to `/x/` and `buildRouteTable` reports no collision (collisions cover configured index names only). The site has always had two entries on one Starlight param there; the table now shows it. Worth a sentence in the ADR, and possibly a follow-up to report it.
- Other surfaces still build `/${id}/` from an entry id (`src/lib/metadata.ts:332`, `layouts/Hub.astro:60`, `lib/routes/rss.ts:46`, `lib/routes/llms-txt.ts:145`, `components/slots/Related.astro:55`), so for an id ending in `/index` they point at `/x/index/`, which Starlight does not serve. Pre-existing and out of scope; name it in the ADR.
- `relative-md-links.ts:59`: `rel.startsWith('..')` also skips a root-level file literally named `..something.md` (fails safe). A `definition` used only by an image reference is rewritten too; harmless.
- `docsRoot` resolves against `process.cwd()`, the glossary integration against `config.root`; consistent with `siteDraftRoutes`, fails safe (empty table) if they differ.
