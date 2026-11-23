---
affected_files: []
cycle_number: 4
mission_slug: diagram-dark-contrast-label-clipping-01M801Y5
reproduction_command:
reviewed_at: '2026-11-23T21:26:53Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP03
---

# WP03 review, cycle 4: changes requested

**Reviewer:** claude::reviewer-renata (not the implementer)

## What I reviewed

- **Content:** `git diff 3a5c48e 1e19da1 -- docs/` (3 files). 1e19da1 is the
  coordination-branch head. It includes bfd6199, the Mission-branch mirror of the
  local-main commit d8e79d7. d8e79d7 is not pushed, so I could not see it. This
  verdict is against bfd6199/1e19da1. If d8e79d7 differs from it, this review does
  not cover d8e79d7.
- **The seam's derived range** (`f647a36..ef5e371`) holds no WP03 docs content, so
  I did not use it.
- **Implementation checked against:**
  - lane-b 098f0ca: author edges (0c7658f) and the font pin;
  - the PR branch `fix/369-370-diagram-legibility` 886f3f9. Its `labelFontRule`
    and `pinDiagramLabelFont` match lane-b's.
- **How I ran it:** I put the 1e19da1 `docs/` tree on top of lane-b 098f0ca, then
  ran the gates and the probe there.

## Cycle-3 findings: resolved

- **B1 is resolved.** The *Author font* item, the 369 #370 bullet and the 370
  fragment now say that a per-node `classDef`/`style` font is kept and can
  overflow. "The rule also overrides…" and "always" are gone.
- **N2 is resolved.** The docs and the 369 edge bullet now say "flowchart edge".
  `fixMermaidEdges` touches only `path.flowchart-link` and `marker`.

My probe confirms the per-node claims. I used the real build steps:
`@beoe/rehype-mermaid` with `BUILD_MERMAID_CONFIG` and `BUILD_SVGO_CONFIG`, then
`sentinelThemeRewrite`, `pinDiagramLabelFont` and `diagramLabelContrast`. I
measured in Chromium 1243, with the label "Wonderfully long label" at 16 px.

| Node | Computed font | Box | Content | Result |
| --- | --- | --- | --- | --- |
| `classDef mono font-family:Courier New` | `"Courier New"` | 200 | 200 (wraps at max width) | kept, as the docs say |
| `style b font-family:Georgia` | `Georgia` | 148.0 | 157.1 | kept, **clipped 9 px**, as the docs now say |
| control (no author font) | the Arial stack | 157.1 | 157.1 | fits |

The emitted rules are `#id .mono>*{font-family:"Courier New"!important}` against
the pin `#id foreignObject,#id foreignObject *{…!important}`. The classDef rule is
more specific, so it wins.

## Blocking

### B2: an `%%{init}%%` font still moves the measurement, and a serif one clips

The docs say a diagram-wide `%%{init}%%` font "does not reach the labels: a fit
the toolkit can guarantee". That is true for the **display** font. It is not true
for the **measurement**. Mermaid's render page sizes each box in the author's
font, and the pin then shows the label in Arial.

I probed one node per `themeVariables.fontFamily` value, with the same label and
the same build steps:

| `%%{init}%%` fontFamily | Box | Shown in | Content | Result |
| --- | --- | --- | --- | --- |
| `Georgia, serif` | 148.0 | Arial stack | 157.1 | **clipped 9 px** (`overflow:hidden`) |
| `serif` | 148.0 | Arial stack | 157.1 | **clipped 9 px** |
| `DejaVu Serif` | 183.1 | Arial stack | 157.1 | slack |
| `Courier New, monospace` | 200 | Arial stack | 200 | wraps |
| `Inter, sans-serif` | 157.1 | Arial stack | 157.1 | fits |
| `trebuchet ms, verdana, arial, sans-serif` | 157.1 | Arial stack | 157.1 | fits |
| `Arial` | 157.1 | Arial stack | 157.1 | fits |

**Why the serif cases clip.** Georgia is not installed, so Chromium resolves
`serif` to "Times New Roman", which `fc-match` maps to Liberation Serif. Liberation
Serif is narrower than Arial. GitHub's Ubuntu runners ship Liberation fonts too,
so CI builds should do the same.

**This is #370's own symptom.** The label is cut off in a diagram that sets its
own font in `%%{init}%%`. It goes beyond cycle-3 N1, which covered a
single-family installed font and had not shown a clip. Here a comma list with a
generic fallback clips.

