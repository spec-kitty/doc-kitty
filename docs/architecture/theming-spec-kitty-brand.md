---
title: Spec Kitty brand theme
description: "The derived --dk-* values and atomic-design chrome for the Spec Kitty brand theme, transcribed from the brand guide and self-contained."
doc_status: draft
updated: 2026-08-22
type: Architecture
kind: Reference
authors:
  - stijn@sddevelopment.be
tags: [theme, brand, spec-kitty, tokens, atomic-design]
related:
  - architecture/theming
  - adr/0011-theme-slot-surface-and-per-kind-layouts
---

# Spec Kitty brand theme

The first brand theme (Layer 2 in the `default → brand → consumer` stack of
[theming.md](./theming.md)). It is **derived from the `spec-kitty-design` brand
guide, not imported**: every value below is transcribed into doc-kitty's own
`--dk-*` catalog and its own atomic components, with no build- or run-time
dependency on `@spec-kitty/tokens` or the `spec-kitty-design` repository. This is
the decision in [ADR-0011](../adr/0011-theme-slot-surface-and-per-kind-layouts.md);
the accepted cost is hand-syncing these values if the guide changes.

One structural fact drives the whole mapping: the Spec Kitty brand is
**dark-mode-first** ("Dark mode is the default surface"). doc-kitty must render
both modes, so the **dark column is transcribed** from the guide and the **light
column is derived** (the guide ships no light palette). Derived light values are
flagged throughout and are the main thing to review.

The brand overrides a subset of `--dk-*` (colour, type families, radius, focus,
caps tracking) and **inherits** the rest from the shipped Default: the 4px spacing
ramp (`--dk-space-*`), the layout widths (`--dk-width-*`), the numeric type scale
and leading (`--dk-text-*` / `--dk-leading-*` — the guide's 12→30px scale already
matches the Default), and shadow *geometry* (only the focus-ring colour changes).

## Token overrides

### Surfaces

| `--dk-*` token | Dark (transcribed) | Light (derived) | Brand source |
|---|---|---|---|
| `--dk-color-bg` | `#0D0E11` | `#FBFAF7` warm paper | `--sk-surface-page`; light derived (warm-white) |
| `--dk-color-bg-nav` | `#121317` | `#F4F2ED` | `--sk-surface-hero` |
| `--dk-color-bg-sidebar` | `#121317` | `#F4F2ED` | `--sk-surface-hero` |
| `--dk-color-surface-1` | `#181A1F` | `#FFFFFF` | `--sk-surface-card` |
| `--dk-color-surface-2` | `#1C1F25` | `#F1EEE7` | `--sk-surface-input` |
| `--dk-color-surface-inset` | `#212830` | `#ECE8DF` | `--sk-surface-pill` |
| `--dk-color-border` | `#2B313B` | `#E2DDD1` | `--sk-border-default` |
| `--dk-color-border-strong` | `#353C48` | `#CFC8B8` | `--sk-border-strong` |

### Text

| `--dk-*` token | Dark (transcribed) | Light (derived) | Brand source |
|---|---|---|---|
| `--dk-color-text` | `#D6D6DA` | `#1A1B1F` | `--sk-fg-body`; light from ink `#1A1408` family |
| `--dk-color-text-strong` | `#FFFFFF` | `#0D0E11` | `--sk-fg-default` |
| `--dk-color-text-muted` | `#A9A9B0` | `#5B5B63` | `--sk-fg-muted` |
| `--dk-color-text-accent` (links) | `#F5C518` | `#806508` deep gold | `--sk-color-yellow`; light derived darker for AA |
| `--dk-color-text-invert` | `#1A1408` | `#FBFAF7` | `--sk-fg-on-primary` |

Yellow as *link text* only works on dark. On the light paper `#F5C518` is ~1.3:1 —
unusable — so light link text derives down to a deep gold `#806508` (~5:1). This is
the one place the accent hue must shift by mode.

### Accent (the brand's yellow signal)

| `--dk-*` token | Dark | Light | Brand source |
|---|---|---|---|
| `--dk-color-accent-low` (tint bg) | `#2A2410` | `#FDF3CF` | `--sk-surface-tint-butter`; pale butter (light) |
| `--dk-color-accent` (mid / UI) | `#F5C518` | `#F5C518` | `--sk-color-yellow` — same both modes |
| `--dk-color-accent-high` (hover/strong) | `#FFD84D` | `#C99A0E` | `--sk-color-yellow-soft` / `-yellow-deep` |
| `--dk-color-accent-text` (ink on accent) | `#1A1408` | `#1A1408` | `--sk-color-accent-fg` — dark ink on yellow |

The yellow-fill + dark-ink pairing (`#F5C518` bg, `#1A1408` text) is >10:1 in both
modes — the brand's primary-CTA contract, transcribed verbatim.

### State (each with its paired `-bg` tint — doc-kitty's contract)

