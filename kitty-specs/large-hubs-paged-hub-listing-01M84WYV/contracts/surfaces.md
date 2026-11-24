# Contract: built surfaces of a paged hub

These rules apply to a paged hub `H`, with `count` children, page size `P` and `n = ceil(count / P)` pages.

| Surface | Contract |
| --- | --- |
| `/<H>/` | Lists children 1…P as hub cards, then `<nav aria-label="Pagination">` with page 1 current |
| `/<H>/page/N/` (2 ≤ N ≤ n) | Starlight frame. `<title>` and `<h1>` read "<H title>, page N". It shows the hub description as its lead, lists children (N−1)·P+1 … min(N·P, count), has the pagination with N current, `<link rel="canonical">` to itself, no Starlight prev/next, and the sidebar's capped entry current where the sidebar is shaped |
| `/<H>/page/1/`, `/<H>/page/n+1/` | Not built |
| `sitemap-*.xml` | Every child, plus every `/<H>/page/N/` for 2 ≤ N ≤ n, each once |
| `/api/index.json` | Every child record as before, plus one `kind: "Listing"` record per N ≥ 2, appended after the docs records. `count === pages.length` holds. The build id folds the listing pages |
| `/api/pages/<H>/page/N.json` | The listing record plus `children` for that page |
| `llms.txt` | The hub line, then one line per N ≥ 2, then the rest of the section, as before |
| Pagefind | Listing pages indexed (`data-pagefind-body`). Pagination numbers are inside `<nav>`, so they are not indexed |
| `assert-no-broken-links` | Every pagination link resolves in `dist` |
| Unpaged hub / site without paged hubs | Byte-identical HTML to before. Empty listing additions everywhere |

Settings (see data-model.md): frontmatter `hub_page_size`, section `hub.pageSize`, site `hub.pageSize`.

Build errors:

- `[dk-config] hub.pageSize must be a positive whole number`
- `section "<id>" hub.pageSize must be a positive whole number`
- the frontmatter gate on `hub_page_size`
- `[dk-hubs] hub "<H>" is paged, but its child "<H>/page" would collide with the paged listing URLs; ...`
