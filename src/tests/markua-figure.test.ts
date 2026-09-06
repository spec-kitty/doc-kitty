/**
 * Astro-free unit matrix for `markuaFigure` (contract `figure-render.md`;
 * FR-005/FR-006, NFR-004). Exercised on **synthetic hast** — `<img>` nodes
 * carrying the `hProperties` WP08's attribute-list plugin would attach — proving
 * the **pre-`rehypeImages`** wrap shape: the bracket text becomes the
 * `<figcaption>`, `{alt:}` becomes the real `alt`, sizing/align/class/id map per
 * the contract, `src` is kept intact, and an un-allowlisted scheme degrades.
 * (The real `__ASTRO_IMAGE_` round-trip — that `alt`/`style` survive
 * optimisation — is WP10's build assertion, not asserted here.)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { toHast } from 'mdast-util-to-hast';
import markuaFigure from '../lib/rehype/markua-figure.js';

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

/** A synthetic hast `<img>` with the given properties, wrapped in root > p
 * (the shape mdast → hast produces for a block image: a lone-image paragraph). */
function imgTree(properties: Record<string, unknown>): HastNode {
  return {
    type: 'root',
    children: [
      { type: 'element', tagName: 'p', properties: {}, children: [
        { type: 'element', tagName: 'img', properties, children: [] },
      ] },
    ],
  };
}

/** Run the pass and return the first top-level replacement node. */
function run(tree: HastNode): HastNode {
  markuaFigure()(tree as never);
  return tree.children![0];
}

function findTag(node: HastNode, tagName: string): HastNode | undefined {
  if (node.type === 'element' && node.tagName === tagName) return node;
  for (const child of node.children ?? []) {
    const found = findTag(child, tagName);
    if (found) return found;
  }
  return undefined;
}

