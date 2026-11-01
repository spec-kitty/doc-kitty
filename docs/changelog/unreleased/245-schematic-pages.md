---
section: Added
---

- **A `kind: Schematic` page documents a JSON or YAML schema (#245).** Before,
  a schema stayed a file that readers opened in a repository. Now a page with
  `kind: Schematic` and `schematic_path: <file>` (relative to the project root,
  inside it) keeps your own Markdown as the body. The toolkit adds the
  schema description before it, then `## Diagram`, `## Properties` and
  `## Source`; a `##` heading you write with one of those names replaces the
  generated one. `$ref` within the file or to another file in the root is
  followed, and a URL `$ref` renders as a link. A bad path, a parse error, a
  non-schema file or an unresolvable `$ref` fails the build with a
  `[dk-schematic]` error. The diagram needs build-mode diagrams and the
  PlantUML service, so client mode leaves it out. The schema is published
  unchanged beside the page, and the OKF export `resource` points at it. No new
  option; `yaml` is a new dependency. See
  [ADR-0067](docs/adr/0067-schematic-pages-reference-a-schema.md).
