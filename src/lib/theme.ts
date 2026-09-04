/**
 * Doc Kitty — the theme-resolution core (Mission M2, ADR-0008/0011/0013).
 *
 * This module is pure, framework-agnostic TypeScript: it owns the public
 * `DocKittyTheme` contract, the `default → brand → consumer` merge, and the
 * generated token-sheet emission. It does NOT touch `config.ts` (WP02 wires it)
 * and renders nothing.
 *
 * Two paths:
 *  - `resolveTheme(undefined)` — the M1-degenerate no-theme case: the Default
 *    `--dk-*` catalog and NO generated sheet (`generated: false`; WP02 reads that
 *    flag to skip emission). `customCss` carries the Default layer's TWO static
 *    entries — the token catalog (`DEFAULT_TOKEN_SHEET`) and the global
 *    component-rule sheet (`DK_COMPONENTS_CSS_SHEET`, diagram-component-css
 *    mission NFR-004) — superseding the older single-entry byte-compat guarantee
 *    (M2 NFR-002); the invariant tests were updated deliberately, not silently
 *    broken.
 *  - `resolveTheme(theme)` — flatten `extends`, merge over the shipped Default,
 *    and `emitTokenSheet(resolved)` produces a stylesheet that re-declares the
 *    merged `--dk-*` catalog + the `--dk-*→--sl-*` bridge, fully substituting
 *    `theme.css` so brand/consumer `customCss` can layer after it. `config.ts`
 *    replaces only the `customCss` entry matching `DEFAULT_TOKEN_SHEET` by
 *    IDENTITY (finding #3) — never a fixed index — so the component sheet and
 *    every later brand/consumer sheet ride through untouched (C-002).
 *
 * The Default catalog + bridge below MIRROR `src/styles/theme.css` (the shipped
 * source of truth). ADR-0011's `--dk-*`-only rule is enforced: a theme sets
 * `--dk-*` only, and no `--sl-*` is ever emitted as a literal value — `--sl-*`
 * appears solely as `--sl-x: var(--dk-y)` in the bridge (FR-004).
 */

// `Kind` is the layout-map key vocabulary — re-exported, never redefined
// (ADR-0009 owns it in schema.ts).
export type { Kind } from './schema.js';
import type { Kind } from './schema.js';

/**
 * The `dk:` slot names a theme may target (theming.md "The slot surface").
 * A theme addresses these carrier slots, never Starlight's `components` map.
 */
export type DkSlotName =
  | 'dk:head'
  | 'dk:site-header'
  | 'dk:site-title'
  | 'dk:social-links'
  | 'dk:site-footer'
  | 'dk:announcement'
  | 'dk:toc'
  | 'dk:toc-mobile'
  | 'dk:pagination'
  | 'dk:last-updated'
  | 'dk:edit-link'
  | 'dk:page-hero'
  | 'dk:metadata-band'
  | 'dk:audience'
  | 'dk:related'
  | 'dk:external-references';

/** Assets forwarded to Starlight-native slots + `dk:head` (per-key last-wins). */
export interface DocKittyAssets {
  logo?: string;
  favicon?: string;
  socialImage?: string;
  fonts?: string[];
}

/**
 * The theme record a consumer passes to `defineDocKittyIntegrations({ theme })`.
 * Stable public surface (NFR-006): a breaking change requires an ADR.
 */
export interface DocKittyTheme {
  name?: string;
  /** The layer this refines: brand `extends` default; consumer `extends` brand. */
  extends?: DocKittyTheme;
  /** `--dk-*` values (object) or a css path declaring them. NEVER `--sl-*`. */
  tokens?: Record<string, string> | string;
  /** Extra stylesheets, layered AFTER the token sheet, in precedence order. */
  customCss?: string[];
  assets?: DocKittyAssets;
  /** `dk:` slot name → `.astro` path. */
  slots?: Partial<Record<DkSlotName, string>>;
  /** `kind` → layout `.astro` path. */
  layouts?: Partial<Record<Kind, string>>;
}

/**
 * The flattened, merged result the Astro integration (WP02) consumes.
 *
 * `generated` is `false` ONLY for the `resolveTheme(undefined)` M1 path, so the
 * caller can skip emission entirely (NFR-002). `tokenSheets` carries css-path
 * `tokens` (the string form) for the emitter to `@import` rather than inline.
 */
export interface ResolvedTheme {
  name?: string;
  tokens: Record<string, string>;
  customCss: string[];
  assets: DocKittyAssets;
  slots: Partial<Record<DkSlotName, string>>;
  layouts: Partial<Record<Kind, string>>;
  tokenSheets: string[];
  generated: boolean;
}

