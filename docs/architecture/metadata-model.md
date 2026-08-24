---
title: Metadata model
description: "The frontmatter contract every page carries, and how the toolkit reads it."
doc_status: draft
updated: 2026-08-21
type: Architecture
kind: Reference
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
| `hero_image` | no | `{ src, alt }` | page hero + default social image |
| `social_thumb` | no | `{ src, alt } \| string` | OG / Twitter share image |
| `agent` | no | `{ discoverable, priority, keywords }` | agent-API visibility/ordering |
| `moscow` | no | `{ level: Must\|Should\|Could\|Won't, rationale }` | MVP/extended split and MoSCoW board on planning pages |
| `tags` | no | `[string]` | agent-API, filtering |
| `authors`, `resource`, `generated`, `verified`, `sources`, `stale_after` | no | as Common Docs | metadata, freshness |
| `okf_version` | root only | `"0.2"` | OKF conformance marker |

¹ `type` is required on every page except the bundle-root `README.md`, which
carries `okf_version` instead. See "Sections and type".

`doc_status` and `kind` are the M1 additions to the contract (ADR-0005 and
ADR-0009). The repo uses `status` and omits `kind` until the M1 migration, so this
table describes the intended contract, not what the validator enforces today.

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
and how to read it. The two axes are independent.
[ADR-0005](../adr/0005-frontmatter-doc-status-and-divio-type.md) introduced this
field as `divio_type`;
[ADR-0009](../adr/0009-finalize-metadata-contract.md) renamed it to `kind` and
defined the taxonomy. A tutorial and a reference page can share a section.

`kind` is required on every page. Its value set is the four Divio content quadrants
plus a set of structural kinds, so a page that does not fit a quadrant still
declares its kind rather than being exempt:

- Content quadrants: `Tutorial`, `How-To`, `Reference`, `Explanation`.
- Structural kinds: `Hub` (a section index or list page: minimal prose, many
  links), `ADR`, `Changelog`, `Glossary`, `Presentation`, `Persona` (an audience
  description), and the planning kinds `Planning`, `Feature`, and `User-Journey`
  (see [ADR-0010](../adr/0010-planning-kinds-and-moscow.md)).

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

## Citation catalog

The `{ type, id }` reference form resolves against two Astro content-layer **data
collections**, each loaded from a single YAML file
([ADR-0018](../adr/0018-citation-catalog-collections.md)):

- `bibliography` ← `docs/_meta/bibliography.yaml`
- `tools` ← `docs/_meta/tools.yaml`

(both mirrored under `example/docs/_meta/` for the example site). The toolkit
exports a zod schema and a loader for each — mirroring the `docs` collection — so a
consumer wires all three into `content.config.ts` in one step. Records are keyed by
their stable, unique `id`; a duplicate id is a fatal, ambiguous citation key.

Record shapes:

| Collection | Required | Optional |
|---|---|---|
| `bibliography` | `id`, `title`, `url` | `type`, `authors: string[]`, `container`, `issued`, `accessed`, `note` |
| `tools` | `id`, `name`, `url` | `note` |

**Resolution.** A catalog `type: biblio` resolves to `bibliography[id]`; `type:
tool` resolves to `tools[id]`. An unresolvable `id`, or an unknown catalog `type`
(anything but `biblio`/`tool`), is a **blocking build error** — and the build-free
`validate-catalog.mjs` gate reports the same verdict, so a citation is caught in
the fast `doc-sanity` lane before a build. Parity between the two arms is the
contract (asserted in `src/tests/`). An inline `{ url, title, note? }` needs no
catalog and carries **no citation key**.

**Rendering.** Each reference item's accessible name **leads with the human title**
(inline `title` or the resolved record `title`); the mono citation key is a
secondary affordance shown only for catalog citations, never the leading or sole
name. The block is an `External references` navigation landmark inside the
searchable content region, so the resolved titles appear in the citing page's own
search fragment.

**Endpoint.** `/api/bibliography.json` projects the bibliography as
`{ version, count, records[] }`, each record carrying at least `id`, `title`, and
`url`. Because a catalog record carries no `doc_status`, this projection is emitted
**outside** page-publication gating (FR-015): unlike `/api/index.json`, RSS, and
the sitemap, it is not filtered by `draft`.

