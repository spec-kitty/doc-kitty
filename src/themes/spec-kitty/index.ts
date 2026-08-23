/**
 * Spec Kitty brand theme — the `DocKittyTheme` definition (WP04, T015/T018/T019).
 *
 * Layer 2 in the `default → brand → consumer` stack (theming.md §Layering). It is
 * DERIVED, NOT IMPORTED (C-005 / ADR-0011): every brand value lives in this repo's
 * own files (tokens.css, brand.css, assets/), with NO dependency on
 * `@spec-kitty/tokens`, a Spec Kitty CDN, or the `spec-kitty-design` repo.
 *
 * This module is purely DECLARATIVE — no logic. `resolveTheme(specKittyTheme)`
 * (WP01) merges it OVER the shipped Default and `emitTokenSheet` produces the
 * generated sheet; `defineDocKittyIntegrations({ theme: specKittyTheme })` (WP02)
 * forwards `assets` to Starlight-native config and exposes `slots`/`layouts`
 * through the virtual manifest the carriers read.
 *
 * ── Two design notes worth reading before editing ────────────────────────────
 *
 * 1. TOKENS ARE SPLIT BY MODE-VARIANCE, and it is deliberate. `emitTokenSheet`
 *    holds ONE value per `--dk-*` key, so an object `tokens` map cannot express a
 *    colour that differs by mode — in dark it would re-emit the light value. So:
 *      • the MODE-INVARIANT tokens (type families, the 800 display weight, caps
 *        tracking, the radius scale, and the invariant accent signal
 *        `--dk-color-accent` #F5C518 + `--dk-color-accent-text` #1A1408) go in the
 *        object `tokens` below, so they flow straight into the generated Default
 *        sheet (`emitTokenSheet`) — present, correctly, in BOTH its `:root` and its
 *        dark block for the mode-varying keys among them;
 *      • the genuinely PER-MODE colour (surfaces, text incl. links #F5C518 dark /
 *        #806508 light, accent tints, state pairs, the focus ring) ships in
 *        tokens.css with its own `:root` + `:root[data-theme='dark']` blocks,
 *        delivered via `customCss`, which `defineDocKittyIntegrations` layers AFTER
 *        the generated sheet — so it wins by SOURCE ORDER at plain specificity (the
 *        same cascade the base sheet uses to beat Starlight; a Layer-3 consumer
 *        loaded later still overrides cleanly).
 *    (This splits the token surface across two files rather than the single
 *    tokens.css of the literal T015/T016 wording — a consequence of the fixed
 *    `emitTokenSheet` contract, not a preference. Every DoD outcome still holds:
 *    the brand values apply in both modes, the brand sheets declare zero `--sl-*`,
 *    and every mode-varying colour is re-declared under a dark selector.)
 *
 * 2. PATHS ARE PACKAGE-EXPORT SPECIFIERS, matching the carriers/base sheet
 *    (config.ts, manifest.ts). `layouts.Persona` resolves via the existing
 *    `./layouts/*` export once WP06 lands the file. The brand's OWN files under
 *    `src/themes/spec-kitty/` (tokens.css, brand.css, assets, the footer organism)
 *    resolve via a `./themes/*` export that src/package.json does NOT YET declare —
 *    see the ⚠ note by `customCss` below. These are strings resolved at WP07's
 *    themed build, exactly as the WP contract intends; nothing here is imported at
 *    type-check time, so an as-yet-absent target does not break `astro check`.
 */
import type { DocKittyTheme } from '../../lib/theme.js';

