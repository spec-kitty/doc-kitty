# Contract — Definitions loader + validation

**Owner**: IC-01 `src/lib/glossary/load.ts` (+ `load.internal.ts` pure, vitest). ADR-0026.

## Signature

```ts
type LoadResult =
  | { present: false }                                  // no .contextive/definitions.yaml
  | { present: true; index: SharedTermIndex };          // parsed + validated

function loadGlossary(root: string): LoadResult;        // throws on invalid (build-fatal)
```

## Rules

1. **Presence-gated** (FR-001): absent file → `{ present: false }`; every downstream seam
   early-returns; build succeeds, no `/glossary/` route, no auto-links, no new frontmatter
   (INV-G4, NFR-002).
2. **Parse once** (INV-G1): YAML → validated model → `SharedTermIndex`, built a single time
   and shared (NFR-004, D6).
3. **Schema validation** (FR-002): validate against the pinned Contextive Community schema
   (zod). On any violation **throw** with a message naming the offending
   `context[/term[/field]]`. The build fails (not a warning).
4. **Scheme safety** (FR-004, INV-G6): every URL value in any term's `meta` passes the
   shared `safeHref` allowlist (`http:`/`https:`/`mailto:`/no-scheme); a non-allowlisted
   scheme (`javascript:`, `data:`, protocol-relative) is **build-fatal**.
5. **Index shape**: lowercased `bySurface` (names + aliases together), per-context term
   lists, deterministic `slug(name)` anchors (see `resolver.md`, `data-model.md`).

## Invariants

- Astro-free and unit-tested (`load.internal.ts`); the thin `load.ts` only does file I/O +
  presence gating.
- Malformed fixture (`example/tests/fixtures/definitions.malformed.yaml`) proves rule 3
  (FR-014) and is kept out of the normal build.
