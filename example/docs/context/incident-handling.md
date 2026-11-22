---
title: Incident handling
description: How the example organisation handles an incident, written once for every product and classified as organisation-wide measures.
doc_status: active
updated: 2026-11-22T00:00:00Z
type: Context
kind: Explanation
tags: [operations, tom]
tom_classification:
  - measure: availability-restoration
    scope: organisation
  - measure: accountability
    scope: organisation
    note: Every incident gets a named owner and a written review.
---

# Incident handling

> [!NOTE]
> This page is an invented example of a TOM classification. It is not legal
> advice.

The example organisation handles incidents the same way for every product it
runs. This page describes that process once. Product pages link here instead of
repeating it.

## How an incident runs

1. Whoever notices the problem opens an incident and names an owner.
2. The owner restores service from the latest backup when data is affected.
3. Within five working days, the owner writes a short review: what happened,
   why, and what changes.

## Why the classification says organisation

The process does not belong to one system. Its `tom_classification` entries
carry `scope: organisation`, so tools that gather evidence can list these
measures once, as inherited, for every product that links here.
