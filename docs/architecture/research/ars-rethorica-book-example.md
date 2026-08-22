---
title: A Markua book example (ars-rethorica)
description: "Using a real open-license Markua book as example content, and the book-vs-docsite content-type question it raises."
status: draft
updated: 2026-08-22
type: Architecture
tags: [markua, example, book, content-model]
related:
  - architecture/research/markua-syntax-support
  - architecture/research/astro-markdown-extensions
  - adr/0004-amend-common-docs-as-extensible-variation
  - adr/0009-finalize-metadata-contract
---

# A Markua book example (ars-rethorica)

An idea for the example site: render a real, open-license Markua book instead of
only toy docs. It would exercise the Markua pipeline on genuine content and give
the example substance. This note captures the idea and the product question it
raises. It is a proposal, not a decision.

## The source

[`ars-rethorica`](https://github.com/stijn-dejongh/ars-rethorica) is a revamp of
the public-domain translation of Aristotle's *Rhetoric*. It is public and licensed
**CC-BY-SA-4.0**. It is a Leanpub Markua manuscript: `manuscript/` holds a
`Book.md` reading order, three parts (`BookOne`, `BookTwo`, `BookThree`), a
preamble, an introduction, a changelog, and roughly sixty chapter files
(`book1chapter1.md` and so on).

## What Markua it exercises

The first chapter alone uses, with real content:

- A blurb with an icon: `{blurb, icon: pencil}` (an editor's note). This hits the
  callout and icon features together, including the `icon:` attribute the
  [Markua note](./markua-syntax-support.md) rated hardest.
- Auto-resolving cross-references: `[#t](#types-of-rhetoric)`,
  `[#t](#book-one-glossary)`. `[#t]` inserts the target's title, which is richer
  than the plain anchor links the Markua note covered.
- Footnotes: `[^^0_1]` throughout.

So it is a strong real-world corpus for the pipeline. It also uses Markua features
**beyond the current five-feature subset** (footnotes, and auto-title
cross-references). Adopting it would either stretch the subset or rely on graceful
degradation for those constructs.

## The modeling question: book vs docsite

The book is a **linear manuscript** (parts, then chapters, in a reading order),
not a Common Docs twelve-section docsite. It does not slot into the convention the
main example dogfoods; putting chapters under `context/` or `architecture/` would
be nonsense.

So the real question is a product one: should doc-kitty support a **book /
manuscript content type** (linear parts and chapters, sequential navigation,
footnotes) alongside Common Docs docsites? That would broaden doc-kitty from a
docsite toolkit into a docs-and-books toolkit, which suits an AI-publishing angle
but is a genuine scope expansion. It is a bigger sibling of the `presentations/`
addition (ADR-0004): a new content type, not just a new section.

## Options

1. **Markua pipeline fixture (low commitment).** Vendor a few chapters as a test
   or demo fixture to validate the Markua remark pipeline against real content. No
   book content type; proves rendering.
2. **Flagship book showcase (bigger).** A second example that renders the whole
   manuscript. Needs a book/linear content model and a book layout (parts,
   chapters, reading order, footnotes). Its own mission, gated on a scope decision.
3. **Both, staged.** Fixture first (with Markua support, M2), showcase later if the
   content-type question is answered yes.

## Integration

Pull the book in as a **git submodule**, not a copy. That keeps attribution and
share-alike with the book, and stops doc-kitty's own tree from absorbing CC-BY-SA
content. Attribute both the CC-BY-SA revamp and the underlying public-domain
translation.

## Recommendation

Keep the Common Docs example as the convention dogfood. Adopt `ars-rethorica` as
the Markua showcase: a fixture first, which validates the pipeline on real content,
and a flagship book example later, gated on the content-type decision below.

## Open decision

Pursue a **book/manuscript content type** as a future ADR and mission, or park
`ars-rethorica` as a showcase-only fixture. This is the interesting fork: whether
doc-kitty renders only docsites, or docsites and books.

## References

- [`stijn-dejongh/ars-rethorica`](https://github.com/stijn-dejongh/ars-rethorica)
  (CC-BY-SA-4.0; public-domain source translation).
- [Supporting Markua syntax](./markua-syntax-support.md),
  [Astro Markdown extensions](./astro-markdown-extensions.md).
