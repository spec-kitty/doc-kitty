---
title: "ADR-0081: Print and PDF output from built HTML via Chromium"
description: "An opt-in print layer prints every page light; sections and the whole site can opt into PDFs that CI prints from the built site with Chromium."
doc_status: draft
updated: 2026-11-25T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:claude-code
related:
  - adr/0007-ci-cd-path-scoped-lanes
  - adr/0008-swappable-theme-layer
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - adr/0040-build-time-diagram-render-dual-mode
  - adr/0050-route-collisions-and-single-index-setting
  - adr/0057-internal-env-handoff-seam
  - adr/0070-excluded-folders
  - adr/0072-parallel-landing-without-shared-files
  - adr/0077-shared-disclosure-control
  - plans/features/book-manuscript-content-type
---

# ADR-0081: Print and PDF output from built HTML via Chromium

## Status

Proposed. It records the operator's rulings on epic #377 of 2026-11-20 and
settles the epic's open choices. Amended before acceptance by the rulings of
2026-11-25 on #377: the consumption test's byte-for-byte check stays, so the
print layer is opt-in, and new sites start with it on.

## Context

A reader in dark mode who prints a doc-kitty page gets a near-black PDF.
Starlight prints its own colour variables light, but doc-kitty's
`--dk-* → --sl-*` bridge keys every colour on `data-theme`, and so wins. Screen
chrome (the header bar, lightbox triggers, machine-readable links) also prints.

A site also cannot offer a section, or the whole set of pages, as one PDF. The
research run on 2026-11-18 compared nine routes. doc-kitty's features live in
its render pipeline: Markua, glossary links, GitHub alerts, build-time diagrams,
generated Gherkin pages and OpenAPI pages. A converter that reads the source
Markdown sees none of them. In the proof of concept, pandoc kept Mermaid fences
as code and printed Markua asides as literal text.

## Decision

### 1. An opt-in print layer

The print layer is opt-in (operator ruling of 2026-11-25 on #377, amending the
2026-11-20 default below). The `print` option of `defineDocKittyIntegrations`
turns it on; `printControl: true` and any PDF turn it on too, because both need
it, and `print: false` next to either is a config error. New sites start with
`print: true`: the starter configuration in the consumer setup guide sets it. A
site that sets none of these builds exactly what it built before the layer
existed, which the consumption test's byte-for-byte check (SC-004) holds every
change to. Off, the layer is in no module graph: the manifest exports its
component only when it is on, as it does for the custom sidebar body
(ADR-0075).

- `print.css` hides the screen chrome, keeps the page title, status, date and
  metadata band, gives the page a white background and the content the full
  printable width, fits each diagram on one sheet, wraps code, keeps headings
  with their text, and prints the URL after each external link. A4 is the
  default paper size (`@page`). A theme overrides any rule, including the paper
  size, with a later sheet; the rules that hide chrome, whiten the page and
  widen the content use `!important` to beat Starlight's layout, so their
  overrides need it too.
- A `beforeprint` hook sets `data-theme="light"` and restores the reader's
  value on `afterprint`. It never writes to storage. It leaves a page with
  client-mode diagrams alone: the diagram renderer redraws on a theme change,
  resetting each diagram to its source first, and a print could catch that.
  Such a page prints light through the fallback below, and its client-mode
  diagrams keep the reader's theme. The renderer, which every site ships,
  carries no print code.
- A print-token fallback covers browsers that print without the event. It is
  generated from the resolved theme by the token emitter: each mode-varying
  token takes its light value under `@media print` at
  `:root:root[data-theme='dark']`, which beats every dark block in any order.
  A brand that ships per-mode colour as a CSS file is invisible to the emitter,
  so on that path the print is light but uses the merged catalog's colours.
- The layer rides the module graph of a script that every in-frame page of a
  site with the layer loads, like the disclosure control (ADR-0077). It adds no
  global component sheet, so the out-of-frame deck route keeps its own print
  rules.

### 2. A `pdf` setting in two places

Which sections print is information architecture, so it lives in
`sections.yaml`. The site default and the whole-site switch live in the
integration options.

```yaml
sections:
  - id: architecture
    pdf: true                           # shorthand for { section: true }
  - id: rhetoric
    pdf: { section: false, site: appendix }
```

```js
defineDocKittyIntegrations({
  pdf: { sections: false, site: true, exclude: { sections: [], kinds: [] } },
});
```

- `pdf.section` gives the section its own PDF. An authored value wins over the
  site default `pdf.sections`, which is `false`.
