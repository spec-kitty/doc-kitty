---
title: Markua-Capable Deck
description: A published reveal.js deck proving the Markua subset renders on slides — asides, an attributed paragraph, and a captioned figure — without swallowing a slide boundary.
doc_status: active
updated: 2026-09-06
type: Presentation
kind: Presentation
hero_image:
  src: ./assets/showcase-hero.png
  alt: Layered diagram illustrating the doc-kitty slide-deck pipeline
sidebar:
  hidden: true
authors:
  - stijn@sddevelopment.be
---

## A slide aside that respects its boundary

An author can flag something to be careful about with a Markua line-prefix
aside, right inside a slide's own content.

W> A caution aside authored with the `W>` line prefix, mid-slide — it renders
W> as a callout here and must not swallow the stack boundary that follows.

### The stack boundary still opens

This inner stack slide proves the `###` right after the aside still opens its
own vertical slide — the aside above did not consume it.

## A wrapped aside groups a longer note

An `{aside}…{/aside}` wrapper groups a longer, multi-line note into one
callout without leaving the slide it was authored in.

{aside}
This whole block is wrapped as a Markua aside. It stays fully inside this
slide — the wrapper opens and closes here, so no slide boundary is crossed.
{/aside}

This closing paragraph sits after the wrapper, still on the same slide.

## Attributes target a slide element precisely

A `{…}` attribute line attaches to the block that follows it — never to a
heading it merely sits near.

{#attr-target}

This paragraph carries an id from the `{#attr-target}` attribute line placed
directly above it.

### The heading keeps its own identity

This inner stack slide's heading is unaffected by the attribute line two
blocks above — the boundary it opens was not consumed.

## A body figure renders as an accessible figure

A Markua figure on this slide is distinct from the deck's title-slide hero
image, which stays a lone, caption-less `<img>`.

{alt: "Layered diagram illustrating the doc-kitty slide-deck pipeline"}

![The out-of-frame deck pipeline, captioned on a body slide](./assets/showcase-hero.png)
