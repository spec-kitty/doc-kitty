# Contract: print routes

| Route | When | Title (`<h1>`) | Page-title level |
|---|---|---|---|
| `/print/<id>/` | section `<id>` has its own PDF | section label | `h2` |
| `/print/` | site `pdf.site` is true | site title | `h3` (sections are `h2`) |

- Rendered with `StarlightPage`, `pagefind: false`, `<meta name="robots" content="noindex">`, filtered from the sitemap; not in `llms.txt`, the agent API, RSS or the OKF bundle (those enumerate docs entries).
- The section's index page (or, for `/print/`, the docs root index) is the cover body: its title is the `<h1>`, its content follows the cover facts. The cover and table of contents use no `h2`/`h3`, so the outline's page-title level holds page titles only.
- Cover: site name, label, purpose (section) or description (site), build date from `SOURCE_DATE_EPOCH` (fallback: last commit time; omitted when neither exists), table of contents linking `#p<N>`.
- Each page: `<section class="dk-print-page" id="p<N>">` starting a new sheet, hero with title, `doc_status`, `updated`; content with ids prefixed `p<N>-`.
- Links: same-document page → `#p<N>[-frag]`; other root-relative → absolute `site + base + path`. Every rewritten link carries `data-dk-print-link` (the print stylesheet prints no URL for it); the build gate maps each same-site absolute link back into the dist.
- `dist/print/manifest.json` lists every document (see data-model.md).
- Config error when a site route already occupies `/print/`.