| Role | dark text | dark `-bg` | light text (derived) | light `-bg` (derived) | Brand source |
|---|---|---|---|---|---|
| info | `#A9C7E8` | `#14202E` | `#2C5E86` | `#EAF1F8` | `--sk-color-blue` / `-blue-bg` |
| success | `#8FCB8F` | `#15241A` | `#2F6B3A` | `#E7F2E7` | `--sk-color-green` / `-green-bg` |
| warning | `#D9B36A` | `#2A2410` | `#7A5A0A` | `#FBF0CF` | `--sk-color-haygold` (brand has no orange) |
| danger | `#E97373` | `#2E1616` (derived) | `#B3352F` | `#FBE7E6` | `--sk-color-red`; `red-bg` derived |
| neutral | `#A9A9B0` | `#262C36` | `#5B5B63` | `#EFEDE8` | `--sk-fg-muted` / `--sk-surface-muted` |

Dark state pairs are all transcribed and clear AA on their tint. Light pairs are
derived (darkened text + pale tint) and pass AA.

### Type, radius, focus

| `--dk-*` token | Value | Brand source |
|---|---|---|
| `--dk-font-display` | `"Falling Sky", "Swansea", ui-sans-serif, system-ui, sans-serif` | `--sk-font-display` — headings/hero only |
| `--dk-font-sans` | `"Swansea", ui-sans-serif, system-ui, -apple-system, sans-serif` | `--sk-font-sans` — body/labels/nav |
| `--dk-font-mono` | `"JetBrains Mono", ui-monospace, "SFMono-Regular", monospace` | `--sk-font-mono` — code, token names, eyebrows |
| `--dk-weight-normal…display` | `400 / 500 / 600 / 700 / 800` | `--sk-weight-normal…extrabold` (800 = wordmark/hero) |
| `--dk-tracking-caps` | `0.15em` | eyebrow convention (ALL-CAPS mono, wide tracking) |
| `--dk-radius-sm / md / lg / pill` | `8px / 12px / 16px / 999px` | `--sk-radius-sm/md/lg/pill` (chip / card / passport / pill) |
| `--dk-shadow-focus` | dark `0 0 0 3px rgba(245,197,24,.55)` / light `0 0 0 3px #C99A0E` | `--sk-border-focus` `#F5C518` + `--sk-shadow-focus` |

**Inherited untouched:** `--dk-space-*`, `--dk-width-*`, the `--dk-text-*` numeric
scale, `--dk-leading-*`, and `--dk-shadow-sm/md/lg` geometry. The guide prefers 1px
hairlines over shadow for depth; only elevated organisms (the passport) use `-lg`.
Fonts load via Google Fonts (JetBrains Mono) and self-hosted `@font-face` for
Falling Sky / Swansea, declared in the theme's `assets.fonts` — never pulled from
`@spec-kitty/tokens`.

## Chrome and atomic-design language

Built self-contained as doc-kitty's own atoms/molecules/organisms — no
`@spec-kitty/*` components — and specified to WCAG 2.2 AA.

### Atoms

- **Eyebrow label** — `--dk-font-mono`, `text-2xs/xs`, uppercase,
  `letter-spacing: var(--dk-tracking-caps)`, colour `--dk-color-text-muted`. The
  brand's signature label; heads every band and block ("WHO IS THIS FOR",
  "RELATED", "REFERENCES", persona field labels). Muted-on-bg is ≥7:1.
- **Status pill** — `--dk-radius-pill`, `-*-bg` fill + paired `-*` text, **always
  text-labelled, never colour-only** (the metadata-band rule and the brand's
  semantic-pairing rule agree). e.g. `doc_status: draft` → warning pair.
- **Kind tag** — `--dk-radius-sm` chip, `surface-inset` bg, mono uppercase micro-label.
- **Icon** — Lucide-style, 2px stroke, rounded caps, 16px inline / 20px standalone;
  inherits context foreground, `--dk-color-accent` only when active. No emoji, ever.
- **Hairline / border** — 1px `--dk-color-border`; depth from borders, not shadows.
- **Focus ring** — `--dk-shadow-focus` (yellow), 3px with offset so it clears the
  1.3:1 yellow-on-paper problem in light mode; on every interactive target ≥24px.

### Molecules

- **Metadata band** (`dk:metadata-band`) — flat `surface-1` strip under the `<h1>`:
  eyebrow-labelled `doc_status` pill + `updated` (mono, muted) + `description`. No gradient.
- **Related-card** (`dk:related` items) — title in `--dk-color-text-accent`, target
  description in `--dk-color-text-muted`, optional kind tag; card-wide clickable, ≥24px.
- **Reference-item** (`dk:external-references`) — same card pattern, mono citation
  key, external-link icon.
- **Field row** — a `<dl>` label/value pair (eyebrow atom + body value), used in the passport.

### Organisms and per-kind layouts

- **Site header** (`dk:site-header` + `dk:site-title`) — the brand's non-negotiable:
  `logo.webp`/`logo.png` as an `<img>` in the top nav **alongside** the wordmark
  "Spec Kitty" in `--dk-font-display` weight 800. Never text-only. doc-kitty carries
  its own copy of the logo/favicon. Active nav item marked with the yellow accent
  (the only always-on yellow).
