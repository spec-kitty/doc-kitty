---
title: The evidence index (technical and organisational measures)
description: What api/tom-annex.json lists and what it is not, its format 1.x for tools, and how to commit an opt-in snapshot and hub page and check them.
doc_status: active
updated: 2026-11-24T00:00:00Z
type: Guide
kind: How-To
authors:
  - process:claude-code
tags: [tom, measures, evidence, gdpr, consumer]
related:
  - adr/0080-tom-classification-field-and-measures-catalog
  - adr/0087-generated-section-contract
  - adr/0083-producer-registry-and-ownership-scopes
  - architecture/metadata-model
  - guides/export-okf-bundle
  - guides/draft-publication
---

# The evidence index (technical and organisational measures)

> [!CAUTION]
> **Evidence index, not the contractual annex.** Not legal advice: this index
> lists documentation that evidences each measure; the annex of a data
> processing agreement remains the parties' own document.

**Audience.** An auditor or data-protection officer who reads the index, a site
owner who turns on its committed copies, and a tool author (such as the shared
organisation bundle of #404) who builds on its format.

## What it is

A site whose pages classify the technical and organisational measures they
evidence, with the `tom_classification` field of
[ADR-0080](../adr/0080-tom-classification-field-and-measures-catalog.md), gets
one more build output: `api/tom-annex.json`. For every measure of the site's
measures catalog it lists the published pages that evidence it, grouped by
scope:

- **`system`**: the measure as the documented system implements it;
- **`organisation`**: the measure as the organisation around it applies it.

Measures that no published page evidences are listed under `uncovered`, so a
reader sees the gaps as well as the coverage.

- **Drafts never count.** The index reads the built content graph, which leaves
  draft pages out. A measure that only a draft classifies is uncovered.
- **A site with no published classified pages gains nothing.** No file is built
  and nothing is linked; doc-kitty's artifact gate only checks that nothing was
  built.
- **It is linked** from `api/index.json` as `_links.tomAnnex`, titled with the
  label, and the OKF export carries the same bytes as `tom-annex.json`.
- **Evidence URLs are absolute**: the site's `site` URL, its `base` and the
  page's path. Set `site` in the Astro config, or the URLs point at
  `http://localhost:4321`.

## What it is not

- It is not the annex of a data processing agreement. That annex is the parties'
  own document.
- It is not a record of processing activities.
- It is not the annex of the EU standard contractual clauses, although the
  shipped default catalog uses that annex's headings.
- It makes no claim that the listed measures are adequate or legally
  sufficient. It shows which pages say something about a measure, not whether
  what they say is enough.

## ⚖ Questions for counsel

These are open, and every generated surface lists them:

- ⚖ The wording "evidence index, not the contractual annex" and the notice on every generated surface.
- ⚖ Whether a data processing agreement may reference this living index, or needs a dated snapshot.
- ⚖ Whether the uncovered list may be shown to third parties, since it can reveal gaps.

## Format 1.x

The index is one JSON object. The shipped schema,
`lib/tom-annex/tom-annex.schema.json` in the toolkit package, describes the
version it ships with exactly, and the tables below follow it key for key. It
rejects keys it does not know, so do not use it to reject a file of a later
`1.x`: see [Versioning](#versioning).

**Serialisation.** Two-space indented JSON with a final newline. Keys are
written in the order of the tables, whatever order a producer built them in, so
the same content always gives the same bytes. A key whose value the page does
not have is written as `null` (a page without a description, a classification
without a note). Only `dpv` is ever left out, when the catalog has no term for
the measure.

### The file

| Key | Type | Rule |
|---|---|---|
| `format` | string | always `"doc-kitty/tom-annex"` |
| `format_version` | string | `"1.<minor>"`; this release writes `"1.0"` |
| `label` | string | always `"Evidence index, not the contractual annex."` ⚖ |
| `notice` | string | the not-legal-advice sentence ⚖ |
| `generated` | object | the stamp, see [The stamp](#the-stamp) |
| `catalog` | object | `source` (string: the catalog's file, or `the shipped default catalog`) and `default` (boolean) |
| `scopes` | object | `system` and `organisation`, each a list of measure entries sorted by `id`; an empty scope is `[]` |
| `uncovered` | list | `{id, label, nature}` for each catalog measure with no evidence in either scope, sorted by `id` |
| `counsel` | list of strings | the ⚖ items, in a fixed order |

Sorting is by UTF-16 code unit, as JavaScript compares strings.

### A measure entry

| Key | Type | Rule |
|---|---|---|
| `id` | string | the catalog id, kebab-case |
| `label` | string | the catalog label |
| `nature` | string | `technical`, `organisational`, `legal` or `physical` |
| `frameworks` | list | `{framework, ref}` pairs, in catalog order |
| `dpv` | string, optional | the measure's Data Privacy Vocabulary term; absent when the catalog has none |
| `evidence` | list | at least one evidence reference, sorted by `url` |

A measure appears at most once in each scope. It can appear in both scopes,
when pages classify it under both.

### An evidence reference

| Key | Type | Rule |
|---|---|---|
| `title` | string | the page title |
| `description` | string or `null` | the page description |
| `url` | string | the page's absolute URL |
| `updated` | string or `null` | the page's `updated` instant |
| `doc_status` | string | the page's `doc_status` |
| `verified` | list | the page's `verified` stamps as `{by, at}` pairs; may be empty |
| `note` | string or `null` | the classification's note, whitespace flattened to single spaces |

### Versioning

- Renaming or removing a key, or changing its meaning, is a **major** version
  (`2.0`).
- Adding a key is a **minor** version (`1.1`).
- A consumer must accept any `1.x` and ignore keys it does not know. Validate a
  file against the schema of its own minor version, or none.
- Format 1.0 includes the `generated` stamp. No 1.0 index was ever released
  without it.

### The stamp

`generated` follows the generated-section contract of
[ADR-0087](../adr/0087-generated-section-contract.md):

| Key | Meaning |
|---|---|
| `by` | `doc-kitty-tom-annex/<toolkit version>`: the producer that wrote it |
| `at` | the latest `updated` or `verified` instant among the listed evidence, or `null` when none has one. **Never the build clock**, so two builds of the same tree write the same bytes. |
| `source_digest` | `sha256:` and 64 hex digits over the declared inputs (ADR-0087 D2): each evidence page's source file, a consumer catalog file, and, as configuration, the site, the base, the section-index names and the shipped default catalog. Equivalent spellings of the site or base (`/docs` and `/docs/`) give the same digest. A change to a page that is not evidence does not change it. |
| `content_hash` | `sha256:` and the first 12 hex digits of the index serialised without `generated`: it detects a hand edit |

The keys of `source_digest`'s input entries are paths relative to the project
the site builds from (its working directory), with `/` separators. ADR-0087 D2
speaks of repository-relative paths; for a site at the root of its repository
the two are the same.

Two limits follow from D2. `content_hash` is computed over the re-serialised
index, so it does not see a formatting-only edit; the `--check` below compares
bytes and does. And doc-kitty's artifact gate checks `content_hash` but neither
recomputes `source_digest` nor re-derives `generated.at`, because it reads only
the build output.

## Snapshot and hub page

Both are opt-in, and both are files you commit. ⚖ Whether a data processing
agreement should cite the living index or a dated snapshot is a question for
counsel; these make either possible.

- **The snapshot** is the built `api/tom-annex.json`, byte for byte, at a path
  you choose. Its history in version control dates each state of the index.
- **The hub page** is a Markdown Hub rendered from the built index: measures by
  nature, then scope, with links to the evidence pages, and the uncovered
  measures. It opens with the label, the notice and the ⚖ items, and carries a
  four-key `generated` stamp. Put it inside an existing section, not at the
  root of the docs: only a Hub inside a section counts as a generated page for
  the frontmatter gate. The example uses `context/evidence-index/index.md`. Do
  not classify the hub page itself.

The `dockitty-tom-annex` command writes and checks them. The stamp and the
check's output use the producer id, `doc-kitty-tom-annex`, with a hyphen; the
command's name has none. It reads only the
built `<dist>/api/tom-annex.json`: it runs no site config, no Astro and no other
repository's code. Run it from the project root: it refuses a `--dist`, `--snapshot` or
`--hub` path outside the working directory (exit `2`).

```sh
# After a build: write both files.
dockitty-tom-annex --dist dist \
  --snapshot docs/_meta/tom-annex.snapshot.json \
  --hub docs/context/evidence-index/index.md

# In CI, after the build: check them, writing nothing.
dockitty-tom-annex --dist dist \
  --snapshot docs/_meta/tom-annex.snapshot.json \
  --hub docs/context/evidence-index/index.md --check
```

Name at least one of `--snapshot` and `--hub`. Writing refuses a target that
holds a file `doc-kitty-tom-annex` did not write: it names the file, writes
nothing and exits `1`. In this repository the same
commands are `pnpm generate:tom-annex` and `pnpm validate:tom-annex`, on the
example site.

`--check` prints one line per file that is not up to date,
`doc-kitty-tom-annex <verdict> <path>`, then the command to regenerate. It
exits `0` when both are up to date, `1` on drift, and `2` on a usage or input
error. A build with no `api/tom-annex.json` is an input error: build the site
first. When several verdicts apply, the first in this table is reported:

| Verdict | Meaning | Remedy |
|---|---|---|
| `missing` | the file does not exist | write it |
| `unowned` | the path holds a file not stamped by `doc-kitty-tom-annex` (the verdict [PR #454](https://github.com/spec-kitty/doc-kitty/pull/454) added to ADR-0087 D3) | move or delete that file, then write |
| `hand-edited` | the file no longer matches its own `content_hash` (for the snapshot, also an `at` its evidence does not give) | move the change to the classified pages or the catalog, then write |
| `stale-source` | its `source_digest` differs from the build's: an evidence page, the catalog or the configuration changed | write again |
| `stale-render` | same inputs, different bytes: a toolkit change, or a formatting edit to the snapshot (on the hub page, any edit reads as `hand-edited`) | write again |

**The check trusts the build.** It compares the committed files with the
`source_digest` of the `dist` you point it at; it does not recompute the
digest from your sources. So in CI, build first and check that fresh output: a
check against a stale `dist` from before a content change passes.

**The workflow is build, then write, then commit.** Both files are rendered
from the previous build. After you change an evidence page or the catalog, the
check stays red until you rebuild and write them again. That is the drift gate
working, not a bug. A toolkit upgrade changes `by`, so it also makes both files
`stale-render` until you write them again.

**The hub page needs a date.** When no listed evidence page has an `updated`
or `verified` date, the index's `generated.at` is `null` and the hub page has
nothing to date itself with. A write that names `--hub` then exits `2` and
writes neither file, because it renders the hub before writing anything; a
write with only `--snapshot` still succeeds. Give at least one evidence page an
`updated` date, rebuild, and write again.

**Commit both files with LF line endings**, for example with `eol=lf` for their
paths in `.gitattributes`. The check compares bytes, so a checkout that turns
them into CRLF reads as `stale-render`.

**How the files are written.** The command writes a hidden temporary file
next to the target (`.<name>.<process id>.tmp`) and renames it over the target,
so an interrupted run never leaves a half-written file. Some limits follow:

- Each file is replaced on its own, not both together. If replacing the hub
  page fails, the snapshot has already been replaced; run the command again.
- A run killed between the two steps can leave that hidden `.tmp` file behind.
  Delete it; the target is unchanged.
- The new file gets the default permissions of your umask, not the old file's
  mode.
- The data is not flushed to disk (`fsync`) before the rename, so a power loss
  right after a write can still lose it.
- Symbolic links are not followed. A target that is a link is judged through
  the link, but the rename replaces the link itself with a regular file. Point
  the flags at the real file.
- On Windows, a target that another program holds open cannot be replaced. The
  command then exits `2` and the old file stays as it was.

A running `astro dev` decides at start-up whether the site has published classified
pages. After you classify the first page, restart it to see
`/api/tom-annex.json`.

## Deferred

- A `file` scope type for the producer registry, so that the snapshot could be
  owned through the registry instead of by its command-line path. It would amend
  ADR-0083 D3; for now the snapshot is recognised by its path.
- The shared organisation bundle (#404), which builds on this format.
- The ADR-0087 stamp helpers (the four-key Markdown stamp, `source_digest` and
  the Markdown `content_hash`) live with this producer for now. They move to the
  shared stamp module when the Gherkin and glossary producers adopt the
  four-key stamp (ADR-0087 D8).
- ADR-0087 D5 names `generated.at` and `updated` as the instants `at` may come
  from; the index also uses `verified[].at`. A follow-up either names
  verification instants in D5 or drops them.
