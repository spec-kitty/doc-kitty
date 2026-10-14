# Code grounding: reading width and wide content (#154)

Mission `reading-width-01M4X4XG`. A read-only survey of `origin/main` at
`81e1663`, written before the spec. Toolchain: Astro 5.18.2,
Starlight 0.32.6, Playwright 1.62.1, Node 22.

## Files and responsibilities

| File | Responsibility | Touched by this mission |
|---|---|---|
| `src/styles/theme.css` | The token sheet (`customCss` slot 0). Declares `--dk-width-content: 45rem` once and bridges it to `--sl-content-width` on `:root`. A brand swap replaces this sheet. | Yes: the default value |
| `src/lib/theme.ts` | `DEFAULT_TOKENS` (`'--dk-width-content': '45rem'`) and the `--sl-*` bridge table that `resolveTheme` emits. Must agree with `theme.css`. | Yes: the default value only (shared with the #114 dispatch, which owns `resolveTheme`) |
| `src/styles/dk-components.css` | Layout geometry that survives a brand swap: `@property --dk-width-frame`, `--dk-frame-gutter`, `.main-frame` cap, sidebar and header insets, the rail pin and the reading-pane width (`html[data-has-toc] .main-pane`). | Yes: the wide-content rule lives here |
| `src/styles/toc-rail.css` | The collapsible rail: 1px hairline, the recentre rule at (0,4,1), the toggle anchor. | No |
| Starlight `ContentPanel.astro` | `.content-panel` (padding `--sl-content-pad-x`) wraps `.sl-container` (`max-width: var(--sl-content-width)`, `margin-inline: var(--sl-content-margin-inline, auto)` from 72rem). | Read only |
| Starlight `Page.astro` | `html:not([data-has-sidebar]) { --sl-content-width: 67.5rem }`: pages without a sidebar keep their own wider column, (0,1,1) beats our `:root` bridge. | Read only |
| Starlight `Header.astro` | The header grid uses `--sl-content-width` to align the search box over the column. A wider token moves the search box. | Read only (visual baseline moves) |
| Starlight `style/markdown.css` | `.sl-markdown-content table { display: block; overflow: auto }`. Tables scroll inside the column today; cells wrap first, which is the squash. | Read only |
| `tests/a11y/layout-geometry.spec.ts` | Bounding-box guard at 1152-2560px. `EXPANDED_MEASURE` pins the column (528, 656, 720, 720, 720) and A6 a 720px floor from 1600px. | Yes: rebaseline the measure deliberately |
| `tests/a11y/helpers/geometry.ts` | `measure()`; `column` is the `.sl-container` box. | Probably not; reuse |
| `tests/a11y/visual.spec.ts` | Two baselines (`home`, `chrome-1920`), both on the home route, which has a sidebar and a rail. Both move. | Baselines regenerated in the pinned container |
| `tests/a11y/routes.ts` | Routes and the axe page list. The overview page is not in `AXE_PAGES`. | Possibly (a route for the wide-table fixture) |
| `src/scripts/assert-chrome-artifacts.mjs` | Checks every token in its list is declared in the built CSS, and that `--sl-content-width` is bridged to `--dk-width-content`. It checks presence, not values. | Only if a token is added |
| `src/tests/layout-css-contract.test.ts` | Static CSS contract: frame token registered, `theme.css` and `resolveTheme` agree, geometry stays out of `theme.css`, logical properties only in geometry rules. | Must stay green; extend only if a new rule needs the same guarantees |
| `tests/consumption/scripts/assert-consumer-surfaces.mjs` | Packed-tarball consumer: frame cap token wins over the default. No content-width check. | No |
| `docs/architecture/theming.md` | Token table and the frame-width section, which states "column is at most `--dk-width-content` (45rem, 720px) ... 720px from 1600px". | Yes: rewrite for the new default and the restore line |
| `CHANGELOG.md` | `[Unreleased]` for 0.3.0 with a `### Changed` section. | Yes |
| `example/docs/architecture/overview.md` | Example page with a sidebar and a short outline. No table. | Yes: the wide-table fixture |

## Invariants that must survive

- **Three separated axes** (charter; ADR-0008 swappable theme layer). Geometry
  lives in `dk-components.css`, never in `theme.css`, so a brand swap keeps it
  (ADR-0045 and the comment block above the frame rules). The new rule goes in
  `dk-components.css`; only the token value changes in `theme.css`.
- **One token, two declarations that agree.** `theme.css` and `DEFAULT_TOKENS` in
  `theme.ts` carry the same default; `layout-css-contract.test.ts` checks that
  agreement for the frame token, and the same check fits the content width.
- **Frame and rail geometry (ADR-0045).** The rail is pinned to
  `--sl-sidebar-width` from 72rem, the reading pane is the rest of the frame,
  and the column centres in it. Assertions A1-A11 must keep passing unchanged,
  except the recorded column measure, which is a ratchet the mission moves on
  purpose.
- **Collapsed rail recentre at (0,4,1)** (`toc-rail.css`). Nothing new may
  outrank it on `.main-pane`.
- **Logical properties only** in geometry rules (FR-012 of the frame mission,
  checked by `layout-css-contract.test.ts`), so right-to-left pages mirror.
- **No horizontal page scroll** at 390-2560px on five routes (NFR-003 ratchet).
- **Below 72rem nothing changes** (issue #154, point 3). The column is
  pane-limited there; the 72rem breakpoint is where Starlight centres the column
  and pins the rail.
- **Docs convention** (`docs/context/convention.md`, ADR-0009): any touched page
  keeps `title`, `description`, `doc_status`, `updated`, and gets `updated`
  bumped.
- **ADRs are immutable** (charter). ADR-0045's 720px figures are measurements of
  its time; a new ADR records the new default rather than editing ADR-0045.
- **WCAG 2.2 AA** in both colour modes (axe lane). A table that scrolls must stay
  reachable; tables with wrapping cells do not scroll.

## Gates on these files and how each stays green honestly

| Gate | Command | Expected effect | How to keep it green |
|---|---|---|---|
| Vitest | `pnpm test` | `layout-css-contract` reads both sheets and `resolveTheme` | Update both declarations together; no assertion loosened |
| Lint, types | `pnpm lint`, `pnpm typecheck` | New spec must type-check | Write it in the existing helper style |
| Docs | `pnpm validate:docs`, `validate:example`, `validate:links`, `validate:adr-index`, `validate:catalog` | Frontmatter on touched pages, new ADR in the generated index | Bump `updated`; regenerate the ADR index with the script |
| Build artifacts | `pnpm build:a11y`, `assert:artifacts`, `assert:no-broken-links`, `assert-chrome-artifacts.mjs` | Token presence and bridge | No new token needs listing unless one is added; then add it to the list |
| Layout geometry | `pnpm test:a11y -- layout-geometry` | `EXPANDED_MEASURE` and A6 move | Re-measure and rewrite the ratchet and its evidence comment; keep the 1px tolerance |
| Visual | `pnpm test:a11y -- visual` | `home` and `chrome-1920` move | Regenerate through the `Update a11y baselines` workflow (pinned `mcr.microsoft.com/playwright:v1.62.1-noble`); local pixels differ by host fonts |
| Axe | `pnpm test:a11y -- axe` | None expected | Keep the fixture table wrapping (no scroll region) |
| Consumption | `consumption-test.yml` | None expected | No change to the frame token surface |

## Churn (`git log --since=90.days origin/main`)

| File | Commits | Latest |
|---|---|---|
| `src/styles/theme.css` | 8 | `d7167f1` full-width frame with an opt-in cap token (2026-10-13) |
| `src/lib/theme.ts` | 7 | `d7167f1` (2026-10-13) |
| `src/styles/dk-components.css` | 6 | `aab5b4b` Gherkin fences in any page (2026-10-14) |
| `src/styles/toc-rail.css` | 3 | `fdb7498` (2026-10-13) |
| `tests/a11y/layout-geometry.spec.ts` | 2 | `8b02cb2` right-to-left under a cap (2026-10-13) |
| `src/scripts/assert-chrome-artifacts.mjs` | 13 | `d7167f1` (2026-10-13) |
| `src/tests/layout-css-contract.test.ts` | 3 | `6ada4ef` (2026-10-13) |
| `docs/architecture/theming.md` | 10 | `1194b06` (2026-10-13) |
| `tests/a11y/visual.spec.ts` | 3 | `1194b06` (2026-10-13) |

The layout files settled one day ago with the frame mission
(`sidebar-frame-header-carrier-01M4T3CB`). Its geometry spec and evidence block
are the reference for how to record a deliberate ratchet move.

## Sibling dispatches

- **Gherkin** (#156, #123-#128): `src/lib/gherkin/**`, `src/tests/gherkin-*`. No
  file overlap. Behaviour interaction: `src/lib/gherkin/mdast.mjs` emits Examples
  as ordinary mdast tables, so on generated feature pages they are direct
  children of `.sl-markdown-content` and a wide-table rule reaches them. That is
  intended (they are tables); a narrow Examples table must render as today.
- **Docs** (#153): `docs/guides/consumer-setup.md`, the `src/lib/config.ts` doc
  comment. This mission avoids `consumer-setup.md` and documents the token in
  `docs/architecture/theming.md`.
- **Correctness** (#114, #112): `resolveTheme` in `src/lib/theme.ts`, glossary
  generation, sidebar. This mission changes only the `--dk-width-content` line in
  `DEFAULT_TOKENS` (and, if one is added, the adjacent width token).
- **Shared risk**: the visual baselines. If another dispatch lands a baseline
  change first, rebase onto main and regenerate once.

## Measurement (2026-10-14, built example, Chromium headless, 16px body)

Column width (`.sl-container`) on the home route (sidebar and rail) and a
sidebar-only page, injecting each candidate as `:root { --dk-width-content }`:

| Viewport | Home, 45rem | Home, 52rem+ | Sidebar-only, 52rem | Sidebar-only, 60rem |
|---|---|---|---|---|
| 1280 | 656 | 656 | 832 | 944 |
| 1440 | 720 | 816 (pane-limited) | 832 | 960 |
| 1920 | 720 | 832 / 896 / 960 / 1024 for 52 / 56 / 60 / 64rem | 832 | 960 |
| 2560 | 720 | same as 1920 | 832 | 960 |

Characters per line, from the average glyph advance of each page's own prose
(7.10-7.82px at 16px in the default font stack):

| Width | Pixels | Characters per line |
|---|---|---|
| 45rem | 720 | 92-101 |
| 52rem | 832 | 106-117 |
| 56rem | 896 | 115-126 |
| 60rem | 960 | 123-135 |

Readings: the 45rem default already sits at the top of the usual 45-90
character range. At 1440px a page with a sidebar and a rail cannot show more
than 816px however large the token is, so any value from 51rem fills the pane
there; the value only matters from about 1600px.
