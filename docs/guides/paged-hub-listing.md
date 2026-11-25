---
title: Page large hub listings
description: Split a large hub's page list into static listing pages. Set the page size per site, section or hub, and see where the listing pages appear.
doc_status: active
updated: 2026-11-25T00:00:00Z
type: Guide
kind: How-To
tags: [hubs, paging, scale, configuration, consumer, accessibility]
related:
  - guides/sidebar-child-cap
  - guides/consumer-setup
  - guides/authoring
  - adr/0089-paged-hub-listing
  - plans/features/large-hubs
---

# Page large hub listings

**Audience.** A site owner whose docs tree has a hub with hundreds of pages, or
the engineer who writes a tool that reads the site's agent API.

A hub is a folder whose index page has `kind: Hub`. Its page lists the folder's
pages as cards. The [sidebar child cap](./sidebar-child-cap.md) keeps a large hub
out of every page's sidebar, so the hub page is how a reader reaches its pages.
With 835 pages, that one page would list 835 cards.

The paged listing splits it. The hub page lists the first page of cards. The
rest go on static listing pages, `/<hub>/page/2/` onwards. A pagination bar links
them all. It works without scripts.

## Which hubs are paged

A hub is paged when both of these hold:

- it has more pages than its sidebar child cap, so the sidebar shows "N pages"
  instead of its pages;
- it has more pages than its page size.

Every other hub lists all its pages on its own page, exactly as before. A site
with no paged hub builds the same pages as before.

## Set the page size

The page size is the number of cards on each listing page. It is set at three
levels. The most specific level that is set wins, then the default of 50.

1. On the hub, with `hub_page_size` in its index page's frontmatter:

   ```yaml
   ---
   title: Missions
   kind: Hub
   hub_page_size: 30
   ---
   ```

2. On a section, with `hub.pageSize` on its entry in `docs/_meta/sections.yaml`
   or in the charter's `sections.entries`:

   ```yaml
   sections:
     - id: missions
       label: Missions
       order: 20
       hub:
         pageSize: 40
   ```

3. On the site, with `hub.pageSize` in `defineDocKittyIntegrations`:

   ```ts
   defineDocKittyIntegrations({
     title: 'My docs',
     hub: { pageSize: 25 },
   });
   ```

Each value must be a positive whole number. Any other value stops the build:

- the site option: `[dk-config] hub.pageSize must be a positive whole number`;
- a section: `section "<id>" hub.pageSize must be a positive whole number`;
- the frontmatter gate names `hub_page_size` and says it "must be a positive
  whole number".

The page size does not change the sidebar. The cap decides whether a hub is
capped. The page size decides how its listing is split.

## The listing pages

A hub with 120 pages and a page size of 50 has three listing pages:

| Page | URL | Lists |
| --- | --- | --- |
| 1 | `/missions/` | pages 1–50 |
| 2 | `/missions/page/2/` | pages 51–100 |
| 3 | `/missions/page/3/` | pages 101–120 |

There is no `/missions/page/1/`, and no empty last page. A site `base` prefixes
every URL.

Each listing page from 2 on:

- sits in the normal site frame, with the header, the search and the sidebar;
- is titled with the hub's title and its page, for example "Missions, page 2";
- shows the hub's description as its lead, then the cards, then the pagination;
- marks the hub's "N pages" sidebar entry as the current page;
- has no previous and next links at the foot of the page, because the pagination
  replaces them;
- has a canonical link to its own URL.

The cards are the ones the hub page shows, in the same order: ADR cards first by
number, then the other pages by section and title.

Page 1 is the hub page itself, so it keeps what every docs page has: Starlight's
previous and next links at its foot (to its neighbours in the sidebar) and the
"This page as data" links. The pagination's Previous and Next, above them, move
between listing pages. The listing pages from 2 on have neither footer: they are
views of the hub, and their agent-API form is the listing record.

## The pagination

The pagination is a navigation landmark named "Pagination". It holds Previous,
the page numbers and Next.

- The current page is text with `aria-current="page"`, never a link to itself.
- Previous on the first page and Next on the last page are plain text.
- With up to seven pages it shows them all. With more, it shows the first page,
  the last page and the current page with its neighbours, and a gap for each run
  of pages left out.
- Every link is at least 24 by 24 CSS pixels, with a visible focus ring.
- It ships no script.

## Where the listing pages appear

Listing pages are included in every surface but the feeds, each exactly once.
The hub and sidebar limits are there to make navigation easier for people, not to
hide content. No child page is listed twice because of paging.

- **Sitemap.** Every child page and every listing page from 2 on.
- **Search.** Listing pages are indexed like the hub page, whose card text is
  indexed too. A search for a page's exact title still finds that page first,
  because the title is its own heading.
