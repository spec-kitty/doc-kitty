/**
 * The print-token fallback (#386, ADR-0081): generated from the resolved theme, never
 * hand-restated, and specific enough to beat every dark block a site can carry.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { emitPrintTokenSheet, emitTokenSheet, resolveTheme } from '../lib/theme.js';
import { docKittyManifest, PRINT_TOKENS_CSS_MODULE_ID } from '../lib/manifest.js';
import { specKittyTheme } from '../themes/spec-kitty/index.js';

/** `name → value` pairs of the one block inside the print sheet. */
function declarations(sheet: string): Map<string, string> {
  const body = sheet.match(/\{\s*:root:root\[data-theme='dark'\] \{([\s\S]*?)\}\s*\}/)?.[1] ?? '';
  return new Map(
    [...body.matchAll(/(--[\w-]+|color-scheme):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

/** The `--dk-*` names the generated sheet re-declares under its dark selector. */
function darkNames(sheet: string): string[] {
  const body = sheet.match(/:root\[data-theme='dark'\] \{([\s\S]*?)\}/)?.[1] ?? '';
  return [...body.matchAll(/(--[\w-]+):/g)].map(([, name]) => name);
}

describe('emitPrintTokenSheet', () => {
  it('declares every mode-varying token, inside @media print, at :root:root[data-theme=dark]', () => {
    const resolved = resolveTheme();
    const sheet = emitPrintTokenSheet(resolved);
    expect(sheet.startsWith('@media print {')).toBe(true);
    const decls = declarations(sheet);
    const expected = darkNames(emitTokenSheet(resolveTheme({})));
    expect(expected.length).toBeGreaterThan(20);
    expect([...decls.keys()].filter((k) => k.startsWith('--'))).toEqual(expected);
    expect(decls.get('color-scheme')).toBe('light');
  });

  it("restates the theme's LIGHT values, not the dark ones", () => {
    const resolved = resolveTheme();
    const decls = declarations(emitPrintTokenSheet(resolved));
    for (const [name, value] of decls) {
      if (name.startsWith('--')) expect(value, name).toBe(resolved.tokens[name]);
    }
    // Control: the Default dark background is not what the fallback prints.
    expect(decls.get('--dk-color-bg')).toBe('#ffffff');
  });

  it("carries a theme's object-token override, so the fallback follows the brand", () => {
    const resolved = resolveTheme({ tokens: { '--dk-color-bg': '#fdfcf8' } });
    expect(declarations(emitPrintTokenSheet(resolved)).get('--dk-color-bg')).toBe('#fdfcf8');
    // The brand theme's object tokens flow in too (its accent signal is mode-invariant).
    const brand = resolveTheme(specKittyTheme);
    expect(declarations(emitPrintTokenSheet(brand)).get('--dk-color-accent')).toBe(brand.tokens['--dk-color-accent']);
  });

  it('is served as a virtual CSS module on the no-theme path too', () => {
    let plugin!: { resolveId: (id: string) => string | null; load: (id: string) => string | null };
    docKittyManifest(resolveTheme()).hooks['astro:config:setup']!({
      updateConfig: (c: { vite: { plugins: (typeof plugin)[] } }) => {
        plugin = c.vite.plugins[0];
      },
    } as never);
    expect(plugin.resolveId(PRINT_TOKENS_CSS_MODULE_ID)).toBe(PRINT_TOKENS_CSS_MODULE_ID);
    expect(plugin.resolveId(`${PRINT_TOKENS_CSS_MODULE_ID}?inline`)).toBe(`${PRINT_TOKENS_CSS_MODULE_ID}?inline`);
    expect(plugin.load(PRINT_TOKENS_CSS_MODULE_ID)).toBe(emitPrintTokenSheet(resolveTheme()));
  });
});

describe('the print hook imports the generated fallback with the print rules', () => {
  it('print.client.ts imports both sheets and never touches storage', () => {
    const src = readFileSync(new URL('../lib/print/print.client.ts', import.meta.url), 'utf8');
    expect(src).toContain("import '../../styles/print.css';");
    expect(src).toContain("import 'virtual:doc-kitty/print-tokens.css';");
    expect(src).not.toMatch(/localStorage|sessionStorage/);
  });
});
