---
section: Changed
---

- **Unreleased OpenAPI versions leave the sitemap and search (#285).** Before,
  the pages of every spec version were listed and indexed like any page. Now
  the pages of a version with `released: false` are still built and served,
  carry the "unreleased" badge and their agent entries, but are held back from
  the sitemap and the search index: readers do not discover a contract that is
  not out yet, agents still resolve it. A released version is unaffected.
