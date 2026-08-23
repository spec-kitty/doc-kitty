---
title: Theming and chrome
description: "How a consumer changes the docsite's look and chrome without forking: slots, tokens, and per-kind layouts."
doc_status: draft
updated: 2026-08-23
type: Architecture
kind: Reference
authors:
  - stijn@sddevelopment.be
tags: [theme, chrome, branding, components, layouts]
related:
  - adr/0008-swappable-theme-layer
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - adr/0015-m2-slot-resolution-and-components-map-seam
  - architecture/metadata-model
---

# Theming and chrome

A consumer must be able to change the docsite's look and chrome without forking
doc-kitty. The first consumer is the Spec Kitty product line, which needs its own
brand; doc-kitty is built to become a general template, so theming is a defined
contract, not ad-hoc CSS. The decision is [ADR-0008](../adr/0008-swappable-theme-layer.md);
the mechanism is [ADR-0011](../adr/0011-theme-slot-surface-and-per-kind-layouts.md).
This page is the design those ADRs point at.

Audience: contributors building the theme layer, and consumers who want to
rebrand.

## What a theme owns, and what it does not

A theme controls presentation only. It does not touch content, the convention, or
the section registry. The same `docs/` tree renders under any theme.

- Theme: colours, type, spacing, logo, favicon, header and footer, custom CSS, and
  the per-kind page layouts.
- Not the theme: the section set and labels (`docs/_meta/sections.yaml`, ADR-0004),
  the frontmatter contract, or any page content.

## Layering and precedence

Three layers, each overriding the one before, each a CSS custom-property scope so
later layers win by cascade order:

1. **Default theme** — shipped by doc-kitty. Sets the entire `--dk-*` catalog and is
   the only layer that must be complete, so an unthemed site is fully styled and
   neutral.
2. **Brand theme** — a named theme a consumer selects (for example a Spec Kitty
   brand). Overrides a subset (mostly colour, type, radius) and may override slots
   or per-kind layouts.
3. **Per-site config** — the last word, for a logo swap or an accent nudge without
   editing the brand theme.

## The token catalog

`--dk-*` is doc-kitty's own stable token surface. Themes and consumers set `--dk-*`
only; a single base stylesheet assigns each `--dk-*` token into the Starlight
`--sl-*` variable it drives. A Starlight rename touches that one base file, not
every theme. Tokens with no `--sl-*` counterpart are doc-kitty-owned and consumed
directly by doc-kitty chrome and layouts.

Notation: **→ `--sl-x`** means the base layer copies this token into `--sl-x`;
**(dk)** means doc-kitty-owned. Defaults are the neutral light theme.

| Category | Tokens (representative) | Bridge |
|---|---|---|
| Surfaces | `--dk-color-bg`, `--dk-color-bg-nav`, `--dk-color-bg-sidebar`, `--dk-color-surface-1/-2/-inset`, `--dk-color-border`, `--dk-color-border-strong` | bg/nav/sidebar/border → `--sl-color-bg`/`-bg-nav`/`-bg-sidebar`/`-hairline`; surfaces (dk) |
| Text | `--dk-color-text`, `-text-strong`, `-text-muted`, `-text-accent`, `-text-invert` | → `--sl-color-text`/`-white`/`-text-accent`; invert (dk) |
| Accent | `--dk-color-accent-low/-/-high`, `-accent-text` | → `--sl-color-accent-low/-/-high`; `-accent-text` (dk) — foreground ON the accent fill, not bridged (ADR-0016). `--sl-color-text-accent` is driven by `--dk-color-text-accent` (Text row), the readable accent-on-background colour. |
| State | `--dk-color-info/success/warning/danger/neutral` + a `-bg` tint each | → `--sl-color-blue/green/orange/red/gray-3` (asides); tints (dk) |
| Type | `--dk-font-sans/-mono/-display`, `--dk-text-2xs…4xl`, `--dk-leading-*`, `--dk-weight-*`, `--dk-tracking-caps` | families → `--sl-font`/`-font-mono`; scale maps by role to `--sl-text-*`; rest (dk) |
| Spacing | `--dk-space-3xs…2xl` (4px ramp) | (dk) — Starlight has no spacing surface |
| Radius | `--dk-radius-sm/md/lg/pill` | (dk) |
| Elevation | `--dk-shadow-sm/md/lg`, `--dk-shadow-focus` | (dk) |
| Layout widths | `--dk-width-content/-sidebar/-band/-deck/-passport` | content/sidebar → `--sl-content-width`/`-sidebar-width`; rest (dk) |

This is the full curated set, deliberately minimal-but-complete: enough to rebrand
colour, type, spacing, and shape, and to drive every chrome and per-kind layout,
without exposing one knob per CSS rule. Each state token has a paired `-bg` tint so
pill and callout text meet contrast without hand-tuning.

**Modes.** Light/dark use Starlight's `data-theme`. Only the mode-varying colour
tokens are re-declared per mode; type, spacing, radius, widths, and shadow geometry
are declared once. Each layer re-declares the same mode-varying subset under its own
dark selector, so a brand or consumer override applies in both modes.

## The slot surface

