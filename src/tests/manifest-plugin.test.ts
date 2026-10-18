import { describe, it, expect } from 'vitest';
import { docKittyManifest, THEME_CSS_MODULE_ID } from '../lib/manifest.js';
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
