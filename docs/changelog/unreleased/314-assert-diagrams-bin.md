---
section: Added
---

- **`dockitty-assert-diagrams` proves a built site drew every diagram (#314).**
  Before, a site that renders diagrams at build time had to write its own check
  of the output to learn that a diagram had shipped as a code block, as a
  client-side `<pre class="mermaid">` or as a PlantUML error. Now `pnpm exec
  dockitty-assert-diagrams dist` fails on any of those, on a diagram figure with
  no `<svg>`, and on a `plantuml.com` URL. It skips redirect pages.
