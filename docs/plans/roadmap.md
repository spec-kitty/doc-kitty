---
title: Roadmap
description: "Phased plan for doc-kitty, split into MVP and extended scope with MoSCoW priorities."
doc_status: draft
updated: 2026-08-22
type: Plan
kind: Planning
authors:
  - stijn@sddevelopment.be
related:
  - architecture/ci-cd-pipeline
  - adr/0010-planning-kinds-and-moscow
---

# Roadmap

Design-iteration phase; order and scope are provisional. This plan splits the work
into an MVP and an extended scope, and prioritizes each feature with MoSCoW. The
per-feature detail lives in [features](./features/); the reasoning behind the
shape lives in the [decision records](../adr/).

(This is a `Planning` page and its features are `Feature` pages per
[ADR-0010](../adr/0010-planning-kinds-and-moscow.md); the `kind` values are
authored once the M1 schema migration lands.)

## Cross-cutting priority — CI/CD

Regardless of feature order, a working, path-efficient CI/CD pipeline is the
primary concern (tests, doc sanity, example deployment). See
[CI/CD Pipeline](../architecture/ci-cd-pipeline.md). It shapes the repo layout and
every feature's definition of done.

## Decisions

The decisions behind this plan are ADRs, not prose here:

- [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md) — amend
  Common Docs; `presentations/` and the `_meta/` registry.
- [ADR-0005](../adr/0005-frontmatter-doc-status-and-divio-type.md) /
  [ADR-0009](../adr/0009-finalize-metadata-contract.md) — the frontmatter contract
  (`doc_status`, `kind`, and the rest).
- [ADR-0006](../adr/0006-direct-render-default-projection-deferred.md) — direct
  render by default; projection deferred.
- [ADR-0007](../adr/0007-ci-cd-path-scoped-lanes.md) — the CI/CD strategy.
- [ADR-0008](../adr/0008-swappable-theme-layer.md) — the swappable theme layer.
- [ADR-0010](../adr/0010-planning-kinds-and-moscow.md) — planning kinds and the
  `moscow` field.

## Scope

### MVP — a minimal viable docsite

The docsite that renders a Common Docs — Kitty tree well and serves agents: render
the `docs/` tree (README-as-index), the metadata model and chrome, the generators,
a swappable theme, audience targeting with rendered relationships and external
references, slide decks, and the CI/CD that keeps it green. Markua support is the
near-term focus and rides just behind the core.

### Extended scope

Everything that makes the docsite richer or turns it into a repository portal:
diagrams, glossary, the doctrine variation, the realistic example content, and the
status/QA/ticketing portals.

### Out of scope (this cycle)

Selective/redacted publishing (the projection pipeline) and a book/manuscript
content type. The first is only needed to publish a filtered subset of a private
tree; the second competes with Leanpub, which we are not doing.

> **Note — Markua support ≠ an in-tool book type.** Declining an in-tool
> book/manuscript type does **not** forgo Leanpub. Markua support (below,
> Should/MVP) keeps the docs source **Markua-clean**, which makes **authoring a
> book or course on Leanpub from the same source materially easier** later — an
> export/reuse path, not doc-kitty becoming a publisher. That Leanpub-export
> dividend is in scope *because* Markua is; the in-tool book *content type* stays
> out.

## Prioritized features (MoSCoW)