/**
 * The M1 static token-sheet specifier, present once in every merged
 * `customCss` (the Default layer's first entry). `config.ts` replaces THIS
 * specific entry — matched by IDENTITY, not position (finding #3) — with the
 * generated token sheet when a theme is active, so its position within
 * `customCss` is not load-bearing for that replacement.
 */
export const DEFAULT_TOKEN_SHEET = '@commondocs-kitty/toolkit/styles/theme.css';

/**
 * The standalone global component-rule sheet (`.dk-callout*` + `.dk-diagram*`,
 * diagram-component-css mission / #59/#60/#68). One entry of
 * `GLOBAL_COMPONENT_SHEETS` below — deliberately never matched by
 * `config.ts`'s token-sheet replacement (only `DEFAULT_TOKEN_SHEET` is) — so
 * it survives that replacement and bundles into branded docs on both the
 * no-theme and themed paths (C-002). `DeckLayout` links it explicitly for the
 * out-of-frame deck route, which gets no global `customCss` injection.
 */
export const DK_COMPONENTS_CSS_SHEET = '@commondocs-kitty/toolkit/styles/dk-components.css';

/**
 * The single-owner list of GLOBAL component-rule sheets — every static sheet
 * (besides the token sheet) that must reach BOTH delivery surfaces: the
 * in-frame docs `customCss` injection (`config.ts`, via `DEFAULT_LAYER`
 * below) and the out-of-frame deck route (`DeckLayout.astro`, which gets no
 * global `customCss` injection at all and so links each entry explicitly).
 * Today this holds exactly one sheet (`DK_COMPONENTS_CSS_SHEET`); a future
 * second global component sheet is added HERE, not independently in each
 * consumer — `DeckLayout` maps over this list against its own statically
 * `?url`-imported hrefs and throws at build time if an entry has no matching
 * import, so an out-of-sync addition fails loud instead of silently missing
 * the deck (finding #2, diagram-component-css review).
 */
export const GLOBAL_COMPONENT_SHEETS: readonly string[] = [DK_COMPONENTS_CSS_SHEET];

/**
 * The Default `--dk-*` catalog — LIGHT / base values, in declaration order.
 * Mirrors the `:root` block of `src/styles/theme.css`. This is the only layer
 * that must be complete; brand/consumer override a subset (ADR-0013).
 */
