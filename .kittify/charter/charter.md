# Project charter — doc-kitty

<!--
Curated, display-only companion to the authoritative
`.kittify/charter/charter.yaml`. It holds the rationale behind the project's
governance. It is never a charter-resolving input, and `charter generate` never
overwrites it. Detail and doctrine live in charter.yaml and the in-repo docs.
-->

## Purpose

doc-kitty is a reusable Astro + Starlight toolkit that renders a repository's
`docs/` tree as a human-first, agent-supported documentation site. It implements
the **Common Docs — Kitty Variation** convention (see
[`docs/context/convention.md`](../../docs/context/convention.md)) and emits
`sitemap.xml`, `rss.xml`, `llms.txt`, and a JSON agent-API. The agent-API is
discovery, not retrieval: a crawlable map of the corpus, not an embedding index.

The first consumer is the Spec Kitty product line, which needs its own brand. The
framework is built to become a public, consumer-usable template.

## What we solve for

Four outcomes, each answering a way that docs-next-to-code fails:

- **Structure** — a predictable, browsable shape.
- **Maintainability** — docs that stay correct next to the code.
- **Agent interoperability** — a site agents can discover and browse.
- **Flexibility** — adapt to a project without a rewrite.

## Scope

In scope: the toolkit, the convention, the generators, the metadata contract, the
theme layer, the CI/CD pipeline, and a worked example. Out of scope: authoring the
documentation content itself, and hosting a retrieval/embedding (RAG) index.

## Three separated axes

- **Content** — the `docs/` tree.
- **Information architecture** — `docs/_meta/sections.yaml` (sections, order,
  labels, feeds).
- **Presentation** — a swappable theme layer.

A consumer can change any one without touching the others. This separation is the
mechanism behind the flexibility outcome.

## Principles and key decisions

Decisions are recorded as ADRs under [`docs/adr/`](../../docs/adr/). The
load-bearing ones:

- Build on Astro + Starlight (ADR-0001); `README.md` is the section index and
  carries frontmatter (ADR-0002); render the repo-root `docs/` directly, plus an
  optional `agent` metadata block (ADR-0003).
- Amend Common Docs rather than fork it (ADR-0004). The canonical structure is the
  officially supported focus; a project may adapt it and the toolkit degrades
  gracefully, but adaptation is tolerated, not supported.
- The metadata contract is finalized in ADR-0009 (`doc_status`, the `kind`
  page-kind taxonomy, `related`, `external_references`, `banner`/`social_thumb`).
- Direct render is the default; a projection/redaction pipeline is optional and
  deferred (ADR-0006). Theme and chrome are a swappable, layered concern (ADR-0008).

## Quality and delivery

- Path-scoped CI (ADR-0007): a single `ci-ok` aggregate is the only required
  check. A documentation-only change skips code checks, and a code-only change
  skips the documentation build. `example_content` is deployed so it builds;
  repo docs are not deployed so they run sanity only.
- Doc-sanity: frontmatter validation, link and `related` integrity (the build
  fails on a dangling ref), markdownlint, and a Vale prose stylecheck.
- Tests: Vitest unit tests for the toolkit; an example build that asserts the
  generated artifacts. Playwright checks arrive with the component system (M2).
- Accessibility target WCAG 2.2 AA. A nightly smoke flow checks the deployed site
  and runs only when the deployment changed.
- Node 22+ and pnpm. Deploy to GitHub Pages on the mainline branch only.

## Documentation policy

The project dogfoods its own convention. Every page carries `title`,
`description`, `doc_status`, `updated`, `type` (validated against the section), and
`kind`. The tree conforms to OKF v0.2. Writing is audience-oriented and avoids
common AI-writing tells (em-dash overuse, rule-of-three padding, hedging, puffery,
filler); headings are sentence case; landings teach then link; one idea per
sentence. Living documentation: a behaviour change updates its docs in the same
change.

## Amendment and exceptions

The convention and its decisions are amended through ADRs. ADRs are immutable once
accepted; a change is a new or superseding ADR (for example ADR-0009 supersedes
ADR-0005's `divio_type`). Deviation from the canonical structure is tolerated with
graceful degradation and is unsupported out of the box; a genuine exception to a
gate is recorded as an ADR with its rationale.

## Doctrine baseline

This charter uses the built-in `software-dev` mission doctrine as its baseline
(specification-by-example and BDD, domain-driven design, atomic design, C4
modelling, execution lanes, and the standard directives), with the project-specific
policy above layered on top. The full selection lives in `charter.yaml`.
