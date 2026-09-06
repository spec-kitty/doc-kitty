/**
 * Astro-free unit matrix for the slide-split transform (FR-018 / NFR-005).
 *
 * The pure grouping/directive/note logic (`splitDeck`) is exercised directly on
 * hand-built mdast; the frontmatter guard is exercised through the plugin
 * wrapper (`deckSplit`) with a fake VFile. No Astro, unified, or vfile runtime is
 * involved, so this suite is independent of the build and the Playwright lane.
 */
import { describe, it, expect } from 'vitest';
import deckSplit from '../lib/remark/deck-split.js';
import {
  splitDeck,
  type DeckFrontmatter,
  type DeckSection,
  type MdNode,
  type MdRoot,
} from '../lib/remark/deck-split.internal.js';

const DECK: DeckFrontmatter = {
  kind: 'Presentation',
  title: 'My Deck',
  description: 'A test deck',
};

const root = (...children: MdNode[]): MdRoot => ({ type: 'root', children });
const h = (depth: number, text: string): MdNode => ({
  type: 'heading',
  depth,
  children: [{ type: 'text', value: text }],
});
const p = (text: string): MdNode => ({
  type: 'paragraph',
  children: [{ type: 'text', value: text }],
});
const html = (value: string): MdNode => ({ type: 'html', value });
const hr = (): MdNode => ({ type: 'thematicBreak' });

const isSection = (n: MdNode): n is DeckSection => n.type === 'deckSection';
const props = (n: MdNode): Record<string, unknown> =>
  (n.data?.hProperties ?? {}) as Record<string, unknown>;
const heading = (n: MdNode, depth: number): boolean =>
  n.children?.some((c) => c.type === 'heading' && c.depth === depth) ?? false;