function textOf(node: HastNode | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

function classesOf(node: HastNode | undefined): string[] {
  const raw = node?.properties?.className;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return raw.split(/\s+/).filter(Boolean);
  return [];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('markuaFigure — deck hero-exclusion (D4/C-COMPOSE-05, #47)', () => {
  it('leaves the tagged deck hero <img> untouched (keeps its alt; no dk-figure, no figcaption)', () => {
    // deck-split.internal.ts (T005) tags the synthesized hero image with
    // `data-deck-hero` (an mdast `data.hProperties` key that surfaces as this hast
    // `properties` key). It is NOT authored Markua figure syntax; wrapping it would
    // relocate+empty the alt (an image-alt violation) and add an unwanted caption to
    // the title slide (INV-2). The discriminator is the explicit tag, not page `kind`.
    const tree = imgTree({ src: 'hero.png', alt: 'Deck hero alt', 'data-deck-hero': '' });
    markuaFigure()(tree as never);
    const img = findTag(tree, 'img');
    expect(img?.properties?.alt).toBe('Deck hero alt'); // alt preserved, not relocated
    expect(findTag(tree, 'figure')).toBeUndefined(); // never wrapped as a dk-figure
    expect(findTag(tree, 'figcaption')).toBeUndefined(); // no caption added to the title slide
    // The enclosing lone-image <p> is left in place, not replaced.
    expect(tree.children![0].tagName).toBe('p');
  });

  it('wraps a deck BODY image (no data-deck-hero tag) as a dk-figure — the pass runs on decks', () => {
    // #47 reverses the prior blanket `kind: Presentation` self-guard: markuaFigure
    // now runs on decks and wraps every image except the explicitly-tagged hero.
    const tree = imgTree({ src: 'slide-body.jpg', alt: 'Body image caption' });
    markuaFigure()(tree as never);
    expect(findTag(tree, 'figure')).toBeDefined();
    expect(findTag(tree, 'figcaption')).toBeDefined();
  });

  it('still wraps a plain (non-deck) docs-page image (no regression from the removed guard)', () => {
    const tree = imgTree({ src: 'palm.jpg', alt: 'Palm Trees' });
    markuaFigure()(tree as never);
    expect(findTag(tree, 'figure')).toBeDefined();
  });

  it('FIX D: skips a bare hero <img> that is a DIRECT child (not wrapped in <p>) — covers the defensive branch', () => {
    // Real `deck-split.internal.ts` output always emits the hero as a
    // lone-image `<p>` (handled by the `loneImageParagraph` branch above); the
    // transformer's `else if (isImg(child)) { if (isHeroImg(child)) continue; }`
    // branch never fires from real input today. It exists as a structural
    // safety net should a future emission shape ever place the tagged hero
    // directly in `root.children` (no wrapping `<p>`) — this test feeds exactly
    // that shape so the branch is covered and its behaviour (skip, untouched)
    // is pinned rather than left as dead, unverified code.
    const tree: HastNode = {
      type: 'root',
      children: [
        { type: 'element', tagName: 'img', properties: { src: 'hero.png', alt: 'Deck hero alt', 'data-deck-hero': '' }, children: [] },
      ],
    };
    markuaFigure()(tree as never);
    const img = findTag(tree, 'img');
    expect(img?.properties?.alt).toBe('Deck hero alt'); // untouched
    expect(findTag(tree, 'figure')).toBeUndefined(); // never wrapped
    expect(tree.children![0].tagName).toBe('img'); // node itself, not replaced
  });
});

// --- FIX 5 (pre-PR squad): the hero tag's mdast→hast round-trip is asserted --
// at the unit tier via the REAL `mdast-util-to-hast`, not a hand-built hast
// fixture — so a future key rename (`data-deck-hero` renamed on one side of the
// seam, or a switch away from `data.hProperties`) fails here rather than only
// surfacing in the browser-level deck a11y gate.
describe('FIX 5 — data-deck-hero survives the REAL mdast-util-to-hast round-trip', () => {
  it('a paragraph > image mdast node tagged data.hProperties["data-deck-hero"] compiles to a hast <img> carrying the property verbatim (un-camelCased)', () => {
    // Exactly the shape `deck-split.internal.ts` `titleChildren` synthesizes
    // (deck-split.internal.ts:190-207): a bare mdast `image` node (no `data.hName`
    // override — the default image handler applies) whose `data.hProperties`
    // carries the empty-string-valued `data-deck-hero` tag, wrapped in a
    // `paragraph`.
    const mdastTree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: 'hero.png',
              alt: 'Deck hero alt',
              data: { hProperties: { 'data-deck-hero': '' } },
            },
          ],
        },
      ],
    };

    const hastTree = toHast(mdastTree as never, { allowDangerousHtml: false }) as HastNode;
    const img = findTag(hastTree, 'img');

    expect(img, 'mdast-util-to-hast must compile the image node to a hast <img>').toBeDefined();
    // Presence, not truthiness — the tag's value is the empty string, which is
    // falsy but still a set property. `in` is what `isHeroImg` checks.
    expect(img?.properties && 'data-deck-hero' in img.properties).toBe(true);
    expect(img?.properties?.['data-deck-hero']).toBe('');
    // The key must survive VERBATIM — un-camelCased — as `markuaFigure`'s
    // `isHeroImg` reads the literal hyphenated key, not a camelCased `dataDeckHero`.
    expect(img?.properties?.dataDeckHero).toBeUndefined();
    expect(img?.properties?.alt).toBe('Deck hero alt');

    // And the full pipeline: markuaFigure must recognise and skip it.
    markuaFigure()(hastTree as never);
    expect(findTag(hastTree, 'figure')).toBeUndefined();
    expect(findTag(hastTree, 'img')?.properties?.alt).toBe('Deck hero alt');
  });
});

