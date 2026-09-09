/**
 * Editorial / "press" CONSUMER theme (Mission consumption-test, WP02 / FR-002,
 * contract C-6, research D4).
 *
 * Layer 3 in the `default → brand → consumer` stack (theming.md §Layering). It
 * proves reuse at N=2: a net-new adopter site takes the shipped Spec Kitty brand
 * and refines it further, WITHOUT touching the toolkit source — everything here
 * consumes only the packed `@commondocs-kitty/toolkit` published surface.
 *
 * This module is purely DECLARATIVE (DIRECTIVE_001 — a theme is a data record,
 * no logic): it extends `specKittyTheme` and shallow-overrides a subset of
 * `--dk-*` tokens the `resolveTheme` merge folds OVER the brand, then over the
 * shipped Default.
 *
 * TWO placement rules govern which override goes where (research D4 / D5):
 *
 *  1. MODE-INVARIANT `--dk-*` (a value that is the same in light and dark — a
 *     font family, a radius, the invariant accent signal) goes in the OBJECT
 *     `tokens` map below. `emitTokenSheet` stores one value per key, so these
 *     flow straight into the generated sheet's `:root` block with the press
 *     value already merged over brand+default. A string css-path `tokens` form
 *     would be `@import`ed at the TOP of the generated sheet and then overridden
 *     by the later generated `:root` — inverting consumer precedence — so the
 *     OBJECT form is mandatory here.
 *
 *  2. MODE-VARYING colour (a value that differs by light/dark — surfaces, strong
 *     text) CANNOT live in the object map (one value per key would re-emit the
 *     light value in dark). It ships in `press.css` under BOTH `:root` and
 *     `:root[data-theme='dark']`, delivered via `customCss`, which the toolkit
 *     layers AFTER the generated sheet so the consumer wins by source order at
 *     plain `:root`, and by matching the emitter's `0,2,0` dark specificity in
 *     dark mode. See `press.css`.
 *
 * NEVER set a `--sl-*` key: `mergeLayers` throws on it (ADR-0011 / FR-004). A
 * theme addresses `--dk-*` only; the `--dk-*→--sl-*` bridge is toolkit-owned.
 */
import { specKittyTheme } from '@commondocs-kitty/toolkit/themes/spec-kitty/index.ts';
import type { DocKittyOptions } from '@commondocs-kitty/toolkit/config';

/**
 * The public theme-record type. `DocKittyTheme` is not re-exported from the
 * package root, so we name it via the one published surface that carries it —
 * `defineDocKittyIntegrations`'s `theme` option (`./config`). This keeps the
 * fixture on the tarball's public `exports` only (contract C-0 / NFR-001) with
 * no reach into the toolkit's internal `lib/`.
 */
type DocKittyTheme = NonNullable<DocKittyOptions['theme']>;

export const pressTheme: DocKittyTheme = {
  name: 'press',
  extends: specKittyTheme,

  // MODE-INVARIANT overrides that the brand does NOT restate in its `customCss`
  // (placement rule 1). The brand sets these only as object `tokens`, so they
  // flow through `emitTokenSheet` into the generated sheet's `:root` and nowhere
  // else — making the generated `:root` the LAST (and only) declaration of each,
  // so the merged press value wins outright. Each differs from BOTH the toolkit
  // Default and the brand, proving the CONSUMER layer won (verified by
  // assert-consumer-theme.mjs; `press === default` is a FAIL).
  //
  // The accent GROUP is deliberately NOT here: the brand re-declares
  // `--dk-color-accent` / `--dk-color-accent-text` in `tokens.css` (a `customCss`
  // sheet layered AFTER the generated sheet), so an object-token override of them
  // would be overwritten by the brand's later `tokens.css`. To win, the consumer
  // must override them in `press.css`, which loads after `tokens.css` — see there.
  tokens: {
    // Editorial display face: a serif masthead voice. Default resolves to the
    // sans stack; the brand sets a "Falling Sky"/"Swansea" sans display.
    '--dk-font-display':
      '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, ui-serif, serif',
    // Sharper editorial geometry. Default 0.5rem, brand 0.75rem.
    '--dk-radius-md': '0.125rem',
    // Wider masthead eyebrow tracking. Default 0.06em, brand 0.15em.
    '--dk-tracking-caps': '0.2em',
  },

  // Overrides that must beat the brand's `tokens.css` (placement rule 2): the
  // genuinely mode-varying colours (surface, heading ink) AND the accent group
  // the brand restates per-mode. `customCss` layers AFTER `tokens.css`, so these
  // win by source order at plain `:root` and by matching the emitter's `0,2,0`
  // dark specificity. See `press.css`.
  customCss: ['./src/theme/press.css'],
};

export default pressTheme;
