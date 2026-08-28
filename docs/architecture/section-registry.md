---
title: Section registry
description: "The docs/_meta/sections.yaml schema: how sections are labelled, ordered, typed, and filtered into the generated surfaces."
doc_status: draft
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

The registry is the **source of truth for section nav, order, and labels**. Before
it, the section list and their order were hardcoded in the generator code; the loader
now reads the registry and drives the Starlight sidebar and the discovery surfaces
from it, so relabelling or reordering a section — for example shipping the glossary
under a named "Reference" group — is a data edit, not a code change. `docs/_meta/` is
reserved, non-content, and excluded from the docs collection, so the registry never
renders as a page.

**What is wired today (issue #18):** the loader (`src/lib/sections.ts`) parses the
registry once and exposes the ordered section list (`sectionOrder`) and the
`id → label` map (`sectionLabels`). The Starlight sidebar (`src/lib/config.ts`) and
the three discovery surfaces — `llms.txt`, the RSS `<category>` fallback, and the
agent-API index — consume it. The frozen `SECTION_ORDER` / `SECTION_LABEL` constants
in `metadata.ts` are **demoted to a no-registry fallback**: a docs root with no
`sections.yaml` still builds against them. Two fields are authored but **not yet
consumed** — `type` as a validation authority and `feeds` as a per-surface filter
(see the deferral notes below).

## Schema

```yaml
# docs/_meta/sections.yaml
version: 1
sections:
  - id: architecture          # required — the folder name under docs/ (the section slug)
    label: Architecture       # required — display name in nav and headings
    order: 20                 # required — integer sort key; lower first
    type: Architecture        # optional (deferred) — canonical `type` for the section
    purpose: >                # optional — one-line summary; a fallback section blurb
      How the toolkit is built and why.
    feeds: [sitemap, rss, llms, agent]   # optional (deferred) — surfaces this section feeds
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | The section slug. Maps 1:1 to a top-level folder under `docs/`. |
| `label` | yes | Display name in the sidebar, section heading, and llms.txt group. |
| `order` | yes | Integer sort key for nav and every section-ordered surface. Lower first. Gaps are allowed (10, 20, 30) so a section can be inserted without renumbering. |
| `type` | no (deferred) | The canonical frontmatter `type` for pages in this section. Carried, but not yet consumed — see the deferral note below. |
| `purpose` | no | One-line description. A fallback section blurb (carried; used opportunistically). |
| `feeds` | no (deferred) | Which generated surfaces include this section's pages. Carried, but not yet consumed as a filter — see the deferral note below. |

`version` marks the schema version so a future change is detectable.

The registry carries `type` in addition to the `id`/`label`/`order`/`purpose`/`feeds`
set named in the convention, so that a future op can tie a section to its canonical
type in one place and retire the loader's hardcoded path-to-type table.

## `type`-to-section derivation (DEFERRED)

> **Status: designed, not yet wired (issue #18).** The loader parses and carries a
> section's `type`, but nothing derives or validates a page's `type` against it yet.
> This op scoped the registry to nav/order/label only; the design below is retained
> as the target for a follow-up and is not a description of current behaviour.

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

## `feeds` semantics (DEFERRED)

> **Status: designed, not yet wired (issue #18).** `feeds` is parsed and carried,
> but no surface yet drops a section by its `feeds` set — per-page publication and
> `agent` gating remain the only filters. The section-level filter below is the
> target for a follow-up.

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

- `loadSectionRegistry(docsRoot)` reads `<docsRoot>/_meta/sections.yaml` once and
  returns the ordered section list; `parseSectionRegistry` is the pure core it wraps.
  A **missing** file returns `null` (the graceful sentinel), so a docs root with no
  registry still builds against the `metadata.ts` fallback constants.
- **Coverage tolerance** (graceful, not fatal): a top-level content folder with no
  registry entry is appended after the registry groups with a humanized label
  (`registryToSidebar`), and a registry entry with no matching folder is skipped from
  the sidebar (Starlight's `autogenerate` throws on an empty directory). This is the
  "tolerated, not supported" posture of ADR-0004.
- Nav, `llms.txt` grouping, the RSS `<category>` fallback, and the agent-API index no
  longer hardcode the section set or order; they read the registry via the pure,
  parameterized `metadata.ts` helpers (`sectionRank(section, order)`,
  `sectionLabel(section, labels)`, `rankForAgents(entries, order)`).

## Failure and edge cases

- **Duplicate `id`** — a build error (ambiguous section): `parseSectionRegistry`
  throws.
- **Duplicate `order`** — a warning; the tie is broken by `id` alphabetically.
- **Missing `id`, `label`, or `order` on an entry** — a build error (these three are
  required for nav/order/label).
- **`type` on an entry** — currently optional and carried but not consumed (the
  `type` authority is deferred, above). `feeds` is likewise carried, not consumed.

## References

- [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md), which
  introduced the registry.
- [Loader and schema](./loader-and-schema.md), which reads it for section order and
  labels (`type` validation is deferred).
- [Generators](./generators.md), which order the discovery surfaces by it.
- [The convention](../context/convention.md), section 2.
