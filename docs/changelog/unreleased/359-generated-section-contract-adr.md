---
section: Documentation
---

- **ADR-0087 proposes one contract for generated sections (#359).** Every
  generated page would carry the same `generated` stamp: `by`, `at`, a new
  `source_digest` over its committed inputs, and `content_hash` over the rendered
  page. Every producer would answer the same `--check` drift gate, which flags
  stale and hand-edited pages. Ownership stays with the producer registry
  (ADR-0083). The ADR also says that `generated.at` is committed data, never the
  build clock, and that doc-kitty never runs a producing repository's code at
  build time. The ADR is Proposed; nothing in the code changes yet.