- `pdf.site` places the section in the whole-site PDF: `main` (the default),
  `appendix` (after the main body) or `omit`. It never changes the section's
  own PDF.
- An invalid value is an advisory warning, and the site default applies.
- Slide decks (`kind: Presentation`) are never in a PDF. OpenAPI reference pages
  are not docs entries, so they never enter one either. Template pages
  (`type: Template`, such as the ADR template) are scaffolding and stay out too.
  `exclude` only adds sections and page kinds to that floor.

### 3. Print routes and PDF URLs

- `/print/<section>/` renders a section, and `/print/` renders the whole site.
  Each route exists only when its PDF is enabled. The routes render every page
  through the same content pipeline as the site, inside the Starlight frame,
  behind a cover page.
- The section's index page is the cover body. Pages follow in print order: an
  index page first, then its children by `sidebar.order` (on a tie, pages before
  folders), then title (numbers read as numbers), then slug. Ids
  are prefixed per page. A link to a page in the same document becomes an
  anchor. Every other root-relative link becomes an absolute site URL and
  prints no URL suffix.
- The routes are `noindex`, out of search and out of the sitemap. They are not
  in `llms.txt`, the agent API, RSS or the OKF bundle, because those surfaces
  list docs entries and not built routes. `/print/` is reserved: while PDFs are
  on, a docs folder or page named `print` is a config error (ADR-0050). A site
  with PDFs must set `site`, because the print documents link to absolute site
  URLs; without it the build warns and builds no print route.
- PDFs are published at `/pdf/<section>.pdf` and `/pdf/site.pdf`. The name
  `site` is reserved, so a section with that id cannot have its own PDF.

### 4. PDFs from the built site, in CI

- `dockitty-pdf` serves a built `dist` and opens each print route in Chromium,
  the one Playwright already installs for build-mode diagrams (ADR-0040). It
  loads each page in the light theme, so client-mode diagrams draw light the
  first time, with a fixed-seed `Math.random`, so their randomised edge paths
  draw the same in every print, refuses a page that did not load light, and waits until every
  client-mode diagram that is laid out holds its drawing (the renderer's own
  `data-processed` marker and its `<svg>`). It then prints with `page.pdf({ tagged: true, outline: true,
  preferCSSPageSize: true })`. It adds no dependency: `playwright` is an
  existing optional peer of the toolkit.
