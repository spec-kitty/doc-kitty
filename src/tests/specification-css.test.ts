/**
 * Specification layout styles use tokens only (gherkin-authoring-aids mission,
 * WP06: NFR-005; contracts/specification-layout.md "Styling").
 *
 * Reads src/styles/specification.css as text. Every declaration value, once its
 * `var(...)` references are removed, must carry no hex, `rgb(`/`hsl(`, named
 * colour or bare length. A positive control proves the sheet has `.dk-spec-card`
 * rules that do reference `--dk-*` tokens, so an empty or renamed sheet cannot
 * pass vacuously. Kept as a small local parser: WP05's helper is file-local.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SHEET = readFileSync(fileURLToPath(new URL('../styles/specification.css', import.meta.url)), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/** `{ selector, body }` for every innermost rule (at-rule wrappers flattened). */
function rules(css: string): Array<{ selector: string; body: string }> {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
}

/** Declaration values with every var(...) reference removed. */
function literalValues(body: string): string[] {
  return body
    .split(';')
    .filter((decl) => decl.includes(':'))
    .map((decl) => decl.slice(decl.indexOf(':') + 1))
    .map((value) => value.replace(/var\([^()]*(\([^()]*\)[^()]*)*\)/g, ''));
}

const NAMED_COLOUR =
  /\b(black|white|red|green|blue|yellow|orange|gray|grey|silver|maroon|purple|navy|teal|olive|gold|brown|pink)\b/i;

describe('specification.css uses tokens only (NFR-005)', () => {
  const all = rules(SHEET);

  it('has .dk-spec-card rules that reference --dk-* tokens (positive control)', () => {
    const card = all.filter((r) => /\.dk-spec-card\b/.test(r.selector));
    expect(card.length).toBeGreaterThan(0);
    expect(card.map((r) => r.body).join(';')).toMatch(/var\(--dk-/);
  });

  it('styles only .dk-spec-card selectors', () => {
    for (const r of all) expect(r.selector, r.selector).toMatch(/^\.dk-spec-card/);
  });

  it('carries no hex, rgb(), hsl(), named colour or bare length outside var()', () => {
    for (const value of all.flatMap((r) => literalValues(r.body))) {
      expect(value, 'hex colour').not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(value, 'rgb()/hsl()').not.toMatch(/\b(rgba?|hsla?)\(/i);
      expect(value, 'named colour').not.toMatch(NAMED_COLOUR);
      expect(value, 'bare length').not.toMatch(/\b\d*\.?\d+(px|rem|em|ch|vw|vh|%)(?![\w-])/);
    }
  });

  it('never reaches for Starlight variables', () => {
    expect(SHEET).not.toMatch(/--sl-/);
  });

  it('lets long source paths wrap at narrow widths', () => {
    const source = all.filter((r) => /\.dk-spec-card__source\b/.test(r.selector)).map((r) => r.body).join(';');
    expect(source).toMatch(/overflow-wrap:\s*anywhere/);
  });
});

describe('the guard catches literals (negative control)', () => {
  it('flags each literal kind in a sample rule', () => {
    const sample = '.dk-spec-card { color: #fff; background: rgb(0 0 0); border-color: red; padding: 4px; }';
    const values = rules(sample).flatMap((r) => literalValues(r.body));
    expect(values.some((v) => /#[0-9a-f]{3,8}\b/i.test(v))).toBe(true);
    expect(values.some((v) => /\brgba?\(/i.test(v))).toBe(true);
    expect(values.some((v) => NAMED_COLOUR.test(v))).toBe(true);
    expect(values.some((v) => /\b\d*\.?\d+px\b/.test(v))).toBe(true);
    expect(literalValues('padding: var(--dk-space-sm, 4px)').join('')).not.toMatch(/px/);
  });
});
