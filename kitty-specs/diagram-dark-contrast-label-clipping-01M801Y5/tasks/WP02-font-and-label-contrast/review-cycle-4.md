---
affected_files: []
cycle_number: 4
mission_slug: diagram-dark-contrast-label-clipping-01M801Y5
reproduction_command:
reviewed_at: '2026-11-22T07:12:25Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP02
---

# WP02 review cycle 3 (author edge colours): REQUEST_CHANGES (reviewer: claude::reviewer-renata)

Reviewed lane-b at 33a1421: 6fb4c8b (red) and 33a1421 (fix), against the operator ruling of
2026-11-22. That ruling says to keep the author's edge colour where it is readable, and to use the
themed edge colour only where the author's colour is under 3:1 against the worst page.

## Blocker

1. **`edgeThemesToOverride` tests each edge against its BEST page, not its worst.**
   File: `src/lib/rehype/diagram-label-contrast.ts`.

   The function checks an edge colour against pure black for dark mode and pure white for light
   mode. That borrows the label argument from cycle 2, but the argument does not carry over:

   - For labels it works because the label colour is itself black or white, the extremes. Black
     text is weakest on the darkest backdrop, and white text on the lightest.
   - An edge colour can be any colour. Contrast between the edge and a page is lowest when the
     page's luminance is closest to the edge's. For almost every edge colour, the edge is LIGHTER
     than every dark page, so the worst dark page is the LIGHTEST dark surface, not pure black.
     Pure black is that edge's most favourable dark page. Light mode mirrors this: the worst light
     page for a mid-tone edge is the darkest light surface.

   Reproduced with the module's own export against the toolkit's default surfaces in
   `src/styles/theme.css`: the dark page `--dk-color-bg: #131721`, and the light cluster fill
   `--dk-diagram-cluster-fill: #eef1f6`, which edges inside a subgraph cross.

   | Author edge colour | Overrides applied | Dark page `#131721` | Light cluster `#eef1f6` |
   |--------------------|-------------------|---------------------|-------------------------|
   | `#5c5c5c`          | none              | **2.68:1**          | 5.91                    |
   | `#606060`          | none              | **2.85:1**          | 5.55                    |
   | `#949494`          | none              | 5.91                | **2.68:1**              |
   | `#d9731a` (WP01 fixture linkStyle) | none | 5.47             | **2.89:1** (3.14 on the white page) |

   So a `linkStyle stroke:#5c5c5c` keeps a 2.68:1 edge on the toolkit's own default dark page.
   That is exactly the defect class the ruling asks to fix. The fixture can't show it because its
   colours, `#0a0721` and `#f5f5f5`, sit at the extremes, where black and white really are the
   worst pages.

   Fix (one way to do it):
   - Per theme, judge the edge against the RANGE of pages that theme can show:
     - dark: luminance from 0 (pure black) up to the lightest dark surface an edge can cross, at
       least `--dk-color-bg` dark and `--dk-diagram-cluster-fill` dark (any brand's dark page
       should sit inside it; state the bound);
     - light: from the darkest light surface an edge can cross (`--dk-diagram-cluster-fill`
       light, `#eef1f6`) up to white.
   - Contrast over a luminance range is lowest at one of its two ends, or is 1 if the edge's
     luminance falls inside the range. So override when the minimum over both ends is under 3:1,
     or when the edge sits inside the range.
   - A translucent stroke: blend over each end, as now.
   - Add unit cases for `#5c5c5c` (dark override), `#949494` (light override), and a colour kept
     in both themes. Consider swapping one fixture edge for a mid-tone colour so the browser check
     covers the case.
   - Correct the module comment ("pure black stands for every dark page" is only true for
     black/white foregrounds), and the diagrams.md and changelog wording if they repeat it.

   Note: `#d9731a`, the WP01 fixture's linkStyle orange, would then be overridden in light mode
   (2.89 on the light cluster fill). If its edges never cross a cluster, the bound can be the page
   alone. Say which surfaces the bound covers, and why.

## Checked and fine

- Theme scoping: `:root[data-theme='dark'|'light']`. Starlight always sets `data-theme` on
  `<html>`, resolving auto mode, so the rules apply to readers who follow their system theme too.
- Arrowheads: the shared marker takes the init lineColor rule (`.marker`, with `.cross`
  excluded), and each linkStyle edge has its own `__<hex>` marker. Overrides stay consistent with
  their edges, and a themed shared marker (a `var()` after the sentinel rewrite) is never touched.
- Edges with no author colour: the `.flowchart-link` rule colour is a `var()` after the rewrite,
  so no override is written.
- Stroke source: inline linkStyle first, then the SVG's class rule. Mermaid sets no `stroke`
  attribute on flowchart links, so not reading one is fine.
- Id scoping: per-diagram ids through `cssEscapeId`, so rules can't reach another diagram.
  Moving `cssEscapeId` with a re-export is fine.
- No regression to the label work: `fixMermaidEdges` runs first and only appends rules; the label
  logic is unchanged.
- Ran on 33a1421: `pnpm test` (src 4306/4306, mcp 181/181), `pnpm lint`, `pnpm typecheck`, all
  green.
- Not run: Playwright (no PlantUML server in this container); the green legibility run is
  accepted from the implementer.
- Out-of-map edits to WP01 files (fixture and spec) are recorded in the commit; acceptable.
