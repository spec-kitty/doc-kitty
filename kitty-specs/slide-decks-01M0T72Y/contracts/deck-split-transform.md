# Contract: deck-split remark transform

**Module**: `src/lib/remark/deck-split.ts` (plugin) + `deck-split.internal.ts` (pure helpers)
**Invoked**: in the Astro remark chain, for every Markdown page.

## Guard

```
if (file.data.astro?.frontmatter?.kind !== 'Presentation') return;  // no-op on docs
```

Off a deck the tree is untouched: `---` renders `<hr>`, comments stay comments, `Note:` is
prose. (C-005.)

## Input → Output

- **Input**: mdast `root` for a `kind: Presentation` page + its frontmatter.
- **Output**: `root.children` replaced by an ordered list of slide nodes
  (`{ type:'deckSection', data:{ hName:'section', hProperties } , children }`) that
  `mdast-util-to-hast` renders as `<section>`s. The layout wraps them in `.reveal > .slides`.

## Grouping rules (pure — unit-tested)

| Input node | Effect |
|---|---|
| content before first `##` | first horizontal section = **title slide** (heading from `title`) |
| heading depth 2 (`##`) | close current horizontal; open new horizontal |
| heading depth 3 (`###`) | convert current horizontal → **stack**: its content becomes inner #1; open inner for the `###` |
| `thematicBreak` (`---`) | close current; open **headingless** horizontal; **drop** the node; set `aria-label` |
| heading depth ≥4 (`####`) | stay **inside** the current slide |
| any other node | append to current slide |

**Stack invariant**: an outer stack `<section>` contains **only** inner `<section>`s (no
loose prose). **Order invariant**: document order preserved.

## Directives + notes (same pass)

- `html` node matching `/^<!--\s*\.slide:\s*(.+?)\s*-->$/` → parse attrs, merge onto the
  **enclosing section** `hProperties`; remove node.
- `html` node matching `/^<!--\s*\.element:\s*(.+?)\s*-->$/` → merge onto **preceding
  sibling** `hProperties`; no sibling → `file.message()` warn + skip; remove node.
- paragraph whose first text starts `Note:` → `deckNote` (`hName:'aside'`,
  `className:['notes']`, `data-pagefind-ignore`), direct child of the section.
- unknown directive key → `file.message()` warn; **never throw**.

## Unit-test matrix (vitest, Astro-free)

title-slide from frontmatter · `##` split count/order · `###` stack conversion + only-inner
invariant · `---` headingless + `aria-label` + no `<hr>` · `####` stays in-slide · `.slide`
attrs on section · `.element` attrs on preceding block · `.element` no-sibling warn ·
`Note:` → aside child · unknown-directive warn (no throw) · **guard**: non-Presentation page
unchanged (`---`→`<hr>`).
