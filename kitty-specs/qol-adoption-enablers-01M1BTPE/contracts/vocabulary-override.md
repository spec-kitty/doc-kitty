# Contract — `_meta/vocabulary.yaml` + resolver (#40)

## File shape (`_meta/vocabulary.yaml`)
```yaml
# All keys optional; an absent file means "shipped defaults, Feature valid".
types:
  aliases:
    Feature: Mission        # authored OR derived "Feature" resolves to "Mission"
  forbidden:
    - Feature               # emitting an effective type of "Feature" fails
kinds:
  aliases: {}
  forbidden: []
```

## Resolver API (canonical, `src/lib/sections.ts`)
```
loadVocabulary(docsRoot): {
  resolveType(term: string | undefined): { effective: string | undefined, forbidden: boolean, aliasedFrom?: string }
  resolveKind(term: string | undefined): { effective: string | undefined, forbidden: boolean, aliasedFrom?: string }
}
```
- Reads `<docsRoot>/_meta/vocabulary.yaml` via the existing `gray-matter` YAML path (no new dependency).
- `default → consumer` overlay: shipped defaults first, consumer file overlays.
- A hand-mirrored twin lives in `src/scripts/validate-frontmatter.mjs` (same discipline as `sections.yaml`).

## Behavioral contract
1. **Order**: derive-if-absent (section registry) → `resolve*` (alias then forbidden) → validate.
2. **Authored AND derived**: `resolve*` is applied to the effective value regardless of whether it was authored or derived (FR-004).
3. **Absent file**: identity resolver; `Feature` stays valid (NFR-002).
4. **Malformed file**: throw a clear, actionable validation error (not a silent default).
5. **Parity**: mjs and ts produce identical `resolve*` results for identical YAML (NFR-004) — the parity test asserts on the resolved output, not the static default arrays.

## Test obligations
- Fixture: alias `Feature→Mission`, authored `type: Feature` → effective `Mission` (US2-1).
- Fixture: forbidden `Feature`, authored `type: Feature` → failure naming the replacement (US2-2).
- Fixture: alias `Feature→Mission`, `plans/features/` page with NO `type` → derived `Feature` resolves to `Mission`, no warning (US2-3, the derived-path case).
- Fixture: no file present → default vocabulary, `Feature` valid (US2-4).
- Parity: same YAML → mjs.resolve == ts.resolve (NFR-004).
