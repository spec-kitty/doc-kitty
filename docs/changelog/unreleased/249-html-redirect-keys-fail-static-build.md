---
section: Changed
---

- **An Astro `redirects` key that ends in `.html` fails a static build
  (#249).** Before, it built a folder that a static host does not serve at that
  URL, or replaced a live page. Now a static build (`output: 'static'` with
  `build.redirects` on) stops and names each key. Move those entries to
  `legacyHtmlRedirects`, without the base on the target. A server-output
  (adapter) site, or one whose adapter sets `build.redirects: false`, keeps its
  `.html` keys: Astro writes no files for them, and the adapter (or Astro at
  request time) answers them. A key that is also a `legacyHtmlRedirects` source
  fails in every mode.
