---
title: "Track a consignment in transit"
description: "Tracking is still being designed: these scenarios record the milestones agreed so far, and the carrier event feed they depend on is not live yet."
kind: Specification
doc_status: draft
glossary_context: "shipping"
sources:
  - resource: "features/shipping/track-consignment.feature"
    title: "Gherkin source"
generated:
  by: "doc-kitty-gherkin/0.4.0"
  at: "2026-10-19T08:58:27Z"
  content_hash: "sha256:89bc5addda4b"
---

# Track a consignment in transit

As a shipper\
I want to see where my consignment is on its voyage\
So that I can tell the consignee when to expect it

Tracking is still being designed: these scenarios record the milestones
agreed so far, and the carrier event feed they depend on is not live yet.

*2 scenarios*

## Scenario: Report the latest milestone

- **Given** a consignment loaded onto a sailing from Rotterdam to Felixstowe
- **When** the vessel departs Rotterdam
- **Then** the consignment is reported as in transit

## Scenario: Report a delay against the planned arrival

- **Given** a consignment in transit with a planned arrival on 14 November
- **When** the carrier reports a revised arrival on 16 November
- **Then** the consignment is reported as delayed by 2 days
