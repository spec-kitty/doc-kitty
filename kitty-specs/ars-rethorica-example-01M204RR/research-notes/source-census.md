# ars-rethorica Book-I conversion census (source-side)

Source: github.com/stijn-dejongh/ars-rethorica @ manuscript/ (CC-BY-SA-4.0).
Scope = Introduction.md, BookOnePreamble.md, BookOne.md (part title), book1chapter1..15.md.

## Markua construct counts (across scope)
- Footnotes: **364 markers** `[^^N_M]`, **182 definitions** `[^^N_M]:` → first-class footnote feature.
- Callouts: **13** `{blurb, icon: pencil}` (editor's notes) + **1** `{blurb, class: info}`.
- Auto-title xrefs: **5** `[#t](#anchor)` → targets: #book-one-glossary, #types-of-rhetoric,
  #epideictic-rethoric (sic), #intent, #motive. Some cross-page (glossary in Preamble).
- Explicit ids `{#id}`: ~10 anchor-setting lines (feed the xref targets; ids feature already supported).
- Book directives to STRIP: 20 `{pagebreak}`, 1 `{mainmatter}`, 1 `{copyright}`, 1 `{class: part}`.
- Images: **0**. Tables: **0**. (Simplifies conversion.)
- Editorial bracket spans e.g. `[is of general application]` (Freese insertions) — literal text;
  watch markdownlint MD052 (undefined reference label) on conversion.

## Structure
- 3 books: I "Purposes and Definitions of Rhetoric" (15ch, IN), II "Persuasion techniques"
  (26ch, landing only), III "Stylistic Delivery and Arrangement Techniques" (19ch, landing only).
- Reading order from Book.md: Introduction, Changelog, BookOne(part), BookOnePreamble, ch1..15.
- Preamble contains the def-list Glossary (Deliberative rhetoric, Dialectic, Dicast, Enthymeme,
  Epideictic rhetoric, Forensic rhetoric, Induction, Orator, Sophist, Syllogism) → native glossary.

## Attribution (mandatory, CC-BY-SA-4.0)
- Source translation: J.H. Freese (1926), public domain, via Perseus Project / Tufts (orig CC-BY-SA-3.0).
- Revamp/editor: Stijn Dejongh (2024), CC-BY-SA-4.0.
- Translation notes referenced: E.M. Cope (1877), W.D. Ross (1959).