describe('splitDeck — grouping', () => {
  it('synthesizes a title slide from frontmatter incl. object hero_image (FR-003)', () => {
    const { children } = splitDeck(root(h(2, 'One')), {
      kind: 'Presentation',
      title: 'Deck Title',
      description: 'Sub',
      // `hero_image` is an OBJECT { src, alt } per the frozen contract (ADR-0011),
      // never a string — a string is silently dropped (regression guard, F-01).
      hero_image: { src: '/hero.png', alt: 'A hero' },
    });
    const title = children[0];
    expect(title.data.hName).toBe('section');
    // heading (h1) + hero image paragraph — the description is metadata only (FR-002),
    // so the hero image is now title child index 1, not 2.
    expect(title.children[0]).toMatchObject({ type: 'heading', depth: 1 });
    expect(title.children[0].children?.[0]).toMatchObject({ value: 'Deck Title' });
    const img = title.children[1]?.children?.[0];
    expect(img).toMatchObject({ type: 'image', url: '/hero.png', alt: 'A hero' });
  });

  it('tags the synthesized hero image with data-deck-hero (D4/C-COMPOSE-05, WP02 T005)', () => {
    // markuaFigure (rehype) reads this via mdast-util-to-hast's default image
    // handler, which folds mdast `data.hProperties` onto the hast `properties` —
    // so this is the discriminator that lets markuaFigure skip only the hero.
    const { children } = splitDeck(root(h(2, 'One')), {
      kind: 'Presentation',
      title: 'Deck Title',
      hero_image: { src: '/hero.png', alt: 'A hero' },
    });
    const title = children[0];
    const img = title.children[1]?.children?.[0];
    expect(img?.data?.hProperties?.['data-deck-hero']).toBe('');
    // url/alt stay identical alongside the tag.
    expect(img).toMatchObject({ type: 'image', url: '/hero.png', alt: 'A hero' });
  });

  it('never synthesizes the description as title-slide body text (FR-002)', () => {
    const { children } = splitDeck(root(h(2, 'One')), {
      kind: 'Presentation',
      title: 'T',
      description: 'LEAK-SENTINEL',
    });
    const title = children[0];
    const hasDescPara = title.children.some(
      (c) =>
        c.type === 'paragraph' &&
        (c.children?.some((k) => k.type === 'text' && k.value === 'LEAK-SENTINEL') ?? false),
    );
    expect(hasDescPara, 'the description must not appear as a title-slide paragraph').toBe(false);
  });

  it('drops a hero_image with no src, and never reads it as a string (F-01)', () => {
    const asString = splitDeck(root(h(2, 'One')), {
      kind: 'Presentation',
      title: 'T',
      // @ts-expect-error — the contract is an object; a string must NOT produce an image
      hero_image: '/legacy-string.png',
    });
    // title slide is just the heading (no image paragraph) when the shape is wrong
    expect(asString.children[0].children.every((c) => c.type !== 'paragraph' || !c.children?.some((k) => k.type === 'image'))).toBe(true);
  });

  it('splits on `##` into ordered horizontal sections', () => {
    const { children } = splitDeck(root(h(2, 'A'), p('a'), h(2, 'B'), p('b')), DECK);
    // title slide + 2 horizontals
    expect(children).toHaveLength(3);
    expect(children.every(isSection)).toBe(true);
    expect(heading(children[1], 2)).toBe(true);
    expect(children[1].children.map((c) => c.value ?? c.type)).toContain('paragraph');
    // document order preserved: A before B
    expect(children[1].children[0].children?.[0]?.value).toBe('A');
    expect(children[2].children[0].children?.[0]?.value).toBe('B');
  });

  it('converts a `##` section into a stack of inner sections on `###`', () => {
    const { children } = splitDeck(
      root(h(2, 'Top'), p('top prose'), h(3, 'Sub'), p('sub prose')),
      DECK,
    );
    const stack = children[1];
    // Stack invariant: outer contains ONLY inner sections, no loose prose.
    expect(stack.children).toHaveLength(2);
    expect(stack.children.every(isSection)).toBe(true);
    // inner #1 = the `##` slide's own content (heading + prose)
    expect(heading(stack.children[0], 2)).toBe(true);
    expect((stack.children[0].children ?? []).map((c) => c.type)).toContain('paragraph');
    // inner #2 = the `###`
    expect(heading(stack.children[1], 3)).toBe(true);
  });

  it('converts the TITLE slide into a stack when `###` precedes the first `##`', () => {
    const { children } = splitDeck(root(h(3, 'Early'), p('x')), DECK);
    expect(children).toHaveLength(1);
    const stack = children[0];
    expect(stack.children).toHaveLength(2);
    expect(stack.children.every(isSection)).toBe(true);
    // inner #1 carries the synthesized title heading (accessible name preserved)
    expect(heading(stack.children[0], 1)).toBe(true);
    expect(heading(stack.children[1], 3)).toBe(true);
  });

  it('renders a deck with NO `##` as a single title slide', () => {
    // title-only frontmatter → the slide is just the synthesized heading + prose
    const { children } = splitDeck(root(p('just prose'), p('more')), {
      kind: 'Presentation',
      title: 'Only',
    });
    expect(children).toHaveLength(1);
    expect(children[0].data.hName).toBe('section');
    // title heading + the two prose paragraphs, in document order
    expect(children[0].children.map((c) => c.type)).toEqual([
      'heading',
      'paragraph',
      'paragraph',
    ]);
  });

  it('turns `---` into a headingless slide with an aria-label and drops the <hr>', () => {
    const { children } = splitDeck(root(h(2, 'A'), hr(), p('after')), DECK);
    // title + A + headingless
    expect(children).toHaveLength(3);
    const headingless = children[2];
    expect(props(headingless)['aria-label']).toBe('Slide 3');
    // the <hr> node is consumed — no thematicBreak survives anywhere
    const flat = JSON.stringify(children);
    expect(flat).not.toContain('thematicBreak');
    expect(headingless.children[0]).toMatchObject({ type: 'paragraph' });
  });

  it('keeps `####`+ inside the current slide', () => {
    const { children } = splitDeck(root(h(2, 'A'), h(4, 'Deep'), p('x')), DECK);
    expect(children).toHaveLength(2);
    // the h4 stays a child of the `##` slide — no new section opened
    expect(heading(children[1], 4)).toBe(true);
    expect(children[1].children.map((c) => c.type)).toEqual([
      'heading',
      'heading',
      'paragraph',
    ]);
  });
});

