---
title: Component system + swappable theme
description: "A component and per-kind layout system with a swappable theme layer a consumer can rebrand without forking."
status: draft
updated: 2026-08-22
type: Feature
moscow:
  level: Must
  rationale: Theme swappability is a hard requirement (ADR-0008) and per-kind layouts underpin later features.
tags: [theming, components]
related:
  - architecture/theming
  - adr/0008-swappable-theme-layer
---

# Component system + swappable theme

Mission M2. A component and per-kind layout system with a theme layer a consumer
can swap to rebrand the site without forking.

Scope: MVP.

Design: [theming and chrome](../../architecture/theming.md) and
[ADR-0008](../../adr/0008-swappable-theme-layer.md).
