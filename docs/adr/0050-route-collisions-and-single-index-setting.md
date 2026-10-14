---
title: "ADR-0050: Route collisions are fatal, and index names are set once"
description: Two files on one address stop the build, index names live in one setting, and _meta Markdown is never published. Amends ADR-0047 and ADR-0048.
doc_status: active
updated: 2026-10-14
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0002-readme-as-index
  - adr/0018-citation-catalog-collections
  - adr/0033-flexible-section-identity
  - adr/0047-relative-markdown-links
  - adr/0048-generated-page-names-and-empty-sources
  - architecture/gherkin-pages
  - architecture/glossary
---

# ADR-0050: Route collisions are fatal, and index names are set once

## Status

**Accepted** — 2026-10-14. It amends [ADR-0047](./0047-relative-markdown-links.md) and
[ADR-0048](./0048-generated-page-names-and-empty-sources.md), and it supersedes
[ADR-0002](./0002-readme-as-index.md) and ADR-0047 in part: where they say that one
of two files on the same address wins, or that a surface decides on its own which
files are index pages, this record replaces that rule. Those records are not edited.
[ADR-0033](./0033-flexible-section-identity.md) still defines `indexBasename`; this
record changes where it is set. [ADR-0018](./0018-citation-catalog-collections.md)
still defines the `_meta` registry files.

## Context

Issues 134 to 139 came from one cause: the toolkit decided which file is a folder's
index page in several places, and the places disagreed.

- **Three settings.** `indexBasename` existed on `defineDocKittyIntegrations`, on
  `docKittyDocsLoader` and as the `--index-basename` flag of the scripts. The flag's
  default was `README,index`; the build's was `README`. A site could pass the link
  check and fail to build, or the reverse.
- **Collisions resolved by name, not by address.** When `README.md` and `index.md`
  sat in one folder, one was demoted to an ordinary page and a warning was logged.
  Two files that produced the same address in other ways (`page.md` and `page.mdx`,
  or `Guide.md` and `guide.md`) were not detected at all.
- **Hand-built addresses.** Feeds, `llms.txt`, the agent API, related links, the Hub,
  the scenario index and the on-this-page block each built a path from the page id.
  A page with the id `guide/index` was advertised at `/guide/index/` while the site
  served it at `/guide/` (issue 134). The sidebar used its own index test (issue 138).
- **`_meta` Markdown** was walked and published like any page, although the folder
  holds registry data.

A shared route rule already existed: `routeOfSlug`, `buildRouteTable` and
`resolveIndexEntries` in `vocabulary-core.mjs`. The mission applies it everywhere.

## Decision

1. **Collisions are keyed by address, compared without regard to letter case, and
   fatal.** Two or more files with the same route stop the build, the loader and
   `dockitty-check-links --strict` (exit 1). One formatter writes the message for all
   three. It names every file, the address and a fix. There is no winner and no
   demotion. Draft files count, whether drafts are published or not. Case-only
   differences fail for ordinary pages too, because their output folders clash on
   macOS and Windows (operator decision 01M4WENRXTXVQ7MEFV7EQXFMB2).
2. **`index.feature` is rejected on any setting.** A Gherkin file with the leaf name
   `index` would map to a generated page that the site serves at its folder address.
3. **Index names are set once, in `defineDocKittyIntegrations`.**
   - The integration publishes the normalised list in the process environment as
     `DK_INDEX_BASENAME`. The loader reads it lazily, when the collection loads.
   - The loader's own `indexBasename` option is deprecated. A value that differs from
     the integration's fails the build and names both.
   - The scripts read the list from the site's `astro.config.*`. `dockitty-check-links`
     prints one `index names: … (from …)` line per root. With no site config its
     default is `README`, the same as the build.
   - `--index-basename` stays as an optional cross-check. It must list the same names
     as the config; the comparison ignores order and letter case, and the config's
     order wins. A disagreement exits 2, and so does a config that cannot be loaded
     (operator decision 01M4WENQAJN2S0N7WXR12F7YY4).
   - `new-doc --section` and `scaffold` default to the first configured name.
4. **`_meta` is excluded everywhere.** Markdown in a `_meta/` folder at any depth, and
   files named `_meta.md` or `_meta.mdx`, are not walked, not in the route table, not
   published, not linked and not link-checked. The registry YAML in `_meta/` still
   loads. `validate-frontmatter` still validates `_meta` Markdown. Authors write
   registry content by hand (operator decision 01M4WE30W61BS7CG5D0KH99T0T).
5. **Every address comes from `routeOfSlug`.** A guard test fails when a source file
   builds an address by hand from a page id.
6. **Index-name matching stays case-insensitive**, as in ADR-0033.

## Consequences

- A site that set index names only on the loader must move them to the integration.
  A site with a colliding pair must rename or remove one file of each pair.
- The scripts now evaluate the site config in a child Node process, about one second
  per run. A config that cannot be loaded is an error, not a silent fallback.
- Agent-API consumers see a changed `route` for pages whose id ends in `/index`, and
  for the site root. The value is the address the site serves.
- The sidebar, the Hub and the feeds agree with the link check, because they share
  one rule.
- Known limits:
  - The address guard in decision 5 inspects template literals. An address built by
    string concatenation is not covered.
  - A site config that hangs is not yet time-limited. The tools do not yet time out.

## Alternatives considered

- **Keep the winner rule, add a warning.** Rejected: it hides content, and the loser
  is the file the author usually meant to publish. Failing early costs one rename.
- **A module-level variable for the index names.** Rejected: the dev server runs two
  Vite servers, one for the config and one for content, and each loads its own copy of
  a module. Only the process environment is shared, so the seam is `DK_INDEX_BASENAME`.
- **Parse `astro.config.*` as text in the scripts.** Rejected: the setting can be a
  computed value or an import. A child process using Vite's `runnerImport` evaluates
  the file as the build does.
- **Make the flag authoritative.** Rejected: it recreates the second setting. As a
  cross-check it catches drift without competing with the config.
- **Case-sensitive collision keys.** Rejected: the page set would build on Linux and
  break on macOS and Windows.
- **Publish `_meta` Markdown and exclude it with a pattern.** Rejected: ADR-0047
  removed the loader's custom `pattern`, and the exclusion belongs in the walk that
  every surface shares.
