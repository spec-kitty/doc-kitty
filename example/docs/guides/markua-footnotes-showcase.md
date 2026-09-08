---
title: Markua footnotes showcase
description: Markua double-caret footnotes rendered as real, back-linked GFM footnotes (FR-004).
doc_status: draft
updated: 2026-09-08
type: Guide
kind: Reference
tags: [markua, footnotes, fixture, showcase]
# Suppress the on-this-page nav (WCAG 2.5.8 target-size theme-chrome issue on a
# short many-heading fixture — the diagram-demonstrator / markua-showcase convention).
tableOfContents: false
glossary_autolink: false
---
<!-- markdownlint-disable -->
<!-- This is a Markua fixture: it deliberately contains Markua footnote syntax
     (`[^^N_M]` references and `[^^N_M]:` definitions) that conventional markdownlint
     rules flag. Not conventional Markdown; frontmatter + links are still validated
     by validate:docs/validate:links. The page is doc_status: draft so it does not
     move the published-page ratchet (EXPECTED_INDEX_ENTRY_COUNT / SITEMAP). -->

# Markua footnotes showcase

Markua writes footnotes with a **double caret** — a reference marker `[^^N_M]` in
the prose and a definition line `[^^N_M]:` below. With the `markua` preset on, the
`markua-footnotes` pass normalises the marker `remark-gfm` already parsed so the
footnote renders as a real, numbered, back-linked note with a clean anchor id.

## A single footnote

Rhetoric is the counterpart of dialectic[^^0_1], as Aristotle opens Book I.

## Several footnotes, in order

The three kinds of rhetoric are deliberative[^^0_2], forensic[^^0_3], and
epideictic[^^0_4] — each addressing a different hearer and a different time.

## One definition, referenced twice

The enthymeme[^^1_1] is the body of proof; the orator returns to the
enthymeme[^^1_1] as the rhetorical counterpart of the syllogism.

## A footnote marker inside inline code stays literal

The source spelling `[^^0_1]` is shown here verbatim inside a code span, so it is
NOT turned into a footnote — only prose markers become notes.

[^^0_1]: "The counterpart of dialectic" — Rhetoric I.1, 1354a.
[^^0_2]: Deliberative rhetoric concerns the future: exhortation and dissuasion.
[^^0_3]: Forensic (judicial) rhetoric concerns the past: accusation and defence.
[^^0_4]: Epideictic (ceremonial) rhetoric concerns the present: praise and blame.
[^^1_1]: The enthymeme is a rhetorical syllogism drawn from probabilities and signs.