doc-kitty registers only **four carrier overrides** with Starlight — `Head`,
`PageTitle`, `MarkdownContent`, `Footer` — plus straight pass-throughs for the rest.
The carriers host doc-kitty's own named `dk:` slots. Themes target `dk:` slot names
through a merged virtual manifest; they never write a Starlight override directly, so
a Starlight rename is a one-file fix in the carriers rather than a break in every
theme.

**Layouts and slots resolve at different sites** ([ADR-0015](../adr/0015-m2-slot-resolution-and-components-map-seam.md)).
Layouts resolve at a single site: the `MarkdownContent` carrier reads `entry.data.kind`
and looks up `kind → layout` in the merged manifest, and nowhere else. Slots resolve
per-carrier: each of the four carriers reads the merged manifest for the `dk:` slots it
hosts and renders the theme's component (or doc-kitty's default) at those slot points.
There is no second single site for slots. Through all of this the Starlight `components`
map stays exactly the four carriers — a theme never registers a Starlight override, so
all theme choice flows through the manifest the carriers read.

**Pass-through slots** (a `dk:` name mapped 1:1 onto a Starlight override):
`dk:head` (Head), `dk:site-header` (Header), `dk:site-title` (SiteTitle),
`dk:social-links` (SocialIcons), `dk:site-footer` (Footer), `dk:announcement`
(Banner), `dk:toc` / `dk:toc-mobile` (TableOfContents / MobileTableOfContents),
`dk:pagination` (Pagination), `dk:last-updated` (LastUpdated), `dk:edit-link`
(EditLink).

**Sequencing** ([ADR-0015](../adr/0015-m2-slot-resolution-and-components-map-seam.md),
decision 4). The pass-through slots that map onto **non-carrier** Starlight overrides
— `dk:site-header` (Header), `dk:site-title` (SiteTitle), `dk:announcement` (Banner),
`dk:social-links` (SocialIcons), `dk:toc` (TableOfContents), `dk:pagination`
(Pagination), `dk:last-updated` (LastUpdated), `dk:edit-link` (EditLink) — are
sequenced past M2. Delivering them as `components` map entries would grow the map beyond
the four carriers and break the ADR-0013 seam-3 invariant. A later mission registers
doc-kitty-owned pass-through wrapper components onto those Starlight slots, so the map
still holds only doc-kitty components. The pass-throughs that target carriers — `dk:head`
(Head) and `dk:site-footer` (Footer) — and the own-chrome slots below ship in M2. The
Spec Kitty brand header does not wait for the pass-through surface: it rides
Starlight-native `logo`/`title` config (see §"Wiring").

**Own-chrome slots** (composed inside the carriers, no native Starlight slot):

| Slot | Purpose | Data | Carrier / position |
|---|---|---|---|
| `dk:page-hero` | page hero from `hero_image {src, alt}` via the Astro image pipeline | `entry.data.hero_image` | `PageTitle`, above the `<h1>` |
| `dk:metadata-band` | `doc_status` / `updated` / `description` strip | `entry.data.{doc_status,updated,description}` | `PageTitle`, below the `<h1>` |
| `dk:audience` | "Who is this for" block | `entry.data.audience[]` | `MarkdownContent`, before `<slot/>` |
| `dk:related` | related-pages block | `entry.data.related[]` + resolved targets | `MarkdownContent`, after `<slot/>` |
| `dk:external-references` | external/citation block | `entry.data.external_references[]` + catalog | `MarkdownContent`, after `dk:related` |

The carriers read page state from `Astro.locals.starlightRoute` (the Starlight
route-data API, available from Starlight 0.32 — see
[ADR-0014](../adr/0014-upgrade-starlight-for-route-data-api.md)); custom frontmatter
reaches `entry.data` only because the toolkit's schema extends
`docsSchema({ extend })`.

## Per-kind layout resolution

A page's `kind` selects the layout that wraps its content.

- **In-frame layouts via a registry (primary).** The `MarkdownContent` carrier reads
  `entry.data.kind` and looks it up in a merged `kind → layout` map, rendering that
  layout around the content slot. These layouts render **in the normal Starlight
  frame**, keeping the sidebar, table of contents, search, and pagination. `Persona`
  and `Hub` are in-frame and keep the sidebar.
- **Presentation is the exception.** A `Presentation` renders through a dedicated
  reveal.js route, a full-page deck engine outside the docs frame.
- **Fallback.** An unknown or absent `kind` falls back to the `Default` prose
  layout; the validator warns rather than fails on an unknown `kind`, matching the
  open-vocabulary contract (ADR-0009).

The map lives in the merged theme manifest, not in a component, so a brand or a
consumer overrides one kind's layout without touching doc-kitty. Ship the four Divio
quadrants on the shared `Default` layout first; give the structural kinds (`Hub`,
`Persona`, `Presentation`, and the rest) bespoke layouts as they land.

## The per-kind layouts

Component-level structure and token usage, all specified to WCAG 2.2 AA.

