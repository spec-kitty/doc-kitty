---
title: Markua graceful degradation
description: Deliberately broken Markua that shows how DocKitty degrades to readable text without failing the build.
doc_status: active
updated: 2026-11-18T00:00:00Z
type: Guide
kind: Reference
tags: [markua, fixture, degradation]
---
<!-- markdownlint-disable -->
<!-- This is a Markua fixture: it deliberately contains Markua syntax (headings
     inside asides/callouts, fenced code in wrappers, {#id} crosslinks, intentional
     malformed constructs) that conventional markdownlint rules flag. Not conventional
     Markdown; frontmatter + links are still validated by validate:docs/validate:links. -->

<!-- Maintainers: this page is the NFR-002 fixture. A cold markua-ON build with
     it present must exit 0 (src/scripts/assert-markua-builds.mjs), and the
     build-artifact gate reads its HTML (src/scripts/assert-build-artifacts.mjs). -->

# Markua graceful degradation

I> This page is broken on purpose. Each example below uses Markua syntax that is wrong or unsupported, to show how DocKitty handles mistakes like these.

A Markua mistake never fails the build. The page still builds, and each broken
construct falls back to readable text:

- Something DocKitty cannot render, such as an unknown icon, is dropped, and the
  build log prints a warning that names it.
- An attribute DocKitty does not support is ignored.
- Syntax that cannot be paired up, such as an unclosed wrapper, stays as literal
  text.

For the syntax that works, see the [Markua showcase](/guides/markua-showcase/).

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
