---
title: "ADR-0068: A site can leave whole docs folders out of the build"
description: One exclude option removes docs folders from the shared walk, so the loader, every output and the gates drop them, and a link into one is reported as excluded.
doc_status: active
updated: 2026-10-31T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:doc-kitty
related:
  - adr/0033-flexible-section-identity
  - adr/0047-relative-markdown-links
  - adr/0050-route-collisions-and-single-index-setting
  - adr/0057-internal-env-handoff-seam
  - adr/0058-build-state-owner-and-config-split
  - guides/consumer-setup
---

# ADR-0068: A site can leave whole docs folders out of the build

## Status

Accepted. Closes [#247](https://github.com/spec-kitty/doc-kitty/issues/247).
It extends [ADR-0050](./0050-route-collisions-and-single-index-setting.md)
decision 4: `_meta` stays reserved, and a site can now name more folders that the
shared walk skips. It adds one name to the handoffs of
[ADR-0057](./0057-internal-env-handoff-seam.md). Those records are not edited
beyond a pointer to this one.

## Context

A site often keeps folders in its `docs/` tree that it does not publish: an
archive, internal reports, migration history, working notes. The spec-kitty
docsite (spec-kitty/spec-kitty#6100) has about 240 such files. DocFX left them out
with content globs. DocKitty had no equivalent:

- The docs loader rejected any `pattern` other than the default.
  [ADR-0047](./0047-relative-markdown-links.md) removed custom patterns because
  the route table, the draft sweep and the link gates walk the tree with
  `walkMarkdownPaths`, which could not see a narrowed pattern. A narrowed
  pattern would publish a route table that lists pages the loader never loads.
- Marking the files `doc_status: draft` is not an answer. It edits files the
  site treats as history, the files still pass through the schema and the
  frontmatter gate (about 30 of them have no `title` or `description`, so the
  build fails on content that is never published), and the files are not drafts.

## Decision

1. **One option, `exclude`, set once in `defineDocKittyIntegrations`.** It is a
   list of folder paths relative to `docsDir`, for example
   `['archive', 'reports', 'plans/engineering-notes']`. Nothing under a listed
   folder is part of the site.
2. **Folders only, validated at config time.** An entry must be a relative path
   with no `.` or `..` segment, no glob syntax, and no dot-prefixed or `_meta`
   segment. A trailing slash and a leading `./` are dropped. Each folder must
   exist under the docs root with the exact letter case given. A typo would
   otherwise exclude nothing and publish the folder, so it fails the config with
   a `[dk-config] exclude:` error. Matching is by whole path segment and
   case-sensitive: `archive` does not exclude `archived/`.
3. **The shared walk applies it.** `walkMarkdownPaths` skips every excluded
   folder. There is no second walker. Every surface built from the walk drops the
   same files: the loader's ids, the route table, the relative-link rewrite, the
   draft sweep, the sidebar shaping, Schematic pages, the content graph, the
   OKF export, the ADR index generator and the link gates. A walk of a folder
   inside the docs root (the ADR folder) inherits the folders below it, and a
   walk of an excluded folder lists nothing.
4. **The handoff is `DK_EXCLUDE`.** `defineDocKittyIntegrations` publishes the
   normalised list as JSON, next to `DK_DOCS_ROOT`, through `setInternalEnv`. It
   is written only when the list is not empty. The walk applies it to the tree
   `DK_DOCS_ROOT` names and to folders inside it, and to no other tree. Like
   `DK_INDEX_BASENAME`, a value that is not a valid list is rejected as hand-set.
5. **The loader does not read the excluded files.** It reads the list at load
   time and passes Astro's `glob()` one negated pattern per folder
   (`!archive/**`), so the files are never parsed or schema-checked, and the dev
   watcher ignores them. With no folders it uses the default loader unchanged.
   The loader's own `pattern` option stays unsupported.
6. **Every generated surface follows the collection.** Pages, the sidebar,
   search, the sitemap, `rss.xml`, `llms.txt`, the agent API and the Hub's ADR
   cards are built from the docs collection or from the walk, so an excluded page
   appears in none of them. A registered section whose folder is excluded is
   treated as absent on disk.
7. **The CLIs read the same list from the site config.** The config evaluator
   that already returns the index names also returns `exclude` and the docs root
   the config named. `resolveSiteIndexBasenames` registers the list for a
   checked root when that root is the site's docs root, and prints
   `excluded folders: … (from astro.config.mjs)`. So `validate-frontmatter`,
   `check-links` (strict roots), `export-okf`, `new-doc`, `scaffold` and the
   other gates that resolve index names skip the folders. A non-strict
   `check-links` root is read as files, as before, and reads no list.
   `generate-adr-index` and `assert-no-broken-links` evaluate the config only
   when given `--docs <dir>`, so their default runs do not change.
8. **A link into an excluded folder is a broken link with its own message.**
   - `check-links --strict` reports a relative `.md` link, a folder link, a
     root-absolute link and a `related:` ref into an excluded folder as
     `… target is excluded from the site (the folder "archive" is in exclude …)`.
   - The build fails on a `related:` ref into an excluded folder with the same
     wording. It already failed on any dangling `related:` ref.
   - `assert-no-broken-links --docs <dir>` reports a link that resolves to the
     route of an excluded page or folder as `target is excluded from the site`.
     Without `--docs` the same link still fails, as `no matching page or file`.
9. **No option means no change.** Without `exclude`, or with `[]`, nothing is
   published, the walk and the loader take the existing path, and the build
   output of the example site is byte-identical.

## Consequences

### Positive

- A site can keep unpublished folders in its tree without editing them, and they
  do not fail the schema, the frontmatter gate or the link check.
- One setting drives every surface, because they share the walk.
- A published page that points into an excluded folder is caught before deploy,
  by name.

### Negative

- The option names folders, not files or patterns. A site that wants to leave
  out single files or a pattern (`**/engineering-notes/`) must list each folder.
- `assert-no-broken-links` and `generate-adr-index` need `--docs` to read the
  list. Without it, the built-link gate still fails a link into an excluded
  folder, with the generic reason, and the ADR generator lists the excluded ADRs.

### Risks

- The built-output gate sees URLs, not source paths. A relative `.md` link into
  an excluded folder is not rewritten by the build, so on the built site it
  resolves under the linking page's own URL. That gate reports it with the
  generic reason. `check-links --strict` reports it with the specific one.
- The walk keys the published list on `DK_DOCS_ROOT`. A loader whose `base`
  differs from the integration's `docsDir` does not see the list. That
  configuration is already unsupported (the sidebar and the route table would
  disagree with the loader).

## Alternatives considered

### Option A: Re-enable the loader's `pattern`

Rejected. It is a second setting, read by the loader only. ADR-0047 removed it
because the walk could not see it. Making every surface parse globs would move
the problem, not remove it.

### Option B: Accept globs in `exclude`

Not now. Folder paths cover the consumer's need, are simple to validate and to
check for existence, and map one-to-one onto a walk that skips a directory
without reading it. Globs can be added later behind the same option if a site
needs them.

### Option C: Case-insensitive matching

Rejected. The existence check already fails a case slip at config time, so exact
matching cannot silently publish a folder. Case-insensitive matching would also
disagree with Astro's glob, which is case-sensitive.

### Option D: Make `assert-no-broken-links` always evaluate the site config

Rejected for now. It would add a config evaluation (and a new exit-2 path) to
every run of a gate that today reads only `dist/`. `--docs` opts in.

## References

- Issue [#247](https://github.com/spec-kitty/doc-kitty/issues/247); consumer
  spec-kitty/spec-kitty#6100.
- [Consumer setup: leave folders out of the site](../guides/consumer-setup.md#leave-folders-out-of-the-site).
