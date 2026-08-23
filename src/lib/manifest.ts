/**
 * Doc Kitty — the merged virtual manifest transport (Mission M2, ADR-0013/0015,
 * research.md Decision 1, spec C-006).
 *
 * This module is the BUILD-TIME transport that carries the resolved theme's
 * `kind → layout` and `dk:slot → component` maps to the render-time carriers.
 * It is an Astro integration, not browser code: at `astro:config:setup` it
 * registers a Vite plugin that serves two generated virtual modules —
 *
 *   - `virtual:doc-kitty/manifest`  — a JS module that STATICALLY imports each
 *     resolved `.astro` path and exports a SYNCHRONOUS `resolveLayout(kind)`
 *     (map lookup, `Default` fallback) plus `slotComponents`. Because every
 *     path is a real top-level `import`, render-time resolution is a plain
 *     synchronous object lookup — there is NO runtime dynamic `import(path)`
 *     (C-006). This is the same mechanism Starlight uses for `virtual:starlight/*`,
 *     so it is proven on the pinned astro@5.18.2 / @astrojs/starlight@0.32.6.
 *   - `virtual:doc-kitty/theme.css` — the generated token sheet (WP01's
 *     `emitTokenSheet`), served as a virtual CSS module so `config.ts` can add
 *     it to `customCss` before the brand/consumer sheets (seam 2). Only
 *     referenced on the themed path; the no-theme build never imports it.
 *
 * The single `MarkdownContent` import site keeps calling `resolveLayout(kind)`
 * with the exact M1 synchronous signature, so the layout-resolution call site is
 * unchanged (ADR-0015 decision 1, seam 1). Per-carrier slot resolution reads
 * `slotComponents` (WP03 wires the carriers).
 */
import type { AstroIntegration } from 'astro';
import { emitTokenSheet, type ResolvedTheme } from './theme.js';

/** The generated JS manifest module the carriers import from. */
export const MANIFEST_MODULE_ID = 'virtual:doc-kitty/manifest';
/** The generated token-sheet CSS module `config.ts` layers into `customCss`. */
export const THEME_CSS_MODULE_ID = 'virtual:doc-kitty/theme.css';

/**
 * An Astro layout component the carrier renders around the content slot — the
 * default-export type of an `.astro` file.
 */
export type LayoutComponent =
  import('astro/runtime/server/index.js').AstroComponentFactory;

/**
 * The synchronous `resolveLayout` contract the generated manifest exports and the
 * `MarkdownContent` carrier calls (unchanged from M1): `kind → layout`, unknown
 * or absent → `Default`. The manifest is a BUILD-TIME virtual module with no
 * static `.d.ts` home in the toolkit sources, so `kind-layouts.ts` re-exports the
 * generated binding under this type.
 */
export type ResolveLayout = (kind: string | undefined) => LayoutComponent;

/** The per-carrier slot lookup the generated manifest exports (WP03 reads it). */
export type SlotComponents = Partial<Record<string, LayoutComponent>>;

/**
 * Doc-kitty's own base layout registrations — package export specifiers resolved
 * from the toolkit workspace dependency, exactly like the carriers in `config.ts`.
 * `Default` is the fallback for every unknown/absent kind; `Hub` is the single
 * base kind (parity with M1 WP04). A theme's `layouts` map merges OVER these
 * per-kind; the `Default` FALLBACK is always doc-kitty's own because `Default`
 * is not a `kind` (ADR-0009 vocabulary), so no theme can displace the fallback.
 */
const DEFAULT_LAYOUT_PATH = '@commondocs-kitty/toolkit/layouts/Default.astro';
const BASE_KIND_LAYOUTS: Readonly<Record<string, string>> = {
  Hub: '@commondocs-kitty/toolkit/layouts/Hub.astro',
};

/** Render an object literal body from prepared `key: value,` lines. */
function objectLiteral(entries: string[]): string {
  return entries.length === 0 ? '{}' : `{\n${entries.join('\n')}\n}`;
}

/**
 * Generate the source of `virtual:doc-kitty/manifest` from a resolved theme.
 *
 * Emits one static `import` per UNIQUE resolved path (deduplicated), then a
 * `kind → component` table, a synchronous `resolveLayout(kind)` (Default
 * fallback), and the `slotComponents` map. Pure and deterministic, so the codegen
 * shape is provable without a build (the build then proves Vite resolves each
 * static import synchronously on the pinned toolchain).
 *
 * No-theme (degenerate) case: `resolved.layouts`/`resolved.slots` are empty, so
 * the manifest equals the M1 static module — `Hub` registered, every other kind
 * → `Default`, no slot overrides.
 */
