# Contract: the one glossary subtree-text helper + cast-free builder type (#83)

## `textOf` (FR-001/FR-002, C-001)

```ts
// src/lib/glossary/link-node.ts
export function textOf(node: LinkChild): string
```

- THE single place the glossary derives a node's plain text. Consumers (all
  three MUST import it; no private copy may return):
  - the shared builder's `aria-label` visible text (`glossaryLinkNode`),
  - the auto-linker's links-used surface and per-section already-linked seed
    (`glossary-autolink.internal.ts` `collectLinksUsed` / `seedFromExistingLinks`),
  - the `:term` directive's label, warning strings, suppress form and fallback
    label (`glossary-term.ts` `transformDirective`).
- Semantics: a `text` node is a leaf whose `value` contributes only when it is
  a string (else `''`); every other node concatenates `textOf(child)` over its
  `children` in document order; a node with neither yields `''`. Text that
  lives only in `data.hChildren` (e.g. the Markua `markuaSpan` leaf) is not
  seen — a pre-existing, documented blind spot shared by all former copies.
- Parameter is the minimal structural `LinkChild`; both callers' local
  `MdNode` / `MdastNode` nodes are accepted with no cast.
- Out of scope: `src/lib/remark/markua-callouts.internal.ts` keeps its own
  `textOf` (includes `inlineCode`, trims) — different semantics, different
  bounded context (C-003). Do not fold.

## `GlossaryLinkNode` assignability (FR-003, C-002)

- `GlossaryLinkNode` is a `type` alias (not an `interface`). A type alias
  carries TypeScript's implicit string index signature, so the builder's
  return value is assignable to both callers' local `MdNode` / `MdastNode`
  (which declare `[key: string]: unknown`) with **no cast**, while the alias
  keeps excess-property checking on the builder's own `return {…}` literal.
  An explicit `[key: string]: unknown` on an interface would also be
  assignable but would silently accept a typo'd extra key (squad-verified).
- Both remark call sites return `glossaryLinkNode(...)` directly. Any
  reappearance of `as unknown as` there is a regression.
- No `@types/mdast` dependency (D3 of the #77/#79 plan).

### Acceptance (unit + typecheck + build)

- `tsc --noEmit -p src/tsconfig.json`: no error in `lib/glossary/` or
  `lib/remark/`; a typo key on the builder literal is rejected (TS2353).
- `pnpm test`: parity guards + goldens green, unchanged.
- Clean `example/dist` rebuild hash-identical to the pre-change build (the
  RSS feed compares equal after sorting items; see research D4 / #85).
