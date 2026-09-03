# Data Model & Core Contracts: Metadata / Vocabulary / Hub Consolidation

**Mission**: metadata-vocab-hub-consolidation-01M1MFVT · **Phase**: 1

This mission adds no persistent data stores. The "model" here is (1) the vocabulary/enum entities being single-sourced, (2) the `doc_status` enum change, and (3) the ADR-entry shape the Hub card renders. The shared-core function signatures stand in for API contracts.

## Entity: `doc_status` enum (#39)

- **Current**: `draft | active | deprecated | superseded` (default `draft`) — `schema.ts:174`, mirrored `validate-frontmatter.mjs:45`.
- **Target**: `draft | active | deprecated | superseded | durable`, single-sourced in `vocabulary-core.mjs`.
- **Semantics of `durable`**: never-retire throughline; **published** (must satisfy `isPublished`, `metadata.ts:306`). Additive — no existing value's meaning or acceptance changes (NFR-002).
- **Validation**: any value outside the enum still fails with a clear message (spec Edge Cases).

## Entity: canonical vocabulary sets (single-sourced by #49)

Moved from triplicated consts into `vocabulary-core.mjs`:
- `STATUSES: string[]` (incl. `durable` after IC-04)
- `DOC_TYPES: string[]` (17 items)
- `KINDS: string[]` (13 items)
- `SECTION_TYPE: Readonly<Record<string,string>>` — frozen fallback map (used when `docs/_meta/sections.yaml` absent)

Data-file vocabulary (unchanged, stays on disk): `docs/_meta/sections.yaml` (per-section `type`), `docs/_meta/vocabulary.yaml` (aliases/forbidden).

## Contract: fs-free derivation core — `src/lib/vocabulary-core.mjs`

Pure, no `node:fs`, no Astro. Importable by `metadata.ts`, `schema.ts`, `vocabulary-loader.mjs`, and (indirectly) the gate.

```
export const STATUSES, DOC_TYPES, KINDS
export const SECTION_TYPE
export function expectedDocType(relPath, typesBySection = SECTION_TYPE, subtypesBySection?) : string | null
  // rules, most-specific first: registry subtypes → adr/plans/operations switch → sectionDefault → null
export function makeAxisResolver(spec) : { resolve(term) : { effective, forbidden } }
export function parseVocabulary(rawYaml, sourceLabel) : VocabularyResolver   // pure parse (string in, resolver out)
export function identityVocabulary() : VocabularyResolver                    // { resolveType, resolveKind } no-op
// index-basename detection (pure): isIndexPath, isRootIndex, detectIndexCollisions, ...
```

Types shipped via hand-written `vocabulary-core.d.ts` (no repo-wide `allowJs`).

## Contract: fs-loader layer — `src/lib/vocabulary-loader.mjs`

May use `node:fs`. Importable by `sections.ts` and `validate-frontmatter.mjs` (NOT by fs-free `metadata.ts`).

```
export function loadVocabulary(docsRoot) : VocabularyResolver        // reads <docsRoot>/_meta/vocabulary.yaml, else identity
export function loadSectionRegistry(docsRoot) : Registry | undefined // reads <docsRoot>/_meta/sections.yaml
export function sectionTypes(registry) : Record<string,string>
export function sectionSubtypes(registry) : Record<string, SubtypeRule[]>
```

Both layers imported by the bare-Node gate with plain `node` — no build/transpile (C-001).

## Entity: ADR entry (Hub card, #50)

Derived per rendered ADR child by the **shared extractor** exported from `generate-adr-index.mjs`:

| Field | Source | Use |
|---|---|---|
| `number` | ADR filename / heading (e.g. `ADR-0013`) | primary sort key (ascending) |
| `status` | body `## Status` section (Proposed/Accepted/Superseded/Deprecated) | badge |
| `date` | body/frontmatter date | shown beside status |
| `title`, `slug`, `kind` | frontmatter (`entry.data`) + `entry.body` for status | card label / gating |

- **Ordering**: ADR-kind children sort by `number` ascending; non-ADR listings keep alphabetical-by-title (C-005).
- **Fallback**: missing `number` or `## Status` ⇒ rendered unbadged / appended, never a hub break (spec Edge Cases).
- **Fidelity invariant (NFR-004)**: because Hub and the generated own-tree table call one extractor, ordering/status/date match 1:1.

## Contract: shared ADR extractor — `src/scripts/generate-adr-index.mjs`

```
export function extractAdrMeta(rawMarkdown, { slug, frontmatter }) : { number, status, date } | null
  // single source for BOTH the generated own-tree table and Hub.astro's ADR card
```
