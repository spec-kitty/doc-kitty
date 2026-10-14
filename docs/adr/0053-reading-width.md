---
title: "ADR-0053: The reading column defaults to 60rem for all body content"
description: The default reading width rises from 45rem to 60rem and every kind of body content uses that one column, so wide tables, diagrams and code get the room too.
doc_status: active
updated: 2026-10-14
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0045-frame-width-token
  - architecture/theming
  - architecture/collapsible-toc-rail
---

# ADR-0053: The reading column defaults to 60rem for all body content

## Status

Accepted (2026-10-14).

Changes the reading-column figures that [ADR-0045](0045-frame-width-token.md)
measured (720px from 1600px). ADR-0045's frame, sidebar and rail decisions stand
unchanged; its measurements describe the layout of their time.

## Context

The reading column was `--dk-width-content: 45rem` (720px), Starlight's default.
Since ADR-0045 the page frame is full width, so on a 1440px to 2560px screen a
720px column sits centred in a large empty pane. Tables suffer most: Starlight
renders a table as a block that is exactly as wide as the column, so a table
with prose in its cells wraps every cell into a narrow strip. Issue 154 showed
it on a published site.

Line length, measured on the example's prose in the default font stack at 16px
(average glyph advance 7.1 to 7.8px):

| Token | Column | Characters per line |
|---|---|---|
| 45rem | 720px | 92 to 101 |
| 52rem | 832px | 106 to 117 |
| 56rem | 896px | 115 to 126 |
| 60rem | 960px | 123 to 135 |

The first design of this change kept the prose at 52rem and let only tables grow
past it, up to a new `--dk-width-wide` token. The operator rejected that: if
the space is available, all body content should use it, not only tables.

## Decision

1. **`--dk-width-content` defaults to 60rem (960px).** This is the operator's
   decision. It is a wider column for all content, not a column tuned for prose
   measure: at 123 to 135 characters per line it is well past the 45 to 90
   range usually advised for reading. The choice trades line length for room
   for tables, diagrams, code and components, and it is the value issue 154
   proposed.
2. **One column for everything.** Prose, tables, diagrams, code blocks and
   components share the column. There is no table-only breakout rule and no
   `--dk-width-wide` token.
3. **The column never sits under the rail.** The column is the smaller of
   `--dk-width-content` and the reading pane, and the pane lies between the
   sidebar and the "On this page" rail, expanded or collapsed. A capped
   `--dk-width-frame` shrinks the pane and so the column.
4. **Small screens are unchanged.** Below 72rem the column fills its pane, as
   before. The one visible change below 72rem is a window of about 1057 to
   1151px with a sidebar, where the pane is wider than 720px and the column
   now fills it.
5. **The default lives in two places that must agree:** the token sheet
   (`theme.css`) and the Default catalog (`theme.ts`).

## Consequences

Measured, default frame, rail expanded:

| Viewport | 1152px | 1280px | 1440px | 1600px | 1920px | 2560px |
|---|---|---|---|---|---|---|
| Reading column width | 528 | 656 | 816 | 960 | 960 | 960 |

- Every site gets the wider column. To keep the previous one:

  ```css
  :root { --dk-width-content: 45rem; }
  ```

- Lines of prose are long at 1600px and wider. A site that cares more about
  prose measure than room for tables sets a smaller token.
- The column ratchet in `tests/a11y/layout-geometry.spec.ts` moved from 720 to
  960px from 1600px, and the visual baselines on the home route need
  regenerating. `tests/a11y/reading-width.spec.ts` guards the column width, the
  restore line, and that the column stays out from under the rail.
- The header's search box aligns to the content width, so it moves with it.

## Alternatives considered

### 52rem prose with wide tables growing past it

The first design: prose at 52rem (106 to 117 characters), and a direct-child
table growing to `--dk-width-wide` (80rem) from 72rem. It kept a better prose
measure but needed a query container on the article panel, a registered
property, a right-to-left rule and a half-pixel caveat, and it left diagrams
and code blocks in the narrow column. Rejected by the operator in favour of one
wider column.

### A breakout grid on the article

Make the article a three-track grid and put wide blocks in the full track.
Grid items do not collapse margins, so the vertical rhythm of every page would
change. Too broad.

### A wrapper element around each table

A rehype step could wrap tables in a `<div>` that bleeds to the pane. It
changes the markup every adopter gets and adds a pipeline stage for what a
token does.

## References

- Issue 154, "Default reading column is too narrow on wide screens; tables are squashed".
- Mission `reading-width-01M4X4XG`: `kitty-specs/reading-width-01M4X4XG/research.md` and `research/code-grounding.md`.
- [ADR-0045](0045-frame-width-token.md), the frame-width token.