export function generateManifestSource(resolved: ResolvedTheme): string {
  // Theme `layouts` merge OVER the base kind registrations (per-key last-wins).
  const kindLayouts: Record<string, string> = {
    ...BASE_KIND_LAYOUTS,
    ...resolved.layouts,
  };

  // One stable import identifier per unique path (dedupe identical specifiers).
  const identByPath = new Map<string, string>();
  const importLines: string[] = [];
  const identFor = (path: string, hint: string): string => {
    const existing = identByPath.get(path);
    if (existing) return existing;
    const ident = `__dk_${hint}_${identByPath.size}`;
    identByPath.set(path, ident);
    importLines.push(`import ${ident} from ${JSON.stringify(path)};`);
    return ident;
  };

  const defaultIdent = identFor(DEFAULT_LAYOUT_PATH, 'default');

  const layoutEntries = Object.entries(kindLayouts).map(
    ([kind, path]) => `  ${JSON.stringify(kind)}: ${identFor(path, 'layout')},`,
  );
  const slotEntries = Object.entries(resolved.slots).map(
    ([slot, path]) => `  ${JSON.stringify(slot)}: ${identFor(path as string, 'slot')},`,
  );

  // FR-009 site-default share image: a theme's `assets.socialImage` is statically
  // imported here (same mechanism as the layouts/slots — a real top-level import,
  // so the asset enters Astro's build pipeline and gets a hashed, servable URL)
  // and exported as `themeSocialImage`. The Head carrier forwards it to HeadShare
  // as the terminal share-image fallback (theme socialImage → toolkit default). No
  // theme (or a theme without socialImage) → `undefined`, so the toolkit default
  // still ships (byte-identical to the no-theme path).
  const socialImagePath = resolved.assets.socialImage;
  const socialImageIdent = socialImagePath ? identFor(socialImagePath, 'social') : null;

  return [
    '// AUTO-GENERATED by @commondocs-kitty/toolkit manifest integration (M2). Do not edit.',
    ...importLines,
    '',
    `const __layouts = ${objectLiteral(layoutEntries)};`,
    `const __default = ${defaultIdent};`,
    '',
    '// Synchronous resolution — a plain map lookup, no dynamic import (C-006).',
    'export function resolveLayout(kind) {',
    '  return (kind && __layouts[kind]) || __default;',
    '}',
    '',
    `export const slotComponents = ${objectLiteral(slotEntries)};`,
    '',
    `export const themeSocialImage = ${socialImageIdent ?? 'undefined'};`,
    '',
  ].join('\n');
}

/**
 * The Astro integration that transports the resolved theme to the carriers.
 *
 * Registered by `defineDocKittyIntegrations` (WP02). Serves both virtual modules
 * from a single Vite plugin, mirroring Starlight's `\0`-prefixed virtual-module
 * convention. The token-sheet module is served un-prefixed with its `.css` id so
 * Vite's CSS pipeline processes it as a real stylesheet (kept separate from the
 * brand/consumer sheets — WP08's two-stylesheet invariant).
 */
export function docKittyManifest(resolved: ResolvedTheme): AstroIntegration {
  const manifestSource = generateManifestSource(resolved);
  const themeCss = emitTokenSheet(resolved);
  const RESOLVED_MANIFEST = `\0${MANIFEST_MODULE_ID}`;

  // A minimal Vite plugin; its shape is checked structurally against Vite's
  // `PluginOption` at the `updateConfig({ vite })` call below (no `vite` type
  // import needed — Astro re-exports the Vite config type transitively).
  const plugin = {
    name: 'doc-kitty:manifest',
    resolveId(id: string): string | null {
      // JS manifest: \0-prefixed so no other plugin transforms it.
      if (id === MANIFEST_MODULE_ID) return RESOLVED_MANIFEST;
      // CSS sheet: keep the `.css` id (un-prefixed) so Vite treats it as CSS.
      if (id === THEME_CSS_MODULE_ID) return THEME_CSS_MODULE_ID;
      return null;
    },
    load(id: string): string | null {
      if (id === RESOLVED_MANIFEST) return manifestSource;
      if (id === THEME_CSS_MODULE_ID) return themeCss;
      return null;
    },
  };

  return {
    name: 'doc-kitty:manifest',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({ vite: { plugins: [plugin] } });
      },
    },
  };
}