**Why the gate misses it.** The fixture's only `%%{init}%%` font is
`Trebuchet MS, Verdana, Arial, sans-serif`. On a Linux runner that resolves to
Arial, so `diagram-legibility.spec.ts` cannot catch this. The code comment in
`diagrams.ts` ("An author directive does not move that measurement") is wrong too.
That is a code note for the dispatcher, not WP03.

**Sentences that overclaim:**

- `diagrams.md`, *Font*: "draws its HTML labels in the font they were measured
  in". Not when an `%%{init}%%` font set the measurement.
- `diagrams.md`, *Author font*: "A diagram-wide font, whether the site's or one
  set in an `%%{init}%%` directive, does not reach the labels: a fit the toolkit
  can guarantee wins over the author's choice." An `%%{init}%%` font does reach
  the measurement, and the fit is not guaranteed. The site's font does not reach
  either, so that half is fine.
- `369-diagram-label-legibility.md`, #370 bullet: "build-rendered Mermaid HTML
  labels are measured and drawn in one Arial-metric font". They are drawn in it,
  but not always measured in it.
- `370-diagram-label-font.md`: "HTML labels use the toolkit's Arial-metric font,
  so they fit the box they were measured in". They do not fit when the box was
  measured in a narrower `%%{init}%%` font.

**Fix (docs only, unless the dispatcher fixes the code first).** Say that an
`%%{init}%%` font still sets the font Mermaid measures labels in, while the label
is shown in the Arial stack. So a label in a diagram whose `%%{init}%%` font is
narrower than Arial on the build machine, such as a serif font, can still be cut
off. Point to #412. Suggested wording:

- *Author font:* "The site's font does not reach the labels. A font set in an
  `%%{init}%%` directive is not shown either, but Mermaid still measures the
  labels in it. If it is narrower than Arial on the build machine, as a serif
  font is, a label can overflow its box. A font set on one node with `classDef` or
  `style` is kept… (as now). Author fonts are tracked in #412."
- *Font:* qualify "in the font they were measured in" with "unless an
  `%%{init}%%` font set the measurement (see *Author font*)".
- 369, #370 bullet: "…are drawn in one Arial-metric font… and measured in it
  unless an `%%{init}%%` font is set; a `classDef` or `style` font is kept."
- 370: drop "so they fit the box they were measured in", or add "A narrower
  `%%{init}%%` font, such as a serif one, still sets the measurement, so a label
  can still be cut off (#412)."

If the dispatcher instead fixes the code, for example by stripping
`themeVariables.fontFamily` from author directives before render, the current
wording can stand. Add a fixture node with a `serif` `%%{init}%%` font to prove it.

## Non-blocking

- **N3.** The 369 edge bullet says "clears 3:1 on every page and subgraph
  surface". `diagrams.md` qualifies the range: "a brand whose dark surfaces are
  lighter… is not covered". The changelog has no such qualifier. This is
  acceptable for a changelog, but "the toolkit's page and subgraph surfaces" would
  be exact.
- **N4.** These two lines are longer than the files' usual ~80-column wrap.
  markdownlint passes, so this is cosmetic:
  - `diagrams.md`: "`%%{init}%%` `lineColor` or a `linkStyle`, does not follow…"
  - the 369 bullet: "Before, a flowchart edge colour the author set (…)"

## Verified accurate (unchanged since cycle 3)

- Opaque and see-through author fills.
- Author label colours (`classDef` and `style` kept; `%%{init}%%`
  `nodeTextColor` replaces a token).
- Author edges: `EDGE_SURFACES` ranges, the id-scoped override and the brand
  caveat.
- SVG-text labels keep Mermaid's sizing.
- Fragment format.

## Overclaim grep

I grepped for `always|every|overrides?|all|never|guarantee` in the three files.

- No "always" or "overrides" remain.
- The "every" hits are all accurate:
  - "every surface it can sit on there";
  - "every brand";
  - "measures every label and edge";
  - 369: "every page and subgraph surface" (see N3).
- "guarantee" is B2.

## Ran

The 1e19da1 docs on lane-b 098f0ca:

| Check | Result |
| --- | --- |
| `pnpm validate:docs` | 210 valid, 4 warnings in unrelated files |
| `pnpm validate:links` | 1846 references resolve |
| `pnpm validate:changelog` | OK, 3 fragments |
| markdownlint-cli2 on the 3 files | 0 issues |
| full `pnpm test` | src 4309/4309 (213 files), mcp 181/181 (23 files), exit 0 |
| Vale | not run (not installed) |