- **`Persona` — passport / character sheet** (in-frame, keeps sidebar). A bounded
  card (`--dk-width-passport`, `--dk-radius-lg`, `--dk-shadow-lg`) with an accent
  identity strip, the persona name as an `<h1>` in `--dk-font-display`, and a
  label/value grid rendered as a `<dl>` so the field relationships are programmatic.
  The avatar uses `hero_image.alt`. **Shipped in M2** as the in-frame passport shell
  rendering generic frontmatter into the `<dl>` grid. Persona-specific authoring
  (dedicated persona fields) and the audience block that links personas to pages
  remain M3.
- **`Hub` — described link list** (in-frame). A lead paragraph, then a `<nav>` with
  an accessible name wrapping a list of described items (each the related-card
  pattern: title in `--dk-color-text-accent`, the target's own description in
  `--dk-color-text-muted`, optional kind tag). Card-wide links, ≥24px targets.
- **`Presentation` — deck shell** (reveal.js route). A staged deck with slide
  navigation, and a mandatory no-JS / reduced-motion linear fallback that renders all
  slides stacked and scrollable, so content is never gated behind the deck
  interaction. Each slide has a heading; controls are real buttons.

The chrome blocks follow the same token discipline: the metadata band renders
`doc_status` as a text-labelled pill (never colour-only), the audience block titles a
panel with persona links plus page-local `guidance_text`, and the related and
external-reference blocks render resolved links as accessible, card-wide targets.

## Shipped themes

doc-kitty ships two themes in this repo:

- **Default** — a neutral, complete theme. It sets the whole `--dk-*` catalog so an
  unthemed site looks clean.
- **Spec Kitty brand** — the first brand theme, **shipped in M2**. It takes its
  visual style from the `spec-kitty-design` brand guide, but is **self-contained and
  derived, not imported**: doc-kitty carries its own atomic-design components and
  `--dk-*` values matching that guide, with no dependency on the `spec-kitty-design`
  repository. Both light and dark render at WCAG 2.2 AA — the dark column is
  transcribed from the guide and the light column is doc-kitty's AA-checked
  derivation, since the guide ships dark-only. The cost of self-containment is keeping
  the values in sync by hand if the guide changes; the benefit is that doc-kitty stays
  standalone (ADR-0011). The full transcribed token mapping and chrome are in
  [the Spec Kitty brand theme](./theming-spec-kitty-brand.md).

## Wiring

`defineDocKittyIntegrations({ theme })` accepts an optional theme and resolves the
three layers before forwarding to Starlight.

```ts
interface DocKittyTheme {
  name?: string;
  extends?: DocKittyTheme;                 // brand extends default; consumer extends brand
  tokens?: Record<string, string> | string; // --dk-* values, or a css file path
  customCss?: string[];                    // layered after the base + tokens
  assets?: { logo?; favicon?; socialImage?; fonts?: string[] };
  slots?: Partial<Record<DkSlotName, string>>;  // dk: slot name -> .astro path
  layouts?: Partial<Record<Kind, string>>;      // kind -> layout .astro path
}
```

Resolution: merge default → brand → consumer (per-key last-wins; `customCss`
concatenates; `tokens` shallow-merge). Emit the merged `--dk-*` map as a generated
stylesheet carrying the `--dk-* → --sl-*` bridge. Forward `assets` to Starlight
`logo`/`favicon` (and `socialImage` to `dk:head`), and `customCss` in precedence
order. Point Starlight's `components` at doc-kitty's four carriers, and expose
`slots`/`layouts` through a virtual manifest the carriers read. Starlight's
`components` map is always doc-kitty's four carriers; all theme choice flows through
the manifest ([ADR-0015](../adr/0015-m2-slot-resolution-and-components-map-seam.md)).

The Spec Kitty brand header rides this `assets` forwarding: its logo-in-nav wordmark
comes from Starlight-native `logo`/`title` config plus brand CSS, so a branded header
renders in M2 without a `Header` override that would grow the `components` map past the
four carriers.

## Version and risk notes

Verify against the pinned Starlight/Astro at build:

- The four carrier overrides (`Head`, `PageTitle`, `MarkdownContent`, `Footer`) are
  the coupling points to re-verify on any Starlight bump; carriers must use
  `Astro.locals.starlightRoute` (Starlight ≥0.32, ADR-0014), not the older `Astro.props`.
- Custom frontmatter (`kind`, `hero_image`, `audience`, `related`,
  `external_references`) reaches `entry.data` only via `docsSchema({ extend })`; the
  toolkit must export the extend schema and the site must wire it.
- `customCss` precedence relies on array order; confirm tokens precede override
  sheets.
- The virtual-manifest injection must be compatible with the Astro 5.2 integration
  API.
- Bespoke per-kind layouts must keep content inside Starlight's searchable content
  region, or Pagefind search coverage regresses.

## References

- [ADR-0008](../adr/0008-swappable-theme-layer.md), the swappable-theme decision.
- [ADR-0011](../adr/0011-theme-slot-surface-and-per-kind-layouts.md), the slot
  surface and per-kind layout resolution.
- [ADR-0015](../adr/0015-m2-slot-resolution-and-components-map-seam.md), the M2 slot
  resolution split, pass-through sequencing, and the components-map seam.
- [Metadata model](./metadata-model.md).
