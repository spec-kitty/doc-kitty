---
title: Metadata model
description: "The frontmatter contract every page carries, and how the toolkit reads it."
status: draft
updated: 2026-08-21
type: Architecture
authors:
  - stijn@sddevelopment.be
tags: [metadata, frontmatter, schema]
related:
  - context/convention
  - adr/0004-amend-common-docs-as-extensible-variation
  - adr/0005-frontmatter-doc-status-and-divio-type
---

# Metadata model

This describes the frontmatter contract every page carries and the rules the
toolkit applies to it: navigation, feeds, the agent-API, and validation. The
normative spec is [the convention](../context/convention.md); this page is where
the evolved contract is designed before it lands there. The settled parts come
from the ADRs it links; the open parts are marked and carry a recommendation.

Audience: contributors building the toolkit, and authors who need to know what to
put in frontmatter.

## The contract at a glance

| Field | Required | Values | Read by |
|---|---|---|---|
| `title` | yes | string | nav, `<title>`, feeds, agent-API |
| `description` | yes | string, 50–180 chars | chrome, feeds, agent-API |
| `doc_status` | yes | `draft \| active \| deprecated \| superseded` | publication gating |
| `updated` | yes | `YYYY-MM-DD` | feeds, freshness |
| `type` | yes¹ | canonical section kind (open vocabulary) | agent-API, validation |
| `divio_type` | see open Q3 | `Tutorial \| How-To \| Reference \| Explanation` | reading-mode grouping |
| `audience` | no | `[{ profile, guidance_text }]` | "Who is this for" block |
| `related` | no | see open Q1 | on-page related block, agent-API |
| `external_references` | no | see open Q2 | on-page references block |
| `agent` | no | `{ discoverable, priority, keywords }` | agent-API visibility/ordering |
| `tags` | no | `[string]` | agent-API, filtering |
| `authors`, `resource`, `generated`, `verified`, `sources`, `stale_after` | no | as Common Docs | metadata, freshness |
| `okf_version` | root only | `"0.2"` | OKF conformance marker |

¹ `type` is required on every page except the bundle-root `README.md`, which
carries `okf_version` instead. See "Sections and type".

## Required fields

`title` and `description` name and summarise the page. `description` is bounded to
50–180 characters, so it serves as the SEO description and the feed and agent-API
summary without truncation.

`doc_status` records the document lifecycle: `draft` (work in progress, not
authoritative), `active` (current and maintained), `deprecated` (kept for history),
`superseded` (replaced; link the replacement in `related`). The rename from
`status` is [ADR-0005](../adr/0005-frontmatter-doc-status-and-divio-type.md).

`updated` is the date the content was last checked against reality, not the date
of an incidental edit. It drives feed ordering and freshness.

## Reading mode: `divio_type`

`type` says where a page lives; `divio_type` says how to read it (Tutorial,
How-To, Reference, Explanation). The two axes are independent
([ADR-0005](../adr/0005-frontmatter-doc-status-and-divio-type.md)). A tutorial and
a reference page can share a section.

## Relationships

`related` and `external_references` both express links as metadata, so the body
stays prose and the links render in a consistent block. Their exact shapes are the
main open questions below.

## Audience

`audience` is a list of `{ profile, guidance_text }`. `profile` is a kebab slug
that must resolve to a persona page under `context/audience/<profile>.md`;
`guidance_text` is the page-local note on what that reader should take from the
page. A "Who is this for" block renders when the list is non-empty. Persona pages
are the shared stakeholder descriptions. This is an M3 feature; the shape is fixed
here so the schema can carry it earlier.

## Agent extension

`agent` tunes how the page appears to agents: `discoverable` (default true) to
include or exclude it from `llms.txt` and the agent index, `priority` (0–1,
default 0.5) to rank it, and `keywords` for retrieval terms beyond `tags`. Kitty
extension, defined in [ADR-0003](../adr/0003-root-docs-and-agent-extension.md).

## Sections and type

Sections are declared in `docs/_meta/sections.yaml` (id, label, order, purpose,
feeds), so section identity, labels, and ordering are data, not code
([ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md)).

`type` names the kind of page and maps to its section (for example
`architecture/*` is `Architecture`). The canonical set is the twelve Common Docs
kinds plus `Presentation`. The value set is open: the validator checks the
canonical set strictly and warns on an unknown value rather than failing, so a
project's own sections degrade gracefully.

## Publication and validation rules

Publication gating from `doc_status`:

- `draft` is excluded from `sitemap.xml`, `rss.xml`, and the agent-API.
- `active`, `deprecated`, and `superseded` are published.

Validation runs in two places: the build-free `validate-frontmatter.mjs` CI gate
and the Astro build's schema. Both validate the canonical contract strictly and
treat unknown `type` values and non-canonical sections as advisory warnings.

## Code model

The framework-agnostic model and helpers live in `lib/metadata.ts`, kept free of
Astro and Starlight imports so they can be unit-tested in isolation and reused by
the builder scripts. They cover publication gating, section ordering, and the
shaping of agent records. The zod schema in `lib/schema.ts` mirrors the contract
for the Astro build. See [loader and schema](./loader-and-schema.md) and
[generators](./generators.md).

## Open decisions

1. **`related` shape.** Bare `[string]` refs, or `[{ ref, note }]` with an
   optional note? The discovery run showed the strongest pattern resolves a ref to
   the target page's own `description` and lets `note` override it. Recommend:
   accept both. A bare string resolves to the target's description; an object adds
   a per-link note. Fail the build on a ref that does not resolve.
2. **`external_references` shape.** Inline only (`[{ url, title, note? }]`), or
   also catalog refs (`{ type: 'biblio' | 'tool', id }`) that resolve against
   shared `bibliography`/`tools` collections? Recommend: support both. Ship inline
   first (M3); add catalog collections when a project needs one source of truth for
   citations.
3. **Is `divio_type` required?** Divio discipline argues yes, but section indexes,
   ADRs, and changelog entries do not fit a quadrant cleanly. Recommend: required
   on content pages, exempt for section `README.md`, `adr/*`, `changelog/*`, and
   `presentations/*`.
4. **Is `type` authored or derived?** It is derivable from the section, but OKF
   wants it present in the file at rest. Recommend: keep it authored; the validator
   checks it matches the section.
5. **Freshness.** How `stale_after` and `updated` combine into a freshness signal,
   and whether the freshness report is a nightly job rather than a PR gate.
   Recommend: nightly and non-blocking; define thresholds with the freshness
   feature, not here.