- **Footer** (`dk:site-footer`) — flat `surface`/`bg-nav`, hairline top border, muted mono meta.
- **Audience block** (`dk:audience`) — eyebrow "WHO IS THIS FOR", persona links as
  related-cards, page-local `guidance_text` as body.
- **Typed tint panels** — the four brand tints map onto doc-kitty's typed blocks to
  differentiate them without colour-coding meaning: `related` → sky, `external-references`
  → lilac, `audience` → mint, callout/aside → butter. Each carries its **paired**
  foreground token (semantic-pairing rule, enforced).
- **Persona passport** (`Persona`, in-frame, keeps sidebar) — a bounded card at
  `--dk-width-passport`, `--dk-radius-lg`, `--dk-shadow-lg`; a **yellow accent identity
  strip** at the top (the "bow-tie" motif); name as `<h1>` in `--dk-font-display` 800;
  fields as a `<dl>` grid of eyebrow-label + body-value rows; avatar from `hero_image.alt`.
- **Hub list** (`Hub`, in-frame) — lead paragraph, then a named `<nav>` of
  related-cards; card-wide links, ≥24px targets.
- **Presentation deck** (`Presentation`, reveal.js route) — dark `surface-page`
  slides, `display` 800 headings, mono eyebrows, yellow active-bullet/progress; real
  `<button>` controls; mandatory no-JS / reduced-motion stacked-scroll fallback. This
  is the **one** doc-kitty surface where the watercolour mascot may appear (decks are
  "supporting materials" under mascot policy C-101); it stays out of all in-frame chrome.

## Signature brand motifs

1. **Yellow used as a scalpel** — CTAs, active nav, focus rings, the passport
   identity strip, the mascot's bow tie. Never body text, never decorative borders.
2. **ALL-CAPS mono eyebrows** with 0.15em tracking heading every band and block.
3. **Flat dark surfaces differentiated by tint** (no gradients) + **1px hairline
   depth** (no drop shadows except elevated cards).
4. **Pill status, sm-radius chips, md cards, lg passport** — a consistent shape language.
5. **Sentence-case, no-emoji, no-exclamation** copy; canonical nouns capitalised
   (Spec, Work Package, Mission); CLI flow rendered `spec -> plan -> tasks ->
   implement -> review -> merge`.
6. **Diagram theme** (for `docs/architecture` Mermaid/embedded diagrams): yellow
   subgraph titles + node borders (`#F5C518`), blue edges (`#A9C7E8`), card-dark
   fills — doc-kitty carries its own copy of these values, not `sk-mermaid-theme.yaml`.

**Contrast summary (AA).** Body `#D6D6DA`/`#0D0E11` ≈13:1 and `#1A1B1F`/`#FBFAF7`
≈16:1 (AAA); muted ≈7:1 both modes; yellow-fill + dark-ink ≈10:1; all state
text-on-tint pairs ≥4.5:1; light link `#806508` ≈5:1; focus ring meets 3:1 non-text
contrast with the light-mode deep-gold variant + offset.

## Provenance and self-containment

| Value group | Source in `spec-kitty-design` |
|---|---|
| Brand accents, ink, states, all dark hexes | `docs/architecture/decisions/ADR-003-addendum-token-values.md` (canonical hex table) |
| Palette roles, "use yellow sparingly", tint panels, mascot policy C-101 | `docs/design-system/brand-guidelines.md` |
| Type roles, eyebrow convention, scale 12–30 / weights 400–800 | `brand-guidelines.md` + `apps/storybook/src/stories/tokens/typography.mdx` |
| Radius, shadow-focus, semantic-pairing, hairline-not-shadow, logo-in-nav, no-emoji | `doctrine/styleguides/sk-visual-identity.styleguide.yaml` + `docs/design-system/using-tokens.md` |
| Copy voice (sentence case, no `!`, canonical nouns, `->` arrows) | `doctrine/styleguides/sk-brand-voice.styleguide.yaml` |
| Diagram colour roles | `docs/architecture/assets/sk-mermaid-theme.yaml` |
| **All light-mode columns, `red-bg`, warning=haygold mapping** | **Derived** — the guide is dark-only; doc-kitty's own AA-checked extrapolations to review |

**Self-containment confirmed.** Values are re-declared as `--dk-*` in doc-kitty's own
default→brand layering; components are doc-kitty's own atoms/molecules/organisms; logo,
favicon, fonts, and diagram theme are carried as doc-kitty's own copies. Nothing
references `@spec-kitty/tokens`, the CDN, or the repo at build or run time.

## References

- [Theming and chrome](./theming.md), the theme-layer design this brand plugs into.
- [ADR-0011](../adr/0011-theme-slot-surface-and-per-kind-layouts.md), the slot
  surface, per-kind layouts, and the self-contained-brand decision.
- `spec-kitty-design` (brand-guide source; derived, not imported).
