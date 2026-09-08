---
title: Example content from ars-rethorica — the docsite showcase corpus
description: "The ars-rethorica showcase lands in the example site: Introduction, Preamble, Book I (15 chapters), Book II/III landings, a generated rhetoric glossary, and two reader personas."
doc_status: active
updated: 2026-09-08
type: Changelog
kind: Changelog
tags: [example, content, markua, footnotes, glossary, personas, showcase]
related:
  - architecture/research/ars-rethorica-book-example
  - architecture/markua
  - plans/features/example-content-ars-rethorica
---

# 2026-09-08 — Example content from ars-rethorica

The example site gains a real, book-length showcase corpus in place of placeholder
text: a Markua-authored port of *ars rhetorica* (Aristotle's *Rhetoric*, Freese's
public-domain 1926 translation), revamped under CC-BY-SA-4.0. It exercises the
docsite's Markua, glossary, audience, and metadata features against genuine prose
rather than fixtures. The feature moves from `doc_status: draft` to `active`.

## What ships

- **The corpus.** A rhetoric hub, an Introduction, a Preamble, an
  about-and-license page, Book I's 15 chapters, and Book II/III landings — 22 active
  pages under `/rhetoric/`, all authored in Markua (footnotes, `{blurb}` callouts,
  `{pagebreak}`/`{mainmatter}`/`{class: part}` structure) and rendered to accessible
  HTML with zero literal markers leaking (SC-002).
- **A generated rhetoric glossary.** The Preamble's terms land as a native
  `glossary/rhetoric/` context (Dialectic, Dicast, Enthymeme, Orator, Syllogism, …),
  auto-linked within the rhetoric-scoped chapters.
- **Two active reader personas.** `rhetoric-practitioner` and `rhetoric-student`
  resolve from the corpus's audience references (the existing draft persona stays
  draft).
- **Attribution.** Every showcase page reaches a visible attribution/license notice
  naming both the public-domain source and the CC-BY-SA-4.0 revamp (SC-007).

## Integration, gates & ratchet

- **Published-page ratchet bumped +25** (31 → 56) for both
  `EXPECTED_INDEX_ENTRY_COUNT` and `EXPECTED_SITEMAP_URL_COUNT` in
  `assert-build-artifacts.mjs` — the exact count of non-draft pages the showcase adds
  (22 rhetoric pages + 2 personas + 1 generated glossary page). The WP01 footnote
  fixtures are `doc_status: draft` and are deliberately not counted.
- **Accessibility coverage.** Two representative routes join the axe lane — the
  rhetoric hub and a footnote-and-callout-bearing Book I chapter — scanned in light
  and dark with zero serious/critical WCAG 2.2 AA violations.
- **Byte-neutral when Markua is off (NFR-001).** The Markua/footnote pass stays inert
  under `DK_MARKUA=off` (`assert:markua` FR-004/SC-003): pre-existing pages keep their
  raw GFM footnote ids and render Markua block markers as literal text.
- **Full gate suite green** — unit tests, `typecheck`, `lint`, `validate:*`, the build
  asserts (`assert:artifacts`/`assert:no-broken-links`/`assert:markua`),
  `test:a11y`, `markdownlint-cli2`, and Vale all pass.

Refs the `ars-rethorica-example` mission.
