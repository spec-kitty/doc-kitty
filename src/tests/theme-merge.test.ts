import { describe, it, expect } from 'vitest';
import {
  resolveTheme,
  mergeTheme,
  mergeLayers,
  emitTokenSheet,
  DEFAULT_TOKEN_SHEET,
  DK_COMPONENTS_CSS_SHEET,
  TOC_RAIL_CSS_SHEET,
  type DocKittyTheme,
} from '../lib/theme.js';

// Small in-file fixtures — do NOT depend on the real brand (WP04).
const brand: DocKittyTheme = {
  name: 'acme',
  tokens: {
    '--dk-color-accent': '#ff5722', // overrides the Default accent
    '--dk-space-md': '1.25rem', // overrides one spacing token
  },
  customCss: ['acme/brand.css'],
  assets: { logo: 'acme/logo.svg', fonts: ['acme/font.woff2'] },
  slots: { 'dk:site-title': 'acme/Title.astro' },
  layouts: { Persona: 'acme/Persona.astro' },
};

const consumer: DocKittyTheme = {
  name: 'acme-docs',
  extends: brand,
  tokens: { '--dk-color-accent': '#123456' }, // last word over brand + default
  customCss: ['site/site.css'],
  assets: { logo: 'site/logo.svg' }, // overrides brand logo; fonts inherited
  slots: { 'dk:site-footer': 'site/Footer.astro' },
  layouts: { Reference: 'site/Reference.astro' },
};

