---
section: Changed
---

- **A generated page keeps its `by` only when the version in it is a SemVer
  2.0.0 version (#401).** Before, the stamp carry-over accepted any `x.y.z`
  with a loose suffix, so a hand-edited `by` such as `doc-kitty-gherkin/01.00.00`
  or `doc-kitty-glossary/1.0.0+.` was kept while the content was unchanged. Now
  the version must follow the SemVer 2.0.0 grammar, with no leading zeros and
  no empty identifier, and stay within npm semver's bounds (at most 256
  characters, each number a safe integer). Any other `by` is rewritten with
  the current toolkit version. This covers the Gherkin and glossary pages and
  the evidence index. A committed `by` that names a released version is
  unaffected.
