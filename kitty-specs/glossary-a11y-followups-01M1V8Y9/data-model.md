# Data Model: Glossary a11y follow-up cluster

This mission has no new persisted data. The one "entity" is the in-memory mdast
glossary link node both emitters produce.

## Glossary link node (mdast `link`)

| Field | Value | Change this mission |
|-------|-------|---------------------|
| `type` | `'link'` | unchanged |
| `url` | `glossaryTermUrl(basePrefix, contextSlug, anchor)` → `/[base]/glossary/<contextSlug>/#<anchor>` | unchanged (single-sourced, C-004) |
| `children` | visible-text nodes (auto-linker: `[{type:'text',value:surface}]`; `:term`: its label children) | unchanged |
| `data.hProperties.class` | `'dk-glossary-link'` | unchanged |
| `data.hProperties['data-glossary-term']` | term name | unchanged |
| `data.hProperties['data-glossary-context']` | context **name** (hover payload key) | unchanged |
| `data.hProperties['data-glossary-anchor']` | de-collided anchor (issue #17) | unchanged |
| `data.hProperties['data-glossary-context-slug']` | de-collided page slug (issue #17) | unchanged |
| `data.hProperties['aria-label']` | **NEW** — `"<visible text>, glossary term"` | **added (IC-02)** |
| `target` / `rel` | absent (internal same-tab link, #64 FR-004) | unchanged (still absent) |

**Visible text** = concatenation of the text descendants of `children` — the same
value the auto-linker uses as `surface` and the same value `collectLinksUsed`
records via `textContent`. The `aria-label` reuses this so it can never disagree
with the used-list surface or the visible/spoken name.

## Ordering / byte-identity invariant (NFR-003)

The `hProperties` bag is emitted with a stable key order. Adding `aria-label` is
the *only* permitted byte delta in the glossary corpus this mission. Placement of
the key within the bag is not observable in rendered HTML attribute order in a way
the gates assert, but keep it adjacent to the other a11y-relevant keys for
readability; the parity test compares the bags by value equality, not key order.

## Producers / consumers (unchanged topology)

- **Producers**: `glossary-autolink.internal.ts` (`makeLinkNode` → shared builder),
  `glossary-term.ts` (`glossaryLinkNode` → shared builder).
- **Consumers**: the hover island (`preview-popover.client.ts`, keys on
  `data-glossary-*`), `collectLinksUsed` (keys on `data-glossary-term`, reads
  anchor/slug), the no-JS fallback, and the render-time re-derive
  (`REDERIVE_REMARK_PLUGINS`). None reads `aria-label`; the new attribute is inert
  to every existing consumer, which is why NFR-002 (re-derive parity) holds with no
  new keyed exclusion.
