---
title: "ADR-0025: The \"On this page\" block and the remark→render data channel (ADR-0017 companion)"
description: A doc-kitty-owned carrier-body block composes the M3 references/related renderers and re-derives the glossary links a page used at render time, never editing M3-owned files.
doc_status: active
updated: 2026-08-26
type: ADR
kind: ADR
authors:
  - stijn@spec-kitty.ai
related:
  - plans/features/glossary-and-contextive
  - adr/0017-m3-content-block-rendering-seam
  - adr/0026-glossary-source-and-generation-seam
  - adr/0027-auto-link-resolution-scoping-and-term-directive
  - adr/0009-finalize-metadata-contract
---

# ADR-0025: The "On this page" block and the remark→render data channel (ADR-0017 companion)

## Status

Accepted. **Companion to [ADR-0017](./0017-m3-content-block-rendering-seam.md)** — it
does not amend or supersede it. Establishes the M4 (Glossary) per-page "On this page"
block and the one data channel that block needs but the M3 seam cannot supply. This is
the **biggest architectural risk in M4** (post-spec squad finding AS-3); it is settled
here before tasks. Depends on the shared matcher pinned by
[ADR-0027](./0027-auto-link-resolution-scoping-and-term-directive.md).

## Context

FR-010 wants an auto-generated **"On this page" block** below the content with three
labelled sub-lists: the page's **external references**, its **related pages**, and the
**distinct glossary links it used**. The first two datums already have a home; the third
does not, and joining them is the risk.

1. **M3 renders references/related as prop-less, self-resolving carrier-body components.**
   Per ADR-0017, `src/components/slots/{ExternalReferences,Related}.astro` take **no
   props**: each reads `Astro.locals.starlightRoute` for the page's `entry.data` and
   `await getCollection('docs' | 'bibliography' | 'tools')` for the catalog, then applies
   the `src/lib/metadata.ts` resolvers (`resolveRelated`, `resolveCitation`,
   `buildCatalog`) and renders the `src/themes/spec-kitty/components/molecules/{Related,
   Reference}*` molecules. There is **no prop channel** into these components — by design.

2. **"Glossary links used" is born in the remark pass.** The auto-linker (ADR-0027) walks
   the page's mdast and, via the **one shared matcher**, decides which term/alias
   occurrences become links. That per-page list of `(surface, context, anchor)` lives in
   `file.data` during the remark pass — a place the M3 carrier-body components, which run
   at the Astro **render** layer, cannot read. The M5 diagram seam (ADR-0023) already hit
   the sibling of this problem and solved the **within-pipeline** case by stashing on
   `file.data.dkDiagrams` and consuming it in a **rehype** plugin. That trick does not
   reach an Astro component; a `getCollection` call and `Astro.locals` do not reach a
   rehype plugin. **No single pass holds both datums** — that is exactly why AS-3 is the
   top risk.

3. **The block must not become a fourth thing to maintain in two places.** FR-010 is one
   block with labelled sub-lists, present with JS off (NFR-005), deduped by distinct term,
   omit-when-empty. Splitting it across an Astro component (refs/related) and a
   rehype-appended fragment (glossary) would straddle two owners and two pipeline stages
   for one visual block.

## Decision

1. **A new doc-kitty-owned block, `src/components/slots/OnThisPage.astro`, renders the
   whole "On this page" section by *composing* the M3 renderers — never editing the
   INV-G5-frozen M3 files.** The M4 block imports the M3 resolvers (`resolveRelated`,
   `resolveCitation`, `slugFromEntryId` from `src/lib/metadata.ts`; **`buildCatalog` from
   `src/lib/catalog.ts`**) and molecules (`src/themes/spec-kitty/components/molecules/*`)
   and self-resolves references/related exactly as `ExternalReferences.astro`/`Related.astro`
   do (same `Astro.locals.starlightRoute` + `getCollection` reads). **No frozen M3 file
   (`ExternalReferences.astro`, `Related.astro`, `metadata.ts`, `catalog.ts`, molecules) is
   modified** — the block replicates their self-resolving *bodies* over the shared resolvers.

   **The mount is owned and presence-gated (post-squad A-3).** `OnThisPage` is mounted in
   the **ADR-0013 M1 carrier** `src/components/MarkdownContent.astro` — which is *not* an
   INV-G5-frozen M3 file, so editing it is legal, but it must have an owner (WP07). To avoid
   double-rendering references/related and to preserve dormancy (NFR-002), the carrier
   **swaps** presence-gated on `isGlossaryActive()` (a cheap definitions-file presence check
   exported by the WP01 loader): **glossary inactive → render the existing standalone
   `<Related/>` + `<ExternalReferences/>` exactly as today (byte-identical)**; **active →
   render `<OnThisPage/>` in their place** (consolidated + glossary links, no double render).
   The swap flips only when the definitions file lands (the WP09 on-switch), so every prior
   WP stays byte-identical (D3).

