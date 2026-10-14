---
title: "ADR-0046: Render Gherkin .feature files as Specification pages by codegen into the docs collection"
description: An opt-in gherkin preset parses .feature sources once and generates one Specification page per feature into the docs collection, reusing the ADR-0026 seam.
doc_status: active
updated: 2026-10-13
type: ADR
kind: ADR
authors:
  - ivan@spec-kitty.ai
related:
  - adr/0051-gherkin-in-any-page
  - adr/0026-glossary-source-and-generation-seam
  - adr/0027-auto-link-resolution-scoping-and-term-directive
  - adr/0028-glossary-frontmatter-fields
  - adr/0009-finalize-metadata-contract
  - adr/0033-flexible-section-identity
  - adr/0035-vocabulary-core-consolidation
  - architecture/research/qa-portal
---

# ADR-0046: Render Gherkin `.feature` files as Specification pages by codegen into the docs collection

## Status

Accepted. The preset is switched on in the example site (`gherkin: { sources: ['features'],
section: 'behaviour' }` in `example/astro.config.mjs`), which builds and gates the
generated behaviour section end to end.

Decisions 1, 2, 6, 8 and 9 are amended by
[ADR-0051](./0051-gherkin-in-any-page.md), which delivers options E and F: the
preset also renders `gherkin` fences and `::gherkin` includes on docs pages,
`sources` becomes optional and only drives generated pages, and in-page errors are
build-fatal through an error sink.

## Context

BDD repositories keep their most precise behavioural statements in Gherkin
`.feature` files. The [QA portal research](../architecture/research/qa-portal.md)
names "BDD living documentation" as the higher-value half of that portal, and the
project charter selects `PARADIGM:behaviour-driven-development`,
`TOOLGUIDE:gherkin` and `PROCEDURE:bdd-scenario-lifecycle`.

doc-kitty already has every downstream capability such pages need:

- glossary auto-linking with bounded contexts (ADR-0027/0028);
- `related` and `audience` blocks (ADR-0009);
- registry-derived types (ADR-0033);
- the discovery surfaces (`llms.txt`, agent API).

What it lacks is a way for non-Markdown sources to enter the `docs` collection,
which is a `glob` over `**/*.{md,mdx}`.

