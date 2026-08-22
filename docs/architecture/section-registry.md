---
title: Section registry
description: "The docs/_meta/sections.yaml schema: how sections are labelled, ordered, typed, and filtered into the generated surfaces."
status: draft
updated: 2026-08-22
type: Architecture
kind: Reference
authors:
  - stijn@sddevelopment.be
tags: [sections, registry, loader, feeds, metadata]
related:
  - adr/0004-amend-common-docs-as-extensible-variation
  - architecture/loader-and-schema
  - architecture/generators
  - context/convention
---

# Section registry

`docs/_meta/sections.yaml` is the authored registry that decouples a section's
**display and behaviour** from its **on-disk structure**. The folder layout under
`docs/` stays the canonical Common Docs tree; the registry says how each section is
labelled, ordered, typed, and which generated surfaces it feeds. This is the
mechanism [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md)
decided; this page specifies its schema and the rules the loader and generators
apply to it.

Audience: contributors building the loader and the generators.

The registry is the **single source of truth for section identity**. Before it, the
section list and their order were hardcoded in the generator code; the registry
replaces that, so relabelling or reordering a section, or dropping it from a feed, is
a data edit, not a code change. `docs/_meta/` is reserved, non-content, and excluded
from the docs collection, so the registry never renders as a page.

## Schema

```yaml
# docs/_meta/sections.yaml
version: 1
sections:
  - id: architecture          # required — the folder name under docs/ (the section slug)
    label: Architecture       # required — display name in nav and headings
    order: 20                 # required — integer sort key; lower first
    type: Architecture        # required — the canonical `type` for pages in this section
    purpose: >                # optional — one-line summary; a fallback section blurb
      How the toolkit is built and why.
    feeds: [sitemap, rss, llms, agent]   # optional — surfaces this section feeds; default all
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | The section slug. Maps 1:1 to a top-level folder under `docs/`. |
| `label` | yes | Display name in the sidebar, section heading, and llms.txt group. |
| `order` | yes | Integer sort key for nav and every section-ordered surface. Lower first. Gaps are allowed (10, 20, 30) so a section can be inserted without renumbering. |
| `type` | yes | The canonical frontmatter `type` for pages in this section. The authority for `type`→section derivation and validation (below). |
| `purpose` | no | One-line description. Used as the section blurb in llms.txt and the agent-API index when the section `README.md` has no `description`. |
| `feeds` | no | Which generated surfaces include this section's pages. A subset of `sitemap`, `rss`, `llms`, `agent`. Omitted means all four. |

`version` marks the schema version so a future change is detectable.

The registry carries `type` in addition to the `id`/`label`/`order`/`purpose`/`feeds`
set named in the convention, because tying a section to its canonical type in one
place is what lets the loader stop hardcoding the path-to-type table.

## `type`-to-section derivation

A page's expected `type` is derived in two steps, most specific last:

1. **Section default.** The section is the first path segment (`architecture/overview`
   → `architecture`); its registry entry's `type` is the default (`Architecture`). A
   section `README.md` takes the section's `type`.
2. **Sub-path overrides.** A few sections carry more than one `type` by sub-path.
   These overrides are a short, documented table the loader applies on top of the
   section default:

   | Path pattern | `type` |
   |---|---|
   | `adr/NNNN-*` | `ADR` |
   | `adr/template` | `Template` |
   | `plans/roadmap` | `Plan` |
   | `plans/epics/*` | `Epic` |
   | `plans/features/*` | `Feature` |
   | `plans/journeys/*` | `User-Journey` |
   | `operations/runbooks/*` | `Runbook` |

   Everything else takes its section default.

The schema validates a page's declared `type` against the derived expectation and
**warns on a mismatch** rather than failing, matching the open-vocabulary posture
(ADR-0004): the canonical set is checked, deviation degrades gracefully. The
bundle-root `docs/README.md` is exempt — it carries `okf_version`, not `type`.

The sub-path overrides live in the loader today because they are few and stable;
they can move into a per-section `subtypes` field in the registry later without a
contract change if a section grows its own sub-kinds.

## `feeds` semantics

`feeds` is a **coarse, section-level filter** over the four generated surfaces. It
composes with the finer per-page gating; a page appears in a surface only when both
allow it:

- **`sitemap`** — the page is published (`doc_status` is not `draft`).
- **`rss`** — published, and ordered by `updated`.
- **`llms`** — published and grouped under this section in the llms.txt narrative.
- **`agent`** — published and `agent.discoverable` is not false.

So the effective rule for surface *X* is: `X ∈ section.feeds` **and** the page's own
publication and `agent` gating allow it. A section left out of a surface removes all
its pages from that surface regardless of the per-page fields; a section in a surface
still defers to the per-page fields. Omitting `feeds` means all four.

This is where a section that should render but not stream out is expressed: internal
planning stays in the sitemap and the agent map but out of the public RSS feed, and
decks are discoverable without being feed items.

## Loader and generator rules

- The loader reads `sections.yaml` once at build and exposes the ordered section
  list and each section's metadata to the schema and every generator.
- **Coverage warnings** (graceful, not fatal): a top-level `docs/` folder with no
  registry entry is rendered with a derived label and a default order appended after
  the registry, and a warning is logged (tolerated, not supported, per ADR-0004); a
  registry entry with no matching folder is a warning.
- No generator hardcodes the section set or order any more; all of nav, llms.txt
  grouping, and the agent-API index read the registry. See
  [generators.md](./generators.md).

## Failure and edge cases

- **Duplicate `id` or `order`** — a duplicate `id` is a build error (ambiguous
  section); a duplicate `order` is a warning, broken by `id` alphabetically.
- **Unknown `feeds` value** — warns and is ignored, so a typo does not silently
  drop a section from a surface it should feed.
- **Missing `type` on an entry** — a build error; `type` is required because
  derivation depends on it.

## References

- [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md), which
  introduced the registry.
- [Loader and schema](./loader-and-schema.md), which reads it and validates `type`.
- [Generators](./generators.md), which order and filter by it.
- [The convention](../context/convention.md), section 2.
