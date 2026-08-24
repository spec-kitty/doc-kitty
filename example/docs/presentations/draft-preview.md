---
title: Draft Preview Deck
description: A draft slide deck that exercises the out-of-frame presentation route without publishing anything or moving the build counts.
doc_status: draft
updated: 2026-08-24
type: Presentation
kind: Presentation
authors:
  - stijn@sddevelopment.be
sidebar:
  hidden: true

---

## Why a draft deck

This deck is intentionally **draft**. It forces the out-of-frame route to render
so the routing seam (ADR-0021) and reveal's SSR-safe init (ADR-0022) are proven
at build time — but as a draft it is excluded from every generator (sitemap,
RSS, llms.txt, the agent API) and does not move the published counts.

### What it proves

- The `presentations/[...slug]` route shadows Starlight and emits
  `.reveal > .slides` out-of-frame, not the Starlight article shell.
- reveal is initialized only in the browser; the static build never imports it.

## Second slide

A second heading so the transform (WP02) has more than one slide boundary to
work with, and so the smoke build renders real slide content.

### Speaker aside

Draft decks carry `data-pagefind-ignore`, so none of this text is indexed.
