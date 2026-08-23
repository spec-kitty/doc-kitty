---
work_package_id: WP05
title: Brand atomic component language
dependencies:
- WP04
requirement_refs:
- FR-012
planning_base_branch: feat/component-system-and-theme
merge_target_branch: feat/component-system-and-theme
branch_strategy: Planning artifacts for this mission were generated on feat/component-system-and-theme. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/component-system-and-theme unless the human explicitly redirects the landing branch.
subtasks:
- T021
- T022
- T023
- T024
- T025
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: frontend-freddy
role: implementer
authoritative_surface: src/themes/spec-kitty/components/
create_intent:
- src/themes/spec-kitty/components/
execution_mode: code_change
owned_files:
- src/themes/spec-kitty/components/**
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load your profile before anything else:

```
/ad-hoc-profile-load frontend-freddy
```

You are **frontend-freddy**. This WP builds the brand's self-contained atomic-design
component language. Two hard constraints: (1) WCAG 2.2 AA by construction (≥24px
targets, visible focus, text-labelled status — never colour-only); (2) the three M3
content blocks (`audience`/`related`/`external-references`) may have their atoms
authored, but they stay **unwired to resolved data** (C-010), and the M1 metadata band
is **reused, not rebuilt**.

## Objective

Author the brand's atoms, molecules, and organisms (self-contained, no `@spec-kitty/*`)
so the brand chrome — and the Persona layout (WP06) — are built from one consistent,
accessible shape language.

## Context

- **Settled design**: [theming-spec-kitty-brand.md](../../../docs/architecture/theming-spec-kitty-brand.md)
  §"Chrome and atomic-design language" (atoms/molecules/organisms and the signature
  motifs) and §"Signature brand motifs". [theming.md](../../../docs/architecture/theming.md)
  §"The per-kind layouts" (the chrome token discipline).
- **The surface you build on**: WP04 provides the brand `--dk-*` tokens; consume them
  via `var(--dk-*)`. WP03 provides the per-carrier slot host points a theme's components
  plug into. The M1 metadata band (`src/components/slots/MetadataBand.astro`) already
  exists — **reuse it**, do not rebuild or touch it (it is another WP's/ M1's file).
- **Scope guard (C-010)**: build the atoms the M3 blocks will later consume (related-card,
  reference-item) for Hub/brand chrome, but do NOT wire `dk:audience`/`dk:related`/
  `dk:external-references` to resolved page data.

## Subtasks

### T021 — Atoms [P]

**Purpose**: The smallest brand building blocks, all AA.

**Steps**:
1. Under `src/themes/spec-kitty/components/atoms/` create: **eyebrow label**
   (`--dk-font-mono`, uppercase, `letter-spacing: var(--dk-tracking-caps)`, muted colour);
   **status pill** (`--dk-radius-pill`, `-*-bg` fill + paired `-*` text, **always
   text-labelled**, never colour-only); **kind tag** (`--dk-radius-sm`, surface-inset);
   **focus ring** (a `:focus-visible` utility using `--dk-shadow-focus`, 3px + offset);
   **hairline** (1px `--dk-color-border`).
2. Every interactive atom carries a `.dk-*` class so WP08/WP09 can bind assertions.

**Files**: `src/themes/spec-kitty/components/atoms/*`.

**Validation**: status pill renders a visible text label; focus utility produces a
`.dk-*:focus-visible` rule in the emitted CSS.

**Edge cases**: the status pill must not encode meaning by colour alone (WCAG 1.4.1).

### T022 — Molecules [P]

**Purpose**: Compose atoms into reusable brand molecules.

**Steps**:
1. Under `.../components/molecules/`: **related-card** (title in
   `--dk-color-text-accent`, target description in `--dk-color-text-muted`, optional
   kind tag; card-wide clickable, min target ≥24px); **reference-item** (same card
   pattern, mono citation key, external-link icon); **field row** (a `<dl>` label/value
   pair: eyebrow atom + body value — used by the Persona passport in WP06).
2. Card-wide links use a real `<a>` with ≥24px min target and a visible focus ring.

**Files**: `src/themes/spec-kitty/components/molecules/*`.

**Validation**: related-card min-height/width ≥24px in the emitted CSS; the field row
renders a semantic `<dl>`/`<dt>`/`<dd>`.

**Edge cases**: card-wide click target must not swallow nested interactive elements.

### T023 — Organisms

**Purpose**: The brand's larger chrome units.

**Steps**:
1. Under `.../components/organisms/`: **site header** (logo `<img>` + wordmark; consumes
   WP04's native-header CSS); **footer** (flat `surface`/`bg-nav`, 1px hairline top
   border, muted mono meta) — this is the component WP04's `slots['dk:site-footer']`
   points at, and it **emits the override-unique class `dk-site-footer--brand`** that the
   doc-kitty default footer never emits (the WP03/WP08 slot-override observable that proves
   `slotComponents` resolved); **typed tint panels** (four brand tints mapped to typed blocks:
   `related`→sky, `external-references`→lilac, `audience`→mint, callout/aside→butter),
   each carrying its **paired** foreground token.
2. Depth from 1px hairlines, not drop shadows (only elevated cards use `-lg`).

**Files**: `src/themes/spec-kitty/components/organisms/*`.

**Validation**: the footer organism renders through the `dk:site-footer` slot (WP03);
each tint panel pairs its background tint with the matching foreground token.

**Edge cases**: the header organism must not register a Starlight `Header` override
(ADR-0015) — it is styling over native config.

### T024 — Wire atoms into brand own-chrome; reuse the M1 band; keep M3 blocks unwired

**Purpose**: Assemble the brand chrome from the atoms without rebuilding M1 or wiring M3.

**Steps**:
1. Use the eyebrow/pill/tag atoms across the brand's own-chrome styling.
2. **Reuse** the M1 metadata band (`src/components/slots/MetadataBand.astro`) — style it
   via the brand `--dk-*` tokens; do NOT copy or rebuild it, and do NOT edit that file
   (it belongs to the M1 surface).
3. The `related-card`/`reference-item` atoms exist for Hub/brand chrome; leave the
   `dk:audience`/`dk:related`/`dk:external-references` block wiring absent (M3).

**Files**: `src/themes/spec-kitty/components/**` (composition only).

**Validation**: the band renders under the brand tokens (M1 assertion §1 still green);
grep confirms no wiring reads `entry.data.audience/related/external_references`.

**Edge cases**: rebuilding the band would duplicate the contract and risk M1 regression.

### T025 — Component-level AA construction

**Purpose**: Bake in the AA properties the WP08 assertions and WP09 axe lane verify.

**Steps**:
1. Ensure every interactive atom/molecule has: a `min-height`/`min-width` ≥24px rule and
   a `.dk-*:focus-visible` ring.
2. **Name the brand interactive atom classes** that MUST carry a ≥24px target rule and a
   `:focus-visible` ring — `.dk-related-card`, `.dk-reference-item`, `.dk-passport__field a`,
   and the brand footer/nav interactive targets. WP08 (T046) scopes its target-size +
   focus construction assertions to these exact class names, so they are the contract:
   axe does not machine-verify target-size (WCAG 2.5.8) or visible focus, so these live as
   CSS construction checks and the class names must be stable.
3. Confirm colour is never the sole carrier of meaning (status pill text-labelled; tint
   panels named, not colour-coded meaning).

**Files**: `src/themes/spec-kitty/components/**` css.

**Validation**: the emitted CSS carries `.dk-*` min-target ≥24px rules and
`.dk-*:focus-visible` rules (WP08 scopes its AA assertions to these); WP09 axe run finds
0 serious/critical.

**Edge cases**: an icon-only control needs an accessible name.

## Branch Strategy

Planning and merge branch: `feat/component-system-and-theme`. This WP branches from its
dependency lane (WP04) per `lanes.json`; completed work merges back into
`feat/component-system-and-theme` unless the human redirects it.

## Definition of Done

- Atoms, molecules, organisms exist under `src/themes/spec-kitty/components/`,
  self-contained (no `@spec-kitty/*`), consuming `var(--dk-*)`.
- Interactive components carry ≥24px targets and `.dk-*:focus-visible` rings (present in
  emitted CSS).
- Status pill is text-labelled; tint panels carry paired foregrounds.
- The M1 metadata band is reused (its file untouched); the three M3 blocks are unwired.
- `astro check` + `pnpm assert:artifacts example/dist` (post-dependent builds) stay green.

## Risks

- Rebuilding the M1 band instead of reusing it — duplication + M1 regression risk.
- Wiring an M3 block to resolved data — scope breach (C-010).
- Colour-only status/meaning — WCAG 1.4.1 failure.

## Reviewer Guidance

Confirm the band is reused (its source file untouched), no M3 block is wired, every
interactive component has a ≥24px target + focus ring in the emitted CSS, the status
pill carries a text label, and nothing references `@spec-kitty/*`.
