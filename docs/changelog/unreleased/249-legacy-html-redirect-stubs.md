---
section: Added
---

- **Old `.html` URLs keep working after a move from DocFX (#249).** Before,
  an Astro redirect keyed on `/a/b.html` was written as the folder
  `dist/a/b.html/index.html`, which a static host does not serve at
  `/a/b.html`. A key `/a/b/index.html` replaced the live page `/a/b/` with a
  folder, and the redirect-coverage gate could not check `.html` URLs at all.
  Now the `legacyHtmlRedirects` option of `defineDocKittyIntegrations`
  (`{ '/a/b.html': '/a/b/' }`, without the base) writes a flat
  `dist/a/b.html` stub after the build. The stub is `noindex`, has a canonical
  link to the target, and is not in the sitemap, `llms.txt` or the agent API.
  It works at the domain root and under a base path, and chains in the map are
  shortened to one step. The gate looks up a baselined `.html` URL as that
  file, follows chains, and fails on a missing stub or a dead target.
  `--declared-redirects` may now be repeated. The new
  `dockitty-generate-legacy-redirects` command writes the mechanical map
  (`x.html -> x/`, `x/index.html -> x/`) from a committed list of old URLs. See
  [ADR-0071](docs/adr/0071-legacy-html-redirects-as-flat-stubs.md) and
  [Keeping .html URLs](docs/migrations/legacy-html-urls.md).
