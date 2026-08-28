---
title: Section registry
description: "The docs/_meta/sections.yaml schema: how sections are labelled, ordered, typed, and filtered into the generated surfaces."
doc_status: draft
updated: 2026-08-28
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

**What is wired today:** the loader (`src/lib/sections.ts`) parses the
registry once and exposes the ordered section list (`sectionOrder`), the
`id → label` map (`sectionLabels`), and — since issue #24 — the `id → type` map
(`sectionTypes`). The Starlight sidebar (`src/lib/config.ts`) and `llms.txt` / the RSS
`<category>` fallback consume the order **and** labels; the agent-API index consumes
the **order only** — a page's `section` field stays the bare folder id, never the
registry label (issue #18). The section-default **`type`** is now the registry's job
too — `metadata.ts`'s pure `expectedDocType` derives a page's expected `type` from
`sectionTypes`, the standalone `validate-frontmatter.mjs` gate runs that derivation
and warns on a mismatch, and `schema.ts` re-exports it (`expectedTypeForPath`) for a
build-side consumer to call (issue #24). The last two fields are now wired too: **`feeds`** is a per-surface
filter (`sectionFeeds` + `feedsSurface`) the sitemap draft filter and the RSS /
llms.txt / agent-index routes apply, and **`purpose`** is the llms.txt section
blurb fallback (`sectionPurposes`). The frozen `SECTION_ORDER` / `SECTION_LABEL` /
`SECTION_TYPE` constants in `metadata.ts` are **demoted to a no-registry
fallback**: a docs root with no `sections.yaml` still builds and validates against
them. Every authored field is now consumed.

## Schema

```yaml
# docs/_meta/sections.yaml
version: 1
sections:
  - id: architecture          # required — the folder name under docs/ (the section slug)
    label: Architecture       # required — display name in nav and headings
    order: 20                 # required — integer sort key; lower first
    type: Architecture        # optional — the section-default `type` (wired, issue #24)
    purpose: >                # optional — one-line summary; the llms.txt blurb fallback (wired)
      How the toolkit is built and why.
    feeds: [sitemap, rss, llms, agent]   # optional — surfaces this section feeds (wired); absent = all four
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | The section slug. Maps 1:1 to a top-level folder under `docs/`. A section whose pages are build-generated (e.g. the glossary) is seeded (`BUILD_GENERATED_SECTION_IDS`), so its group is **always** emitted even when the folder is absent at config-eval time (issue #23); any other registered id with no folder is skipped with a **loud warning**, never silently. |
| `label` | yes | Display name in the sidebar, section heading, and llms.txt group. |
| `order` | yes | Integer sort key for nav and every section-ordered surface. Lower first. Gaps are allowed (10, 20, 30) so a section can be inserted without renumbering. |
| `type` | no | The section-default frontmatter `type` for pages in this section (**wired**, issue #24). A page's expected `type` is this value (a section `README.md` takes it), refined by the short sub-path subtype table below. Omitting it means the section has no default expectation (the `type` check degrades to a no-op for that section). |
| `purpose` | no | One-line description. **Wired** as the llms.txt section blurb FALLBACK: the emitted blurb is the section `README` description **??** this `purpose` (README wins). A section with neither gets no blurb line. |
| `feeds` | no | Which generated surfaces include this section's pages (**wired**). **Omitting it feeds ALL FOUR surfaces** (absent = all). Composes with the per-page publication / `agent` gating — see the semantics below. |

`version` marks the schema version so a future change is detectable.

The registry carries `type` in addition to the `id`/`label`/`order`/`purpose`/`feeds`
set named in the convention. This is now the **single place** a section's canonical
type is declared: the loader's former hardcoded section-to-type table is retired to a
no-registry fallback, and both validators derive the section default from here
(issue #24).

## `type`-to-section derivation (WIRED)

> **Status: wired (issue #24).** The registry is the section-default `type`
> authority. `sectionTypes(registry)` (`src/lib/sections.ts`) exposes the
> `id → type` map; the pure `expectedDocType(relPath, typesBySection)`
> (`src/lib/metadata.ts`) derives a page's expected `type` from it; and both
> validation surfaces consume it — the standalone `validate-frontmatter.mjs` gate
> and the build-side `schema.ts` (`expectedTypeForPath`). A docs root with no
> `sections.yaml` falls back to the frozen `SECTION_TYPE` map so it still
> validates.

A page's expected `type` is derived in two steps, most specific last:

1. **Section default.** The section is the first path segment (`architecture/overview`
   → `architecture`); its registry entry's `type` is the default (`Architecture`). A
   section `README.md` takes the section's `type`. A section with no `type` in the
   registry has no default expectation, so the check is a no-op for it.
2. **Sub-path subtypes.** A few sections carry more than one `type` by sub-path.
   These are a short, documented table applied **in code** on top of the section
   default:

   | Path pattern | `type` |
   |---|---|
   | `adr/template.md` | `Template` |
   | `plans/epics/*` | `Epic` |
   | `plans/features/*` | `Feature` |
   | `operations/runbooks/*` | `Runbook` |

   Everything else — including a plain `adr/*` record — takes its section default.

Both validators check a page's declared `type` against the derived expectation and
**warn on a mismatch** rather than failing, matching the open-vocabulary posture
(ADR-0004): the canonical set is checked, deviation degrades gracefully. The
bundle-root `docs/README.md` is exempt — it carries `okf_version`, not `type`.

The sub-path subtypes stay in code (mirrored in `metadata.ts` and, for bare Node,
`validate-frontmatter.mjs`) because they are few and stable. Moving them into a
per-section `subtypes` registry field is the one part still deferred — a follow-up
ADR item — and can happen without a contract change if a section grows its own
sub-kinds.

## `feeds` semantics (WIRED)

> **Status: wired.** `feeds` filters each generated surface. `sectionFeeds(registry)`
> (`src/lib/sections.ts`) exposes the `id → feeds` map and `feedsSurface(feeds,
> sectionId, surface)` applies the **absent = all four** default; the sitemap draft
> filter (`src/lib/config.ts`) and the RSS / llms.txt / agent-index routes each
> compose it with their existing per-page gating. An absent registry means no feeds
> filtering at all (byte-compatible with the pre-feeds surfaces).

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
  (`registryToSidebar`). A registry entry that is neither present on disk nor a
  known build-generated id is skipped with a **loud warning** (Starlight's
  `autogenerate` does not stat the folder — it would render an empty group — so we
  skip-and-warn instead). This is the "tolerated, not supported" posture of ADR-0004.
- **Sidebar route matching** (see [ADR-0029](../adr/0029-sidebar-autogenerate-content-root-coupling.md)):
  each group's `autogenerate.directory` is prefixed with the `docsDir` (`docs/<id>`,
  not the bare id) so it aligns with Starlight's route paths — Starlight matches
  autogenerate routes against a **hard-coded** `src/content/docs` root, which never
  strips doc-kitty's `docs/` loader base, so a bare `<id>` would match nothing and
  render every group empty. The prefix is version-pinned to the Starlight peer range
  and guarded by a build assertion (BA-11).
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
- **`type` on an entry** — optional; when present it is the section-default `type`
  authority (wired, above); when absent the section has no default `type`
  expectation. `purpose` and `feeds` are likewise optional and now consumed
  (llms.txt blurb fallback; per-surface filter with absent = all four).

## References

- [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md), which
  introduced the registry.
- [Loader and schema](./loader-and-schema.md), which reads it for section order,
  labels, and the section-default `type` validation.
- [Generators](./generators.md), which order the discovery surfaces by it.
- [The convention](../context/convention.md), section 2.