export const specKittyTheme: DocKittyTheme = {
  name: 'spec-kitty',

  // No explicit `extends`: `resolveTheme` always prepends the shipped Default
  // layer (theme.ts DEFAULT_LAYER), so the brand inherits the complete neutral
  // catalog — spacing, widths, the numeric type scale, leading, and shadow-sm/md/lg
  // geometry — and overrides only the subset declared here + in tokens.css.

  // MODE-INVARIANT brand tokens (design note 1). These flow into the generated
  // Default sheet via `emitTokenSheet`, so the brand type/radius/tracking and the
  // yellow signal are present in the bridge-adjacent layer. `--sl-*` keys are
  // rejected by `mergeLayers` (ADR-0011) — this map is `--dk-*` only. Per-mode
  // colour lives in tokens.css (customCss), not here.
  tokens: {
    // Type: families (Falling Sky / Swansea named first, robust fallback stacks;
    // proprietary files are NOT shipped and NOT CDN-loaded — see brand.css).
    '--dk-font-display': '"Falling Sky", "Swansea", ui-sans-serif, system-ui, sans-serif',
    '--dk-font-sans': '"Swansea", ui-sans-serif, system-ui, -apple-system, sans-serif',
    '--dk-font-mono': '"JetBrains Mono", ui-monospace, "SFMono-Regular", monospace',
    // Display weight (800) — the wordmark/hero weight the Default does not carry.
    '--dk-weight-display': '800',
    // Eyebrow convention: ALL-CAPS mono, wide tracking (Default is 0.06em).
    '--dk-tracking-caps': '0.15em',
    // Radius: chip / card / passport / pill.
    '--dk-radius-sm': '0.5rem', // 8px
    '--dk-radius-md': '0.75rem', // 12px
    '--dk-radius-lg': '1rem', // 16px
    '--dk-radius-pill': '999px',
    // The invariant accent signal (same in both modes; re-stated in tokens.css too
    // so the palette reads coherently). Emitting them here puts #F5C518 into both
    // blocks of the generated sheet.
    '--dk-color-accent': '#F5C518',
    '--dk-color-accent-text': '#1A1408',
  },

  // ⚠ These specifiers (and `assets`/`slots` below) live under
  // `src/themes/spec-kitty/`, which needs a `./themes/*` export in
  // src/package.json (OUT of this WP's owned files — flagged for WP07). tokens.css
  // MUST precede brand.css: tokens first (C-007 tokens-before-overrides), chrome
  // after. Both layer AFTER the generated Default sheet (seam 2), so the brand wins.
  customCss: [
    '@commondocs-kitty/toolkit/themes/spec-kitty/tokens.css',
    '@commondocs-kitty/toolkit/themes/spec-kitty/brand.css',
  ],

  // Assets ride Starlight-native `logo`/`favicon` (ADR-0015 decision 5): the header
  // renders logo-in-nav with NO Header/SiteTitle override. doc-kitty carries its
  // OWN mark (self-authored SVG placeholders, not copied from spec-kitty-design).
  // `fonts` is the declarative asset list; JetBrains Mono actually loads via the
  // optional Google-Fonts @import in brand.css (brand-sanctioned; mono fallback
  // covers its absence). No proprietary Falling Sky / Swansea files are shipped.
  assets: {
    logo: '@commondocs-kitty/toolkit/themes/spec-kitty/assets/logo.svg',
    favicon: '@commondocs-kitty/toolkit/themes/spec-kitty/assets/favicon.svg',
    socialImage: '@commondocs-kitty/toolkit/themes/spec-kitty/assets/social-card.svg',
    fonts: [
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap',
    ],
  },

  // Brand footer organism — WP05 lands it at
  // src/themes/spec-kitty/components/organisms/SiteFooter.astro (it emits the
  // override-unique `dk-site-footer--brand` class the Footer carrier keys on).
  // Keep this key; the string resolves at WP07's themed build.
  slots: {
    'dk:site-footer':
      '@commondocs-kitty/toolkit/themes/spec-kitty/components/organisms/SiteFooter.astro',
  },

  // Persona passport layout — WP06 lands src/layouts/Persona.astro; resolves via
  // the existing `./layouts/*` export (no package.json change needed for this one).
  layouts: {
    Persona: '@commondocs-kitty/toolkit/layouts/Persona.astro',
  },
};

export default specKittyTheme;
