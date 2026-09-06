# Research: Glossary builder ergonomics (#83)

No NEEDS CLARIFICATION markers and no dependency decision; research is confined
to the three design points the implementer needs pinned.

## D1 — Home for the one subtree-text helper

- **Decision**: export the helper from `src/lib/glossary/link-node.ts`, where
  the aria-label variant already lives; both remark modules already import
  that module, so consolidation adds no new import edge.
- **Rationale**: lowest churn; the helper is a 5-line pure function whose only
  consumers are the shared builder and the two remark plugins.
- **Alternative considered**: a dedicated `src/lib/glossary/node-text.ts`.
  Rejected for now — one more file for one function, and it would make
  `link-node.ts` import its own sibling for a helper it defined first. Cheap to
  split later if a fourth consumer appears outside the glossary lib.
- **Semantics pinned**: `text` nodes are leaves (return `value` when it is a
  string, else `''`); every other node concatenates its `children` in order.
  This matches the two recursive `textOf` variants exactly, and matches the
  visit-based `textContent` for all real mdast input (text nodes never carry
  `children`; `value` is always a string).

## D2 — Why the double-cast is needed, and the one-line fix

A `tsc` probe against the current types:

| Assignment | Result |
|---|---|
| `GlossaryLinkNode` → `MdNode` | **error** — "Index signature for type 'string' is missing in type 'GlossaryLinkNode'" |
| `LinkChild` → `MdNode` | ok |
| type-alias literal of the same shape → `MdNode` | ok |
| `MdNode` → `LinkChild` (the argument direction) | ok |

- **Decision (revised after the pre-PR squad)**: declare `GlossaryLinkNode`
  as a `type` alias of the same shape. Both callers then hold the builder's
  return value with no cast.
- **Rationale**: TypeScript gives object-literal *type aliases* an implicit
  index signature but never *interfaces*; the callers' `MdNode`/`MdastNode`
  both declare `[key: string]: unknown`, so an interface source would need an
  explicit one. The first cut did exactly that; the squad (paula-patterns,
  reviewer-renata, debugger-debbie, independently) showed an explicit index
  signature also disables excess-property checking on the builder's own
  `return {…}` literal (a typo key compiles clean), whereas the alias keeps
  that check while being equally assignable. The runtime object is unchanged
  either way.
- **Alternative considered**: widen the callers' interfaces (drop their index
  signatures). Rejected — those index signatures are what let the walkers
  ride along unknown mdast fields; removing them would ripple through
  `visit`/`linkifyNode` and the sibling plugins' precedent.
- **Alternative considered (first cut)**: keep the `interface` and add an
  explicit `[key: string]: unknown`. Assignable, and stylistically consistent
  with `LinkChild`, but it costs the excess-property check above. Rejected
  after the squad measured that cost.

## D3 — Caret-offset lower bound for the e2e nit

`preview-popover.client.ts` clamps the caret's x offset to
`[CARET_HALF_PX, popover.offsetWidth - CARET_HALF_PX]` with `CARET_HALF_PX = 8`
and writes it as `${n}px`. The tightened assertion therefore checks the
property matches `/^\d+(\.\d+)?px$/` and parses to a number ≥ 8. That is the
documented clamp, not a magic number; it fails on `0px` (the A4 false-green)
while never failing a correctly clamped popover of any width.

## D4 — The rss.xml oracle outlier (found during verification)

The hashed-corpus oracle showed 233/234 files identical; `rss.xml` differed.
Investigation (debugger-debbie lens, confirmed by the orchestrator): the feed
is built from frontmatter only, so nothing in this diff can reach it. The
delta is a pure **reordering** of tied items: `rankForFeed` sorts by
`updatedMillis` only, so ties fall through to content-layer insertion order,
which is the completion order of a 10-way concurrent glob/render pool. A
`tinyglobby` probe over `example/docs` returned 16 distinct orders in 20
calls; two builds of the unchanged pre-change tree produced two different
`rss.xml` hashes; the sorted `<item>` multiset and the envelope are identical
between pre- and post-change builds. Filed as a follow-up (make the
comparator total with a slug tiebreak); out of scope here (C-003).