- **Agent API.** `/api/index.json` has one record per listing page from 2 on,
  with `kind: "Listing"`, `listing_of` (the hub), `page` and `of` (the page
  count). The records come after the docs records and before any OpenAPI
  records. `/api/pages/<hub>/page/<n>.json` adds `children`, the slug, title and
  URL of each page that listing page shows (the `ListingChild` type in the
  toolkit's agent API contract, `src/lib/contract.ts`). A hub the agent API leaves out, by
  its section's `feeds` or its own `agent.discoverable: false`, has no listing
  records.
- **`llms.txt`.** One line per listing page, right after the hub's own line:

  ```text
  - [Missions, page 2](https://example.com/missions/page/2/): children 51–100 of 120
  ```

- **Not in the feeds.** The RSS feed and the per-page Atom entries carry no
  listing pages, by design: a listing page is a slice of its hub, not a dated
  page with news of its own. The pages it lists are in the feeds as before.

The build identity (`buildId`) covers the listing, so a changed page size
changes it.

## A page named `page`

The listing pages live at `/<hub>/page/<n>/`. A paged hub may not also have a
page there. A child file `page.md`, a `page/` folder, or any page whose route
starts with `/<hub>/page/` stops the build:

```text
[dk-hubs] hub "missions" is paged, but its child "missions/page" would collide with the paged listing URLs; rename the child or raise the hub's page size or cap
```

Rename the page, or raise the hub's page size or cap so the hub is not paged.
The check ignores case, because routes do.

The check counts every page the toolkit publishes, by its `doc_status`. A page
with Starlight's `draft: true` but `doc_status: active` is not built in
production, yet it still stops the build. This is deliberate: the build fails
loudly rather than guess. Give the page `doc_status: draft`, or rename it.

## Translate the pagination

The pagination's words are Starlight UI strings with English defaults. Translate
them as you translate any UI string:

| Key | English |
| --- | --- |
| `dockitty.hub.pagination.label` | Pagination |
| `dockitty.hub.pagination.previous` | Previous |
| `dockitty.hub.pagination.next` | Next |
| `dockitty.hub.pagination.page` | Page {page} |
| `dockitty.hub.pagination.title` | {title}, page {page} |

`{page}` and `{title}` are replaced. A key a locale does not translate falls back
to English. The agent API and `llms.txt` always use the English title.

## Translated sites

A locale is paged where it has its own translated hub index, over its cap. Its
listing pages list that locale's own pages, so each locale pages to its own
depth: English can have `/missions/page/4/` while French stops at
`/fr/missions/page/3/`.

A listing page's alternate-language links, the `hreflang` links in its head and
the language picker, name only the listing pages that are built. English
`/missions/page/4/` has no French alternate, and English `/missions/page/2/`
keeps its French one. When the default locale has no listing page at that
number, the `x-default` link is dropped too. This is the operator's ruling,
recorded on
[#342](https://github.com/spec-kitty/doc-kitty/issues/342#issuecomment-7155320882).
The build removes those links from the built listing pages; no other page is
touched. The dev server (`astro dev`) skips that step, so it still shows every
locale's link.

## Sites with their own sidebar

A site that writes its own Starlight sidebar is paged the same way. Its sidebar
stays exactly as written, so it shows no "N pages" entry.

Such a site has no site-wide child cap, so the default cap (50) decides which hubs
are paged. After upgrading, a hub with more than 50 pages is paged. To keep it on
one page, raise its cap (`sidebar_child_cap` on the hub, or `sidebar.childCap` on
its section) or its page size above its page count.

## Strict Content Security Policy

The pagination's styles are one inline `<style>` element, emitted only on pages
that show the pagination. A site without a paged hub emits it nowhere. A strict
`style-src` must allow its hash:

```text
style-src 'self' 'sha256-dlpk7sxv9SQrYU5m52WcuINGV5NwRI/Y3N3Ida3KAhE='
```

The hash is the SHA-256 of the element's text content, base64-encoded, as
browsers compute it. It changes only when the toolkit changes those styles.

## For tools: the paging API

`@spec-kitty/doc-toolkit/child-cap` exports the rules the build uses, so a page
generator or a tool can predict a hub's listing pages exactly:

| Export | What it does |
| --- | --- |
| `DEFAULT_HUB_PAGE_SIZE` | 50 |
| `resolveHubPageSize({ hub, section, site })` | The page size, most specific level first |
| `isPagedHub(hub)` | Whether a hub is paged: capped, and more pages than its page size |
| `hubPageCount(hub)` | The number of listing pages, 1 when not paged |
| `hubPageSlice(children, page, pageSize)` | The children on one listing page |
| `pagedHubSlug(hub, page)` | A listing page's slug: the hub for page 1, `<hub>/page/<n>` after |
| `hubListingPages(hubs)` | Every listing page from 2 on of every paged hub |
| `cappedHubCaps(hubs)` | The hubs the sidebar caps, from data that lists every hub |
| `HUB_PAGINATION_KEYS`, `HUB_PAGINATION_STRINGS`, `resolveHubString` | The pagination strings |

The `HubCap` type gained two optional fields, `capped` and `pageSize`. Code
written against the sidebar child cap's `HubCap` still compiles. The build's hub
data now lists every published `kind: Hub` hub, capped or not, whatever the
sidebar mode. Filter it with `cappedHubCaps` where you need only the capped
hubs.

An invalid page size passed to these functions throws a `RangeError`.

## Limits

- **Locales.** A locale is paged only where it has its own translated hub index.
  Its listing pages list that locale's own pages; fallback pages from the
  default locale are not listed. See [Translated sites](#translated-sites).
- **The hub data files are not pruned.** Each build writes its hub data to
  `<cacheDir>/doc-kitty-hubs/<hash>.hubs.json` (by default under
  `node_modules/.astro/`). Nothing deletes old ones; they are small, and clearing
  the cache folder removes them.
- **No dynamic listing yet.** There is no "load more", sorting or filtering on
  the listing. That is planned in #343.
- **`llms.txt` lists every page.** A summary mode that lists a large hub and an
  index file instead is planned in #344.
