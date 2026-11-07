---
section: Fixed
---

- **The agent index no longer names a surface the site does not mount (#290).**
  Before, `/api/index.json` linked `rss`, `bibliography`, `scenarios`, `llms` and
  `sitemap`, and each record's `self`, unless the site turned the first four off
  through `links`, so a site without one of those routes shipped a dangling link.
  Now the toolkit detects the surfaces from the site's routes at their standard
  paths, and `_links` follows that. `llms` follows the `llms.txt` route, and
  `sitemap` needs both the sitemap and `site` to be set, so a build with no `site`
  has no `sitemap` link. `IndexLinks.llms` and `IndexLinks.sitemap` are now
  optional in the contract types. An explicit `links` value still wins for
  `rss`, `bibliography`, `scenarios` and `pages`, which is how to link a route at
  another path; `llms` and `sitemap` have no override.
