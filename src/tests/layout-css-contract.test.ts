/**
 * CSS contract for the page-frame geometry (sidebar-frame-header-carrier
 * mission, WP01: FR-001..FR-006, FR-012).
 *
 * A fast guard that needs no browser and no build. It reads the two sheets as
 * text and checks the properties that make the geometry hold: the frame-width
 * token is registered, the frame rule fills its cap, the gutter and rail-pin
 * rules exist and are desktop-gated, and all of it lives in the sheet that
 * survives a brand swap. The measured geometry itself (bounding boxes at five
 * widths) is asserted by the Playwright layout guard; this suite only fails
 * fast when a rule is removed or moved.
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

/** Rules whose selector list contains `needle`, with every list entry split out. */
const rulesFor = (needle: string, from = components): Rule[] =>
  from.rules.filter((r) => r.selector.split(',').some((s) => s.trim().endsWith(needle)));

const DESKTOP = '@media (min-width: 50rem)';
const RAIL = '@media (min-width: 72rem)';
const GUTTER = 'var(--dk-frame-gutter)';

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

describe('frame rule (FR-001)', () => {
  it('fills its cap and centres, inside the desktop media query', () => {
    const [frame, ...rest] = rulesFor('.main-frame');
    expect(frame, 'no .main-frame rule').toBeDefined();
    expect(rest).toHaveLength(0);
    expect(frame.decls).toMatchObject({
      width: '100%',
      'max-width': 'var(--dk-width-frame)',
      'margin-inline': 'auto',
    });
    expect(frame.media).toEqual([DESKTOP]);
  });

  it('keeps no trace of the retired 90rem cap or its 100rem query', () => {
    expect(COMPONENTS).not.toMatch(/max-width:\s*90rem/);
    expect(COMPONENTS).not.toMatch(/min-width:\s*100rem/);
  });
});

describe('frame gutter (FR-004)', () => {
  it('defaults to 0 and is derived from the token at the desktop breakpoint', () => {
    const roots = components.rules.filter(
      (r) => r.selector === ':root' && '--dk-frame-gutter' in r.decls,
    );
    const base = roots.find((r) => r.media.length === 0);
    const desktop = roots.find((r) => r.media[0] === DESKTOP);
    expect(base?.decls['--dk-frame-gutter']).toBe('0px');
    // `100%`, not `100vw`: the viewport unit includes the scrollbar, the
    // frame's own percentage base does not.
    expect(desktop?.decls['--dk-frame-gutter']).toBe(
      'max(0px, (100% - var(--dk-width-frame)) / 2)',
    );
  });

  it('offsets the fixed left sidebar by the gutter', () => {
    const [sidebar] = rulesFor('.sidebar-pane');
    expect(sidebar?.selector).toBe('html[data-has-sidebar] .sidebar-pane');
    expect(sidebar.decls['inset-inline-start']).toBe(GUTTER);
    expect(sidebar.media).toEqual([DESKTOP]);
  });

  it('insets the header content by the gutter, with and without a sidebar', () => {
    const [header] = rulesFor('header.header');
    expect(header, 'no header.header rule').toBeDefined();
    const selectors = header.selector.split(',').map((s) => s.trim());
    expect(selectors).toContain('html[data-has-sidebar] header.header');
    expect(selectors).toContain('html:not([data-has-sidebar]) header.header');
    expect(header.decls['padding-inline']).toBe(`calc(var(--sl-nav-pad-x) + ${GUTTER})`);
    expect(header.media).toEqual([DESKTOP]);
  });

  it('insets the narrow-desktop table-of-contents bar by the gutter', () => {
    const [bar] = rulesFor('mobile-starlight-toc nav');
    expect(bar?.decls['inset-inline']).toBe(
      `calc(var(--sl-content-inline-start, 0rem) + ${GUTTER}) ${GUTTER}`,
    );
    expect(bar.media).toEqual([DESKTOP]);
  });
});

describe('rail pin (FR-005, FR-006)', () => {
  const EXPANDED = 'html:not([data-toc-collapsed])';

  it('gives the rail column and the fixed rail the sidebar width when expanded', () => {
    const pin = components.rules.find(
      (r) => r.decls.width === 'var(--sl-sidebar-width)' && r.selector.includes('.right-sidebar'),
    );
    expect(pin, 'no rail width rule').toBeDefined();
    expect(pin!.selector.split(',').map((s) => s.trim())).toEqual([
      `${EXPANDED} .right-sidebar-container`,
      `${EXPANDED} .right-sidebar`,
    ]);
    expect(pin!.media).toEqual([RAIL]);
  });

  it('leaves the fixed rail at its static position: no inline inset', () => {
    // The rail starts where its reserved column starts. An inline inset here
    // would be a second statement of the same position that could disagree
    // with it; the geometry spec (A3, A4) measures the result.
    for (const rule of rulesFor('.right-sidebar')) {
      for (const prop of ['inset', 'inset-inline', 'inset-inline-start', 'inset-inline-end', 'left', 'right']) {
        expect(rule.decls, `${rule.selector} sets ${prop}`).not.toHaveProperty(prop);
      }
    }
  });

  it('sizes the reading pane as the remainder and centres its column', () => {
    const [pane, ...rest] = rulesFor('.main-pane');
    expect(pane, 'no .main-pane rule').toBeDefined();
    expect(rest).toHaveLength(0);
    expect(pane.selector.split(',').map((s) => s.trim())).toEqual([
      // (0,3,1): above Starlight's (0,3,0), below toc-rail.css's (0,4,1).
      'html[data-has-sidebar][data-has-toc] .main-pane',
      'html[data-has-toc]:not([data-toc-collapsed]) .main-pane',
    ]);
    expect(pane.decls).toMatchObject({
      width: 'calc(100% - var(--sl-sidebar-width))',
      '--sl-content-margin-inline': 'auto',
    });
    expect(pane.media).toEqual([RAIL]);
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
