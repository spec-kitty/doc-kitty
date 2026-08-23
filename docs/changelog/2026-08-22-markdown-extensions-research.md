---
title: Markdown extensions research
description: Added architecture research on Astro Markdown extensions, Markua support, and example content.
doc_status: active
updated: 2026-08-22
type: Changelog
kind: Changelog
tags: [research, markua, markdown]
related:
  - architecture/research/markua-syntax-support
  - architecture/research/ars-rethorica-book-example
---

# 2026-08-22 — Markdown extensions research

Added a research track under [`architecture/research/`](../architecture/research/):

- **Astro Markdown extensions** — how Astro and Starlight support custom Markdown
  syntax: MDX components, the remark/rehype pipeline, `remark-directive`, Starlight
  asides, and `astro:assets`.
- **Supporting Markua syntax** — a curated Markua subset (images, ids, asides,
  callouts, icons) rendered by preprocessing into `remark-directive` plus a small
  attribute-list plugin. Grounded in the Markua spec (0.30) and manual.
- **Example content from ars-rethorica** — convert the open-license Markua book
  (Aristotle's *Rhetoric*, CC-BY-SA-4.0) into realistic docsite example content.

Decision recorded: doc-kitty supports Markua for **docsites and presentations
only**. It gives Leanpub syntax compatibility through alignment, and deliberately
does not build a book or document pipeline (which would compete with Leanpub).
