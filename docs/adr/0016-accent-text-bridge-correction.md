---
title: "ADR-0016: Bridge --sl-color-text-accent from --dk-color-text-accent"
description: The accent-text bridge pointed at the ink-on-fill token and failed AA on dark nav; correct it to the readable accent-on-background token.
doc_status: active
updated: 2026-08-23
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - architecture/theming
  - architecture/theming-spec-kitty-brand
  - adr/0013-m1-chrome-substrate-single-layer
---

# ADR-0016: Bridge --sl-color-text-accent from --dk-color-text-accent

## Status

Accepted. Corrects a bridge pairing shipped in M1 (ADR-0013) and resolves a
contradiction in the [theming.md](../architecture/theming.md) token table. The
theme-layer design (ADR-0008/0011/0015) is unchanged.

## Context

The M1 base stylesheet and the M2 themed bridge both assigned Starlight's accent
**text** variable from the wrong doc-kitty token:

```css
--sl-color-text-accent: var(--dk-color-accent-text);   /* WRONG */
```

`--sl-color-text-accent` is the colour Starlight paints **accent text on the page
or nav background** — links and the header site title. `--dk-color-accent-text` is
the opposite role: the **ink that sits on the accent fill** (dark text on a yellow
button), `#1A1408` in the Spec Kitty brand in both modes. Pairing them made the
site title render `#1A1408` on the dark nav `#121317` — a **1.01:1** contrast ratio,
a serious WCAG 2.2 AA failure.

The two tokens have deceptively similar names, and the theming.md token table listed
**both** `--dk-color-text-accent` (Text row) and `--dk-color-accent-text` (Accent
row) as mapping to `--sl-color-text-accent`, so the implementation had a
contradictory spec to follow.

M1's chrome assertion checked bridge pairings by **name only**, not computed
contrast, so it did not catch this. The M2 Playwright/axe accessibility lane (WP09),
running axe-core across the branded example in both modes, caught it on its first
run — the lane doing exactly what it was added for.

## Decision

Bridge Starlight's accent text variable from the readable accent-on-background
token, and make the ink-on-fill token doc-kitty-owned (unbridged):

```css
--sl-color-text-accent: var(--dk-color-text-accent);   /* #F5C518 dark / #806508 light in the brand */
```

`--dk-color-accent-text` (`#1A1408`) stays doc-kitty-owned — the foreground for the
brand's accent-fill components (CTA buttons, the passport identity strip), which
carry their own contrast (>10:1 on the yellow fill).

Applied consistently in the three places that carry the bridge:

- `src/lib/theme.ts` (the M2 themed-bridge generator, `emitTokenSheet`);
- `src/styles/theme.css` (the M1 Default base sheet);
- `src/scripts/assert-chrome-artifacts.mjs` (the non-fakeable bridge gate,
  `REQUIRED_BRIDGE`), so the assertion tracks the corrected contract.

The theming.md token table is corrected so `--dk-color-accent-text` is marked `(dk)`
(unbridged) and `--sl-color-text-accent` is driven by `--dk-color-text-accent`.

## Consequences

- The header site title and links meet WCAG 2.2 AA in both modes (`#F5C518` on the
  dark nav; `#806508` ≈5:1 on the light nav). The WP09 axe lane goes green.
- The name-only bridge check keeps its value for completeness, and the axe lane now
  covers computed contrast — the two are complementary, and the gap this ADR closes
  motivates keeping the axe lane a required `ci-ok` member.
- The Default (neutral) theme's rendering is unchanged: its
  `--dk-color-text-accent` already resolves to the same value it used before, so the
  correction is brand-visible and Default-neutral.

## Alternatives considered

### Override the site-title colour in the brand only

Rejected. It would mask a wrong bridge for every consumer theme rather than fix the
contract once; any future brand would hit the same 1.01:1 title.

### Leave the bridge; weaken the axe rule

Rejected outright — weakening an accessibility gate to hide a real AA failure
inverts the gate's purpose.

## References

- [Theming and chrome](../architecture/theming.md),
  [Spec Kitty brand theme](../architecture/theming-spec-kitty-brand.md).
- [ADR-0013](./0013-m1-chrome-substrate-single-layer.md) (the M1 substrate the bridge
  shipped in).
