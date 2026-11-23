---
title: Generated pages
description: How a page generator can hide capped pages before the sidebar is built.
doc_status: active
updated: 2026-11-23T00:00:00Z
type: Guide
kind: Explanation
---

# Generated pages

A tool that writes hundreds of pages can mark each one with
`sidebar: { hidden: true }` when its hub is over the cap, so Starlight never
builds the entries the cap would drop. The toolkit's `cappedChildHidden(count, cap)`
says when. The sidebar, the current entry and the previous and next links are
the same with or without the hint.
