# Research: Wider reading column and room for wide content

Mission `reading-width-01M4X4XG`. Spikes run 2026-10-14 against the built
example (`pnpm build:a11y`), Chromium headless 1194, by injecting CSS and
markup with Playwright. Probes lived in the session scratchpad. The code survey
and the line-length measurement are in
[research/code-grounding.md](./research/code-grounding.md).

## R1 — Default reading width

**Decision**: 52rem (832px at 16px).

**Rationale**: 45rem already gives 92-101 characters per line in the default
font stack; 60rem gives 123-135. A page with a sidebar and a rail is limited by
its pane to 816px at 1440px, so any value from 51rem fills the pane there. 52rem
is the smallest value that does, at 106-117 characters per line (NFR-004 bound:
120). Tables, which are what the issue shows squashed, get extra room from R2
rather than from a wider prose column.

**Alternatives considered**: 56rem (115-126 characters, gains nothing at 1440px);
60rem (the issue's proposal; 123-135 characters). Both remain one-token
overrides for a site that wants them.

## R2 — Wide content

**Decision**: From 72rem up, a table that is a direct child of
`.sl-markdown-content` gets `width: max-content`, `min-width: 100%`, and
`max-width: min(100cqi, var(--dk-width-wide))`, with `.content-panel` as an
inline-size query container. It is centred on the column by
`position: relative; inset-inline-start: 50%; translate: -50%`, and
`translate: 50%` when the table's direction is right-to-left (`:dir(rtl)`).

**Rationale**:

- `100cqi` is the panel's content box: the reading pane minus its padding. It
  never includes the rail, expanded or collapsed, capped frame or not.
- `min-width: 100%` keeps a narrow table's box equal to the column, so the
  relative offset and the translate cancel exactly and it renders as today
  (FR-006). `min-width` beats `max-width`, so `--dk-width-wide` at or below the
  column width switches the growth off (FR-004).
- The column is centred in the pane from 72rem (`--sl-content-margin-inline:
  auto`), so centring the table on the column keeps it symmetric and inside the
  pane. Below 72rem the column is start-aligned and pane-limited, so the rule
  does not apply there (FR-005).
- Spike at 1920px, rail expanded: pane 312-1608, column 544-1376, wide table
  320-1600 (1280px, the cap), centre 960; narrow table 544-1376. Collapsed:
  table 464-1744 inside the 1px hairline at 1919. 2560px collapsed: 1280px wide.
  Right-to-left: table 320-1600, narrow table unchanged. Document scroll width
  equals the viewport in every case.
- Starlight sets `dir` on `<main>` from the page language, so an `html[dir]`
  selector is the wrong signal; `:dir(rtl)` on the table reads its actual
  direction. A test that simulates right-to-left must set `dir` on `<main>` too.

**Alternatives considered**:

- Breakout grid on `.sl-markdown-content` (full-width grid, prose in the middle
  track): changes margin collapsing for every element on every page; rejected as
  too broad.
- Negative inline margins to the pane: needs the table's own width in `calc()`,
  so narrow tables would shift; rejected.
- A rehype wrapper `<div>` around each table: works, but adds a pipeline step
  and changes the markup contract for every adopter; rejected for a CSS-only
  fix.
- Growing diagrams and code blocks too: diagrams already scale to fit and
  code blocks scroll by convention; Mermaid's SVG sizing makes `max-content`
  unreliable. Out of scope.

## R3 — Containment side effects

**Decision**: Accept `container-type: inline-size` on `.content-panel`.

**Rationale**: It adds layout, style and inline-size containment. The panel's
width comes from its parent, never its content, so inline-size containment
changes nothing. Layout containment makes it the containing block for
positioned descendants: inside the panel those are only visually-hidden spans
(1px, clipped). The glossary popover is appended to `<body>`. No existing CSS
uses container queries. The existing no-horizontal-scroll and layout-shift
tests cover regressions.

## R4 — Baselines

**Decision**: Regenerate `home` and `chrome-1920` through the
`Update a11y baselines` workflow dispatched against this branch, then merge its
branch into this one.

**Rationale**: Both are taken on the home route, whose column changes at 1440px
and up. The workflow runs in the same pinned image as the a11y lane, so the
pixels match CI; local screenshots differ by host fonts.

## Supply chain

No dependency is added, upgraded or removed.
