---
section: Added
---

- **A site can leave whole docs folders out of the build (#247).** Before, the
  docs loader refused any pattern but the default, so a folder you keep in git
  but do not publish (an archive, internal reports, working notes) was built,
  schema-checked and link-checked like any other. Now
  `defineDocKittyIntegrations({ exclude: ['archive', 'plans/engineering-notes'] })`
  leaves those folders out of the loader, the routes, the sidebar, search, the
  sitemap, `rss.xml`, `llms.txt`, the agent API and the ADR Hub, and
  `validate-frontmatter` and `check-links --strict` skip them. Entries are
  folder paths relative to `docsDir`, with no globs, and each must exist with the
  same letter case. A link or `related:` ref from a published page into an
  excluded folder is reported as "target is excluded from the site";
  `assert-no-broken-links` and `generate-adr-index` take a new `--docs <dir>`
  option to read the list. Without `exclude` nothing changes. See
  [ADR-0070](docs/adr/0070-excluded-folders.md).
