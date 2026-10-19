import { describe, it, expect } from 'vitest';
import { docKittyManifest, generateManifestSource, THEME_CSS_MODULE_ID } from '../lib/manifest.js';
import type { ResolvedTheme } from '../lib/theme.js';

/** Pull the Vite plugin the integration registers at `astro:config:setup`. */
function pluginOf(resolved: ResolvedTheme) {
  let plugin!: {
    resolveId: (id: string) => string | null;
    load: (id: string) => string | null;
  };
  docKittyManifest(resolved).hooks['astro:config:setup']!({
    updateConfig: (c: { vite: { plugins: (typeof plugin)[] } }) => {
      plugin = c.vite.plugins[0];
    },
  } as never);
  return plugin;
}

const resolved = { layouts: {}, slots: {}, assets: {}, tokens: {}, tokenSheets: [] } as unknown as ResolvedTheme;

describe('docKittyManifest theme.css module', () => {
  it('resolves and loads the theme sheet when Vite appends a query (?inline)', () => {
    const plugin = pluginOf(resolved);
    const id = `${THEME_CSS_MODULE_ID}?inline`;
    expect(plugin.resolveId(id)).toBe(id);
    expect(plugin.load(id)).toBe(plugin.load(THEME_CSS_MODULE_ID));
    expect(plugin.load(id)).not.toBeNull();
  });
});

// gherkin-authoring-aids WP06 (FR-017): `Specification` is a base kind beside
// `Hub`, on by default; a theme maps it to Default to opt out.
const SPEC_LAYOUT = '@spec-kitty/doc-toolkit/layouts/Specification.astro';
const HUB_LAYOUT = '@spec-kitty/doc-toolkit/layouts/Hub.astro';
const DEFAULT_LAYOUT = '@spec-kitty/doc-toolkit/layouts/Default.astro';

/** The `kind → import identifier` table and `identifier → specifier` imports. */
function layoutTable(source: string): Record<string, string> {
  const imports = new Map<string, string>();
  for (const m of source.matchAll(/^import (\w+) from "([^"]+)";$/gm)) imports.set(m[1], m[2]);
  const body = /const __layouts = (\{[\s\S]*?\}|\{\});/.exec(source)?.[1] ?? '{}';
  const table: Record<string, string> = {};
  for (const m of body.matchAll(/^\s+"([^"]+)": (\w+),$/gm)) table[m[1]] = imports.get(m[2]) ?? '';
  return table;
}

describe('generateManifestSource base kinds', () => {
  it('maps Specification to the Specification layout with no theme', () => {
    expect(layoutTable(generateManifestSource(resolved)).Specification).toBe(SPEC_LAYOUT);
  });

  it('keeps Hub unchanged', () => {
    expect(layoutTable(generateManifestSource(resolved)).Hub).toBe(HUB_LAYOUT);
  });

  it('lets a theme opt out by mapping Specification to Default', () => {
    const themed = { ...resolved, layouts: { Specification: DEFAULT_LAYOUT } } as unknown as ResolvedTheme;
    const table = layoutTable(generateManifestSource(themed));
    expect(table.Specification).toBe(DEFAULT_LAYOUT);
    expect(table.Hub).toBe(HUB_LAYOUT);
    expect(generateManifestSource(themed)).not.toContain(SPEC_LAYOUT);
  });
});
