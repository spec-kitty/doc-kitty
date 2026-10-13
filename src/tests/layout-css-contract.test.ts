/**
 * CSS contract for the page-frame geometry (sidebar-frame-header-carrier
 * mission, WP01: FR-001..FR-006, FR-012).
 *
 * A fast guard that needs no browser and no build. It reads the two sheets as
 * text and checks what a measurement cannot: the frame-width token is
 * registered, theme.css and the Default catalog agree on it, geometry stays out
 * of the sheet a brand swap replaces, and no geometry rule uses a physical
 * property. The geometry itself (bounding boxes at five widths, in both
 * directions) is measured by the Playwright layout guard, so the individual
 * declarations are not pinned here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { resolveTheme } from '../lib/theme.js';

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );

const COMPONENTS = read('../styles/dk-components.css');
const THEME = read('../styles/theme.css');

interface Rule {
  /** Selector list, whitespace-normalised. */
  selector: string;
  /** Declaration name → value. */
  decls: Record<string, string>;
  /** Preludes of the enclosing `@media` blocks, outermost first. */
  media: string[];
}

interface AtBlock {
  prelude: string;
  body: string;
}

/**
 * Minimal brace-matching walk over comment-free CSS. Enough for these two
 * sheets: style rules, `@media` nesting, and other at-blocks (collected raw).
 */
function parse(css: string): { rules: Rule[]; atBlocks: AtBlock[] } {
  const rules: Rule[] = [];
  const atBlocks: AtBlock[] = [];
  const walk = (text: string, media: string[]): void => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open === -1) return;
      let depth = 1;
      let close = open + 1;
      while (close < text.length && depth > 0) {
        if (text[close] === '{') depth += 1;
        else if (text[close] === '}') depth -= 1;
        close += 1;
      }
      const prelude = text.slice(i, open).replace(/\s+/g, ' ').trim();
      const body = text.slice(open + 1, close - 1);
      if (prelude.startsWith('@media')) {
        walk(body, [...media, prelude]);
      } else if (prelude.startsWith('@')) {
        atBlocks.push({ prelude, body });
      } else {
        const decls: Record<string, string> = {};
        for (const part of body.split(';')) {
          const colon = part.indexOf(':');
          if (colon === -1) continue;
          decls[part.slice(0, colon).trim()] = part
            .slice(colon + 1)
            .replace(/\s+/g, ' ')
            .trim();
        }
        rules.push({ selector: prelude, decls, media });
      }
      i = close;
    }
  };
  walk(css, []);
  return { rules, atBlocks };
}

const components = parse(COMPONENTS);
const theme = parse(THEME);

/** Every rule this work package added: the ones that shape frame geometry. */
const geometryRules = components.rules.filter(
  (r) =>
    /--dk-frame-gutter|--dk-width-frame/.test(JSON.stringify(r.decls)) ||
    /\.main-frame|\.main-pane|\.right-sidebar|\.sidebar-pane|header\.header|mobile-starlight-toc/.test(
      r.selector,
    ),
);

describe('frame-width token registration (FR-002, FR-003)', () => {
  it('registers --dk-width-frame so an invalid value computes to 100%', () => {
    const registration = components.atBlocks.find(
      (b) => b.prelude === '@property --dk-width-frame',
    );
    expect(registration, '@property --dk-width-frame is missing').toBeDefined();
    const body = registration!.body.replace(/\s+/g, ' ');
    expect(body).toContain("syntax: '<length-percentage>'");
    expect(body).toContain('inherits: true');
    expect(body).toContain('initial-value: 100%');
  });

  it('theme.css and the Default catalog agree on the token and its default', () => {
    const root = theme.rules.find(
      (r) => r.selector === ':root' && '--dk-width-frame' in r.decls,
    );
    expect(root, 'theme.css :root does not declare --dk-width-frame').toBeDefined();
    expect(root!.decls['--dk-width-frame']).toBe('100%');
    expect(resolveTheme(undefined).tokens['--dk-width-frame']).toBe('100%');
  });
});

describe('placement and direction', () => {
  it('finds all eight geometry rules', () => {
    // Guards the two sweeps below against passing on an empty set.
    expect(geometryRules).toHaveLength(8);
  });

  it('keeps geometry out of the token sheet, which a brand swap replaces', () => {
    expect(THEME).not.toContain('--dk-frame-gutter');
    expect(THEME).not.toContain('@property');
    for (const selector of ['.main-frame', '.main-pane', '.right-sidebar', '.sidebar-pane']) {
      expect(THEME, `${selector} must not be styled in theme.css`).not.toContain(selector);
    }
  });

  it('uses logical properties only, so right-to-left mirrors (FR-012)', () => {
    const physical = /^(left|right|(margin|padding|border)-(left|right)(-.+)?)$/;
    for (const rule of geometryRules) {
      for (const property of Object.keys(rule.decls)) {
        expect(property, `${rule.selector} uses physical ${property}`).not.toMatch(physical);
      }
    }
  });
});
