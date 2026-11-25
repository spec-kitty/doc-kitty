---
title: "ADR-0089: Paged hub listings, included in every surface but the feeds"
description: A hub over its sidebar child cap lists its pages across static listing pages, mounted by the toolkit, framed by Starlight, and listed once in every surface but the feeds.
doc_status: active
updated: 2026-11-25T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:claude-code
related:
  - adr/0084-sidebar-child-cap
  - adr/0063-sidebar-carrier
  - guides/paged-hub-listing
  - guides/sidebar-child-cap
  - plans/features/large-hubs
---

# ADR-0089: Paged hub listings, included in every surface but the feeds

## Status

Proposed (2026-11-24), with the second slice of
[Large hubs](../plans/features/large-hubs.md) (#342), which also takes in #429. It
builds on [ADR-0084](./0084-sidebar-child-cap.md), the sidebar child cap.

## Context

ADR-0084 caps a large hub's sidebar group to its overview link and one "N pages"
entry that leads to the hub. The hub page (`kind: Hub`) then lists every page of
the folder as a card. A hub with 1,000 pages is one very long page, and it is the
only way a reader without scripts reaches those pages.

The cap's build data (`HubCap`, in `virtual:doc-kitty/route-shaping`) covered
only hubs over their cap, and only on sites whose sidebar the toolkit shapes.
A listing needs the data of every hub, also on a site with its own sidebar
(#429).

Issue #342 first asked that listing pages stay out of the sitemap. The operator
ruled otherwise on 2026-11-24: "Include them everywhere, so they are retrievable
by api, sitemap, and iterative deepening searches. The hub and sidenav exclusions
are for human navigation ease purposes, not as a means to hide content."

## Decision

1. **Which hubs are paged.** A hub is paged when it is over its sidebar child cap
   and has more pages than its page size. Every other hub lists all its pages, as
   before.
2. **The page size is its own setting**, resolved most specific first: the hub
   index's `hub_page_size`, the section's `hub.pageSize` (`sections.yaml` or the
   charter's `sections.entries`), the site's `hub.pageSize` in
   `defineDocKittyIntegrations`, then 50. A value that is not a positive whole
   number stops the build.
3. **One data set for every hub (#429).** The route-shaping data lists every
   published `kind: Hub` hub, whatever its cap and the sidebar mode, with two new
   optional `HubCap` fields, `capped` and `pageSize`. Sidebar shaping keeps only
   the capped hubs (`cappedHubCaps`), so the sidebar is unchanged. The hub page,
   the listing pages, the agent API and `llms.txt` all page through this one data
   set, in the order the hub page lists.
4. **The listing pages are a toolkit route in the Starlight frame.** The
   route-shaping integration injects `/[...hub]/page/[page]/` (prerendered),
   rendered through Starlight's `StarlightPage`, and only when a hub is paged.
   Page 1 is the hub page itself. Each listing page has the hub's title with its
   page, a self canonical, no Starlight previous and next links, and a labelled
   pagination `<nav>` that ships no script.
5. **Listing pages appear in every surface but the feeds, each exactly once.**
   The sitemap and
   the search index take them from the built pages. The agent API adds one
   `kind: "Listing"` record per listing page, after the docs records and before
   the OpenAPI records, with a per-page artifact that lists its children.
   `llms.txt` adds one line per listing page after its hub's line. A child page
   is never listed twice because of paging. A hub the agent API leaves out lists
   no listing pages there. The build identity covers the listing. The RSS feed
   and the per-page Atom entries are the exception: they carry no listing pages,
   because a listing page is a slice of its hub, not a dated page with news of
   its own. The pages it lists are in the feeds as before.
6. **The routes get the hub data through a file.** The agent API and `llms.txt`
   cannot import the virtual module. The route-shaping integration writes the
   data to a content-addressed file under Astro's `cacheDir`, and
   `DK_HUB_DATA` holds only its path, as `DK_OPENAPI` does. A path keeps the
   environment small: Linux refuses an environment string over 128 KiB, and every
   process the build spawns inherits it.
7. **A `page` child of a paged hub stops the build.** Any routed page under the
   hub whose route is `/<hub>/page` or starts with `/<hub>/page/` would collide
   with the listing URLs, compared without case.
8. **Locales follow #341** (the operator's ruling). A locale is paged where it
   has its own translated hub index over its cap, and its listing pages list
   that locale's own pages; fallback pages from the default locale are not
   listed. Each locale pages to its own depth.
9. **Alternates name only built listing pages** (the operator's ruling of
   2026-11-25, [recorded on #342](https://github.com/spec-kitty/doc-kitty/issues/342#issuecomment-7155320882)). Because locales page to different
   depths, Starlight's hreflang links and language picker could name a locale
   listing page that was never built. On a listing page they keep only the
   locale listing pages that are built; `x-default` is dropped too when the
   default locale's listing page is not built. The picker takes its options from
   the locale config, and the components map is fixed at the six carriers
   (ADR-0015), so the route-shaping integration removes those links from the
   built listing pages in `astro:build:done`, against the list of built pages.
   No other page is read.
10. **Unpaged sites do not change.** A site with no paged hub builds the same
   HTML and CSS as before: the route is not mounted, and the pagination's styles
   are an inline `<style>` emitted only with the pagination.

## Consequences

### Positive

- A large hub's page holds a bounded number of cards.
- Every page stays reachable without scripts, and every page and listing page is
  in the sitemap, the agent API and `llms.txt`.
- Sites with their own sidebar get the same listing.

### Negative

- A strict Content Security Policy must allow the hash of the pagination's inline
  style. The hash changes when the toolkit changes those styles.
- Search results can include a listing page for a query that matches card text,
  as they already include the hub page.
- The hub data is computed in more than one place during a build, from the same
  inputs.
- Nothing prunes the hub data files (`<cacheDir>/doc-kitty-hubs/*.hubs.json`).
  Old ones stay until the cache folder is cleared, as the `DK_OPENAPI`
  publication files do.
- A page with Starlight `draft: true` and `doc_status: active` is not built in
  production, yet it trips the `page` collision check of decision 7. The check
  fails loudly rather than guess.
- On a listing page, a locale without a built listing page at that number has no
  alternate link at all, not a link to its hub page.

### Risks

- A consumer integration that rewrites built HTML must keep the pagination's
  inline style intact for the strict-CSP hash to match.

## Alternatives considered

### Fallback listing pages for every locale

Rejected by the operator (decision 9). They would add URLs to every surface and
show the default locale's pages under the locale's URLs.

### Pointing a missing alternate at the locale's hub page

Rejected by the operator (decision 9). The `hreflang` link would then name
different content.

### Paging by query string (`?page=2`)

Rejected. It is not static, a crawler does not follow it, and it needs a script
to render.

### A page file in each consumer site

Rejected. Every adopter would have to add the file. The toolkit already injects
its own routes (the content graph).

### Reusing the sidebar child cap as the page size

Rejected by the operator. The cap decides the sidebar; the page size decides the
listing. One setting would tie them.

### Keeping listing pages out of the sitemap and search

Rejected by the operator's ruling above: the limits are for navigation, not to
hide content.

### Listing each page's children again in `llms.txt`

Rejected. Every child would appear twice. The listing lines name their range
instead.

### The hub data in the environment

Rejected. A large site's data passes the per-string environment limit and breaks
every process the build spawns afterwards.

## References

- Issues #342 and #429, epic #340.
- [Page large hub listings](../guides/paged-hub-listing.md), the configuration
  guide.
- [ADR-0084](./0084-sidebar-child-cap.md), the sidebar child cap.
