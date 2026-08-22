---
title: Example content from ars-rethorica
description: "Convert an open-license Markua book into realistic docsite example content; the book/document pipeline is out of scope."
status: active
updated: 2026-08-22
type: Architecture
tags: [markua, example, content, leanpub]
related:
  - architecture/research/markua-syntax-support
  - architecture/research/astro-markdown-extensions
  - adr/0004-amend-common-docs-as-extensible-variation
---

# Example content from ars-rethorica

The example site needs realistic content, not toy docs. The idea: convert an
open-license Markua book into docsite content, so the example shows real prose that
exercises the Markua pipeline. Direction is decided: doc-kitty supports Markua for
**docsites and presentations only**. A book or document pipeline is out of scope.

## Positioning: compatible with Leanpub, not competing

doc-kitty renders docsites and slide decks. Supporting Markua gives authors
**Leanpub syntax compatibility out of the box** through syntax alignment: the same
source can feed Leanpub and doc-kitty. doc-kitty deliberately does **not** build a
book or document pipeline, because that competes with Leanpub. Books stay in
Leanpub; doc-kitty renders the docsite and the decks.

## The source

[`ars-rethorica`](https://github.com/stijn-dejongh/ars-rethorica) is a revamp of
the public-domain translation of Aristotle's *Rhetoric*, public and licensed
**CC-BY-SA-4.0**. It is a Leanpub Markua manuscript: `manuscript/` holds a
`Book.md` reading order, three parts, a preamble, an introduction, a changelog, and
about sixty chapter files.

## What Markua it exercises

The first chapter alone uses, with real content:

- A blurb with an icon: `{blurb, icon: pencil}`, hitting the callout and icon
  features together (including the `icon:` attribute the
  [Markua note](./markua-syntax-support.md) rated hardest).
- Auto-resolving cross-references: `[#t](#types-of-rhetoric)`.
- Footnotes: `[^^0_1]`.

It is a strong real-world corpus. It also uses Markua features **beyond the current
five-feature subset** (footnotes, auto-title cross-references), so converting it
will either stretch the subset or rely on graceful degradation for those.

## The approach: convert the book into docsite content

Adapt the manuscript into a docsite rather than a linear book: parts become
sections, chapters become pages, with the introduction, a glossary, and a changelog
alongside. The result is realistic, Markua-rich pages rendered as a docsite.

Because *Rhetoric* is not software or project documentation, its natural section set
(the three books) is a **custom** set, not the canonical twelve. Under
[ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md) that is the
tolerated-but-unsupported path, which raises one sub-question below.

## Where the converted content lives (sub-decision)

- **Option A — a separate content showcase.** A distinct example with the book's
  custom sections, Markua content, and real prose, kept apart from the
  convention-dogfood example. The flagship example stays canonical and about the
  toolkit; the showcase demonstrates custom sections plus Markua plus realistic
  content. **Leaning this way.**
- **Option B — the converted book becomes the primary example.** Simpler (one
  example), but the flagship then demonstrates the tolerated-but-unsupported custom
  section path rather than the canonical convention.

## Integration and licensing

Conversion is a one-time transform (chapters to pages plus frontmatter), so a live
submodule is optional; a scripted conversion from the source, or a vendored
converted copy, both work. Note the share-alike implication: the converted pages
are a derivative of CC-BY-SA-4.0 content, so they carry CC-BY-SA-4.0 too, separate
from doc-kitty's own code license. Attribute both the revamp and the public-domain
translation.

## Decision and open items

- **Decided.** Docsite (and presentations) support only; no book or document
  pipeline. Markua is for Leanpub syntax compatibility, not for competing with
  Leanpub.
- **Open.** Where the converted content lives (separate showcase, leaning A), and
  how much to convert (a representative subset of chapters versus the whole book).

## References

- [`stijn-dejongh/ars-rethorica`](https://github.com/stijn-dejongh/ars-rethorica)
  (CC-BY-SA-4.0; public-domain source translation).
- [Supporting Markua syntax](./markua-syntax-support.md),
  [Astro Markdown extensions](./astro-markdown-extensions.md).