ADR-0026 settled the same question for the glossary. Non-authored pages are
codegen'd as Markdown **into** the collection, because an injected route is
invisible to the sidebar, sitemap filter, agent API, `llms.txt` and the bare-Node
gates (ADR-0026's finding AS-6).

## Decision

1. **Opt-in preset.** `defineDocKittyIntegrations({ gherkin: { sources, section? } })`.
   Absent means no integration and unchanged pages, routes and config. Three
   things from the same release still change with the preset off: `Specification`
   joins the `kind` and `type` vocabulary, the desktop "On this page" links get a
   24px minimum target (a site-wide accessibility fix in `toc-rail.css`), and
   `@cucumber/gherkin` and `@cucumber/messages` are installed for every consumer.
   Unlike the glossary,
   activation is an explicit option, not presence, because `.feature` files have
   no canonical location.
2. **Parse once with the official parser.** `@cucumber/gherkin` +
   `@cucumber/messages` (exact-pinned) with deterministic incrementing ids. Syntax
   errors are build-fatal, listing every `file:line:col`.
3. **Codegen into the collection (the ADR-0026 seam).** During `astro:config:setup`,
   write one page per feature to `<docsDir>/<section>/<path>.md`, plus one hub
   per directory with a non-draft feature, named with the first configured `indexBasename`. Generated
   pages are committed. A `--check` drift gate keeps them honest.
4. **Single ownership.** Generated pages carry
   `generated: { by: "doc-kitty/gherkin", at: "sha256:<source hash>" }`. The
   generator deletes only owned stale files, and fails if an authored file sits
   in the generated section.
5. **Metadata via namespaced feature tags.** `@dk:context`, `@dk:status`
   (plus the `@wip`/`@deprecated` shorthands), `@dk:persona`, `@dk:mission`,
   `@dk:adr`, `@dk:related`, `@dk:updated`, `@dk:autolink` and `@dk:priority` map
   onto the existing frontmatter. Other feature tags become `tags`. `type` is
   registry-derived, not emitted.
6. **Steps render as prose list items**, not code. That makes them eligible for
   glossary auto-linking (ADR-0027 skips code, headings and links). Literal text
   is escaped against Markdown, raw HTML, remark-directive and Markua attribute
   syntax. Descriptions pass through as Markdown.
7. **Vocabulary.** `Specification` is appended to the canonical `KINDS` and
   `DOC_TYPES` (ADR-0035 single source). The existing `Feature` kind keeps its
   meaning (a roadmap proposal).
8. **Shared pure core in `.mjs`.** The tag contract, renderer and planner are
   JSDoc-typed `.mjs`, imported by both the TS integration and the bare-Node
   `generate-feature-pages.mjs --check`, so build and gate agree by construction.
9. **A scenario index for agents, mounted by the site.** `scenarioIndexRoute()`
   (from `@spec-kitty/doc-toolkit/routes`) serves `/api/scenarios.json`. At build
   time it re-parses each published feature page's `.feature` source with the same
   loader, so a site mounts it by hand at `src/pages/api/scenarios.json.ts` and
   repeats the `sourceRoot` and `sourceUrlPrefix` it gave `gherkin`. A page whose
   source is missing or has changed since generation fails the build. `llms.txt`
   advertises the route whenever a published generated page exists, so a site that
   does not mount it, or that turns the preset off while keeping the committed
   pages, advertises a page that does not exist.

   Decision taken at landing: the route stays site-mounted for 0.2.0, like every
   other doc-kitty route. Having the integration inject it was considered and left
   for separate work, because it would be the toolkit's first injected route and
   needs a packed-tarball proof before it ships.
10. **The feed is the site's choice.** The example site lists its feature pages
    and hubs in RSS (its `behaviour` section feeds `rss`). A generated page has no
    `updated` date unless the feature carries `@dk:updated=<date>`, so by default
    its item has no `<pubDate>` and sorts after the dated items.

## Consequences

### Positive

- Sidebar, sitemap, RSS, `llms.txt`, agent API, related and audience blocks,
  draft gating and glossary linking all work with **no new render code** and no
  plugin-order change. The example site lists the pages in its RSS feed; the items
  are undated unless a feature sets `@dk:updated`.
- Ambiguous domain language in specs surfaces as the existing glossary collision
  warning.
- Agents get behavioural contracts through the same discovery surface as the
  docs, with `sources` pointing at the executable file.
- It sets up the QA-portal results overlay (phase 2) without committing to it.

### Negative

- A second generated tree in git (the same trade-off ADR-0026 accepted).
- One new runtime dependency pair (`@cucumber/gherkin`, `@cucumber/messages`),
  installed for every consumer whether or not the preset is on.
- The frontmatter gate's generated-page exemption moves from a path rule to a
  marker rule (`generated.by`), keeping the glossary path rule for compatibility.

### Risks

- **Trust boundary.** Feature descriptions are Markdown passthrough, so raw HTML in
  a description lands on the page, on the hub and in the page's `description`.
  Step text, names and table cells are escaped; descriptions are not. Pull
  `.feature` files only from sources you trust as much as your docs.
- **Ownership is by stamp only.** A hand-written page that carries
  `generated.by: doc-kitty/gherkin` is treated as generated, and is pruned when no
  feature maps to it.
- **Only Feature-level tags gate publication.** A `@wip` on a single Scenario does
  not hide it; it is shown as a tag on the page.
- **Known limit: a directory holding only draft features gets no hub.** With drafts
  built (the default), the sidebar then warns "Add an index page to …". The author
  cannot act on it, because an authored file in the generated section stops the
  build. The warning goes away when one feature in the directory is published, or
  when the site builds with `DK_PUBLISH_DRAFTS=off`.
- Imperative, UI-level scenarios read poorly as docs. Mitigated by authoring
  guidance; a lint is a follow-up.
- Committed pages freeze when the preset is turned off. Removal is a manual
  folder delete.
- `generated.at` holding a hash instead of a time stretches the field's meaning.
  This is accepted deliberately: it keeps output deterministic and needs no schema
  change. The value is always `sha256:`-prefixed, so it can't be mistaken for a
  date.

## Alternatives considered

### Option A: `injectRoute` per feature

Rejected for the reasons ADR-0026 gives: invisible to the collection and every
generator.

### Option B: a composite content loader that adds entries to the `docs` store

Rejected. The entries exist only inside the Astro build, so the bare-Node gates
(`validate-frontmatter`, `check-links`, `validate-catalog`, redirect coverage)
never see them. It also depends on the glob loader's internal store bookkeeping.

### Option C: register `.feature` as a content entry type

Rejected. It relies on an undocumented integration API under a capped Starlight
peer range, and has the same gate blindness as Option B.

### Option D: embed `@cucumber/html-formatter` output

Rejected as the page source: a standalone React report outside theme, nav,
glossary and agent API. It could fit phase 2 as an embedded results view.

### Option E: a `gherkin` fence renders as a structured scenario (issue #120, slice A)

[Issue #120](https://github.com/spec-kitty/doc-kitty/issues/120) proposes four
slices. Slice A turns a `gherkin` code fence in a Markdown page into a structured
scenario (feature title and narrative, step list, tables). It serves an author who
shows one scenario inside a guide. It does not by itself publish a feature
directory, and the author still pastes the feature text into the page.

### Option F: include a feature, or one scenario, by path (issue #120, slice B)

Slice B includes a feature file, or one scenario selected by name or tag, through
slice A's rendering. It removes the copy-paste and the drift, but each include is
an authored page, so the sidebar, hubs, `llms.txt` and agent API see only what an
author chose to include.

This ADR delivers slice C first: a configured directory of `.feature` files
becomes generated pages and hubs (the issue's jobs 1, 3 and 4). Slices A and B
remain open for separate work. They serve the "show one scenario in a guide" job
and can reuse this ADR's renderer.

> **Delivered by [ADR-0051](./0051-gherkin-in-any-page.md), 2026-10-13.** Slices A
> and B render through one remark stage that shares a view model with this ADR's
> renderer.

### Option G: the integration injects the scenario index route

Considered at landing and left for separate work (see decision 9). It would remove
the by-hand mount and the repeated `sourceRoot`/`sourceUrlPrefix`, but it would be
the toolkit's first injected route and needs a packed-tarball proof first.

## References

- [ADR-0026](./0026-glossary-source-and-generation-seam.md): codegen into the collection.
- [ADR-0027](./0027-auto-link-resolution-scoping-and-term-directive.md): auto-link eligibility and sections.
- [ADR-0028](./0028-glossary-frontmatter-fields.md): `glossary_context`, `glossary_autolink`.
- [ADR-0033](./0033-flexible-section-identity.md): registry-derived types and subtypes.
- [ADR-0035](./0035-vocabulary-core-consolidation.md): the single-source vocabulary core.
- [QA portal research](../architecture/research/qa-portal.md).
- [Gherkin reference](https://cucumber.io/docs/gherkin/reference/).
