# Data Model — Documentation Charter

The charter is data, not code. This model describes the authoritative
`_meta/charter.yaml` shape, the resolved (effective) charter, and the resolution
rules. Types are illustrative (JSDoc-const / zod discipline, not new `.d.ts`).

## Entity: Charter (authoritative `_meta/charter.yaml`)

All keys optional; an absent key means "canonical default for that axis". An
empty file ≡ absent (identity/defaults).

```yaml
# _meta/charter.yaml
version: 1                     # charter schema version (integer; forward-compat)
vocabulary:                    # absorbs today's _meta/vocabulary.yaml
  types:                       # extend/alias/forbid over DOC_TYPES
    aliases:   { Feature: Capability }
    forbidden: [ Feature ]
  kinds:                       # extend/alias/forbid over KINDS
    aliases:   {}
    forbidden: []
statuses:                      # NEW — extend-only over canonical STATUSES
  add: [ deprecated ]          # additive only; canonical values are reserved
required_fields:               # NEW — relaxation list (title is a hard floor)
  optional: [ updated ]        # fields allowed to be absent for this consumer
sections:                      # absorbs today's _meta/sections.yaml
  index_basename: README       # or "index"
  order: [ context, architecture, adr, ... ]
  entries:
    - { id: context, label: Context, type: Context, purpose: "...", feeds: [rss] }
  subtypes: { ... }
```

### Field validation & invariants
| Field | Rule / Invariant | On violation |
|---|---|---|
| `version` | integer; known/forward-compatible | fail closed (FR-010) |
| `vocabulary.types/kinds` | alias target not also forbidden; term not both aliased & forbidden | fail closed (existing `parseVocabularyAxis` semantics) |
| `statuses.add` | additive only; MUST NOT remove/forbid/alias-away a canonical `STATUSES` value | fail closed with reserved-status message (C-004) |
| `required_fields.optional` | MUST NOT include `title` | fail closed with floor message (C-005) |
| `sections.*` | same shape as legacy `sections.yaml` entries | fail closed on malformed |
| any unknown top-level key | warn (forward-compat), not fail | warning |

## Entity: ResolvedCharter (effective, derived-but-committed)

Produced by `parseCharter(raw)` in the fs-free core; identical shape whether it
came from `charter.yaml` or (back-compat) the legacy files.

```
ResolvedCharter = {
  resolveType(term)   -> canonical | alias-target | FORBIDDEN
  resolveKind(term)   -> canonical | alias-target | FORBIDDEN
  resolveStatus(term) -> legal (canonical ∪ added) | UNKNOWN(warn)
  legalStatuses       -> string[]  (canonical ∪ added)
  sections            -> registry (order, entries, indexBasename, subtypes)
  requiredFields      -> { required: string[], floor: ['title'] }
  sourceMeta          -> { fromCharter: bool, legacyPresent: bool }
}
```

### Resolution rules (deterministic — D-02)
1. If `_meta/charter.yaml` present and declares an **axis**, that axis is taken
   **entirely** from the charter (no merge with legacy for that axis).
2. For any axis the charter omits (or if no charter file), fall back to the
   legacy file for that axis (`vocabulary.yaml` / `sections.yaml`), else to the
   canonical shipped default.
3. `resolveStatus`: legal = canonical `STATUSES` ∪ `statuses.add`; canonical
   values can never be removed.
4. `requiredFields.required` = canonical required set minus
   `required_fields.optional`, but `title` is never removed.
5. Section order: charter/registry order if present; else frozen `SECTION_ORDER`
   fallback (D-05).
6. Resolution is order-independent and stable across builds (NFR-007).

## State / lifecycle
The charter has no runtime state; it is read at build/validate time. The only
"transition" is **migration**: legacy `_meta/{vocabulary,sections}.yaml` →
`_meta/charter.yaml` (behavior-preserving, quickstart + migration guide).

## Reserved / floor constants (cannot be overridden)
- **Reserved statuses**: the canonical `STATUSES` tuple (incl. `draft`,
  `published`, `durable`) — extend-only.
- **Floor required field**: `title`.
