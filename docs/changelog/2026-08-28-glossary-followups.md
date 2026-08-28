---
title: Glossary follow-ups — anchor de-collision, build-parity, section registry
description: M4 glossary follow-ups — anchor de-collision (#17), render/build parse parity (#16), and the wired sections.yaml registry driving nav, type, feeds, blurbs (#18, #20–#24).
doc_status: active
updated: 2026-08-28
type: Changelog
kind: Changelog
tags: [glossary, anchors, sections, registry, sidebar, navigation]
related:
  - architecture/glossary
  - architecture/section-registry
  - architecture/loader-and-schema
---

# 2026-08-28 — Glossary follow-ups (#16, #17, #18)

The three follow-ups filed after the M4 glossary post-merge adversarial squad land
together on one branch. Two close correctness/robustness classes that were dormant
behind input shapes the example corpus does not contain; the third delivers the
FR-013 "Reference" nav group and resolves the DIRECTIVE_044 section split-brain.

## #17 — Per-context anchor de-collision + empty-slug guard

Term anchors and context page-slugs are now computed **once** in `buildIndex` and read
everywhere, instead of each surface recomputing `slug()`.

- **De-collision.** Within a context, distinct names that slug to the same value get a
  stable suffix (`c`, `c-2`, `c-3` — e.g. `C`/`C++`/`C#`), assigned in source order and
  guarded against re-collision. The de-collided anchor is stored on the index and
  consumed by the generator, the resolver, the autolink used-list, and the
  On-this-page block, so page id, link target, and hover all agree.
- **Empty slugs are build-fatal.** A term or context name with no `[a-z0-9]` characters
  (a CJK-only name, `→`, `&`) now fails the build loudly instead of shipping `#` or
  overwriting the hub. Non-Latin (Unicode) anchoring is explicitly **out of scope for
  v1**.
- **Intra-context duplicate names are build-fatal**, surfacing an authoring mistake the
  hover-payload map previously swallowed silently.
- **URL-slug fold-in.** Link URLs now use the context *slug*, fixing a pre-existing 404
  for any context whose name was not already its own slug (spaces, capitals, `&`);
  `data-glossary-context` keeps the original name for the hover payload.
- **Unicode word boundaries.** The autolink matcher widened from `[A-Za-z0-9]`
  lookarounds to `\p{L}\p{N}` (with the `u` flag), so a term no longer links inside a
  larger non-ASCII word (`Cargoで`, `caféCargo`).

## #16 — Render/build markdown-parse parity

`OnThisPage`'s used-list re-derive and the definitions-payload `stripMarkdown` built
their own bare `remark-parse` processors, diverging from the real build pipeline.

- **One shared processor factory.** `src/lib/glossary/page-processor.ts`
  (`createPageProcessor`) is now the single parse configuration —
  `remark-parse` + `remark-gfm` + `remark-smartypants` (+ `remark-directive` on
  request) — imported by both re-derive sites, mirroring the existing "one shared
  matcher / one shared slug" discipline.
- **Closes the phantom used-list entry** for a gfm autolink literal (`cargo@x.com`
  stayed a text node under the bare parser and got linked) and the strikethrough/table
  **preview divergence** in definitions. Both re-derive sites now run the full
  parse+transform phase (`runSync(parse(...))`), so `remark-gfm` (syntax) **and**
  `remark-smartypants` (a transformer) both apply — matching the build, which curls
  prose before autolinking. This also closes the residual curl-phantom for surfaces
  with typographic punctuation (`don't`, `Rock 'n' Roll`) and gives definitions
  preview↔render parity (#20).
- `remark-gfm@4.0.1` and `remark-smartypants@3.0.3` are declared as direct deps, pinned
  to the versions Astro/Starlight resolve, with a guard test that fails if the pins
  drift from Astro's resolution (#21). **`remark-mdx` is deferred** (reduced scope):
  the corpus has no `.mdx` pages, so the MDX-expression phantom stays dormant behind a
  reserved factory option.

## #18 — Section registry wired: "Reference" nav group

**The `docs/_meta/sections.yaml` registry is no longer inert.** A loader now reads it
and drives both the Starlight sidebar and the discovery surfaces, so relabelling or
reordering a nav group is a data edit rather than a code change.

- **A registry loader.** `src/lib/sections.ts` parses `_meta/sections.yaml` once into an
  ordered, validated section list. A duplicate `id` is build-fatal; a duplicate `order`
  warns and tie-breaks by `id`; a missing registry returns a graceful `null` so a docs
  root without one still builds.
- **The sidebar is registry-driven.** With no explicit `sidebar`, the preset now
  synthesizes named, ordered groups from the registry, each `autogenerate`-ing from its
  section folder. A folder with no registry entry is still shown (appended with a
  humanized label); a registry-free site keeps Starlight's bare tree-autogeneration.
- **The glossary ships under "Reference".** The example registry gives the `glossary`
  section `label: Reference`; its content folder stays `glossary/`. The sidebar,
  `llms.txt`, and the RSS `<category>` fallback label it "Reference"; the agent-API
  index applies the registry *order* only (a page's `section` field stays the folder
  id `glossary`). The root Hub grid reads the same registry order, so the landing page
  no longer diverges from the other surfaces.
- **`metadata.ts` stayed pure.** `sectionRank`, `sectionLabel`, and `rankForAgents` now
  take the resolved order/labels as arguments and fall back to the frozen
  `SECTION_ORDER` / `SECTION_LABEL` constants when omitted, so the module remains
  Astro-free and fs-free.

## The registry now drives every consumer it was designed for (#22, #23, #24)

The remaining registry axes — previously parsed-but-unconsumed deferrals — are now
wired, so `sections.yaml` is the single source of truth end-to-end:

- **`type` is the section-default authority (#24).** `sectionTypes(registry)` feeds the
  pure `expectedDocType`; the standalone `validate-frontmatter.mjs` gate (the former
  hardcoded `switch` mirror, now reading the registry) runs that derivation and warns
  on a mismatch, and `schema.ts` re-exports it (`expectedTypeForPath`) for a build-side
  consumer to call. Severity stays advisory (warn, never fail); the frozen
  `SECTION_TYPE` is the no-registry fallback. Sub-path subtypes stay in code per
  ADR-0004.
- **`feeds` is a per-surface filter.** Each of sitemap / RSS / llms / agent now composes
  the section's `feeds` set with per-page gating. A section that omits `feeds` feeds all
  four, and an absent registry filters nothing — so a site that declares no `feeds`
  (including the example) is byte-inert.
- **`purpose` is the llms.txt section blurb.** Each section group emits a blurb =
  the section `README` description ?? the registry `purpose` (README wins; neither → no
  line).
- **The discovery surfaces honor `docsDir` (#22).** llms.txt, RSS, and the agent-API
  index resolve the registry from the content root, so a non-default docs directory no
  longer splits registry authority between the sidebar and the surfaces. The integration
  publishes the resolved root as an internal `DK_DOCS_ROOT` signal that the sitemap
  filter and the routes both read, so order/label/`feeds` are computed against one
  `sections.yaml` even when `docsDir` and the loader `base` differ (closes the
  cross-surface split the review flagged); a standalone route with no integration falls
  back to the content-layer `filePath`, then `<cwd>/docs`.
- **A build-generated section survives an uncommitted folder (#23).** The sidebar seeds
  known build-generated section ids (the glossary), so its "Reference" group no longer
  vanishes when the generated folder isn't committed; a genuinely missing registered
  section now warns loudly instead of being dropped in silence.

## Review hardening (pre-merge adversarial squad)

A multi-lens pre-merge review (correctness, architecture, security, semantic) was folded
in on the same branch:

- The root **Hub grid** now reads the registry order, so the landing page no longer
  diverges from the sidebar/discovery surfaces (the fourth section-order consumer).
- `renderTerm` throws on a missing anchor (loud invariant) and neutralizes `{`/newline
  in the heading text so an author-supplied `{#id}` can't shadow the stored anchor.
- The three reconciled architecture docs were corrected to match the shipped code
  (the agent-API applies order only, not the "Reference" label; `feeds`/`purpose`/`type`
  no longer described as deferred).

## Sidebar route-matching fix (the registry sidebar shipped empty, then was fixed)

The first cut of the registry sidebar emitted each group as
`autogenerate: { directory: '<id>' }`. That rendered **every nav group empty** — no
hub link and no child pages — because Starlight matches `autogenerate` routes against
a **hard-coded** `src/content/docs` content root, which never strips doc-kitty's
repo-`docs/` loader base; a bare `<id>` matched nothing. An interim fix that added
explicit hub links was superseded by the real one: **prefix each group's directory
with the `docsDir`** (`docs/<id>`), aligning it with Starlight's route paths so the
whole tree renders — section hubs **and** child pages — with `sidebar: { hidden: true }`
decks still filtered out. This is a deliberate, version-pinned coupling to Starlight's
internals, documented in
[ADR-0029](../adr/0029-sidebar-autogenerate-content-root-coupling.md): the
`@astrojs/starlight` peer range is capped `<0.33.0` so an incompatible upgrade fails
loudly at install, and a build assertion (BA-11) fails the build if the groups ever
render empty again.

## Notes for consumers

- If your docs tree has a `_meta/sections.yaml`, your sidebar becomes registry-driven
  (named, ordered groups). Passing an explicit `sidebar` still wins. With no registry
  file, nothing changes.
- The registry sidebar requires your `docsDir` option to equal the `base` you pass to
  `docKittyDocsLoader` (the convention default `docs/` for both); if they diverge the
  nav groups render empty. Pinned to Starlight `<0.33.0` — see ADR-0029.

Refs #16, #17, #18, #20, #21, #22, #23, #24
