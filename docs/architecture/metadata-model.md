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
| `type` | yes¹ | canonical section kind (open vocabulary), authored | agent-API, validation |
| `kind` | yes | page kind (see "Page kind"), open vocabulary | reading-mode grouping, per-kind layout |
| `audience` | no | `[{ profile, guidance_text }]` | "Who is this for" block |
| `related` | no | `[string \| { ref, note }]` | on-page related block, agent-API |
| `external_references` | no | `[{ url, title, note? } \| { type, id }]` | on-page references block |
| `banner` | no | `{ src, alt }` | page hero + default social image |
| `social_thumb` | no | `{ src, alt } \| string` | OG / Twitter share image |
| `agent` | no | `{ discoverable, priority, keywords }` | agent-API visibility/ordering |
| `tags` | no | `[string]` | agent-API, filtering |
| `authors`, `resource`, `generated`, `verified`, `sources`, `stale_after` | no | as Common Docs | metadata, freshness |
| `okf_version` | root only | `"0.2"` | OKF conformance marker |

¹ `type` is required on every page except the bundle-root `README.md`, which
carries `okf_version` instead. See "Sections and type".

`doc_status` and `kind` are the M1 additions to the contract (ADR-0005). The repo
uses `status` and omits `kind` until the M1 migration, so this table describes the
intended contract, not what the validator enforces today.

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

## Page kind: `kind`

`type` says where a page lives (its section); `kind` says what kind of page it is
and how to read it. The two axes are independent
([ADR-0005](../adr/0005-frontmatter-doc-status-and-divio-type.md) introduced this
field as `divio_type`, before it was renamed): a tutorial and a reference page can
share a section.

`kind` is required on every page. Its value set is the four Divio content quadrants
plus a set of structural kinds, so a page that does not fit a quadrant still
declares its kind rather than being exempt:

- Content quadrants: `Tutorial`, `How-To`, `Reference`, `Explanation`.
- Structural kinds: `Hub` (a section index or list page: minimal prose, many
  links), `ADR`, `Changelog`, `Glossary`, `Presentation`, `Persona` (an audience
  description).

The vocabulary is open, like `type`: the validator checks the canonical set above
and warns on an unknown value rather than failing.

`kind` drives layout, not only grouping. A page can render through a per-kind
template: a `Hub` as a described link list, a `Persona` as a passport or character
sheet, a `Presentation` as a slide deck. This is where `kind` earns its place
beyond `type`.

Redundancy with `type` is accepted on purpose. In a structural section the two
coincide (an ADR page is `type: ADR`, `kind: ADR`); in a content section they
differ (a guide is `type: Guide` with `kind: How-To` or `Tutorial`). Every page
declares an explicit kind, so tools and layouts switch on it without special-casing
paths.

## Relationships

`related` and `external_references` both express links as metadata, so the body
stays prose and the links render in a consistent block.

`related` links to other pages in this docs tree. Each entry is either a bare
slug or an object:

```yaml
related:
  - architecture/overview          # bare slug: renders the target's own description
  - ref: guides/deployment
    note: how the CI deploys this  # object: a per-link note overrides the description
```

The build resolves each `ref` and fails on one that does not exist, so a related
list cannot silently rot.

`external_references` links to material outside the tree. Each entry is either an
inline citation or a reference into a shared catalog:

```yaml
external_references:
  - url: https://revealjs.com
    title: reveal.js
    note: the deck engine          # inline
  - type: biblio
    id: <catalog-id>               # resolves against the bibliography collection
```

Two catalog collections back the `{ type, id }` form: `bibliography` and `tools`.
A catalog record is the single source of truth for a citation, so the same source
can be referenced from many pages and rendered consistently. Inline entries suit
one-off links; catalog entries suit sources cited more than once.

## Images: banner and social thumbnail

Two optional image fields feed both the page display and its share metadata,
following the Hugo reference where one image drives the on-page hero and the
social card.

`banner` is the image shown at the top of the page (a hero or header). It is an
object so it carries alt text, which accessibility requires:

```yaml
banner:
  src: ./assets/architecture-hero.webp
  alt: A layered diagram of the toolkit
```

`social_thumb` is the image used for social and search share cards (Open Graph
and Twitter). When it is omitted, the page falls back to `banner.src`, then to a
site-wide default:

```yaml
social_thumb: ./assets/architecture-share.png   # or { src, alt }
```

The `Head` override generates the share metadata from these fields plus the page's
`title` and `description`: `og:title`, `og:description`, `og:image`,
`og:image:alt`, `twitter:card` (`summary_large_image`), `twitter:image`, and the
canonical URL. This is part of the metadata-driven chrome (M1).

Image handling differs by purpose:

- `banner` uses Astro's optimized image pipeline (colocated with the page or under
  a known assets path), so it is resized and served in a modern format.
- `social_thumb` must resolve to a stable absolute URL, because crawlers fetch it
  directly. It resolves to a `public/` asset or the built absolute URL of the
  optimized image. A site-wide default covers pages that set neither field.

## Audience

`audience` is a list of `{ profile, guidance_text }`. `profile` is a kebab slug
that must resolve to a persona page under `context/audience/<profile>.md`;
`guidance_text` is the page-local note on what that reader should take from the
page. A "Who is this for" block renders when the list is non-empty. Persona pages
are the shared stakeholder descriptions. They live under `context/audience/`, a
sub-location of the `context` section, and carry `kind: Persona`. This is an M3
feature; the shape is fixed here so the schema can carry it earlier.

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
`architecture/*` is `Architecture`). The canonical set is the Common Docs `type`
values (one per section, plus the ADR `Template` and the `plans/` and
`operations/` sub-kinds) plus `Presentation`. The value set is open: the validator
checks the canonical set strictly and warns on an unknown value rather than
failing, so a project's own sections degrade gracefully.

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

## Design decisions (pending ADR reconciliation)

Working resolutions from the design phase. They move into ADRs once the contract
stops growing; until then this list is the record.

1. **`related` shape.** Accept both a bare slug and `{ ref, note }`. A bare slug
   renders the target's own `description`; a `note` overrides it. The build fails
   on a ref that does not resolve.
2. **`external_references` shape.** Support both inline `{ url, title, note? }`
   and catalog `{ type, id }` from the start, backed by `bibliography` and `tools`
   collections.
3. **Page kind is `kind`** (renamed from `divio_type`), required on every page,
   with an extended open vocabulary: the four Divio quadrants plus structural kinds
   (`Hub`, `ADR`, `Changelog`, `Glossary`, `Presentation`, `Persona`). It drives
   per-kind layout. See "Page kind".
4. **`type` is authored**, and the validator checks it matches the section.
5. **Images**: `banner` (page hero and the default social image) and
   `social_thumb` (the OG/Twitter card), following the Hugo reference. See
   "Images".
6. **Freshness** (taken as recommended, pending objection): `stale_after` and
   `updated` feed a nightly, non-blocking freshness report. Thresholds are defined
   with the freshness feature, not here.

Reconciliation pending: the rename to `kind` and the extended vocabulary need to
land in [ADR-0005](../adr/0005-frontmatter-doc-status-and-divio-type.md), which
recorded the field as `divio_type` with only the four quadrants. That waits until
the contract stops growing.