const DEFAULT_BASE: Record<string, string> = {
  // Type: families
  '--dk-font-sans':
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
  '--dk-font-mono':
    "ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  '--dk-font-display': 'var(--dk-font-sans)',
  // Type: modular scale
  '--dk-text-2xs': '0.6875rem',
  '--dk-text-xs': '0.75rem',
  '--dk-text-sm': '0.875rem',
  '--dk-text-base': '1rem',
  '--dk-text-lg': '1.125rem',
  '--dk-text-xl': '1.25rem',
  '--dk-text-2xl': '1.5rem',
  '--dk-text-3xl': '1.875rem',
  '--dk-text-4xl': '2.25rem',
  // Type: leading, weights, caps tracking
  '--dk-leading-tight': '1.2',
  '--dk-leading-normal': '1.5',
  '--dk-leading-relaxed': '1.7',
  '--dk-weight-normal': '400',
  '--dk-weight-medium': '500',
  '--dk-weight-semibold': '600',
  '--dk-weight-bold': '700',
  '--dk-tracking-caps': '0.06em',
  // Spacing: 4px ramp
  '--dk-space-3xs': '0.125rem',
  '--dk-space-2xs': '0.25rem',
  '--dk-space-xs': '0.5rem',
  '--dk-space-sm': '0.75rem',
  '--dk-space-md': '1rem',
  '--dk-space-lg': '1.5rem',
  '--dk-space-xl': '2rem',
  '--dk-space-2xl': '3rem',
  // Radius
  '--dk-radius-sm': '0.25rem',
  '--dk-radius-md': '0.5rem',
  '--dk-radius-lg': '0.875rem',
  '--dk-radius-pill': '999px',
  // Elevation (geometry once; focus ring keys off the accent-low token)
  '--dk-shadow-sm': '0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.1)',
  '--dk-shadow-md': '0 2px 4px rgba(16, 24, 40, 0.06), 0 4px 8px rgba(16, 24, 40, 0.1)',
  '--dk-shadow-lg': '0 4px 8px rgba(16, 24, 40, 0.08), 0 12px 24px rgba(16, 24, 40, 0.12)',
  '--dk-shadow-focus': '0 0 0 3px var(--dk-color-accent-low)',
  // Layout widths
  '--dk-width-content': '45rem',
  '--dk-width-sidebar': '18rem',
  '--dk-width-band': '50rem',
  '--dk-width-deck': '60rem',
  '--dk-width-passport': '32rem',
  // Mode-varying COLOUR tokens — LIGHT (default)
  '--dk-color-bg': '#ffffff',
  '--dk-color-bg-nav': '#f7f8fa',
  '--dk-color-bg-sidebar': '#f2f4f7',
  '--dk-color-surface-1': '#f7f8fa',
  '--dk-color-surface-2': '#eceef2',
  '--dk-color-surface-inset': '#e4e7ec',
  '--dk-color-border': '#d0d5dd',
  '--dk-color-border-strong': '#98a2b3',
  '--dk-color-text': '#3a4149',
  '--dk-color-text-strong': '#101828',
  '--dk-color-text-muted': '#5a6069',
  '--dk-color-text-accent': 'var(--dk-color-accent-text)',
  '--dk-color-text-invert': '#ffffff',
  '--dk-color-accent-low': '#e7effb',
  '--dk-color-accent': '#3159c4',
  '--dk-color-accent-high': '#1d3d94',
  '--dk-color-accent-text': '#1d3d94',
  '--dk-color-info': '#14539e',
  '--dk-color-info-bg': '#e8f1fb',
  '--dk-color-success': '#146c3a',
  '--dk-color-success-bg': '#e4f4ea',
  '--dk-color-warning': '#8a4b00',
  '--dk-color-warning-bg': '#fbecd2',
  '--dk-color-danger': '#b42318',
  '--dk-color-danger-bg': '#fbe9e7',
  '--dk-color-neutral': '#3f4650',
  '--dk-color-neutral-bg': '#eceef2',
  // Diagram surfaces (ADR-0024) — LIGHT values. Consumed by the render owner into
  // Mermaid `themeVariables`; mode-varying, so re-declared in DEFAULT_DARK below.
  // AA pairs proven by src/tests/diagram-tokens.test.ts.
  '--dk-diagram-node-fill': '#eceef2',
  '--dk-diagram-node-border': '#5b6472',
  '--dk-diagram-node-text': '#1d2733',
  '--dk-diagram-edge': '#33507f',
  '--dk-diagram-subgraph-title': '#26324a',
  '--dk-diagram-cluster-fill': '#eef1f6',
};

/**
 * The mode-varying COLOUR subset — DARK override values, in declaration order.
 * Mirrors the `:root[data-theme='dark']` block of `theme.css`. Its KEYS are the
 * enumerated mode-varying set the emitter re-declares under the dark selector so
 * a brand override applies in BOTH modes; non-colour tokens are declared once.
 */
const DEFAULT_DARK: Record<string, string> = {
  '--dk-color-bg': '#131721',
  '--dk-color-bg-nav': '#171c28',
  '--dk-color-bg-sidebar': '#10141d',
  '--dk-color-surface-1': '#1b212e',
  '--dk-color-surface-2': '#232b3a',
  '--dk-color-surface-inset': '#0d111a',
  '--dk-color-border': '#2a3342',
  '--dk-color-border-strong': '#3d4859',
  '--dk-color-text': '#c4cbd6',
  '--dk-color-text-strong': '#f2f4f8',
  '--dk-color-text-muted': '#9aa3b2',
  '--dk-color-text-invert': '#131721',
  '--dk-color-accent-low': '#16233f',
  '--dk-color-accent': '#7aa0f2',
  '--dk-color-accent-high': '#cddbf9',
  '--dk-color-accent-text': '#a9c2f7',
  '--dk-color-info': '#9cc3f5',
  '--dk-color-info-bg': '#16273f',
  '--dk-color-success': '#7fd6a3',
  '--dk-color-success-bg': '#14301f',
  '--dk-color-warning': '#ecc16a',
  '--dk-color-warning-bg': '#33260c',
  '--dk-color-danger': '#f2a79c',
  '--dk-color-danger-bg': '#351613',
  '--dk-color-neutral': '#aab3c2',
  '--dk-color-neutral-bg': '#232b3a',
  // Diagram surfaces (ADR-0024) — DARK values. Neutral motif harmonising with the
  // Default dark palette; AA pairs proven by src/tests/diagram-tokens.test.ts.
  '--dk-diagram-node-fill': '#1e2532',
  '--dk-diagram-node-border': '#8a94a6',
  '--dk-diagram-node-text': '#dbe1ea',
  '--dk-diagram-edge': '#8fb0f0',
  '--dk-diagram-subgraph-title': '#aebfe0',
  '--dk-diagram-cluster-fill': '#0e131c',
};

