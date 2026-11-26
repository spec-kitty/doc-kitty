/**
 * The print layer's stylesheet contract (#385, #387, #388, #389). A browser test
 * (`tests/a11y/print.spec.ts`) proves the computed result; this pins the rules
 * themselves, so a dropped selector fails fast without a build.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const css = readFileSync(new URL('../styles/print.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const printBlock = css.slice(css.indexOf('@media print'));

/** The declaration bodies of every rule whose selector list contains `selector`. */
function ruleFor(selector: string): string {
  let bodies = '';
  for (const m of printBlock.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // Split the selector list on top-level commas only (`:is(h1, h2)` stays whole).
    const selectors = m[1].split(/,(?![^(]*\))/).map((s) => s.trim());
    if (selectors.includes(selector)) bodies += m[2];
  }
  return bodies;
}

describe('print.css', () => {
  it('sizes the page A4 outside the print block, so a theme restates one @page', () => {
    expect(css.slice(0, css.indexOf('@media print'))).toMatch(/@page\s*\{[^}]*size:\s*A4/);
  });

  it.each([
    '.page > header.header',
    '.sidebar',
    '.right-sidebar-container',
    'site-search',
    'starlight-theme-select',
    '.pagination-links',
    '.dk-lightbox__trigger',
    'dialog.dk-lightbox',
    '.expressive-code .copy',
    '.dk-machine-links',
    '.dk-page-formats',
    '.dk-print-control',
    '.dk-hub__aux',
    'starlight-menu-button',
    '.sl-skip-link',
  ])('hides %s', (selector) => {
    expect(ruleFor(selector)).toMatch(/display:\s*none/);
  });

  it('never hides the page identity', () => {
    for (const keep of ['.dk-page-hero', '.dk-metadata-band', '#_top', 'h1']) {
      expect(ruleFor(keep)).not.toMatch(/display:\s*none/);
    }
  });

  it('keeps fills only on asides, callouts, code and diagrams', () => {
    const exact = [...printBlock.matchAll(/([^{}]+)\{[^{}]*print-color-adjust:\s*exact/g)]
      .flatMap((m) => m[1].split(',').map((s) => s.trim()));
    expect(exact.sort()).toEqual(['.dk-callout', '.dk-diagram', '.expressive-code', '.starlight-aside']);
  });

  it('keeps headings with their text and blocks whole, and wraps code', () => {
    expect(ruleFor('.sl-markdown-content :is(h1, h2, h3, h4)')).toMatch(/break-after:\s*avoid/);
    for (const block of ['figure', '.dk-diagram', '.starlight-aside', '.dk-callout', '.expressive-code', 'tr']) {
      expect(ruleFor(block), block).toMatch(/break-inside:\s*avoid/);
    }
    expect(ruleFor('.sl-markdown-content :is(p, li)')).toMatch(/orphans:\s*3;\s*widows:\s*3/);
    expect(ruleFor('.expressive-code pre')).toMatch(/white-space:\s*pre-wrap/);
  });

  it('fits diagrams to one sheet', () => {
    expect(ruleFor('.dk-diagram svg')).toMatch(/max-width:\s*100%/);
    expect(ruleFor('.dk-diagram svg')).toMatch(/max-height:\s*240mm/);
  });

  it('prints external link URLs only, at a specificity a theme can switch off', () => {
    const rule = [...printBlock.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].includes('::after'));
    expect(rule?.[1]).toContain("a:where([href^='http']");
    // The documented off-switch `.sl-markdown-content a::after` is (0,1,2): everything
    // past `a` must sit inside `:where()` so a later theme sheet wins.
    expect(rule?.[1].trim()).toMatch(/^\.sl-markdown-content a:where\(.*\)::after$/);
    expect(rule?.[1]).toContain(':not([data-dk-print-link])');
    expect(rule?.[1]).toContain(':not(:has(img))');
    expect(rule?.[2]).toContain('attr(href)');
  });

  it('shows every tab panel and hides the tab list', () => {
    expect(ruleFor("starlight-tabs [role='tablist']")).toMatch(/display:\s*none/);
    expect(ruleFor("starlight-tabs [role='tabpanel']")).toMatch(/display:\s*block/);
  });
});