/** Extract the `:root[data-theme='dark'] { … }` block body from emitted CSS. */
function darkBlock(css: string): string {
  const marker = ":root[data-theme='dark'] {";
  const start = css.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('resolveTheme — per-key last-wins (default → brand → consumer)', () => {
  it('consumer token beats brand beats default', () => {
    const r = resolveTheme(consumer);
    expect(r.tokens['--dk-color-accent']).toBe('#123456'); // consumer
    expect(r.tokens['--dk-space-md']).toBe('1.25rem'); // brand (consumer silent)
    expect(r.tokens['--dk-color-bg']).toBe('#ffffff'); // default (neither touched)
  });

  it('name, assets, slots, layouts merge per-key last-wins', () => {
    const r = resolveTheme(consumer);
    expect(r.name).toBe('acme-docs'); // consumer wins
    expect(r.assets.logo).toBe('site/logo.svg'); // consumer wins
    expect(r.assets.fonts).toEqual(['acme/font.woff2']); // inherited from brand
    // slots/layouts union: each layer's keys survive, later value wins per key.
    expect(r.slots['dk:site-title']).toBe('acme/Title.astro'); // brand key kept
    expect(r.slots['dk:site-footer']).toBe('site/Footer.astro'); // consumer key
    expect(r.layouts.Persona).toBe('acme/Persona.astro');
    expect(r.layouts.Reference).toBe('site/Reference.astro');
  });
});

describe('resolveTheme — customCss concatenation order', () => {
  it('concatenates base (token sheet + component sheet, NFR-004) → brand → consumer', () => {
    expect(resolveTheme(consumer).customCss).toEqual([
      DEFAULT_TOKEN_SHEET,
      DK_COMPONENTS_CSS_SHEET,
      TOC_RAIL_CSS_SHEET,
      'acme/brand.css',
      'site/site.css',
    ]);
  });

  it('two-layer chain (default → brand) proves flattening order', () => {
    const r = resolveTheme(brand);
    expect(r.customCss).toEqual([DEFAULT_TOKEN_SHEET, DK_COMPONENTS_CSS_SHEET, TOC_RAIL_CSS_SHEET, 'acme/brand.css']);
    expect(r.tokens['--dk-color-accent']).toBe('#ff5722');
  });
});

describe('resolveTheme — tokens shallow-merge', () => {
  it('a later layer overrides only the keys it names; un-named inherit', () => {
    const r = resolveTheme(brand);
    expect(r.tokens['--dk-space-md']).toBe('1.25rem'); // overridden by brand
    expect(r.tokens['--dk-space-lg']).toBe('1.5rem'); // un-named → default kept
    expect(r.tokens['--dk-color-accent']).toBe('#ff5722'); // overridden
    expect(r.tokens['--dk-color-bg']).toBe('#ffffff'); // un-named → default kept
  });

  it('rejects a --sl-* token key (ADR-0011 --dk-only rule)', () => {
    const bad: DocKittyTheme = { tokens: { '--sl-color-bg': 'red' } };
    expect(() => resolveTheme(bad)).toThrow(/--dk-\*|--sl-color-bg/);
  });
});

describe('resolveTheme — no-theme default path (NFR-002 superseded by NFR-004)', () => {
  // Pre-diagram-component-css, `resolveTheme(undefined).customCss` was a single
  // static entry, byte-for-byte (the old NFR-002 guarantee). This mission
  // DELIBERATELY changes that shape (#68/C-002): the Default layer now ships a
  // SECOND static sheet — the global component-rule sheet — alongside the token
  // sheet, so component CSS (`.dk-callout*`/`.dk-diagram*`) reaches a branded
  // build too (it must survive `config.ts`'s brand slot-0 replacement, which
  // only replaces `customCss[0]`). This test asserts the NEW two-entry shape;
  // the token/bridge contract below is unaffected.
  it('undefined yields the token sheet + component sheet, no generated sheet', () => {
    const r = resolveTheme(undefined);
    expect(r.customCss).toEqual([DEFAULT_TOKEN_SHEET, DK_COMPONENTS_CSS_SHEET, TOC_RAIL_CSS_SHEET]); // deep-equal, three entries: token sheet + component sheet + toc-rail sheet (NFR-004)
    expect(r.customCss).toHaveLength(3);
    expect(r.generated).toBe(false); // WP02 skips emission
  });

  it('undefined still exposes the full Default catalog', () => {
    const r = resolveTheme(undefined);
    expect(r.tokens['--dk-color-bg']).toBe('#ffffff');
    expect(r.tokens['--dk-color-accent']).toBe('#3159c4');
    expect(r.tokens['--dk-space-md']).toBe('1rem');
  });

  it('empty object {} is NOT the no-theme path: merges, generated:true, nothing extra', () => {
    const r = resolveTheme({});
    expect(r.generated).toBe(true); // routed through the Default merge
    expect(r.customCss).toEqual([DEFAULT_TOKEN_SHEET, DK_COMPONENTS_CSS_SHEET, TOC_RAIL_CSS_SHEET]); // adds nothing extra
    expect(r.tokens['--dk-color-bg']).toBe('#ffffff'); // Default catalog present
  });
});

describe('emitTokenSheet — bridge + --dk-only (FR-004)', () => {
  it("emits the merged tokens and carries the bridge, with zero --sl-*: literals", () => {
    const css = emitTokenSheet(resolveTheme(brand));
    // Merged override present in the :root catalog.
    expect(css).toContain('--dk-color-accent: #ff5722;');
    // Bridge present, in var() form only.
    expect(css).toContain('--sl-color-accent: var(--dk-color-accent);');
    expect(css).toContain('--sl-color-bg: var(--dk-color-bg);');
    // No --sl-* assigned a literal value — every --sl-* value is a var(--dk-*).
    const slValues = [...css.matchAll(/(--sl-[a-z0-9-]+):\s*([^;]+);/gi)];
    expect(slValues.length).toBeGreaterThan(0); // the bridge is present at all
    for (const [, name, value] of slValues) {
      expect(value.trim(), `${name} must bridge via var(), not a literal`).toMatch(
        /^var\(--dk-[a-z0-9-]+\)$/,
      );
    }
  });
});

describe('emitTokenSheet — mode-varying subset under the dark selector', () => {
  it('re-declares mode-varying tokens; brand override applies in both modes', () => {
    const dark = darkBlock(emitTokenSheet(resolveTheme(brand)));
    // Overridden colour → the brand value re-declared under dark too.
    expect(dark).toContain('--dk-color-accent: #ff5722;');
    // Un-overridden colour → the Default DARK value (not the light value).
    expect(dark).toContain('--dk-color-bg: #131721;');
    expect(dark).not.toContain('--dk-color-bg: #ffffff;');
    // Non-colour tokens are declared once (not in the dark block).
    expect(dark).not.toContain('--dk-space-md');
    expect(dark).not.toContain('--dk-radius-sm');
  });
});

describe('resolveTheme — extends chain guards', () => {
  it('detects a cyclic extends chain', () => {
    const a: DocKittyTheme = { name: 'a' };
    a.extends = a;
    expect(() => resolveTheme(a)).toThrow(/cycle/i);
  });

  it('mergeTheme is an alias of resolveTheme', () => {
    expect(mergeTheme(brand)).toEqual(resolveTheme(brand));
  });

  it('mergeLayers folds an explicit layer list (base first)', () => {
    const r = mergeLayers([{ tokens: { '--dk-x': '1' } }, { tokens: { '--dk-x': '2' } }]);
    expect(r.tokens['--dk-x']).toBe('2'); // later layer wins
    expect(r.generated).toBe(true);
  });
});
