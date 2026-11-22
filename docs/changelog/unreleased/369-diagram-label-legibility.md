---
section: Fixed
---

- **Build-time diagram labels stay readable on author colours in dark mode
  (#369).** Before, a node whose fill the author set (a Mermaid `classDef` or
  `style` fill, or a PlantUML ArchiMate layer colour) kept that pale fill in dark
  mode while its label turned light, so the label nearly vanished. Mermaid's
  edge-label halo also stayed pale green in dark mode. Now, a label on a fill the
  author set is black or white, whichever contrasts more with that fill, in both
  themes. On a see-through fill the label keeps its theme colour unless black or
  white clears 4.5:1 over any page. A label colour the author set is kept, and
  the halo follows the theme.
- **Build-time Mermaid labels are no longer cut off (#370).** Before, a diagram
  that set its own font in an `%%{init}%%` directive was drawn in the site's
  font, which is wider than the font its label boxes were measured in, so long
  labels were clipped. Now, every build-rendered Mermaid HTML label is measured
  and drawn in one Arial-metric font (Arial, Helvetica, Liberation Sans or
  Arimo).
