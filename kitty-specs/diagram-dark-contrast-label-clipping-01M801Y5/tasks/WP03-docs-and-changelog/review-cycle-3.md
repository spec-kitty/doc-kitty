---
affected_files: []
cycle_number: 3
mission_slug: diagram-dark-contrast-label-clipping-01M801Y5
reproduction_command:
reviewed_at: '2026-11-23T21:08:27Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP03
---

# WP03 review, cycle 3: changes requested

**Reviewer:** claude::reviewer-renata (not the implementer)

## What I reviewed

- **Content:** `git diff 9621b5f 3a5c48e -- docs/` (3 files). 3a5c48e is the
  Mission-branch mirror of the local-main commit e25328d. e25328d was never pushed,
  so I could not see it. The seam's derived range (f647a36..7b2fe89 on `main`)
  holds no WP03 content either. This verdict is against 3a5c48e. If e25328d
  differs from 3a5c48e, it does not cover e25328d.
- **Implementation checked against:**
  - lane-b 098f0ca (approved WP02 code, with author edges, 0c7658f);
  - the PR branch `fix/369-370-diagram-legibility` 886f3f9 (squad fixes 61cd2de
    and 0872e90).

## Blocking

### B1: the `classDef` font claim is the opposite of what the code does

`diagrams.md` says: "The rule also overrides a font set on one node with
`classDef`." The *Author font* item says: "Labels always use this stack."

Neither holds.

- **What Mermaid 11.17.1 emits.** A `classDef … font-family:X` becomes
  `#id .cls>*{font-family:X!important}` and `#id .cls span{…!important}`.
  These rules have specificity (1,1,0) or (1,1,1).
- **What the pin is.** `#id foreignObject,#id foreignObject *{…!important}` has
  specificity (1,0,1).
- **Result.** Both are `!important`, so the classDef rule wins. A `style id
  font-family:X` is kept as well.

**How I checked.** I ran the real build steps: mermaid-isomorphic with
`BUILD_MERMAID_CONFIG`, then `BUILD_SVGO_CONFIG`, `sentinelThemeRewrite` and
`pinDiagramLabelFont`. Then I measured computed fonts in Chromium.

| Node | Computed font | Box vs content |
| --- | --- | --- |
| `classDef mono font-family:Courier New` | `"Courier New"` | 86.4 px box, 80 px content |
| `style a font-family:Georgia` | `Georgia` | 76 px box, 85 px content: **clipped** |
| control node | the Arial stack | 91.6 px box, 92 px content: fits |

So a per-node author font is kept, and it can still clip, as #370 did. This
disposes squad finding 15 differently from how it was recorded.

**Same overclaim in the changelog:**

- `370-diagram-label-font.md`: "HTML labels always use the toolkit's
  Arial-metric font".
- `369-diagram-label-legibility.md`, #370 bullet: "every build-rendered Mermaid
  HTML label is measured and drawn in one Arial-metric font".

**Fix (docs only).** Say that the rule sets the font for labels without a
per-node font. A font set on one node with `classDef` or `style` is kept, and
such a label can still overflow its box. Point to #412. Narrow both changelog
sentences the same way, for example "every build-rendered Mermaid HTML label
without a per-node font". Drop "The rule also overrides a font set on one node
with `classDef`."

## Non-blocking

### N1: "measured in" with a single-family `%%{init}%%` font

If an author `%%{init}%%` names one installed family, the render page measures
in that font, while the label is shown in the Arial stack.

- Mermaid then emits `#id .label{font-family:<font>}`. Only a comma list emits
  no label font. I checked both.
- Probe, same control label:
  - `DejaVu Serif`: 105.75 px box;
  - `DejaVu Sans Mono`: 115.6 px box;
  - no `%%{init}%%`: 91.6 px box;
  - in each case the label is shown at 92 px.

So the label sits in a box sized for another font. These fonts leave slack. A
narrower installed font would clip. I could not show that, because no narrow
font is installed here.

This contradicts the WP02 code comment ("An author directive does not move that
measurement"). It is a code issue, not a WP03 one, and I am reporting it to the
dispatcher. Once it is settled, the docs' "draws its HTML labels in the font they
were measured in" may need a qualifier.

### N2: edges are Mermaid flowchart edges only

`fixMermaidEdges` handles only `path.flowchart-link` and `marker`. The *Author
edges* item and the changelog edge bullet say "edge" without saying
"flowchart". An `%%{init}%%` `lineColor` in a sequence or class diagram is not
covered. Suggest "a flowchart edge colour".

## Verified accurate

- **Opaque author fill:** black or white, whichever contrasts more.
- **See-through fill:**
  - black or white only if it clears 4.5:1 over pure black or white, otherwise
    themed;
  - the `rgba(230,230,230,.5)` limit holds: 4.42:1 over black, so themed; about
    5:1 on the default dark page.
- **Author label colours:**
  - `classDef` and `style` colours are kept;
  - an `%%{init}%%` `nodeTextColor` is a stylesheet colour, not inline, so it is
    not treated as the author's.
- **Author edges:**
  - per theme, judged against black up to the lightest dark surface, and the
    darkest light surface up to white (`EDGE_SURFACES`);
  - an id-scoped themed override applies where 3:1 fails;
  - the brand caveat is correct.
- **SVG-text labels** (sequence diagrams) keep Mermaid's own sizing.
- **The 370 Changed "Before"** ("could reach") is accurate. A single-family
  `%%{init}%%` font did reach `.label` before the change.
- **Fragment format** matches `docs/changelog/unreleased/README.md`:
  - `section:` is the only key;
  - each bullet opens with a bold lead and the issue number;
  - each entry uses "Before, … Now, …";
  - there are no headings.

## Ran

The 3a5c48e docs on lane-b 098f0ca:

| Check | Result |
| --- | --- |
| `pnpm validate:docs` | OK, no warnings for diagrams.md |
| `pnpm validate:links` | 1846 references resolve |
| `pnpm validate:changelog` | OK, 3 fragments |
| markdownlint-cli2 on the 3 files | 0 issues |
| full `pnpm test` | src 4309/4309, mcp 181/181 |
| Vale | not run (not installed here) |

## Also for the dispatcher (not WP03)

lane-b (edge override) and the PR branch (PlantUML on-shape pin, case-insensitive
`rgb`) have diverged. Merging them conflicts in 7 files. The pushed PR branch
does not contain the #369 edge fix that these docs describe.
