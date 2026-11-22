---
title: Audit logging
description: How the example product records administrative actions, with the technical measures this page provides evidence for.
doc_status: active
updated: 2026-11-22T00:00:00Z
type: Architecture
kind: Explanation
tags: [security, tom]
related:
  - ref: context/incident-handling
    note: The organisation-wide incident process this product relies on.
tom_classification:
  - events-logging
  - measure: storage-protection
    note: Log archives are encrypted at rest.
---

# Audit logging

> [!NOTE]
> This page is an invented example of a TOM classification. It is not legal
> advice.

The example product writes one log line for every administrative action. Each
line names the actor, the action and the time.

Log archives are encrypted at rest and kept for thirteen months.

## Incidents

Incident handling is an organisation-wide process. This page does not restate
it. It links to [Incident handling](../context/incident-handling.md) through
`related`, so the organisation measures stay written and reviewed in one place.