## Images: hero image and social thumbnail

Two optional image fields feed both the page display and its share metadata,
following the Hugo reference where one image drives the on-page hero and the
social card. (`hero_image` was named `banner`; it was renamed to avoid a collision
with Starlight's built-in `banner`, see
[ADR-0011](../adr/0011-theme-slot-surface-and-per-kind-layouts.md).)

`hero_image` is the image shown at the top of the page (a hero or header). It is an
object so it carries alt text, which accessibility requires:

```yaml
hero_image:
  src: ./assets/architecture-hero.webp
  alt: A layered diagram of the toolkit
```

`social_thumb` is the image used for social and search share cards (Open Graph
and Twitter). When it is omitted, the page falls back to `hero_image.src`, then to a
site-wide default:

```yaml
social_thumb: ./assets/architecture-share.png   # or { src, alt }
```

The `Head` override generates the share metadata from these fields plus the page's
`title` and `description`: `og:title`, `og:description`, `og:image`,
`og:image:alt`, `twitter:card` (`summary_large_image`), `twitter:image`, and the
canonical URL. This is part of the metadata-driven chrome (M1).

Image handling differs by purpose:

- `hero_image` uses Astro's optimized image pipeline (colocated with the page or under
  a known assets path), so it is resized and served in a modern format.
- `social_thumb` must resolve to a stable absolute URL, because crawlers fetch it
  directly. It resolves to a `public/` asset or the built absolute URL of the
  optimized image. A site-wide default covers pages that set neither field.

## Audience

`audience` is a list of `{ profile, guidance_text }`. `profile` is a kebab slug
that resolves to a persona page under `context/audience/<profile>.md`;
`guidance_text` is the page-local note on what that reader should take from the
page. A "Who is this for" block renders when the list is non-empty.

Persona pages are the shared stakeholder descriptions. **Their location of record
is `context/audience/`**, a sub-location of the `context` section, and they carry
`kind: Persona`. [ADR-0020](../adr/0020-persona-location-reconciliation.md)
reconciled this: personas relocated from a top-level `personas/` directory to
`context/audience/` so a persona is a first-class member of the `context` section
and an `audience` profile slug resolves against it directly. Persona attribute
fields (`role`, `goals`, `responsibilities`) are defined in
[ADR-0019](../adr/0019-persona-attribute-fields.md); the passport layout renders
them.

Profile resolution is a **soft miss** (FR-002): a `profile` with no persona page
does not fail the build — the block renders the humanized slug and warns on the
build log. This is deliberately asymmetric with the build-fatal `related` miss
below, because an audience note is page guidance, not a navigational contract.

## Agent extension

`agent` tunes how the page appears to agents: `discoverable` (default true) to
include or exclude it from `llms.txt` and the agent index, `priority` (0–1,
default 0.5) to rank it, and `keywords` for retrieval terms beyond `tags`. Kitty
extension, defined in [ADR-0003](../adr/0003-root-docs-and-agent-extension.md).

## Planning metadata

Planning pages (`kind: Planning`, `Feature`, `User-Journey`) can carry a `moscow`
field for prioritization:

```yaml
moscow:
  level: Must        # Must | Should | Could | Won't
  rationale: One sentence on why this priority.
```

`level` is required when `moscow` is present, and `rationale` is required with it,
so a priority never appears without its reason. `Won't` records something as out of
the current scope, with the reason. See
[ADR-0010](../adr/0010-planning-kinds-and-moscow.md). The `moscow` field is
additive and can be authored now; the `kind` values follow the M1 migration.

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

## Decisions

The metadata contract is finalized in
[ADR-0009](../adr/0009-finalize-metadata-contract.md): the `kind` taxonomy (which
supersedes ADR-0005's `divio_type`), the `related` and `external_references`
shapes, the `hero_image`/`social_thumb` images, authored `type`, and freshness. This
page describes the contract; ADR-0009 records the decisions and their rationale.
