---
section: Changed
---

- **An `adr.id` pattern may be written in upper case (#271).** Before,
  `pattern: '^(?<id>ADR-\d+)-'` matched no ADR, because the pattern runs
  against the lowercased file name, and then (#269, never released) failed at
  charter load. Now such a pattern is matched case-insensitively, so it reads
  `ADR-12-Use-X.md` on the hub and in the generated index alike. The id shows
  lowercased (`adr-12`), so it agrees with the page's URL. Escapes such as `\D`
  and `\W`, group names and back-references keep their meaning. A lower-case
  pattern compiles exactly as before. See the amendment note in
  [ADR-0069](docs/adr/0069-configurable-adr-id-and-frontmatter-status.md).
