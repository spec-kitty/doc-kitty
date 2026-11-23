---
section: Added
---

- **A pack reader, pinned to the charter's packs contract (#330).** Before,
  doc-kitty could not read a Spec Kitty pack. Now `readPack(dir)` reads a pack
  directory into one model: identity, the README's title, preamble and
  sections, presets, mutability levels, an inventory per kind, a manifest whose hashes are
  recomputed, and warnings that never fail the build. It classifies files with a
  vendored snapshot of the charter's packs contract at
  `contract-packs-v0.1.0-rc.1`, checked by a lock and by the charter's own
  conformance cases. `pnpm packs:sync-contract --ref <tag>` refreshes the
  snapshot. The new `packs.charterLock` and `packs.contract` options pin the
  contract, and `dockitty-read-pack <dir> --json` prints the model. Pack pages
  follow in #338. See
  [ADR-0079](docs/adr/0079-kitty-packs-through-a-charter-contract-reader.md).
- **One registry for generated pages (#330).** Before, the frontmatter gate,
  the stamp helpers and the Gherkin generator each named the Gherkin and
  glossary producers themselves. Now every producer is registered once, with an
  ownership scope: a whole section, or directories inside one. A stamp outside
  its producer's scope no longer exempts a page. See
  [ADR-0083](docs/adr/0083-producer-registry-and-ownership-scopes.md).
