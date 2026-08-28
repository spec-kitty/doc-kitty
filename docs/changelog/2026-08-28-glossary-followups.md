---
title: Glossary follow-ups — anchor de-collision, build-parity, section registry
description: Three M4 post-merge follow-ups land together — per-context anchor de-collision with an empty-slug guard (#17), render/build markdown-parse parity (#16), and the wired _meta/sections.yaml registry that ships the glossary under a "Reference" nav group (#18).
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
  **preview divergence** in definitions.
- `remark-gfm@4.0.1` and `remark-smartypants@3.0.3` are declared as direct deps, pinned
  to the versions Astro/Starlight resolve. **`remark-mdx` is deferred** (reduced
  scope): the corpus has no `.mdx` pages, so the MDX-expression phantom stays dormant
  behind a reserved factory option.

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
  `llms.txt`, the RSS `<category>` fallback, and the agent-API index all group and rank
  it under "Reference".
- **`metadata.ts` stayed pure.** `sectionRank`, `sectionLabel`, and `rankForAgents` now
  take the resolved order/labels as arguments and fall back to the frozen
  `SECTION_ORDER` / `SECTION_LABEL` constants when omitted, so the module remains
  Astro-free and fs-free.
- **Deferred:** `type`-from-registry as a validation authority (ADR-0004/FR-003) and
  `feeds` as a per-surface filter are both parsed and carried but not yet consumed.

## Notes for consumers

- If your docs tree has a `_meta/sections.yaml`, your sidebar becomes registry-driven
  (named, ordered groups). Passing an explicit `sidebar` still wins. With no registry
  file, nothing changes.
- The visual-regression baseline for the example site's sidebar changes with #18 and
  must be regenerated in the pinned Playwright container
  (`pnpm test:a11y --update-snapshots`).

Refs #16, #17, #18