describe('markuaFigure — figure shape (US2 sc.1)', () => {
  it('wraps ![Palm Trees](palm-trees.jpg) into <figure> + <figcaption> + nested <img>', () => {
    const node = run(imgTree({ src: 'palm-trees.jpg', alt: 'Palm Trees' }));

    expect(node.tagName).toBe('figure');
    expect(classesOf(node)).toContain('dk-figure');

    const img = findTag(node, 'img');
    expect(img?.properties?.src).toBe('palm-trees.jpg');

    const caption = findTag(node, 'figcaption');
    expect(caption?.properties?.className).toEqual(['dk-figure__caption']);
    expect(textOf(caption)).toBe('Palm Trees');
  });

  it('unwraps the lone-image <p> — the <figure> replaces it, never nests inside a <p>', () => {
    const tree = imgTree({ src: 'palm-trees.jpg', alt: 'Palm Trees' });
    markuaFigure()(tree as never);
    expect(tree.children![0].tagName).toBe('figure');
    expect(findTag(tree, 'p')).toBeUndefined();
  });
});

describe('markuaFigure — caption vs alt (Markua semantic, US2 sc.2)', () => {
  it('bracket text = caption; {alt:} = real alt', () => {
    // ![The original Mac](mac.jpg) with {alt: "a red apple"}.
    const node = run(
      imgTree({ src: 'mac.jpg', alt: 'The original Mac', markuaAlt: 'a red apple' }),
    );

    expect(textOf(findTag(node, 'figcaption'))).toBe('The original Mac');
    expect(findTag(node, 'img')?.properties?.alt).toBe('a red apple');
  });
});

describe('markuaFigure — empty-safe alt fallback (NFR-004)', () => {
  it('captioned image with no {alt:} → alt="" and NO warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const node = run(imgTree({ src: 'mac.jpg', alt: 'The original Mac' }));

    expect(findTag(node, 'img')?.properties?.alt).toBe('');
    expect(textOf(findTag(node, 'figcaption'))).toBe('The original Mac');
    expect(warn).not.toHaveBeenCalled();
  });

  it('captionless image with no {alt:} → alt="" and a warning naming the file (no throw)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // No caption text at all → no <figcaption>, alt="", warn.
    const node = run(imgTree({ src: 'decorative.png' }));

    const img = findTag(node, 'img');
    expect(img?.properties?.alt).toBe('');
    expect(findTag(node, 'figcaption')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('decorative.png');
  });

  it('never throws on a captionless, alt-less image', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => run(imgTree({ src: 'decorative.png' }))).not.toThrow();
  });
});

describe('markuaFigure — sizing (US2 sc.3)', () => {
  it('{width: "75%"} → nested <img style="width: 75%">', () => {
    const node = run(imgTree({ src: 'a.jpg', alt: 'A', width: '75%' }));
    expect(findTag(node, 'img')?.properties?.style).toBe('width: 75%');
  });

  it('{width} + {height} both fold into the style string', () => {
    const node = run(imgTree({ src: 'a.jpg', alt: 'A', width: '50%', height: '20%' }));
    expect(findTag(node, 'img')?.properties?.style).toBe('width: 50%; height: 20%');
  });
});

describe('markuaFigure — align (US2 sc.4)', () => {
  it('{align: right} → dk-figure--right on the <figure>', () => {
    const node = run(imgTree({ src: 'a.jpg', alt: 'A', align: 'right' }));
    expect(classesOf(node)).toContain('dk-figure--right');
  });

  it('{align: middle} → dk-figure--center', () => {
    const node = run(imgTree({ src: 'a.jpg', alt: 'A', align: 'middle' }));
    expect(classesOf(node)).toContain('dk-figure--center');
  });

  it('{align: left} → dk-figure--left', () => {
    const node = run(imgTree({ src: 'a.jpg', alt: 'A', align: 'left' }));
    expect(classesOf(node)).toContain('dk-figure--left');
  });
});

