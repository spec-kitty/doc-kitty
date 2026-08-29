---
title: Markua graceful degradation
description: Deliberately malformed Markua that must never fail the build (NFR-002).
doc_status: active
updated: 2026-08-29
type: Guide
kind: Reference
tags: [markua, fixture, degradation]
# Suppress the on-this-page nav (WCAG 2.5.8 target-size theme-chrome issue on a
# short many-heading fixture — the diagram-demonstrator convention).
tableOfContents: false
---
<!-- markdownlint-disable -->
<!-- This is a Markua fixture: it deliberately contains Markua syntax (headings
     inside asides/callouts, fenced code in wrappers, {#id} crosslinks, intentional
     malformed constructs) that conventional markdownlint rules flag. Not conventional
     Markdown; frontmatter + links are still validated by validate:docs/validate:links. -->

# Markua graceful degradation

This page collects the *cannot-fail-the-build* cases. Each construct below is
deliberately malformed; the build must still exit 0 (NFR-002) and every case must
degrade to **readable text** — never broken markup, never a thrown error.

## An unknown icon drops gracefully

A callout naming an icon that is not in the seed map keeps rendering, without the
icon, and the build emits a single warning naming the unknown value:

{icon: fa-obscure-name}
T> This tip names an unknown icon (`fa-obscure-name`). The icon is dropped with a
build warning, and the tip itself still renders. <!-- row 33 -->

## An unsupported attribute is ignored

`{fullbleed:}` is not an honoured figure attribute; it is silently dropped and the
image still renders:

{fullbleed: true, alt: "a placeholder image"}

![A placeholder](palm-trees.svg)

## An unbalanced wrapper stays literal

An `{aside}` with no matching `{/aside}` cannot be grouped, so its marker is left
as literal text and the surrounding content renders normally — the rest of the
page is **not** swallowed:

{aside}
This paragraph follows an unterminated wrapper. The `{aside}` marker above renders
as the literal text `{aside}`, and this paragraph renders as an ordinary
paragraph. <!-- row 35 (unbalanced wrapper) -->

## Ordinary content still renders

The malformed cases above do not break anything that follows them. This closing
paragraph proves the page keeps rendering to the end.
