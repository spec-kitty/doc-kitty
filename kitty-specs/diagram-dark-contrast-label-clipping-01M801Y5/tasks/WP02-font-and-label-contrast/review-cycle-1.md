---
affected_files: []
cycle_number: 1
mission_slug: diagram-dark-contrast-label-clipping-01M801Y5
reproduction_command:
reviewed_at: '2026-11-22T00:01:16Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP02
---

# WP02 review cycle 1: REQUEST_CHANGES (reviewer: claude::reviewer-renata)

Reviewed lane-b at ef0920a (review range dfc0518..ef0920a).

## Blocker

1. **A translucent author fill gets a label colour that fails in one theme (FR-002, NFR-001).**
   File: `src/lib/rehype/diagram-label-contrast.ts`.

   The code:
   - `parseLiteralColour` treats an `rgba()` fill with alpha ≥ 0.5 as opaque and returns its raw
     channels.
   - `shapeFill` never reads `fill-opacity`.
   - `labelColourFor` then picks black or white against the raw colour. The page behind the
     shape, which differs per theme, is never taken into account.

   The module comment claims either colour "clears 4.58:1 for any fill … in both themes". That
   holds only for opaque fills.

   Reproduced by calling the module's own exports on the lane code (blended over white for
   light, a dark page for dark):

   | Author fill                   | Label chosen | Light  | Dark  |
   |-------------------------------|--------------|--------|-------|
   | `rgba(17,104,189,.6)`         | white        | 2.62:1 | 9.73  |
   | `rgba(0,0,0,.5)`              | white        | 3.98:1 | 19.96 |
   | `fill:#000;fill-opacity:0.3`  | white        | ≈2:1   | high  |

   In the last case, the plugin writes `color:#ffffff!important` on the label.

   Translucent fills are common on Mermaid subgraphs and clusters (`style sub fill:#xxxxxx80`,
   `rgba(...)`). With `!important`, the pass also removes the themed colour that might have
   worked.

   Fix:
   - Take the effective alpha as rgba alpha × `fill-opacity` (also `opacity` on the shape, if
     cheap).
   - When it is < 1, blend the fill over the light and the dark diagram backdrop. Use the
     toolkit's default `--dk-diagram-*`/page background values; a consumer redeclaring them is
     out of scope, so say so in a comment.
   - Pick the label colour that clears 4.5:1 against both blends. If neither black nor white
     does, leave the label themed (don't force `!important`).
   - Handle `#rrggbbaa` / `#rgba` the same way, or keep returning null for them and test that.
   - Add unit cases for the three fills above, plus one where neither colour works.
   - Correct the module comment.

   The fixture has no translucent fill, so WP01's spec can't catch this. Consider adding one
   translucent node to the fixture in a follow-up; WP01 is approved, so that is not required
   here.

## Nits (non-blocking)

2. `labelFontRule('#' + id)`: the id is not CSS-escaped. Mermaid ids are safe today, and every
   diagram gets the identical rule, so a shared or cloned id (lightbox) cannot leak anything.
   An id that needs escaping would just turn the rule into a silent no-op. One line would cover
   it: escape it, or use `svg[id="…"]`.

## Checked and fine

- **FR-003:** Mermaid 11.17.1 `addHtmlSpan` applies `node.labelStyle` inline to both the span
  and the div, so an author `classDef color` sits where `carriers` looks. The author colour is
  kept.
- **Themed fills:** they are `var()` after `sentinelThemeRewrite`, so `parseLiteralColour`
  returns null and the label is untouched. Edge labels (`g.edgeLabel`) are not visited.
- **PlantUML:** `ENTITY_BLOCK` fails safe. An entity with a nested `<g>` simply doesn't match,
  and a match cannot run past its own `</g>` into a neighbour. Only themed `<text>` fills inside
  the block are replaced; author text fills and non-entity bytes are left alone.
- **rgba sentinel rewrite:** comma and space/slash notations, an anchored triple (no `1225`
  false match), alpha → `color-mix(in srgb, var(..) N%, transparent)`, opaque → plain token.
  Non-sentinel colours pass through. C-005 holds.
- **Font pin:** isolated in `pinDiagramLabelFont` plus one `fontFamily` line in
  `BUILD_MERMAID_CONFIG`, so it is easy to flip when the operator rules on author-font policy.
  The disk-cache salt already includes `mermaidConfig`, so the `fontFamily` change invalidates
  old renders.
- **Deviations (a) and (b)** (no render-page `css`; the rule inside each SVG instead of
  `dk-components.css`): accepted. They keep clear of the #405 chrome goldens and reach the
  lightbox clone.
- **Ran on ef0920a:** `pnpm test` (src 4295/4295, mcp 181/181), `pnpm lint`, `pnpm typecheck`,
  all green.
- **Not run:** the Playwright suite and the half-by-half proof. No PlantUML server can be
  started in this reviewer container; that is accepted from the implementer's report.
