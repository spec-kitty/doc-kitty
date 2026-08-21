---
title: Theming and chrome
description: "How a consumer changes the docsite's look and chrome without forking the toolkit."
status: draft
updated: 2026-08-21
type: Architecture
authors:
  - stijn@sddevelopment.be
tags: [theme, chrome, branding, components]
related:
  - adr/0008-swappable-theme-layer
  - architecture/starlight-integration
  - architecture/metadata-model
---

# Theming and chrome

A consumer must be able to change the docsite's look and chrome without forking
doc-kitty. The first consumer is the Spec Kitty product line, which needs its own
brand. doc-kitty is expected to become a general template, so theming is a defined
contract, not ad-hoc CSS in one repo.

Audience: contributors building the theme layer, and consumers who want to
rebrand.

## What a theme owns, and what it does not

A theme controls presentation only. It does not touch content, the convention, or
the section registry. The same `docs/` tree renders under any theme.

- Theme: colours, type, spacing, logo, favicon, header and footer, custom CSS,
  and the per-kind page layouts.
- Not the theme: the section set and labels (that is `docs/_meta/sections.yaml`,
  see [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md)), the
  frontmatter contract, or any page content.

Two display concerns stay separate: `_meta/sections.yaml` is the information
architecture (which sections, in what order, under what labels); the theme is the
visual presentation. A consumer can change one without the other.

## The theme surface

A theme can set the following, in layers of increasing effort. Most rebrands only
need the first two.

1. **Design tokens.** CSS custom properties for colour, type, spacing, and radius.
   A theme sets `--dk-*` tokens, which bridge to Starlight's `--sl-*` tokens. This
   is the low-friction path and covers brand colours and fonts.
2. **Assets.** Logo, favicon, default social image, and web fonts.
3. **Custom CSS.** Extra stylesheets layered after the base, for rules tokens
   cannot express.
4. **Component overrides.** Astro components that replace named slots: the site
   header, footer, and head, plus doc-kitty's own chrome (the metadata band, the
   related and reference blocks). The deep path.
5. **Per-kind layouts.** Templates keyed on `kind` (a `Persona` as a passport, a
   `Hub` as a link list, a `Presentation` as a deck; see
   [the metadata model](./metadata-model.md)). A theme can provide or override
   these.

## Layering and precedence

Three layers, each overriding the one before:

1. **Default theme** — shipped by doc-kitty. Neutral, so an unthemed site looks
   clean.
2. **Brand theme** — a named theme a consumer selects (for example a Spec Kitty
   brand). It overrides tokens, assets, and components.
3. **Consumer config** — per-site overrides in the site's own config, for the last
   word without editing the brand theme.

## How it is wired

`defineDocKittyIntegrations({ theme })` takes a theme and forwards it to Starlight:
tokens and custom CSS become `customCss`, assets become `logo`/`favicon`, and
component overrides become Starlight's `components` map plus doc-kitty's own slots.
A theme is a unit that can live in the site's repo or ship as a package.

To keep themes from coupling to Starlight internals, doc-kitty exposes a curated
slot set (its own named surface) and maps those slots to Starlight. A theme targets
the doc-kitty surface, so a Starlight change does not break every theme.

> **Version-sensitive.** The exact Starlight override API (`components`,
> `customCss`, `logo`) is verified against the pinned version when the theme layer
> is built (M2).

## Decisions

Resolved 2026-08-21:

1. **Packaging.** A theme is a preset or module object now. An npm-package
   convention (`@scope/dk-theme-<name>`) is defined when doc-kitty goes public.
2. **v1 override depth.** Tokens, assets, and custom CSS ship first. Component and
   per-kind-layout overrides arrive with the component system (M2).
3. **Default and brand.** doc-kitty ships a neutral default theme and a Spec Kitty
   brand theme (the first real theme), both in this repo. The brand theme also
   proves the contract.
4. **Slot surface.** Themes target a curated doc-kitty slot set mapped onto
   Starlight, not Starlight's slots directly, so a Starlight change does not break
   every theme.