describe('splitDeck — directives', () => {
  it('merges `.slide` attributes onto the enclosing section', () => {
    const { children, warnings } = splitDeck(
      root(h(2, 'A'), html('<!-- .slide: data-background-color="#0D0E11" -->')),
      DECK,
    );
    expect(props(children[1])['data-background-color']).toBe('#0D0E11');
    expect(warnings).toHaveLength(0);
    // directive node consumed
    expect(children[1].children.some((c) => c.type === 'html')).toBe(false);
  });

  it('merges multiple `.slide` directives last-wins per key', () => {
    const { children } = splitDeck(
      root(
        h(2, 'A'),
        html('<!-- .slide: data-transition="fade" -->'),
        html('<!-- .slide: data-transition="zoom" -->'),
      ),
      DECK,
    );
    expect(props(children[1])['data-transition']).toBe('zoom');
  });

  it('merges `.element` attributes onto the preceding sibling block', () => {
    const bullet = p('a bullet');
    const { children, warnings } = splitDeck(
      root(h(2, 'A'), bullet, html('<!-- .element: class="fragment" -->')),
      DECK,
    );
    const para = children[1].children.find((c) => c.type === 'paragraph');
    expect(para?.data?.hProperties?.class).toBe('fragment');
    // Regression guard for the FIX A collision case below: a node with NO prior
    // `className` still gets the plain raw `class` key, never `className`.
    expect(para?.data?.hProperties?.className).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });

  it('FIX A: a `.element: class="…"` MERGES into an existing `className` array (deck callout collision) instead of writing a duplicate raw `class` key', () => {
    // A Markua callout (`markua-callouts.ts`, `emitThemeCallout`) rewrites its
    // directive to `data.hName: 'aside'` / `data.hProperties.className:
    // ['dk-callout', 'dk-callout--tip']` BEFORE `deckSplit` ever sees it. A
    // reveal `<!-- .element: class="fragment" -->` immediately after it used to
    // write a second, RAW `class` key next to that array —
    // `<aside class="dk-callout dk-callout--tip" class="fragment">` — invalid
    // markup that silently drops the fragment (a browser keeps only the first
    // `class` attribute). This node mirrors that emitted callout shape.
    const calloutNode: MdNode = {
      type: 'containerDirective',
      data: { hName: 'aside', hProperties: { className: ['dk-callout', 'dk-callout--tip'] } },
      children: [],
    };
    const { children, warnings } = splitDeck(
      root(h(2, 'A'), calloutNode, html('<!-- .element: class="fragment" -->')),
      DECK,
    );
    const aside = children[1].children.find((c) => c.type === 'containerDirective');
    expect(props(aside as MdNode).className).toEqual(['dk-callout', 'dk-callout--tip', 'fragment']);
    expect(props(aside as MdNode).class).toBeUndefined(); // no duplicate raw `class` key
    expect(warnings).toHaveLength(0);
  });

  it('FIX A: the merge dedupes a token already present in `className`', () => {
    const calloutNode: MdNode = {
      type: 'containerDirective',
      data: { hName: 'aside', hProperties: { className: ['dk-callout', 'fragment'] } },
      children: [],
    };
    const { children } = splitDeck(
      root(h(2, 'A'), calloutNode, html('<!-- .element: class="fragment" -->')),
      DECK,
    );
    const aside = children[1].children.find((c) => c.type === 'containerDirective');
    expect(props(aside as MdNode).className).toEqual(['dk-callout', 'fragment']);
  });

  it('warns and skips a `.element` directive with no preceding sibling', () => {
    // after `---` the headingless slide is empty, so there is no preceding block
    const { warnings } = splitDeck(
      root(h(2, 'A'), hr(), html('<!-- .element: class="fragment" -->')),
      DECK,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/no preceding sibling/i);
  });

  it('warns (never throws) on an unknown directive key', () => {
    let result: ReturnType<typeof splitDeck> | undefined;
    expect(() => {
      result = splitDeck(root(h(2, 'A'), html('<!-- .slide: wat="nope" -->')), DECK);
    }).not.toThrow();
    expect(result?.warnings.some((w) => /unknown/i.test(w.message))).toBe(true);
    // still produced sections despite the warning
    expect(result?.children.length).toBeGreaterThan(0);
  });
});

