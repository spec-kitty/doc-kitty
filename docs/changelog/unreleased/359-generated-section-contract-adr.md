---
section: Documentation
---

- **ADR-0087 defines one contract for generated sections (#359).** It is
  accepted, and the code follows in later changes. Under it, every generated page
  will carry the same `generated` stamp: `by`, `at`, a new `source_digest` over
  its declared inputs (with a byte-exact algorithm and a worked example), and
  `content_hash` over the rendered page. Every producer will answer the same
  `--check` drift gate, which flags stale and hand-edited pages. Ownership stays
  with the producer registry (ADR-0083, also accepted). The ADR also says that
  `by` and `at` change only when the page does, and that doc-kitty never runs a
  producing repository's code at build time.
