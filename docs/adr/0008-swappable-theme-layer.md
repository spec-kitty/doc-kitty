---
title: "ADR-0008: Theme and chrome are a swappable, layered concern"
description: Consumers rebrand the docsite through a defined theme contract, without forking the toolkit.
status: active
updated: 2026-08-21
type: ADR
authors:
  - stijn@sddevelopment.be
related:
  - architecture/theming
  - adr/0004-amend-common-docs-as-extensible-variation
  - plans/roadmap
---

# ADR-0008: Theme and chrome are a swappable, layered concern

## Status

Accepted

## Context

The docsite's look and chrome must be changeable by consumers. The first consumer
is the Spec Kitty product line, which needs its own brand. doc-kitty is expected to
grow into a general, consumer-usable template, so rebranding cannot mean forking
the toolkit or hand-editing its CSS.

doc-kitty already separates content from information architecture: the section
registry (`docs/_meta/sections.yaml`, [ADR-0004](./0004-amend-common-docs-as-extensible-variation.md))
holds labels and ordering as data. Visual presentation needs the same treatment.

## Decision

Theming is a first-class, layered contract with a defined override surface. A theme
controls presentation only; it does not touch content, the convention, or the
section registry.

The override surface, in order of effort: design tokens (CSS custom properties),
assets (logo, favicon, social image, fonts), custom CSS, component overrides
(header, footer, head, and doc-kitty's own chrome), and per-kind page layouts.

Three layers apply in order: a neutral default theme shipped by doc-kitty, a brand
theme a consumer selects, and per-site config for the last word.
`defineDocKittyIntegrations({ theme })` is the entry point; it forwards a theme to
Starlight. Themes target a curated doc-kitty slot surface rather than Starlight
internals, so a Starlight change does not break every theme.

The design lives in [theming.md](../architecture/theming.md).

## Consequences

- A consumer rebrands through tokens and assets (easy) or through components and
  layouts (deep), without forking.
- doc-kitty ships a neutral default plus a Spec Kitty brand theme as the first real
  theme, which also proves the contract.
- The theme surface becomes a stable contract that has to be versioned and kept
  backward-compatible as the template matures.
- The curated slot surface is an extra layer over Starlight to build and maintain.

## Alternatives considered

### Option A: Fork to rebrand

Rejected. It defeats the "consumer-usable template" goal; every brand would carry a
divergent copy of the toolkit.

### Option B: Config-only tokens

Rejected. Tokens cover colours and fonts but not header, footer, or per-kind
layouts, so deeper chrome changes would still need a fork.

### Option C: Expose Starlight slots directly

Rejected as the public surface. It couples every theme to Starlight internals.
doc-kitty maps a curated slot set onto Starlight instead.

## References

- [Theming and chrome](../architecture/theming.md)
- [ADR-0004](./0004-amend-common-docs-as-extensible-variation.md), the section
  registry that separates IA display from content.
- [Roadmap](../plans/roadmap.md), the component and theme system (M2).