describe('splitDeck — notes', () => {
  it('turns a `Note:` paragraph into an aside child of the slide', () => {
    const { children } = splitDeck(
      root(h(2, 'A'), p('visible'), { type: 'paragraph', children: [{ type: 'text', value: 'Note: hidden speaker text' }] }),
      DECK,
    );
    const aside = children[1].children.find((c) => c.type === 'deckNote');
    expect(aside?.data?.hName).toBe('aside');
    expect(aside?.data?.hProperties?.className).toEqual(['notes']);
    expect(aside?.data?.hProperties?.['data-pagefind-ignore']).toBe('');
    // the `Note:` prefix is stripped from the aside's text
    const text = aside?.children?.[0]?.children?.[0]?.value;
    expect(text).toBe('hidden speaker text');
  });
});

describe('splitDeck — stack conversion migrates name + attributes (B-01/B-02/B-04)', () => {
  it('a headingless `---` slide that gains `###` keeps its aria-label on the CONTENT slide, not the wrapper (B-01)', () => {
    // --- opens a headingless slide (aria-label), then loose prose, then ### makes it a stack.
    const { children } = splitDeck(
      root(h(2, 'A'), hr(), p('loose'), h(3, 'Sub')),
      DECK,
    );
    const stack = children[2]; // title, A, headingless-stack
    expect(stack.children.every(isSection)).toBe(true);
    // the wrapper stack is NOT the only named node: inner #1 (the content) carries the label
    expect(props(stack)['aria-label']).toBeUndefined();
    expect(props(stack.children[0])['aria-label']).toBe('Slide 3');
  });

  it('labels a headingless slide by NAVIGABLE ordinal, counting inner stack slides (B-02)', () => {
    // title(1), A becomes a stack: A-content(2) + Sub(3); then --- headingless is slide 4.
    const { children } = splitDeck(
      root(h(2, 'A'), p('a'), h(3, 'Sub'), p('s'), hr(), p('after')),
      DECK,
    );
    const headingless = children[children.length - 1];
    expect(props(headingless)['aria-label']).toBe('Slide 4');
  });

  it('a `.slide` attribute on a `##` that later becomes a stack lands on inner #1, not the wrapper (B-04)', () => {
    const { children } = splitDeck(
      root(
        h(2, 'A'),
        html('<!-- .slide: data-background-color="#101828" -->'),
        h(3, 'Sub'),
      ),
      DECK,
    );
    const stack = children[1];
    // wrapper clean, background scoped to the content slide (no bleed across the stack)
    expect(props(stack)['data-background-color']).toBeUndefined();
    expect(props(stack.children[0])['data-background-color']).toBe('#101828');
  });
});

