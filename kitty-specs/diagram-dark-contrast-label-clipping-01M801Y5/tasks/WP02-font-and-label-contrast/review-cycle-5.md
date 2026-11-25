---
affected_files: []
cycle_number: 5
mission_slug: diagram-dark-contrast-label-clipping-01M801Y5
reproduction_command:
reviewed_at: '2026-11-25T07:57:51Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP02
---

# WP02 review cycle 5 (ruling B: an `%%{init}%%` font is neither shown nor measured): APPROVE

Reviewer: claude::reviewer-renata (not the implementer).

## What I reviewed

- **Lane-b at 044f559:**
  - 47a62e7: the red fixture and spec;
  - 05d21c1: the fix;
  - 044f559: the mission-branch merge.
- **Previous approval head 098f0ca:** an ancestor of the new head.
- **Rulings applied:**
  - Operator ruling B: the toolkit Arial stack wins for both display and measurement.
  - Author fonts are tracked in #412.
  - Sequence font keys are deferred to #458.

## Adversarial checks

1. **The `secure` list matches Mermaid 11.17.1 exactly.**
   - Source: the installed `mermaid/dist/chunks/mermaid.core/chunk-DU6HZSFF.mjs` default config.
   - The UMD `mermaid/dist/mermaid.js` that mermaid-isomorphic loads carries the same list.
   - That list is `secure`, `securityLevel`, `startOnLoad`, `maxTextSize`, `suppressErrorRendering`, `maxEdges`.
   - This equals `MERMAID_DEFAULT_SECURE`. No default is dropped.
2. **`fontFamily` is stripped at every depth.**
   - `addDirective` → `updateCurrentConfig` → `sanitize(d)`.
   - `sanitize` deletes each `siteConfig.secure` key with `Object.hasOwn`, and recurses into every object value.
   - Front matter `config` and `%%{init}%%` are merged (`cleanAndMerge`) and go through `addDirective`.
   - Probe through mermaid-isomorphic with `BUILD_MERMAID_CONFIG`, label "Wonderfully long label" (control box 157.1 px):

     | Variant | With fix | `fontFamily` removed from `secure` |
     |---|---|---|
     | `%%{init}%%` `themeVariables.fontFamily: serif` | 157.1 | 148.0 |
     | `%%{init}%%` top-level `fontFamily` | 157.1 | 148.0 |
     | front matter `config.fontFamily` | 157.1 | 148.0 |
     | front matter `config.themeVariables.fontFamily` | 157.1 | 148.0 |
     | `%%{init}%%` `flowchart.fontFamily` | 157.1 | 157.1 (not a measurement vector) |

3. **Other directive keys survive the strip.**
   - `%%{init}%%` `{themeVariables: {fontFamily: serif, lineColor: '#0a0721'}}` keeps `#0a0721` in the SVG.
   - The built fixture page has 4 hits for `0a0721`, 0 for `trebuchet`, and no serif label family.
4. **`inlineStyles: false` changes only SVG content.**
   - I compared a full head dist with a dist built with that line removed (M2).
   - Only 5 diagram pages and their 4 atom feeds differ, and every byte outside `<svg>` is identical.
   - 13 SVGs change. Rules that match one element stay in the id-scoped `<style>` instead of moving into a `style` attribute.
   - Values are unchanged: `var(--dk-…)` tokens and author `!important` fills.
   - Size is +1,339 bytes over those 13 SVGs (+0.75%).
   - No site CSS targets SVG internals. The rules keep `#id` specificity, the existing `!important` author-fill and contrast rules are unaffected, and dark/light both pass.
   - Unit goldens are green.
5. **Fresh builds, with `.astro` and `.vite` caches cleared before every build.**
   - 47a62e7 is RED in all 4 cells, for both reasons: "Wonderfully long label" and "A second long label" overflow, and edges per figure are `[3,2,0,3,4,3]`.
   - 044f559 is GREEN in all 4 cells: light and dark, at 1280 and 390 px.
   - Each build had build-rendered diagrams (32 `foreignObject`).
6. **The unrelated Playwright failures are pre-existing.**
   - The full suite on the 044f559 dists gives 554 passed, 9 failed, 229 skipped.
   - The full suite on the 098f0ca dists gives the same 9 failures and the same counts.
   - The 9 failures are:
     - axe `scrollable-region-focusable` on `/guides/getting-started/` × 4 projects;
     - brand-home visual baseline × 4 projects;
     - published-light `sidebar-membership`: 5 draft entries lost, 4 expected.
7. **The 044f559 merge brings no WP02 file changes.**
   - `git diff 05d21c1 044f559` touches only `docs/` and `kitty-specs/`.
   - `--remerge-diff` is empty, so the merge is clean.
8. **Each mutation fails its own assertion.**
   - M1 (`secure` without `fontFamily`): RED in all 4 cells, from label overflow only.
   - M2 (no `inlineStyles: false`): RED in all 4 cells, from the edge count only.

Anti-pattern checklist:

| # | Item | Result |
|---|---|---|
| 1 | Dead code | PASS. `MERMAID_DEFAULT_SECURE` is used by `BUILD_MERMAID_CONFIG`. |
| 2 | Synthetic-fixture test | PASS. The browser spec runs the real build; the mutations go red. |
| 3 | Silent empty return | N/A |
| 4 | FR coverage | PASS |
| 5 | Frozen surface | N/A |
| 6 | Locked decision | PASS |
| 7 | Shared-file ownership | Noted below |
| 8 | Production fragility | N/A |

On item 7: 47a62e7 edits WP01's fixture and spec out of map. The commit message records this, and it is acceptable.

## Gates (044f559)

| Gate | Result |
|---|---|
| `pnpm test` | src 4309/4309 (213 files), mcp 181/181 (23 files) |
| `pnpm typecheck` | green |
| `pnpm lint` | green |
| diagram-legibility | 4/4 passed |

## Non-blocking findings

- **N1: a `themeCSS` font in `%%{init}%%` still moves the measurement.**
  - Example: `%%{init: {'themeCSS': '.nodeLabel { font-family: serif; }'}}%%`.
  - The box is measured at 148.0 px. The pin then shows the label in Arial at 157.1 px, so it clips by 9 px (verified in Chromium).
  - This is author CSS, the same class as `classDef`/`style` fonts. Recommendation: add it to #412, and to the WP03 *Author font* text. Do not secure `themeCSS`, which would remove an author feature; that is an operator decision.
- **N2: the code comment on `MERMAID_DEFAULT_SECURE` is slightly wrong.**
  - It says: "Setting `secure` replaces the list, so it is restated in full".
  - In 11.17.1, `setSiteConfig` merges with `assignWithDepth`, which unions arrays, so the defaults would survive anyway.
  - Restating the list is harmless and defensive, but "replaces" is inaccurate.
- **N3: the WP03 docs are now stale against this fix.**
  - The merged WP03 text says an `%%{init}%%` font "sets the measurement" in four places: the `diagrams.md` *Font* and *Author font* items, the 369 bullet and the 370 fragment.
  - With 05d21c1 that is no longer true for `fontFamily`. WP03 needs a resync. That is out of WP02 scope.
- **N4: the edge-count assertion is still `expect.soft`.**
  - It fails the test, as the M2 run shows, so it is acceptable.
  - Consider making it hard again now that it is green.
