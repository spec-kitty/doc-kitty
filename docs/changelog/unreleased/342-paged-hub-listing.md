---
section: Added
---

- **Large hubs list their pages across static listing pages (#342, #429).**
  Before, a hub over its sidebar child cap still listed every page as a card on
  one page. Now such a hub lists its first page of cards and links
  `/<hub>/page/2/` onwards with a labelled pagination that needs no script. Set
  the page size (default 50) with `hub_page_size` on the hub, `hub.pageSize` on a
  section, or `hub.pageSize` in `defineDocKittyIntegrations`. Listing pages are
  in the sitemap, search, the agent API (`kind: "Listing"` records with their
  children) and `llms.txt`, each once; the RSS and Atom feeds leave them out. On
  a translated site each locale pages to its own depth, and a listing page's
  `hreflang` links and language picker name only the listing pages that are
  built. A hub that is not paged, and a site with
  no paged hub, builds exactly as before. The route-shaping hub data now covers
  every hub, also on sites with their own sidebar; `HubCap` gained the optional
  `capped` and `pageSize` fields, and `cappedHubCaps` filters the capped ones. A
  strict Content Security Policy must allow the pagination's inline-style hash.
  See [Page large hub listings](docs/guides/paged-hub-listing.md) and
  [ADR-0089](docs/adr/0089-paged-hub-listing.md).
