---
title: "ADR-0048: Generated index page names and empty Gherkin sources"
description: Glossary index pages follow the site's index name, and the Gherkin generator stops on empty sources instead of deleting pages; amends ADR-0026 and ADR-0046.
doc_status: active
updated: 2026-10-13
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0026-glossary-source-and-generation-seam
  - adr/0046-gherkin-feature-pages
  - adr/0002-readme-as-index
  - adr/0035-vocabulary-core-consolidation
  - architecture/glossary
  - architecture/gherkin-pages
  - guides/consumer-setup
---

# ADR-0048: Generated index page names and empty Gherkin sources

## Status

**Accepted** — 2026-10-13. Introduced by the generated-page-and-link-integrity
mission (issues #122 and #129). It amends two statements and leaves both ADRs
as written:

- **[ADR-0026](./0026-glossary-source-and-generation-seam.md)** says generated
  glossary pages are written as `index.md`. Decision 1 below replaces that rule.
- **[ADR-0046](./0046-gherkin-feature-pages.md)** says the generator deletes the
  pages it owns when the sources yield no feature (Decision 4, and the
  "no `.feature` files left" step of the architecture page). Decision 3 below
  replaces that behaviour when pages exist.

Everything else in both ADRs stands, including ADR-0046's single-owner stamp
and the hub file name rule.

## Context

**Glossary (#129).** The generator wrote `glossary/index.md` and
`glossary/<context>/index.md` whatever the site's `indexBasename` said. On a site
whose only index name is `README`, Starlight 0.32.6 still served the hub at
`/glossary/`, because its `slugToParam` strips a trailing `/index` from an id. What
broke was the toolkit's own view of the page. Its id was `glossary/index`, so links
the toolkit built to it pointed at `/glossary/index/`, which does not exist. The
Hub layout found no children for it, and the sidebar did not treat it as the
folder's index page. This was established by reading the Starlight source, not by
running a build.

**Gherkin (#122).** An uninitialised git submodule looks the same to the
generator as "every feature was deleted". With the preset on, the build warned and
removed every generated page, silently emptying the section.

## Decision

1. **The glossary file name follows the site's index setting.** The target name is
   `index` when the site lists it, in any letter case. Otherwise it is the site's
   first index name. A site that lists `index` keeps its existing output byte for
   byte. A `README`-only site gets `README.md` pages, which the toolkit's route
   rule treats as the folder's index.
   - An index name that is not a plain file name is rejected before anything is
     written: it contains `/` or `\`, starts with `.`, or has surrounding
     whitespace.
   - The Gherkin hub still uses the site's first index name, while the glossary
     prefers `index`. One site can therefore hold a `README.md` Gherkin hub and an
     `index.md` glossary hub. That is deliberate: it keeps every existing
     glossary page where it is.
2. **An authored file or a symbolic link stops the build.** If a file or a symbolic
   link sits at a path the glossary generator writes and is not a generated glossary
   page, the build fails with the path named. The generator does not overwrite
   authored content. A symbolic link at `glossary/` or at a context folder also
   stops the build, because every write and removal would land outside the docs
   tree. The check runs before anything is written. Replace the link with a real
   folder.
3. **Empty Gherkin sources stop the build when generated pages exist.**
   `generateFeaturePages` throws before any write when the whole source set yields
   no feature, generated pages are present, and `allowEmpty` is not `true`. The
   message names the usual cause (a source directory that is not checked out) and
   the two ways out. Setting `gherkin.allowEmpty: true`, or passing `--allow-empty`
   to `dockitty-generate-feature-pages`, restores the old behaviour: warn, then
   remove the pages. A non-boolean `allowEmpty` in the site config is rejected by
   name. Unchanged: a first run with no pages, a source set where only some
   directories are empty, and `--check`, which already exits 1 and lists the pages as
   stale with empty sources, with or without the flag.
4. **Stale glossary pages are removed by a guarded rule.** A page left under a
   previous index name is removed only when all of these hold:
   - it sits at the hub position or in a folder of a current context;
   - its name is one of the site's index names, or `index`, and is not the name just
     written (compared without regard to letter case);
   - its `kind` is the one the generator writes for that position;
   - its frontmatter keys are exactly the generator's;
   - its bytes are identical to the page the generator just wrote for that
     position.

   The last condition is what makes the rule safe without an ownership stamp. An
   earlier build leaves the same text behind when the glossary source has not
   changed. A page someone wrote by hand does not match it.

   Two kinds of look-alike are kept, and the build warns once for each file. A page
   with the generator's `kind` but different keys is treated as authored; the warning
   says the folder now has two index-named files and tells the adopter to delete the
   old one if it is a leftover, or rename it if they wrote it. A page with the
   generator's keys whose content differs is also kept; its warning says the same
   and names the content as the reason. Folders are never removed.

   **Upgrade consequence.** A default-settings site whose 0.2.0 build left
   `glossary/index.md` pages gets them removed without a warning when the glossary
   source is unchanged since that build. If the source changed in between, the old
   pages whose content changed are kept, and the build warns for each; the adopter
   deletes them.

### Known limits, not fixed here

- A page left under a name that is no longer one of the site's index names is not
  removed.
- A context removed from the source leaves its folder behind.

## Consequences

### Positive

- On a `README`-only site the glossary hub is the folder's index page in the
  toolkit's own model: links to it resolve, the Hub layout lists its children and
  the sidebar places it.
- An uninitialised submodule fails the build with the cause named, instead of
  deleting the section.
- Upgrading a site that changes its index setting does not leave two hubs when the
  source is unchanged: the old pages go. Anything that might be authored stays with
  a warning.

### Negative

- A site that relied on empty sources pruning its pages must set `allowEmpty`.
  That is a breaking change for that site.
- One site can carry two hub file names, `README.md` for Gherkin and `index.md`
  for the glossary.
- Glossary pages have no ownership stamp, so the prune rests on a rule. The
  byte-identical condition narrows the case where it misjudges a page to one that
  is a copy of what the generator wrote. An adopter who changes a generated
  page by hand sees it kept with a warning, not removed.

### Risks

- The Starlight behaviour in Context is read from source. If a later Starlight
  changes how it derives a route from an id ending in `/index`, the account of
  #129 needs a second look.
- Other surfaces build a page address as `/<id>/` and still point at
  `/glossary/index/` for an id ending in `/index`. See
  [ADR-0047](./0047-relative-markdown-links.md).

## Alternatives considered

### Warn only on empty Gherkin sources

Rejected. The warning already existed, and the pages were deleted anyway. A warning
in a CI log does not protect the section.

### Fail in check mode only

Rejected. `--check` already fails with empty sources. The loss happens in the
build and the generate command, which do not run in check mode.

### An ownership stamp on glossary pages

Rejected by the project owner. A `generated:` field would change the bytes of
every glossary page and remove an existing guard that asserts there is no such
field. The guarded rule in Decision 4, with its byte comparison, stands in for it.

### Always the first index name for the glossary

Rejected. A site that lists `README` first and `index` second would see every
glossary page rename on upgrade. Preferring `index` when it is listed keeps
existing output unchanged.

## References

- [ADR-0026](./0026-glossary-source-and-generation-seam.md): codegen into the collection, the statement amended here.
- [ADR-0046](./0046-gherkin-feature-pages.md): Gherkin pages, the statement amended here.
- [ADR-0047](./0047-relative-markdown-links.md): the shared route rule and the surfaces that still build `/<id>/`.
- [ADR-0002](./0002-readme-as-index.md): `README` as the section index.
- [Glossary architecture](../architecture/glossary.md) and [Gherkin feature pages](../architecture/gherkin-pages.md).