2. **The "glossary links used" datum is computed at render by one shared, deterministic
   helper — not carried on a frontmatter channel (post-squad A-1/A-2).** The obvious
   `remarkPluginFrontmatter` channel is **closed**: `docKittyDocsSchema` is
   `docsSchema({ extend: z.object(...) })`, which **strips** an undeclared
   `glossary_links_used`, and `entry.data` is frozen at collection-load while the remark
   write happens at render — so a self-resolving carrier block can never read
   `route.entry.data.glossary_links_used`. Instead the block calls **one shared helper**,
   `linksForBody(entry.body, pageContext, index, ignoreList)`, which runs the *same*
   transforms the build pipeline applies — parse → `remarkDirective` → `glossary-term`
   (ADR-0027 WP05) → `computePageLinks` (ADR-0027 WP04) — and collects **every**
   `data-glossary-term` link node (both auto-linked and `:term`), returning the distinct
   ordered `(surface, context, anchor)` list. Because it reuses the *same pure functions*
   over the same `(body, context, index)`, NFR-004 determinism guarantees the list is
   byte-identical to what the pipeline linked, **and it includes `:term` links** (which a
   bare `resolve.ts` re-derive would drop — `resolve.ts` has no section model and no
   directive pass).

3. **`entry.body` is the substrate; no spike needed.** The glob loader
   (`glob({ base: 'docs' })`) populates `entry.body` with raw markdown for every `.md/.mdx`
   entry, so `linksForBody` has its input at render with no dependency on frontmatter
   surfacing. (The retired remarkPluginFrontmatter path would have needed a spike; the
   re-derive needs none.) The block reads one contract: **a distinct, ordered list of
   `(surface, context, anchor)` the page linked, `:term` links included.**

4. **No-JS and dedup live in the block, not the channel.** The block renders plain
   anchors to `/glossary/<context>/#<term>` (NFR-005), dedups by distinct term, and holds
   a stable order (definition order, then first-appearance) — pure render-time list work,
   identical with or without JS (the hover island of ADR-0027 is orthogonal).

## Consequences

### Positive

- ADR-0017 holds literally — its three components are untouched; M4 **composes** them.
  No props are threaded through the ADR-0015 slot boundary; `resolveLayout` stays
  synchronous. M4 is additive.
- One block, one owner, one heading — FR-010's "labelled sub-lists" is a single Astro
  component, not a stage-straddling hybrid.
- The datum is re-derived by the **same pure functions** the pipeline runs (`glossary-term` +
  `computePageLinks`), so "links used" cannot drift from "links inserted" — same
  functions, same `(body, context, index)` — and `:term` links are included.

### Negative

- doc-kitty now owns a block that duplicates the *resolution* logic of two M3 components
  (by importing their resolvers, not their markup) — a future M3 resolver change must be
  picked up here. Mitigation: the block imports `metadata.ts`/`catalog.ts`, so the resolver
  logic is shared, not copied.
- The block re-runs the directive+term+link transforms over `entry.body` at render (build
  time) rather than reading a cached datum — a little duplicated work. Mitigation: it is
  build-time only, deterministic, and buys correctness the frontmatter channel could not
  provide.

### Risks

- An implementer could be tempted to edit the frozen M3 files (`ExternalReferences.astro`/
  `Related.astro`/`metadata.ts`/`catalog.ts`/molecules) to "just add a glossary list."
  Forbidden: the block composes by import. Editing the **carrier** `MarkdownContent.astro`
  to mount the block is the *only* allowed component touch (owned by WP07, INV-G5-legal).
- A re-derive that forgets the directive+term pre-pass would silently drop `:term` links.
  Mitigation: the pinned `linksForBody` helper runs the pre-pass; a WP07 test asserts a
  `:term`-linked page's used-list includes the `:term` term.

## Alternatives considered

### Carry "links used" on `remarkPluginFrontmatter` and read `route.entry.data.glossary_links_used`

**Rejected (post-squad A-1).** Two independent blockers: (1) `docKittyDocsSchema` is
`docsSchema({ extend: z.object(...) })`, which strips an undeclared key — so
`glossary_links_used` never survives into `entry.data`; and (2) `entry.data` is frozen at
collection-load while the remark write happens at render. Declaring the field in the schema
fixes only (1), not the lifecycle. The deterministic render-time re-derive (Decision 2)
sidesteps both.

### Append the glossary sub-list from a rehype plugin, keep refs/related as M3 components

Rejected. It splits one visual block across a rehype-appended fragment (has `file.data`) and
an Astro component (has `getCollection`), fighting FR-010's single labelled-sub-list block
and complicating ordering, dedup, and styling.

### Thread resolved data through `slotComponents` props into the M3 components

Rejected — this is exactly the ADR-0015-incompatible path ADR-0017 already refused: slot
bodies are prop-less and resolution is synchronous; threading props is a silent transport
change.

### Compute "links used" in the block by reading the rendered DOM (client-side)

Rejected — violates NFR-005 (the block must be present and complete with JS off).

## References

- [ADR-0017](./0017-m3-content-block-rendering-seam.md) (the composed M3 seam),
  [ADR-0023](./0023-diagram-render-and-metadata-seam.md) (the `file.data` remark→rehype
  precedent + spike/fallback discipline),
  [ADR-0027](./0027-auto-link-resolution-scoping-and-term-directive.md) (the one shared
  matcher this block reuses),
  [ADR-0009](./0009-finalize-metadata-contract.md) (the `related`/`external_references`
  contract the composed renderers resolve).
- Post-spec squad AS-3 / AS-5; spec FR-010, NFR-004, NFR-005.
