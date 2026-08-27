# Contract — Glossary resolver (the one shared matcher)

**Owner**: IC-02 `src/lib/glossary/resolve.ts` (pure, Astro-free, vitest). ADR-0027 (D1/D6).

## Signature

```ts
type Resolution =
  | { kind: 'link'; context: string; anchor: string; termName: string }
  | { kind: 'unresolved'; surface: string; competing: string[] }
  | { kind: 'none' };

function resolveSurface(
  surface: string,               // the matched text (any case)
  pageContext: string | undefined,
  index: SharedTermIndex,
  ignoreList: ReadonlySet<string>,
): Resolution;
```

## Rules (each a unit test)

1. `surface` is lowercased before lookup; matching is **whole-word, case-insensitive**
   (FR-006). A substring inside a larger word never matches (guard is the caller's; the
   resolver receives already-word-bounded surfaces).
2. Ignore-listed surface → `{ kind: 'none' }` (FR-008).
3. Surface not in `index.bySurface` → `{ kind: 'none' }`.
4. Exactly one candidate context → `{ kind: 'link', … }` (FR-007).
5. Multiple candidates, `pageContext` is one of them → `{ kind: 'link', context: pageContext, … }`.
6. Multiple candidates, `pageContext` absent or not among them → `{ kind: 'unresolved',
   competing: sorted(candidateContexts) }` (FR-007; `competing` is deterministically ordered
   for the greppable warning, NFR-007).
7. Aliases resolve exactly like names (FR-012) — they share `index.bySurface`.
8. `anchor` is always `slug(termName)` — deterministic (NFR-004); `slug` is the shared
   `src/lib/glossary/anchor.ts`.

## Invariants

- **Pure**: no I/O, no Astro imports; same inputs → same output (NFR-004).
- **Single source of truth**: three runtime consumers call this — the auto-linker (IC-04),
  `:term` (IC-05), and the block's `linksForBody` re-derive (IC-07, via `computePageLinks`).
  The generator (IC-03) imports only `anchor.slug`, **not** `resolve.ts` — glossary
  cross-links on generated pages are produced by the auto-linker running over them at build
  (they self-declare `glossary_context`), so there is no IC-03→resolver edge (post-squad L-2).
