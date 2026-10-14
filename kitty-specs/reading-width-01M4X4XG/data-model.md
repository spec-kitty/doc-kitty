# Data model: Wider reading column and room for wide content

The mission's "data" is two public design tokens and the boxes they size.

## Tokens

| Token | Default | Accepts | Read by | Notes |
|---|---|---|---|---|
| `--dk-width-content` | `52rem` (was `45rem`) | a length | `--sl-content-width` (bridge in `theme.css`), so Starlight's `.sl-container` max width and the header grid | Declared in `theme.css` `:root` and `DEFAULT_TOKENS` in `src/lib/theme.ts`; the two must agree |
| `--dk-width-wide` (new) | `80rem` | a length | the wide-table rule in `dk-components.css` | Same two declarations. At or below the column width, growth is off |

Restore the previous look: `:root { --dk-width-content: 45rem; }`.
Turn table growth off: `:root { --dk-width-wide: 0; }`.

## Boxes (from 72rem)

| Box | Width |
|---|---|
| reading pane (panel content box, `100cqi`) | frame − sidebar − rail (when expanded) − 2 × `--sl-content-pad-x` |
| reading column | `min(pane, --dk-width-content)`, centred in the pane |
| direct-child table | `clamp(column, max-content, min(pane, --dk-width-wide))`, centred on the column |

## Invariants

- table start ≥ pane start and table end ≤ pane end (both directions, both rail states).
- |table centre − column centre| ≤ 1px.
- a table whose natural width ≤ column: table box = column box.
- below 72rem: table box = column box.
