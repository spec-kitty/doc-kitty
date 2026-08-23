---
title: "ADR-0011: Theme slot surface and per-kind layouts"
description: How the theme layer works — a curated slot surface, per-kind layout resolution, and the hero_image rename.
doc_status: active
updated: 2026-08-22
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - architecture/theming
  - adr/0008-swappable-theme-layer
  - adr/0009-finalize-metadata-contract
---

# ADR-0011: Theme slot surface and per-kind layouts

## Status

Accepted. Implements [ADR-0008](./0008-swappable-theme-layer.md); supersedes the
`banner` field in [ADR-0009](./0009-finalize-metadata-contract.md).

## Context

ADR-0008 decided that theme and chrome are a swappable, layered concern with a
curated slot surface, but left the mechanism unspecified. This ADR sets how a theme
plugs in, how a page's `kind` selects a layout, and resolves a field-name collision
found while designing it. The full design is in
[theming.md](../architecture/theming.md).

## Decision

1. **Curated slot surface.** doc-kitty registers only four carrier overrides with
   Starlight (`Head`, `PageTitle`, `MarkdownContent`, `Footer`), plus pass-throughs.
   The carriers host doc-kitty's own `dk:` slots (page-hero, metadata-band,
   audience, related, external-references, and the pass-through chrome). Themes
   target `dk:` slot names through a merged virtual manifest; Starlight's
   `components` map is always doc-kitty's carriers. A Starlight rename is a one-file
   fix in the carriers, not a break in every theme.
2. **Per-kind layout resolution.** Primary mechanism: a `kind → layout` registry
   resolved in the `MarkdownContent` carrier, rendering the layout **in the normal
   Starlight frame** so the sidebar, table of contents, search, and pagination keep
   working. `Persona` and `Hub` are in-frame and keep the sidebar. `Presentation` is
   the one exception: it renders through a dedicated reveal.js route, a full-page
   deck engine. An unknown or absent `kind` falls back to the `Default` prose
   layout; the validator warns rather than fails (ADR-0009 open vocabulary).
3. **Rename `banner` to `hero_image`.** The page-hero field `banner {src, alt}`
   collides with Starlight's built-in `banner {content}` (the announcement bar), a
   collision that fails schema validation at build. Rename the page-hero field to
   `hero_image`. This supersedes the `banner` field in ADR-0009; `social_thumb` and
   its fallback are unchanged except that the chain is now `social_thumb` →
   `hero_image.src` → site default.
4. **Wiring.** `defineDocKittyIntegrations({ theme })` merges default → brand →
   consumer and forwards tokens and `customCss` to Starlight and `slots`/`layouts`
   to the virtual manifest.
5. **The Spec Kitty brand theme is self-contained.** The first brand theme takes its
   visual style from the `spec-kitty-design` brand guide, but is **derived, not
   imported**: doc-kitty ships a self-contained atomic-design theme with its own
   `--dk-*` values and components, and takes no dependency on that repository.

## Consequences

- Themes are insulated from Starlight internals, and most rebrands are token-only.
- Per-kind layouts get bespoke rendering without losing Starlight's sidebar, search,
  and TOC, except decks, which deliberately leave the frame.
- The `hero_image` rename touches the metadata contract (a small edit to every page
  that used `banner`, of which there are none yet) and the metadata model.
- The self-contained brand theme means no runtime or build coupling to
  `spec-kitty-design`; the cost is keeping the brand values in sync by hand if that
  guide changes.

## Alternatives considered

### Per-kind: `template: 'splash'` for all structural kinds

Rejected as the default. `splash` strips the sidebar and TOC, which is wrong for
`Persona` and `Hub` (the user's call: keep the sidebar). Only `Presentation` wants a
chrome-free page, and it uses a dedicated reveal route rather than `splash`.

### Import the spec-kitty-design theme as a dependency

Rejected. It would couple doc-kitty's build to an external design repo. A
self-contained, derived theme keeps doc-kitty standalone.

### Keep `banner`, override Starlight's meaning

Rejected. Fighting Starlight's built-in schema is fragile; renaming to `hero_image`
is a one-time, clean change.

## References

- [Theming and chrome](../architecture/theming.md).
- [ADR-0008](./0008-swappable-theme-layer.md), [ADR-0009](./0009-finalize-metadata-contract.md).
- `spec-kitty-design` (brand-guide source for the Spec Kitty brand theme; derived,
  not imported).
