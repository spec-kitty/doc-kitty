# Research: Readable build-time diagrams in both themes

## R1 — Why the dark edge reported in #369 does not reproduce

- **Finding**: on 2026-11-21, `docs.spec-kitty.ai/architecture/diagrams/02_containers/`
  resolves every `.flowchart-link` path and arrowhead marker to `rgb(143,176,240)`
  (`#8fb0f0`, the dark token) in dark mode: on a fresh dark load, and after a
  toggle from light. `rgb(51,80,127)` appears only in light mode. The site's CSS
  declares only doc-kitty's default `--dk-diagram-*` values, in a light and a
  dark block; it re-declares none. The local fixture build agrees.
- **Decision**: no code change; ratchet with a 3:1 edge check in both themes.
- **Likely origin of the report**: a measurement taken while the page was still
  in light mode (for example `prefers-color-scheme` emulated after load with a
  stored `light` choice). Not provable after the fact.

## R2 — Why labels clip (#370)

- **Finding**: `mermaid-isomorphic` renders in a blank page with no body font.
  Mermaid emits `#id .label{font-family:…}` from its theme font. When an author
  `%%{init}%%` sets `themeVariables.fontFamily`, the emitted SVG carries no
  label `font-family` at all (seen on the consumer's third diagram and in the
  fixture). Labels are then measured in the render page's default font and shown
  in the site's `--dk-font-sans`, which is wider. The fixture reproduces the
  consumer's numbers exactly (box 98.859 px, content 105 px).
- **Decision**: pin `Arial, Helvetica, "Liberation Sans", Arimo, sans-serif` with
  `!important` on Mermaid label content on both sides: a stylesheet handed to the
  render page through `@beoe/rehype-mermaid`'s `css` option (a `data:` URL), and
  the same rule in `dk-components.css` for the figure and the lightbox copy.
- **Rationale**: these four fonts share Arial's advance widths, so a width
  measured on the Linux build (Liberation Sans) matches Arial on macOS, Windows
  and iOS.
- **Alternatives considered**:
  - `htmlLabels: false`: labels become SVG text, so nothing is clipped, but a
    font mismatch still makes text spill over its box; it also changes how HTML
    and Markdown in labels render for every consumer diagram. Rejected.
  - Bundle a web font for both sides: exact metrics everywhere, but adds a font
    asset (C-003). Rejected.
  - Pin only `mermaidConfig.fontFamily`: an author init directive still
    overrides it. Rejected.

## R3 — Why ArchiMate labels vanish in dark mode (#369 item 2)

- **Finding**: the PlantUML ArchiMate stdlib fills each element with its layer
  colour (`#FFFFCC`/`#FFC` business, pale blue application, `#C9FFC9`
  technology) as a literal; `skinparam defaultFontColor` makes the label the
  `node-text` sentinel, rewritten to `var(--dk-diagram-node-text)` — light in
  dark mode. Mermaid does the same for a `classDef`/`style` that sets `fill`
  without `color`.
- **Decision**: a rehype pass after `sentinelThemeRewrite`. A shape fill that is
  a literal colour marks an author fill; a label colour that is a
  `var(--dk-diagram-*)` marks a themed label. Only that pair is changed: the
  label colour becomes `#000000` or `#ffffff`, whichever contrasts more with the
  fill. Either choice clears 4.58:1 for every fill.
- **Alternatives considered**: a fixed light canvas behind every figure — it
  breaks the dark theme for the themed parts of every diagram. Rejected.

## R4 — How to measure contrast in the browser check

- **Finding**: a DOM probe that walks `elementsFromPoint` for the backdrop
  missed the defect (it skipped the wrong layers). Pixels do not lie.
- **Decision**: hide every label and edge, take one screenshot, decode it in a
  page canvas, and read the backdrop at each label's box and along each edge.
  The foreground is the element's computed colour. No new dependency.

## Supply chain

No dependency is added, upgraded or removed (DIRECTIVE_051: no controls to run).
