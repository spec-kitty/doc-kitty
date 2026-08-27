# Contract — "On this page" block + the render-time links-used helper

**Owner**: IC-07 `src/components/slots/OnThisPage.astro` + its mount in
`src/components/MarkdownContent.astro`. ADR-0025 (AS-3, ADR-0017 companion),
post-tasks-squad A-1/A-2/A-3.

## Composition (no frozen-M3 edits)

The block imports and reuses M3 — it does **not** modify any INV-G5-frozen M3 file:
- `src/lib/metadata.ts` → `resolveRelated`, `resolveCitation`, `slugFromEntryId`.
- **`src/lib/catalog.ts` → `buildCatalog`** (NOT `metadata.ts` — corrected post-squad L-1).
- `src/themes/spec-kitty/components/molecules/{RelatedCard,ReferenceItem}.astro` (markup).
Reads `Astro.locals.starlightRoute` for `entry.data` + `getCollection('docs'|'bibliography'
|'tools')` (the ADR-0017 self-resolving pattern).

## The links-used mechanism (re-derive; the frontmatter channel is closed)

- **No frontmatter channel** (post-squad A-1): `docKittyDocsSchema` is `docsSchema({ extend:
  z.object(...) })` which strips an undeclared key, and `entry.data` freezes at load while
  remark runs at render — so `route.entry.data.glossary_links_used` is unreadable. Do **not**
  rely on it. (No T029 spike; retired.)
- **One shared helper** `linksForBody(entry.body, pageContext, index, ignoreList)` runs the
  SAME transforms the pipeline applies — parse → `remarkDirective` → `glossary-term` (WP05) →
  `computePageLinks` (WP04) — and collects **every** `data-glossary-term` node (auto-linked
  **and** `:term`), returning the distinct ordered `(surface, context, anchor)` list. It
  reuses WP04/WP05's pure exports (NOT `resolve.ts` alone — that has no section model and no
  directive pass, so it would drop `:term` links and mis-count first-per-section). WP07
  depends on **WP04 and WP05**.
- Determinism (NFR-004) makes the re-derived list byte-identical to what the pipeline linked.

## Mount (owned + presence-gated — post-squad A-3)

- `OnThisPage` is mounted in `src/components/MarkdownContent.astro` (the **ADR-0013 M1
  carrier**, NOT an INV-G5-frozen M3 file — legal to edit, owned by WP07).
- **Presence-gated swap** on `isGlossaryActive()` (WP01 export, definitions-file presence):
  inactive → render the existing standalone `<Related/>` + `<ExternalReferences/>` exactly as
  today (byte-identical dormancy, NFR-002); active → render `<OnThisPage/>` in their place (no
  double render of refs/related). The swap flips only at the WP09 on-switch (D3).

## Render rules (FR-010)

1. Three labelled sub-lists: external references, related pages, glossary links used.
2. **Omit** the block (or any sub-list) when empty.
3. Glossary links **deduped by distinct term**, stable order (definition order, then
   first-appearance).
4. Present and complete with **JS off** (NFR-005) — plain anchors to
   `/glossary/<context>/#<anchor>`; the hover island (IC-06) is orthogonal.
5. No frozen-M3 file modified (INV-G5). The only allowed component touch is the carrier mount.
