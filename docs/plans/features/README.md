---
title: Features
description: "The doc-kitty feature pages, grouped by MoSCoW priority as set in the roadmap."
doc_status: draft
updated: 2026-08-22
type: Feature
kind: Hub
agent:
  priority: 0.7
---

# Features

One page per feature in the [roadmap](../roadmap.md), grouped by MoSCoW priority.
Each page is a thin wrapper: it carries the priority and rationale in frontmatter
and links the existing design, rather than re-documenting it. The MVP/extended
split and the MoSCoW levels are set in the roadmap; this index reflects them.

## Must

- [Common Docs rendering](./common-docs-rendering.md) (Must) — render the docs tree
  with README-as-index.
- [CI/CD pipeline](./ci-cd-pipeline.md) (Must) — the path-scoped delivery harness.
- [Metadata model + chrome](./metadata-model-and-chrome.md) (Must) — the frontmatter
  contract and the chrome driven by it.
- [Generators: RSS + llms.txt](./generators-rss-llms.md) (Must) — the discovery
  basics.
- [Component system + swappable theme](./component-system-and-theme.md) (Must) —
  per-kind layouts and a rebrandable theme.
- [Audience + related + external references](./audience-related-external-references.md)
  (Must) — audience targeting and rendered relationships.
- [Slide decks (reveal.js)](./slide-decks.md) (Must) — presentations as a first-class
  output surface.

## Should

- [Markua syntax support](./markua-syntax-support.md) (Should) — a subset of Markua
  for Leanpub compatibility.
- [Diagrams (Mermaid + PlantUML)](./diagrams.md) (Should) — build-time, self-contained
  diagrams.
- [Doctrine variation](./doctrine-variation.md) (Should) — recast the convention as
  charter and doctrine.
- [Glossary + Contextive](./glossary-and-contextive.md) (Should) — auto-linked
  glossary with Contextive.
- [Generated sitemap + HATEOAS read API](./generated-sitemap-and-read-api.md)
  (Should) — SEO sitemap and a richer `_links` read API.

## Could

- [Example content from ars-rethorica](./example-content-ars-rethorica.md) (Could) —
  a realistic Markua showcase.
- [Mission status portal](./mission-status-portal.md) (Could) — spec-kitty mission
  status in the docsite.
- [QA portal](./qa-portal.md) (Could) — CI test artifacts and quality signals.
- [Ticketing report](./ticketing-report.md) (Could) — a report over issue trackers.

## Won't

- [Selective/redacted publishing](./selective-redacted-publishing.md) (Won't) — the
  projection pipeline; out of this cycle.
- [Book / manuscript content type](./book-manuscript-content-type.md) (Won't) —
  competes with Leanpub; out of this cycle.

## Corpus classification (dogfood, #40)

This section is the reviewable outcome of the [own-corpus correction work
package](../../../kitty-specs/qol-adoption-enablers-01M1BTPE/tasks/WP02-own-corpus-correction.md)
(mission `qol-adoption-enablers`, FR-006). It classifies every page in this
folder so a reviewer signs off on the *verdicts*, not on a validator warning
count.

Why the count alone proves nothing: `docs/plans/features/*` derives `type:
Feature` from the folder path, and all pages already carry `type: Feature`, so
authored == derived and the corpus emits **zero path-mismatch warnings before
any work**. `type` is therefore effectively frozen here — re-typing a page while
it stays under `plans/features/` would *create* a warning, and relocating it
needs the deferred `plans/features/ → plans/missions/` rename (C-006a). The
in-scope lever is `kind` (not path-derived): a semantically-wrong `kind` can be
corrected in place with no warning. Genuinely mis-placed pages are *filed* for
relocation, never moved here.

Verdicts: `correct-feature` (leave) · `kind-wrong` (fix `kind` in place) ·
`type-misplaced` (file relocation follow-up under C-006a).

| Page | type / kind | Content one-liner | Verdict |
| --- | --- | --- | --- |
| `README.md` | Feature / Hub | This section index / hub for the feature pages | correct-feature (leave — `Hub` is the correct index kind) |
| `common-docs-rendering.md` | Feature / Feature | Render a Common Docs `docs/` tree with README-as-index (MVP) | correct-feature |
| `ci-cd-pipeline.md` | Feature / Feature | Path-scoped CI/CD delivery pipeline (M0) | correct-feature |
| `metadata-model-and-chrome.md` | Feature / Feature | Frontmatter contract + page chrome driven by it (M1) | correct-feature |
| `generators-rss-llms.md` | Feature / Feature | `rss.xml` + `llms.txt` discovery generators (MVP) | correct-feature |
| `component-system-and-theme.md` | Feature / Feature | Per-kind layouts + swappable theme (M2) | correct-feature |
| `audience-related-external-references.md` | Feature / Feature | Render `audience`/`related`/`external_references` as on-page blocks (M3) | correct-feature |
| `slide-decks.md` | Feature / Feature | reveal.js slide decks authored in Markdown (M6) | correct-feature |
| `markua-syntax-support.md` | Feature / Feature | A practical subset of Markua for Leanpub compatibility | correct-feature |
| `diagrams.md` | Feature / Feature | Mermaid/PlantUML diagrams, themed + accessible (M5) | correct-feature |
| `doctrine-variation.md` | Feature / Feature | Recast the docs convention as charter + doctrine (M7) | correct-feature |
| `glossary-and-contextive.md` | Feature / Feature | Auto-linked glossary integrated with Contextive (M4) | correct-feature |
| `generated-sitemap-and-read-api.md` | Feature / Feature | `sitemap.xml` + HATEOAS `_links` read API | correct-feature |
| `example-content-ars-rethorica.md` | Feature / Feature | Ship realistic ars-rethorica example content | correct-feature |
| `mission-status-portal.md` | Feature / Feature | Planned portal surfacing spec-kitty mission status (Could) | correct-feature (verified — see note) |
| `qa-portal.md` | Feature / Feature | Planned portal surfacing CI test artifacts / QA signals (Could) | correct-feature (verified — see note) |
| `ticketing-report.md` | Feature / Feature | Planned report over issue trackers via an adaptor layer (Could) | correct-feature (verified — see note) |
| `selective-redacted-publishing.md` | Feature / Feature | Projection pipeline for filtered/redacted publishing (M8, Won't) | correct-feature |
| `book-manuscript-content-type.md` | Feature / Feature | Dedicated book/manuscript content type (Won't) | correct-feature |

**Tally: 19 correct-feature · 0 kind-wrong · 0 type-misplaced.**

Suspects verified, not assumed. The tasks flagged `mission-status-portal.md`,
`qa-portal.md`, and `ticketing-report.md` as possible content-vs-type
mismatches (their titles say "portal"/"report"). On reading, each page is a
forward-looking **feature proposal** — a `Could`-priority capability the product
*could gain*, with a MoSCoW rationale and a link to a design/research doc. None
is itself a rendered portal or a generated report artifact (which would read as
`Reference`/generated content). So `type: Feature` and `kind: Feature` are both
correct, and none is a relocation candidate for the deferred C-006a rename.

Type-misplaced follow-ups filed under C-006a: **none.** No page's content
belongs in another section, so there is nothing to bundle with the deferred
`plans/features/ → plans/missions/` rename at this time.

Guard: `node src/scripts/validate-frontmatter.mjs docs` reports zero
path-mismatch warnings — unchanged by this work package, since only `kind` is
in-scope to edit and no `kind` needed correcting.
