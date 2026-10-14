# Layout contract: reading column and wide tables

The externally visible surface of this mission is CSS behaviour a site owner can
rely on and override. There is no API or event.

## C-1 Tokens

- `--dk-width-content` defaults to `52rem` in both `src/styles/theme.css` and
  `resolveTheme(undefined).tokens`.
- `--dk-width-wide` defaults to `80rem` in both, and appears in the token list of
  `assert-chrome-artifacts.mjs`.

## C-2 Wide-table rule (>= 72rem only)

Applies to `table` elements that are direct children of `.sl-markdown-content`
and not inside `.not-content`. Lives in `src/styles/dk-components.css` (survives
a brand swap). Uses logical properties and `:dir(rtl)`; no `html[dir]` selector.
Does not select `.main-pane`, so the collapsed-rail recentre rule is untouched.

## C-3 Observable geometry (asserted by `tests/a11y/reading-width.spec.ts`)

| Case | Expectation (1px tolerance) |
|---|---|
| 1440px, sidebar + rail | column = pane |
| 1920px, sidebar + rail | column = 832px, centred in the pane |
| 1920px expanded / collapsed, LTR / RTL | wide table wider than the column by >= 100px, inside the pane, centred on the column |
| 2560px collapsed | wide table <= `--dk-width-wide` |
| any width | a table narrower than the column starts at the column start |
| 390, 768, 1024px | table box = column box |
| all of the above | document scroll width = viewport width |
| `--dk-width-content: 45rem` at 1920px | column = 720px |
