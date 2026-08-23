---
title: Selective/redacted publishing (projection)
description: "A projection pipeline that publishes a filtered, redacted subset of a private docs tree."
doc_status: draft
updated: 2026-08-22
type: Feature
kind: Feature
moscow:
  level: Won't
  rationale: Only needed to publish a filtered subset of a private tree, so it is out of this scope and revisited on demand.
tags: [publishing, projection]
related:
  - adr/0006-direct-render-default-projection-deferred
---

# Selective/redacted publishing (projection)

Mission M8. A projection pipeline that publishes a filtered, redacted subset of a
private docs tree instead of rendering it directly.

Scope: Out (this cycle).

Design: [ADR-0006](../../adr/0006-direct-render-default-projection-deferred.md).