- A post-pass pins `CreationDate` and `ModDate` to `SOURCE_DATE_EPOCH`, falling
  back to the last commit time. It sets `Title` to the section label or the site
  title, and `Producer` to `doc-kitty-pdf/<version>`. Chromium also gives each
  structure element an id from a per-process DOM node counter, which drifts
  between runs; the post-pass renumbers those ids in place, in order, outside
  stream data. It uses Node built-ins only, as fixed-width patches plus a PDF
  incremental update. Two runs on one
  build give identical bytes. For a two-build byte check (#300), the two dates
  are the documented build-clock fields.
- A gate checks one PDF per enabled document and no other. Each PDF must have
  pages, a structure tree, mark info, the site language, and one outline entry
  per printed page. The gate does not claim PDF/UA.
- A path-scoped CI lane (ADR-0007) runs on the drafts-off build, which is the
  build the deploy publishes. It runs the command, the gate and a determinism
  check. It is advisory and is not part of `ci-ok`. The deploy on `main` prints
  the PDFs into `dist/pdf/` and publishes them with the site. A failed print
  fails the deploy, so no published page links a missing PDF. Pull requests
  publish nothing.

### 5. What the whole-site PDF is, and is not

The whole-site PDF is a print of the built site in reading order: the
registered sections, then any unregistered folders, then the appendix sections.
A page at the top level, outside any folder, prints after the cover.
It is not a book or manuscript content type. It adds no chapters, front matter,
page-numbered index or authoring syntax. The
[book and manuscript plan](../plans/features/book-manuscript-content-type.md)
stays *Won't*.

### 6. Settled choices

The epic left these choices open. The operator settled them on 2026-11-20:

| Choice | Ruling |
|---|---|
| Defaults | Section PDFs are opt-in per section, and the whole-site PDF is opt-in at site level. The print layer was on for every site; the operator amended that on 2026-11-25 (section 1): it is opt-in, and on in the starter configuration for new sites. |
| Where PDFs live | `dist/pdf/`, deployed on `main` only, not a release asset. |
| Paper size | A4, overridable through `@page`. There is no config key. |
| Ordering against #369 and #370 | These diagram fixes do not block. Diagram-heavy sections should wait for them before their PDFs are promoted. |
| Whole-site PDF | Yes, with the boundary in section 5. |
| Decks and OpenAPI pages | Never in a PDF. Further exclusions are configurable. |

One choice stays open: when the advisory lane joins `ci-ok`. The maintainers
decide that once it has been green for a period they agree on. Until then, a
pull request can merge with a red `pdf` lane, but the deploy on `main` prints
the PDFs and fails when a print fails. That is deliberate: a site never
publishes a page that links to a PDF it does not have. A maintainer who sees a
red lane fixes it before merging, or the next deploy stops.

### 7. Public surface

This decision adds these contracts, which later changes must keep or migrate:

- The `pdf` key in `sections.yaml`, and the `print`, `pdf` and `printControl`
  options of `defineDocKittyIntegrations`.
- The URLs `/print/`, `/print/<section>/` and `/pdf/<name>.pdf`, with `site` as
  a reserved PDF name, and the build file `dist/print/manifest.json`.
- The commands `dockitty-pdf`, `dockitty-assert-pdf` and
  `dockitty-assert-pdf-determinism`, and the package export
  `@spec-kitty/doc-toolkit/routes/print-injected`.
- The class `.dk-print-control` and the attribute `data-dk-print`.
- The `pdf` list in the served-surfaces record (#397), from the resolved
  settings. Nothing reads it yet; it lets a later surface, such as the agent
  index, link the PDFs without a second source of truth.

The print control's labels are English, like the rest of the toolkit's
chrome. Translating them waits for the toolkit's own label work.

## Consequences

### Positive

- A site with the print layer prints clean and light in either colour mode, and
  new sites start with it on.
- A site without it builds exactly what it built before, so the layer reaches
  existing sites only when they ask for it.
- PDFs keep everything the render pipeline adds, because they come from the
  built site.
- The PDFs are reproducible, tagged, and carry a bookmark outline.

### Negative

- The print layer adds one stylesheet and one small script to every in-frame
  page of a site that turns it on.
- An existing site that does not turn the layer on keeps printing as before: a
  reader in the dark theme prints a dark page there.
- On a page with client-mode diagrams, a browser print keeps those diagrams in
  the reader's theme (#369 is where client diagrams become theme-agnostic).
  PDFs are not affected.
- Paged-media features that Chromium lacks are out of reach, such as
  `target-counter()` page numbers in a table of contents (#383).

### Risks

- A Chromium change could alter the PDF structure, or add another varying
  field. The post-pass refuses any PDF without a classic cross-reference table,
  the gate checks the structure, and the determinism check compares two prints
  on every run.
- A site with many diagram-heavy pages pays more lane time. Sections are
  opt-in.

## Alternatives considered

### pandoc with Typst or LaTeX from the source Markdown

This route has the best accessibility: Typst 0.14 tags PDFs and has a PDF/UA-1
mode. It sees none of doc-kitty's render pipeline, though. It stays the
deferred archival route for PDF/UA (#384).

### pandoc from the OKF bundle

The bundle carries the raw source, so pandoc renders it no better than the
source tree. The bundle does give better structure: reading order, index entries
and relations.

### WeasyPrint on the built HTML

WeasyPrint runs no JavaScript, so client-mode diagrams and the client-side
enhancements are lost. Its PDF/UA support is experimental.

### Vivliostyle CLI or Paged.js

Vivliostyle is AGPL-3.0. Paged.js is an optional later polish (#383). It is the
only way to get page-numbered tables of contents, and its tagging needs a new
check.

## References

- Epic #377 and stories #378 to #382, with the research run of 2026-11-18.
- [ADR-0007](0007-ci-cd-path-scoped-lanes.md),
  [ADR-0008](0008-swappable-theme-layer.md),
  [ADR-0011](0011-theme-slot-surface-and-per-kind-layouts.md),
  [ADR-0040](0040-build-time-diagram-render-dual-mode.md),
  [ADR-0050](0050-route-collisions-and-single-index-setting.md),
  [ADR-0057](0057-internal-env-handoff-seam.md),
  [ADR-0070](0070-excluded-folders.md),
  [ADR-0072](0072-parallel-landing-without-shared-files.md),
  [ADR-0075](0075-sidebar-carrier-renders-own-sublist-on-opt-in.md),
  [ADR-0077](0077-shared-disclosure-control.md).