| Feature | Mission | MoSCoW | Scope | Rationale |
|---|---|---|---|---|
| Common Docs rendering (README-as-index) | — | Must | MVP | The base; a docsite that does not render the tree is nothing. |
| CI/CD pipeline | M0 | Must | MVP | The harness every feature lands on; the stated primary concern. |
| Metadata model + chrome | M1 | Must | MVP | The contract every other feature reads and renders from. |
| Generators: RSS + llms.txt | — | Must | MVP | The agent- and human-facing discovery basics; already scaffolded. |
| Generated sitemap + HATEOAS read API | — | Should | Extended | SEO sitemap and a richer machine-readable (`_links`) read API refine discovery beyond the MVP basics. |
| Component system + swappable theme | M2 | Must | MVP | Theme swappability is a hard requirement (ADR-0008); per-kind layouts underpin later features. |
| Markua syntax support (subset) | — | Should | MVP | The stated near-term focus and Leanpub compatibility; the base renders without it, so not Must. |
| Audience + related + external references | M3 | Must | MVP | Core to the human-first, agent-supported promise: audience targeting and rendered relationships ship at launch. |
| Slide decks (reveal.js) | M6 | Must | MVP | Presentations are a first-class output pillar alongside docsites, required at launch. |
| Diagrams (Mermaid + PlantUML) | M5 | Should | Extended | High value for technical docs; build-time, self-contained. |
| Doctrine variation | M7 | Should | Extended | Recast the convention into charter/doctrine; governance and quality. |
| Glossary + Contextive | M4 | Should | Extended | Ubiquitous-language support is high value; the auto-linking effort and a Contextive dependency keep it out of MVP. |
| Example content from ars-rethorica | ars-rethorica-example | Could | Extended | Delivered — the ars-rethorica showcase corpus (Introduction, Preamble, Book I 15 chapters, Book II/III landings, generated rhetoric glossary, two active reader personas) ships in the example site. |
| Mission status portal | — | Could | Extended | Repository portal; depends on spec-kitty integration. |
| QA portal | — | Could | Extended | Repository portal; depends on CI test artifacts. |
| Ticketing report | — | Could | Extended | Repository portal; adaptor work, GitHub first. |
| Selective/redacted publishing (projection) | M8 | Won't | Out | Only needed to publish a filtered subset of a private tree; revisit on demand. |
| Book / manuscript content type | — | Won't | Out | Competes with Leanpub; we stay docsite + presentations. |

Each row has (or will have) a [feature page](./features/) carrying its `moscow`
label and rationale in frontmatter.

## Adoption enablers (from the spec-kitty proving ground)

The spec-kitty adoption study
([research](../architecture/research/spec-kitty-adoption-proof.md)) surfaced a set
of **doc-kitty-side changes that reduce adoption friction for a real, large
consumer** — most of which also fix doc-kitty's own bugs (a dogfooding dividend).
Each is filed on the tracker.

| Enabler | Friction it removes | Priority | Issue |
|---|---|---|---|
| Loader accepts `index.md` as the section index (alongside `README.md`) | Spares an adopter renaming ~60 section indexes + rewriting ~1,589 links/redirects | Should | [#37](https://github.com/spec-kitty/doc-kitty/issues/37) |
| `type`/`kind` optional + `type` derived from the section registry | Avoids forcing two required frontmatter fields onto a large corpus (~790 docs) | Should | [#38](https://github.com/spec-kitty/doc-kitty/issues/38) |
| Add `durable` to the `doc_status` enum | Never-retire throughline docs otherwise hard-fail the schema | Must (additive) | [#39](https://github.com/spec-kitty/doc-kitty/issues/39) |
| Overridable `type`/`kind` vocabulary (neutralize `Feature` for Mission-canon adopters) | Lets a canon-bound adopter avoid a prohibited term; fixes an internal inconsistency | Should | [#40](https://github.com/spec-kitty/doc-kitty/issues/40) |
| Tolerate `adr/<era>/NNNN-` ADR paths | Adopters with >100 era-partitioned ADRs keep their structure | Should | [#41](https://github.com/spec-kitty/doc-kitty/issues/41) |
| First-class redirect-coverage gate for migrating adopters | The highest-risk migration item (URL-scheme change) has no equivalent today | Should | [#42](https://github.com/spec-kitty/doc-kitty/issues/42) |
| Resolve LICENSE (`UNLICENSED` → add LICENSE file) | Hard blocker: no adopter can vendor doc-kitty code until licensed | Done (MIT, PR #74/#75) | [#43](https://github.com/spec-kitty/doc-kitty/issues/43) |
| Doc-honesty fixes (ADR-0030 in index; `AGENTS.md` `status`→`doc_status` + full section list; README "early scaffold" drift) | Curated-not-wiki integrity — the repo's own convention | Should | [#44](https://github.com/spec-kitty/doc-kitty/issues/44) |

Sequencing for a large-consumer adoption: the loader/vocab/enum items (#37–#41)
shrink adopter churn; **LICENSE (#43) and the redirect gate (#42) are the two hard
gates**; the doc-honesty items (#44) are quick self-consistency fixes. See the
research doc's phased recommendation for how these line up with a reference
adoption.