describe('splitDeck — directive robustness (B-03/B-05)', () => {
  it('warns on a misspelled directive NAME and consumes it (B-03 / FR-008)', () => {
    const { children, warnings } = splitDeck(
      root(h(2, 'A'), html('<!-- .slyde: data-x="1" -->')),
      DECK,
    );
    expect(warnings.some((w) => /unknown deck directive/i.test(w.message))).toBe(true);
    // the typo'd comment does not survive as inert markup in the slide
    expect(children[1].children.some((c) => c.type === 'html')).toBe(false);
  });

  it('a leading `.element` warns rather than mutating the synthesized title node (B-05)', () => {
    const { children, warnings } = splitDeck(
      root(html('<!-- .element: class="fragment" -->'), h(2, 'A')),
      DECK, // DECK has a title, so the title slide has synthesized children
    );
    expect(warnings.some((w) => /no preceding sibling/i.test(w.message))).toBe(true);
    // the synthesized title heading/description carry no injected class
    for (const kid of children[0].children) {
      expect(kid.data?.hProperties?.class).toBeUndefined();
    }
  });
});

describe('splitDeck — directive security allowlist (S-01/S-02)', () => {
  it('rejects (does not apply) an `on*` event-handler attribute (S-01)', () => {
    const { children, warnings } = splitDeck(
      root(h(2, 'A'), html('<!-- .slide: onclick="steal()" -->')),
      DECK,
    );
    expect(props(children[1]).onclick).toBeUndefined();
    expect(warnings.some((w) => /rejected unsafe/i.test(w.message))).toBe(true);
  });

  it('rejects an `on*` handler on a `.element` target too (S-01)', () => {
    const bullet = p('b');
    const { warnings } = splitDeck(
      root(h(2, 'A'), bullet, html('<!-- .element: onmouseover="x" -->')),
      DECK,
    );
    expect(bullet.data?.hProperties?.onmouseover).toBeUndefined();
    expect(warnings.some((w) => /rejected unsafe/i.test(w.message))).toBe(true);
  });

  it('rejects a remote-content background attribute but keeps a local one (S-02)', () => {
    const remote = splitDeck(
      root(h(2, 'A'), html('<!-- .slide: data-background-iframe="https://evil.example" -->')),
      DECK,
    );
    expect(props(remote.children[1])['data-background-iframe']).toBeUndefined();
    expect(remote.warnings.some((w) => /rejected unsafe/i.test(w.message))).toBe(true);

    const local = splitDeck(
      root(h(2, 'B'), html('<!-- .slide: data-background-image="./local.png" -->')),
      DECK,
    );
    expect(props(local.children[1])['data-background-image']).toBe('./local.png');
  });

  it('drops an unknown attribute (allowlist is load-bearing, not decorative) (S-01)', () => {
    const { children, warnings } = splitDeck(
      root(h(2, 'A'), html('<!-- .slide: contenteditable="true" -->')),
      DECK,
    );
    expect(props(children[1]).contenteditable).toBeUndefined();
    expect(warnings.some((w) => /unknown .*\(dropped\)/i.test(w.message))).toBe(true);
  });
});

describe('deckSplit plugin — scope guard (C-005)', () => {
  const makeFile = (kind: string) => {
    const messages: string[] = [];
    return {
      messages,
      file: {
        data: { astro: { frontmatter: { kind } } },
        message(reason: string) {
          messages.push(reason);
          return reason;
        },
      },
    };
  };

  it('is a no-op on a non-Presentation page (`---` stays a thematicBreak → <hr>)', () => {
    const tree = root(h(2, 'A'), hr(), p('x'));
    const before = JSON.parse(JSON.stringify(tree));
    const { file } = makeFile('Doc');
    deckSplit()(tree, file);
    // byte-identical tree: thematicBreak survives, no deckSection introduced
    expect(tree).toEqual(before);
    expect(tree.children.some((c) => c.type === 'thematicBreak')).toBe(true);
    expect(tree.children.some((c) => c.type === 'deckSection')).toBe(false);
  });

  it('transforms and surfaces warnings on a Presentation page', () => {
    const tree = root(h(2, 'A'), html('<!-- .slide: bogus="x" -->'));
    const { file, messages } = makeFile('Presentation');
    deckSplit()(tree, file);
    expect(tree.children.every((c) => c.type === 'deckSection')).toBe(true);
    expect(messages.some((m) => /unknown/i.test(m))).toBe(true);
  });
});
