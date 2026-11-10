---
section: Fixed
---

- **Mermaid `erDiagram` renders in build mode (#315).** Before, any
  `erDiagram` failed the whole build with "Cannot read properties of undefined
  (reading '0')": Mermaid writes `style="undefined;undefined"` on its
  relationship edges, and the SVG minifier threw on it. Now the build drops the
  unset style declarations before minifying, and the example site carries an
  `erDiagram` so a build-mode run covers it.
