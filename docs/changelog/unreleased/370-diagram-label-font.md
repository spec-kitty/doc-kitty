---
section: Changed
---

- **Build-time Mermaid labels ignore an `%%{init}%%` font (#370).** Before, a
  diagram's `%%{init}%%` `fontFamily` could reach its labels. Now, the build
  drops an `%%{init}%%` or front-matter `fontFamily`, including
  `themeVariables.fontFamily`, so HTML labels are measured and shown in the
  toolkit's Arial-metric font, and a diagram that set its own font looks
  different. Every other directive value is kept. A font set in author CSS
  (`classDef`, `style` or an `%%{init}%%` `themeCSS` rule) is still kept and can
  still overflow; author fonts are tracked in #412. The sequence diagram font
  keys are not dropped yet (#458).
