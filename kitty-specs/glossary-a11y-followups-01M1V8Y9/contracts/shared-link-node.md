# Contract: shared glossary link-node builder + a11y affordance

## The one builder (IC-01, FR-003, C-001)

```ts
// src/lib/glossary/link-node.ts
export function glossaryLinkNode(
  context: string,
  contextSlug: string,
  anchor: string,
  termName: string,
  children: LinkChild[],   // visible-label mdast nodes
  basePrefix: string,
): GlossaryLinkNode
```

- Returns a `link` node with `url = glossaryTermUrl(basePrefix, contextSlug,
  anchor)` and the `hProperties` bag in the data model.
- **Both** `makeLinkNode` (auto-linker) and `glossaryLinkNode` (`:term`) MUST
  delegate to this function. No second inline builder may remain (C-001).
- Auto-linker call site wraps its `surface: string` as
  `children = [{ type: 'text', value: surface }]` (only per-caller delta).
- Href stays single-sourced through `glossaryTermUrl` (C-004) — the builder does
  not re-implement URL construction.
- The return type is a minimal structural node shape assignable to both callers'
  local `MdNode` / `MdastNode` interfaces (no `@types/mdast` dependency, D3).

## The a11y affordance (IC-02, FR-001/002/005, NFR-005, C-002)

- `hProperties['aria-label'] = `${visibleText}, glossary term`` where
  `visibleText` is the concatenated text of `children`.
- MUST be an attribute only — no extra `text` child node (FR-005: the
  `textContent`-based links-used surface and its count-pins are unchanged).
- MUST lead with the exact visible text (NFR-005: accessible name stays in sync).
- Present in server-rendered HTML with JS disabled (FR-002).
- Applied uniformly to auto-links and `:term` links → the cross-emitter parity
  test asserts both bags include the identical `aria-label` (NFR-001).

### Acceptance (unit + build)

- `glossary-link-node-parity.test.ts`: both emitters' nodes are deep-equal,
  including `aria-label`. (extend existing test)
- `glossary-autolink.test.ts` / `glossary-term.test.ts`: golden literal updated to
  include `aria-label`. (update existing tests)
- `glossary-substrate-parity.test.ts`: still green, no new keyed exclusion. (must
  not need edits — if it does, that is a red flag the affordance leaked into a
  build-time stage the re-derive does not mirror)
- Built demonstrator HTML: every `a[data-glossary-term]` has
  `aria-label$=", glossary term"`; ordinary content links have none.

## The placement/caret e2e guard (IC-03, FR-004, SC-002)

- In `tests/a11y/glossary.spec.ts`, in both colour modes:
  - a glossary term with ample space below → after open,
    `popover` has `data-placement="bottom"`.
  - a glossary term forced low in the viewport → after open, `popover` flips to
    `data-placement="top"`.
  - caret presence proxy: the popover carries the `--dk-glossary-caret-left`
    custom property, and the active-placement `::after` pseudo-element has a
    non-`none` computed `border-*-color`.
- The existing count-pins (4 term anchors, 3 `cargo`, 1 `hr` policy, 2 distinct
  links-used) MUST remain unchanged (SC-004).
