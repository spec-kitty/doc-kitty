# Phase 1 Data Model — Glossary + Contextive (M4)

Entities, value objects, invariants. The **shared term-index** is the load-bearing
artifact: parsed once (ADR-0026), the single source of truth for four consumers (D6).

## Entities & value objects

### DefinitionsFile (source of truth)
`.contextive/definitions.yaml` — Contextive Community format.
- `contexts: Context[]` (≥1 when present)
- **Invariant**: parsed + validated **once** (IC-01); invalid → build-fatal naming the
  offending context/term/field (FR-002); absent → feature dormant, build succeeds (FR-001).

### Context
- `name: string` (required; the disambiguation unit)
- `domainVisionStatement?: string` (markdown; rendered on the context page if present, FR-003)
- `terms: Term[]`
- Maps to: one generated page `/glossary/<slug(name)>/` + one nav node.

### Term
- `name: string` (required)
- `definition: string` (required; **markdown**, rendered through the real pipeline — FR-004)
- `aliases?: string[]` (each treated exactly like `name` — FR-012)
- `examples?: string[]`
- `meta?: Record<string, string>` (markdown; any URL scheme-checked, non-allowlisted → fatal, FR-004)
- **Anchor**: `slug(name)` — deterministic (NFR-004), the click target.

### SharedTermIndex (value object — the one shared matcher's data, ADR-0026)
- `bySurface: Map<lowercased surface (name|alias), Array<{ context, anchor, termName }>>`
- `contexts: Map<name, { slug, terms, domainVisionStatement? }>`
- **Invariant**: keys are lowercased for whole-word case-insensitive matching (FR-006);
  aliases and names occupy the same map (FR-012). Built once by the loader; imported by the
  generator, resolver, `:term`, and (fallback path) the block.

### PageContext (per-page frontmatter, ADR-0028)
- `glossary_context?: string` (page-local; not inherited v1)
- `glossary_autolink?: boolean` (default true)
- Reaches remark via `file.data.astro.frontmatter` (AS-5).

### Resolution (value object — resolver output, ADR-0027)
Discriminated union over `(surface, pageContext, index)`:
- `{ kind: 'link', context, anchor, termName }` — single candidate, or multi resolved by page context
- `{ kind: 'unresolved', surface, competing: string[] }` — multi, page context absent/not a candidate
- `{ kind: 'none' }` — not a term/alias, or ignore-listed

### GlossaryLinkUsed (value object — the FR-010 datum)
- `{ surface, context, anchor, termName }` — distinct per term; published to
  `remarkPluginFrontmatter.glossary_links_used` (ADR-0025); consumed by `OnThisPage.astro`.

### OnThisPageBlock (rendered, ADR-0025)
- `externalReferences: ResolvedReference[]` (composed from M3 `resolveCitation`)
- `related: ResolvedRelated[]` (composed from M3 `resolveRelated`)
- `glossaryLinks: GlossaryLinkUsed[]` (deduped by term, stable order)
- **Invariant**: omit the block (or any empty sub-list); present with JS off (NFR-005).

## Invariants (cross-cutting)

- **INV-G1 (single parse)**: the definitions file is parsed/validated once; all consumers
  read the one `SharedTermIndex` (NFR-004, D6).
- **INV-G2 (determinism)**: same input → byte-identical generated pages, anchors, injected
  links, and `glossary_links_used` order (NFR-004).
- **INV-G3 (collision safety)**: an unresolved collision is never auto-linked; exactly one
  greppable warning per distinct unresolved surface per page; build exits 0 (NFR-007).
- **INV-G4 (presence-gated dormancy)**: no definitions file → no `/glossary/` route, no
  auto-links, no new frontmatter, byte-identical corpus (FR-001, NFR-002).
- **INV-G5 (no M3 mutation)**: the block composes M3 by import; no M3-owned file changes
  (ADR-0025).
- **INV-G6 (scheme safety)**: every URL in `meta` passes the `safeHref` allowlist or the
  build fails (FR-004).

## State / lifecycle (build-time)

```
absent .contextive        → DORMANT   (no route, no links, corpus byte-identical)
present + valid           → ACTIVE    (parse once → index → generate pages → link → block)
present + invalid         → FATAL     (build fails, names context/term/field)
present + unresolved collision on a page → ACTIVE, term left plain + greppable warning (exit 0)
```

No runtime state; all resolution is build-time and deterministic.
