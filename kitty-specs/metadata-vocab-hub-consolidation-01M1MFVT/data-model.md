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

Types come from the `.mjs` source itself under the repo-global `allowJs`: enum arrays are JSDoc-const literal tuples (`export const STATUSES = /** @type {const} */ ([...])`) so `z.enum(STATUSES)` and `typeof STATUSES[number]` work; **no `.d.ts` sidecar** (ignored for a `.mjs` specifier). `metadata.ts` derives `DocStatus = typeof STATUSES[number]` / `DocType = typeof DOC_TYPES[number]` — no hand-listed union twin. (Squad-corrected, research.md §D4/F6-F8.)

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
- **Inclusion (squad F5/F6)**: Hub's ADR group **excludes** number-less pages and `type:Template`, exactly as the generator's `discoverAdrs` does — so the two sides list the same set. Empty/unparseable `## Status` ⇒ rendered unbadged (not excluded). `number` comes ONLY from `extractAdrMeta` (same input on both sides), never a Hub-local parse.
- **Fidelity invariant (NFR-004)**: because Hub and the generated own-tree table call one extractor over the same inclusion rule, ordering/status/date match 1:1 **over the published+numbered set**. A draft numbered ADR appears in the generated table but not the (isPublished-filtered) hub — the invariant is scoped accordingly, not asserted across that gap.

## Contract: shared ADR extractor — `src/scripts/generate-adr-index.mjs`

```
export function extractAdrMeta(rawMarkdown, { slug, frontmatter }) : { number, status, date } | null
  // SOLE source of number + status + date for BOTH the generated own-tree table
  // and Hub.astro's ADR card. `number` derived from the NNNN- prefix carried by
  // slug/basename identically on both sides (returns null → excluded, matching discoverAdrs).
```
