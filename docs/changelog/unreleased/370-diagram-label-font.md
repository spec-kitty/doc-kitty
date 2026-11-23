---
section: Changed
---

- **Build-time Mermaid labels ignore an `%%{init}%%` font (#370).** Before, a
  diagram's `%%{init}%%` `fontFamily` could reach its labels. Now, HTML labels
  use the toolkit's Arial-metric font, so they fit the box they were measured
  in. A diagram that set its own font looks different. A font set on one node
  with `classDef` or `style` is still kept and can still overflow. Author fonts
  are tracked in #412.
