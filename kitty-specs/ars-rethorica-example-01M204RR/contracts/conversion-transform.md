# Contract: Manuscript → docsite conversion transform

Deterministic transform from `ars-rethorica/manuscript/*.md` to
`example/docs/rhetoric/**`. May be a committed script + reviewed output, or a
reviewed manual conversion; the **vendored converted pages are the deliverable**
(no live submodule).

## Per-file rules
- **STRIP** (remove, no artifact): `{pagebreak}`, `{mainmatter}`, `{copyright}`, `{frontmatter}`,
  `{backmatter}`.
- **MAP TO LANDING**: `BookOne/Two/Three.md` (`{class: part}` + `# I: ...`) → `book-<n>/index.md`
  `kind: Hub` landing (title from the part heading). Book II/III landings note chapters are
  out of scope for this showcase.
- **KEEP (pipeline renders)**: `[^^N_M]` footnotes, `{blurb, icon: pencil}` / `{blurb, class: ...}`
  callouts, `{#id}` explicit anchors.
- **NORMALISE aliases**: callout `class: info` → `information`; bare `icon: pencil` → the mapped
  Starlight glyph the icon-map expects (verify against `src/lib/markua/icon-map.ts`).
- **ICON CALLOUT PARSE (verified in WP03):** inline `{blurb, icon: pencil}` does NOT parse (the wrapper grammar accepts only `{blurb}` / `{blurb, class: X}`). Emit the icon as its OWN attribute-list line immediately above a bare `{blurb}`: a line `{icon: fa-pencil}` then a line `{blurb}` … `{/blurb}`. Use the `fa-` prefix (icon-map `lookup()` requires it).
- **DEGRADE** `[#t](#anchor)` → `[<readable title>](/rhetoric/<path>/#anchor)` (root-absolute,
  target title derived from the target heading). Cross-page targets point at the owning page.
- **GLOSSARY**: extract the Preamble definition-list into `definitions.yaml` (D4); the Preamble
  page links to the generated glossary instead of embedding the list.
- **FRONTMATTER**: prepend doc-kitty frontmatter (see data-model). Add `<!-- markdownlint-disable -->`
  immediately after the frontmatter on Markua-bearing pages.
- **LINKS**: inter-chapter/prev-next links are root-absolute (`/rhetoric/book-one/chapter-02/`).
- **ENCODING**: preserve curly quotes / em-dashes / Greek (backtick) spans without mojibake.

## Output invariants
- 0 literal Markua markers in rendered HTML (SC-002).
- Every page has exactly one body H1 and a ≤180-char description.
- Reading order matches source `Book.md`.
