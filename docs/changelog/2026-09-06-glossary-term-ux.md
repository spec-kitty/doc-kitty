---
title: "Glossary term-link UX polish — affordance, same-tab, popover caret + flip"
description: "Glossary term links now read as distinct-but-quiet, open same-tab, and the hover popover gains a caret and flips above the term near the viewport bottom (#64)."
doc_status: active
updated: 2026-09-06
type: Changelog
kind: Changelog
tags: [glossary, accessibility, css]
related:
  - architecture/glossary
---

# 2026-09-06 — Glossary term-link UX polish

Three visible-quality defects from the 2026-09-04 docsite review, remediated
together at the shared glossary link-node shape so an auto-linked term and an
authored `:term` link stay indistinguishable downstream.

## What changed

- **A glossary term link now reads as a distinct, quiet affordance (#64).**
  Before: a term anchor carried only `data-glossary-*` markers and no styling,
  so it rendered exactly like an ordinary navigation link. After: every term
  anchor — auto-linked or `:term`-directive — carries a `dk-glossary-link`
  class styled with a dotted, offset underline and a `help` cursor, reading as
  "hover for a definition" while keeping the same AA-proven accent colour as
  other content links in both themes.
- **An internal term link opens in the same tab (#64).** Before:
  `target="_blank" rel="noopener"` sent every term click to a new tab, unlike
  every other internal link. After: term links resolve to
  `/glossary/<context>/#<anchor>` and open same-tab, like the rest of the
  site's internal navigation.
- **The hover popover shows a caret and flips above the term near the
  viewport bottom (#64).** Before: the popover always positioned itself below
  the term with no caret, so it could render partially off-screen near the
  bottom of the viewport and gave no visual anchor back to the term. After: a
  caret points from the popover at the term, and the popover measures its own
  height once mounted to flip above the term (caret flipping to point down)
  when it would otherwise overflow the viewport bottom and there is room
  above — staying hoverable and Esc-dismissible throughout (WCAG 2.2 1.4.13).

## Why it matters

None of these defects blocked publishing, but each is visible to a reader on
first contact with the glossary: an unstyled term link is indistinguishable
from navigation, a surprise new tab breaks the reader's flow, and a
popover clipped at the viewport edge is hard to read. The class and the
`target`/`rel` removal land at the one shared link-node shape both the
auto-linker and the `:term` directive emit, so the re-derive parity guard and
the "indistinguishable downstream" invariant hold unchanged. A site with no
`.contextive/definitions.yaml` is unaffected — the feature stays
presence-gated and the build stays byte-identical.