/** The enumerated mode-varying colour token names (re-declared under dark). */
const MODE_VARYING: readonly string[] = Object.keys(DEFAULT_DARK);

/**
 * The `--dk-*→--sl-*` bridge, as `[--sl-*, --dk-*]` pairs in declaration order.
 * Mirrors the `:root:root` block of `theme.css`. The RHS is always a `--dk-*`
 * name; the emitter writes `--sl-x: var(--dk-y)` — never a literal (FR-004).
 */
const BRIDGE: ReadonlyArray<readonly [string, string]> = [
  // Surfaces
  ['--sl-color-bg', '--dk-color-bg'],
  ['--sl-color-bg-nav', '--dk-color-bg-nav'],
  ['--sl-color-bg-sidebar', '--dk-color-bg-sidebar'],
  ['--sl-color-hairline', '--dk-color-border'],
  // Text
  ['--sl-color-text', '--dk-color-text'],
  ['--sl-color-white', '--dk-color-text-strong'],
  ['--sl-color-gray-2', '--dk-color-text-muted'],
  // Starlight's accent TEXT colour (links, site title on the page/nav bg) must be
  // the readable accent-on-background token --dk-color-text-accent (brand: #F5C518
  // dark / #806508 light), NOT --dk-color-accent-text (ink ON the accent fill,
  // #1A1408) — the latter is 1.01:1 on the dark nav. The WP09 axe lane caught this;
  // --dk-color-accent-text is dk-owned (accent-fill foreground), unbridged. See ADR-0016.
  ['--sl-color-text-accent', '--dk-color-text-accent'],
  // Accent
  ['--sl-color-accent-low', '--dk-color-accent-low'],
  ['--sl-color-accent', '--dk-color-accent'],
  ['--sl-color-accent-high', '--dk-color-accent-high'],
  // State (asides)
  ['--sl-color-blue', '--dk-color-info'],
  ['--sl-color-green', '--dk-color-success'],
  ['--sl-color-orange', '--dk-color-warning'],
  ['--sl-color-red', '--dk-color-danger'],
  ['--sl-color-gray-3', '--dk-color-neutral'],
  // Type families + scale
  ['--sl-font', '--dk-font-sans'],
  ['--sl-font-mono', '--dk-font-mono'],
  ['--sl-text-xs', '--dk-text-xs'],
  ['--sl-text-sm', '--dk-text-sm'],
  ['--sl-text-base', '--dk-text-base'],
  ['--sl-text-lg', '--dk-text-lg'],
  ['--sl-text-xl', '--dk-text-xl'],
  ['--sl-text-2xl', '--dk-text-2xl'],
  ['--sl-text-3xl', '--dk-text-3xl'],
  ['--sl-text-4xl', '--dk-text-4xl'],
  // Layout widths
  ['--sl-content-width', '--dk-width-content'],
  ['--sl-sidebar-width', '--dk-width-sidebar'],
];

/** The shipped Default layer: full catalog + its static sheets — the token
 * catalog (brand-replaceable, matched by IDENTITY not position — see
 * `config.ts`'s `customCss` derivation) followed by every `GLOBAL_COMPONENT_SHEETS`
 * entry (survives brand token-sheet replacement — NFR-004/C-002). */
const DEFAULT_LAYER: DocKittyTheme = {
  tokens: { ...DEFAULT_BASE },
  customCss: [DEFAULT_TOKEN_SHEET, ...GLOBAL_COMPONENT_SHEETS],
};

/**
 * Flatten a theme's `extends` chain into `[outermost-ancestor, …, this]`.
 * Guards against a cyclic `extends` (a theme that, directly or transitively,
 * extends itself) by tracking visited layer objects.
 */
function flattenChain(theme: DocKittyTheme): DocKittyTheme[] {
  const chain: DocKittyTheme[] = [];
  const seen = new Set<DocKittyTheme>();
  let current: DocKittyTheme | undefined = theme;
  while (current) {
    if (seen.has(current)) {
      throw new Error('DocKittyTheme.extends cycle detected');
    }
    seen.add(current);
    chain.push(current);
    current = current.extends;
  }
  return chain.reverse();
}

/**
 * Fold an ordered layer list (base first) into a single `ResolvedTheme`:
 *  - `tokens` shallow-merge (later `--dk-*` keys win; un-named inherit);
 *  - `customCss` concatenate in layer order;
 *  - `assets`, `slots`, `layouts`, `name` per-key last-wins.
 *
 * Enforces the `--dk-*`-only rule (ADR-0011/FR-004): a `--sl-*` key in an object
 * `tokens` throws, so no `--sl-*` literal can ever reach the emitted sheet. A
 * string `tokens` (css path) is recorded in `tokenSheets` for the emitter to
 * reference rather than inlining. Always yields `generated: true`; the no-theme
 * distinction is owned by `resolveTheme`.
 */
