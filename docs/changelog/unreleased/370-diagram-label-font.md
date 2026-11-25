---
section: Changed
---

- **Build-time Mermaid labels ignore an `%%{init}%%` font (#370).** Before, a
  diagram's `%%{init}%%` `fontFamily` could reach its labels. Now, HTML labels
  are shown in the toolkit's Arial-metric font, so a diagram that set its own
  font looks different. Mermaid still measures the labels in an `%%{init}%%`
  font, so one narrower than Arial on the build machine, such as a serif font,
  can still cut a label off. A font set on one node with `classDef` or `style`
  is still kept and can still overflow. Author fonts are tracked in #412.