describe('markuaFigure — class + id + title', () => {
  it('{class: hero} is appended to the figure class list', () => {
    const node = run(imgTree({ src: 'a.jpg', alt: 'A', className: ['hero'] }));
    expect(classesOf(node)).toEqual(['dk-figure', 'hero']);
  });

  it('{#fig1} → figure id="fig1"', () => {
    const node = run(imgTree({ src: 'a.jpg', alt: 'A', id: 'fig1' }));
    expect(node.properties?.id).toBe('fig1');
  });

  it('{title:} passes through to the nested <img title>', () => {
    const node = run(imgTree({ src: 'a.jpg', alt: 'A', title: 'The Original Mac' }));
    expect(findTag(node, 'img')?.properties?.title).toBe('The Original Mac');
  });

  it('ignores unsupported keys that WP08 should never attach (C-006, FR-012)', () => {
    const node = run(imgTree({ src: 'a.jpg', alt: 'A', fullbleed: true, float: 'inside' }));
    const img = findTag(node, 'img');
    // No leakage of markua-internal / unsupported keys onto the <img>.
    expect(img?.properties).toEqual({ src: 'a.jpg', alt: '' });
    expect(node.properties).toEqual({ className: ['dk-figure'] });
  });
});

describe('markuaFigure — no markua-internal keys leak onto the <img>', () => {
  it('strips caption/markuaAlt/width/height/align/class/id from the <img> properties', () => {
    const node = run(
      imgTree({
        src: 'a.jpg',
        alt: 'Caption text',
        markuaAlt: 'real alt',
        caption: 'Caption text',
        width: '75%',
        align: 'right',
        className: ['hero'],
        id: 'fig1',
        title: 'a title',
      }),
    );
    const img = findTag(node, 'img');
    expect(Object.keys(img!.properties!).sort()).toEqual(
      ['alt', 'src', 'style', 'title'].sort(),
    );
  });
});

describe('markuaFigure — safeHref: un-allowlisted scheme degrades (never an <img src>)', () => {
  it('drops a javascript: source — no <img> emitted, degrades to caption text', () => {
    const node = run(imgTree({ src: 'javascript:alert(1)', alt: 'Evil' }));
    expect(findTag(node, 'img')).toBeUndefined();
    expect(node.type).toBe('text');
    expect(node.value).toBe('Evil');
  });

  it('drops a data: source — no <img> emitted', () => {
    const node = run(imgTree({ src: 'data:text/html,<script>alert(1)</script>', alt: 'x' }));
    expect(findTag(node, 'img')).toBeUndefined();
  });

  it('allows an http(s) web URL through as a plain <img src>', () => {
    const node = run(imgTree({ src: 'https://example.com/a.png', alt: 'Web' }));
    expect(findTag(node, 'img')?.properties?.src).toBe('https://example.com/a.png');
  });
});

describe('markuaFigure — src kept intact (pre-rehypeImages contract)', () => {
  it('the wrapped nested <img> keeps its original local src, unrewritten', () => {
    const node = run(imgTree({ src: 'images/palm-trees.jpg', alt: 'Palm Trees' }));
    const img = findTag(node, 'img');
    expect(img?.properties?.src).toBe('images/palm-trees.jpg');
    // No __ASTRO_IMAGE_ marker — this pass runs BEFORE rehypeImages.
    expect(img?.properties?.__ASTRO_IMAGE_).toBeUndefined();
  });

  it('leaves a page with no image untouched', () => {
    const tree: HastNode = {
      type: 'root',
      children: [
        { type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: 'plain text' }] },
      ],
    };
    markuaFigure()(tree as never);
    expect(tree.children![0].tagName).toBe('p');
    expect(textOf(tree)).toBe('plain text');
  });

  it('leaves an inline image (paragraph with surrounding text) as an in-place wrap, not a <p> unwrap', () => {
    const tree: HastNode = {
      type: 'root',
      children: [
        { type: 'element', tagName: 'p', properties: {}, children: [
          { type: 'text', value: 'before ' },
          { type: 'element', tagName: 'img', properties: { src: 'a.jpg', alt: 'A' }, children: [] },
          { type: 'text', value: ' after' },
        ] },
      ],
    };
    markuaFigure()(tree as never);
    // The <p> stays (not a lone-image paragraph); the inner img is wrapped in place.
    expect(tree.children![0].tagName).toBe('p');
    expect(findTag(tree, 'figure')).toBeDefined();
  });
});