export function mergeLayers(layers: DocKittyTheme[]): ResolvedTheme {
  const resolved: ResolvedTheme = {
    tokens: {},
    customCss: [],
    assets: {},
    slots: {},
    layouts: {},
    tokenSheets: [],
    generated: true,
  };

  for (const layer of layers) {
    if (layer.name !== undefined) resolved.name = layer.name;

    if (typeof layer.tokens === 'string') {
      resolved.tokenSheets.push(layer.tokens);
    } else if (layer.tokens) {
      for (const [key, value] of Object.entries(layer.tokens)) {
        if (key.startsWith('--sl-')) {
          throw new Error(
            `DocKittyTheme.tokens sets a Starlight variable (${key}); themes set --dk-* only (ADR-0011).`,
          );
        }
        resolved.tokens[key] = value;
      }
    }

    if (layer.customCss) resolved.customCss.push(...layer.customCss);
    if (layer.assets) resolved.assets = { ...resolved.assets, ...layer.assets };
    if (layer.slots) resolved.slots = { ...resolved.slots, ...layer.slots };
    if (layer.layouts) resolved.layouts = { ...resolved.layouts, ...layer.layouts };
  }

  return resolved;
}

/**
 * Resolve a theme into a `ResolvedTheme`.
 *
 * `undefined` → the M1-degenerate no-theme path: the Default catalog,
 * `customCss = [DEFAULT_TOKEN_SHEET, DK_COMPONENTS_CSS_SHEET]` (NFR-004 — the
 * component sheet ships alongside the token sheet even with no theme active),
 * and `generated: false` so the caller skips emission. Any provided theme
 * (including `{}`) merges over the shipped Default and yields `generated: true`
 * — `{}` simply adds nothing extra.
 */
export function resolveTheme(theme?: DocKittyTheme): ResolvedTheme {
  if (theme === undefined) {
    const base = mergeLayers([DEFAULT_LAYER]);
    base.generated = false;
    return base;
  }
  return mergeLayers([DEFAULT_LAYER, ...flattenChain(theme)]);
}

/** Alias for {@link resolveTheme}: merge a theme over the shipped Default. */
export const mergeTheme = resolveTheme;

/** Serialise one CSS declaration block. */
function block(selector: string, decls: string[]): string {
  return `${selector} {\n${decls.map((d) => `  ${d}`).join('\n')}\n}`;
}

/**
 * Emit the generated stylesheet for a resolved theme: the merged `--dk-*` block,
 * the mode-varying subset re-declared under the dark selector, and the
 * `--dk-*→--sl-*` bridge — a full substitute for `theme.css` that brand/consumer
 * `customCss` layer after.
 *
 * The dark block re-declares each mode-varying token using the theme's overriding
 * value when it differs from the Default light value (so a brand override applies
 * in both modes), otherwise the Default dark value. The bridge is written at
 * `:root:root` (specificity 0,2,0) to beat Starlight's `[data-theme='light']`
 * block in both modes, matching `theme.css`. No `--sl-*` literal is ever emitted
 * (FR-004): `--sl-*` appears only as `--sl-x: var(--dk-y)`.
 */
export function emitTokenSheet(resolved: ResolvedTheme): string {
  const parts: string[] = [];

  // css-path `tokens` are referenced, not inlined (`@import` must precede rules).
  for (const sheet of resolved.tokenSheets) {
    parts.push(`@import url('${sheet}');`);
  }

  // :root — the merged --dk-* catalog (base / light values).
  parts.push(
    block(
      ':root',
      Object.entries(resolved.tokens).map(([name, value]) => `${name}: ${value};`),
    ),
  );

  // Dark: re-declare the mode-varying subset (override wins in both modes).
  parts.push(
    block(
      ":root[data-theme='dark']",
      MODE_VARYING.map((name) => {
        const merged = resolved.tokens[name];
        const overridden = merged !== undefined && merged !== DEFAULT_BASE[name];
        const value = overridden ? merged : DEFAULT_DARK[name];
        return `${name}: ${value};`;
      }),
    ),
  );

  // The bridge, at :root:root — always `var(--dk-*)`, never a literal.
  parts.push(
    block(
      ':root:root',
      BRIDGE.map(([sl, dk]) => `${sl}: var(${dk});`),
    ),
  );

  return parts.join('\n\n') + '\n';
}
