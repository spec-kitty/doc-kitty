---
title: Authored type that conflicts with the derived type
description: A page that authors a canonical type disagreeing with its section-derived type; authored wins and the mismatch is an advisory warning (FR-003).
doc_status: active
updated: 2026-08-23
type: Guide
kind: Reference
---

# Authored type that conflicts with the derived type

Authored `type: Guide` under a section that derives another type. The gate honors
the authored value and emits an advisory (non-failing) mismatch warning through
its structured `warnings[]`.
