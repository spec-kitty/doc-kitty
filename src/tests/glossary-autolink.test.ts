/**
 * Astro-free unit matrix for the glossary auto-linker (ADR-0027 Decision 2,
 * contract `autolink-and-term.md`; FR-005/006/007/009, NFR-004/007). Everything
 * load-bearing lives in `glossary-autolink.internal` and is driven here directly
 * over hand-built mdast — no Astro, unified, or vfile runtime. The wrapper cases
 * exercise the deck/opt-out/presence gates and the `file.message` warning.
 *
 * The index stubs mirror the resolver's own test discipline: tiny inline
 * `SharedTermIndex`es (WP01's loader is never touched at runtime), and a
 * deliberately WRONG `anchor` field so the tests prove the linker recomputes it
 * via the shared `slug(termName)` rule.
 */
import { describe, it, expect } from 'vitest';
import {
  computePageLinks,
  collectLinksUsed,
  formatUnresolvedWarning,
  partitionSections,
  type MdNode,
  type MdRoot,
} from '../lib/remark/glossary-autolink.internal.js';
import glossaryAutolink from '../lib/remark/glossary-autolink.js';
import type { SharedTermIndex } from '../lib/glossary/types.js';

// ---------------------------------------------------------------------------
// mdast constructors
// ---------------------------------------------------------------------------
const text = (value: string): MdNode => ({ type: 'text', value });
const para = (...children: MdNode[]): MdNode => ({ type: 'paragraph', children });
const h2 = (value: string): MdNode => ({ type: 'heading', depth: 2, children: [text(value)] });
const h3 = (value: string): MdNode => ({ type: 'heading', depth: 3, children: [text(value)] });
const inlineCode = (value: string): MdNode => ({ type: 'inlineCode', value });
const plainLink = (url: string, ...children: MdNode[]): MdNode => ({ type: 'link', url, children });
const root = (...children: MdNode[]): MdRoot => ({ type: 'root', children });

/**
 * A `:term`-produced glossary link node (WP05's exact emitted shape) — including
 * the `data-glossary-anchor` / `data-glossary-context-slug` markers the two node
 * builders now carry (issue #17). `anchor` defaults to `slug`-of-surface for the
 * simple lowercase fixtures here, but is passable for de-collided cases.
 */
const termLink = (
  surface: string,
  termName: string,
  context: string,
  anchor: string = surface,
  contextSlug: string = context,
): MdNode => ({
  type: 'link',
  url: `/glossary/${contextSlug}/#${anchor}`,
  children: [text(surface)],
  data: {
    hProperties: {
      class: 'dk-glossary-link',
      'data-glossary-term': termName,
      'data-glossary-context': context,
      'data-glossary-anchor': anchor,
      'data-glossary-context-slug': contextSlug,
    },
  },
});

// ---------------------------------------------------------------------------
// index stub — anchor + contextSlug now carry the AUTHORITATIVE stored values the
// linker READS (issue #17): the emitted URL/anchor come straight from these.
// ---------------------------------------------------------------------------
function indexOf(
  bySurface: Record<
    string,
    Array<{ context: string; contextSlug: string; anchor: string; termName: string }>
  >,
): SharedTermIndex {
  return { bySurface: new Map(Object.entries(bySurface)), contexts: new Map() };
}

const index = indexOf({
  cargo: [{ context: 'shipping', contextSlug: 'shipping', anchor: 'cargo', termName: 'Cargo' }],
  policy: [
    { context: 'hr', contextSlug: 'hr', anchor: 'policy', termName: 'Policy' },
    { context: 'shipping', contextSlug: 'shipping', anchor: 'policy', termName: 'Policy' },
  ],
  'bill of lading': [
    { context: 'shipping', contextSlug: 'shipping', anchor: 'bill-of-lading', termName: 'Bill of Lading' },
  ],
  // A de-collided term (C++ → stored anchor `c-2`, e.g. after a `C` term) — used to
  // prove the linker emits, and collectLinksUsed reads back, the STORED anchor.
  'c++': [{ context: 'langs', contextSlug: 'langs', anchor: 'c-2', termName: 'C++' }],
});

const EMPTY_IGNORE: ReadonlySet<string> = new Set();

// ---------------------------------------------------------------------------
// helpers over the produced tree
// ---------------------------------------------------------------------------
function eachNode(node: MdNode, fn: (n: MdNode) => void): void {
  fn(node);
  if (Array.isArray(node.children)) for (const c of node.children) eachNode(c, fn);
}
function glossaryLinks(tree: MdNode): MdNode[] {
  const out: MdNode[] = [];
  eachNode(tree, (n) => {
    if (n.type === 'link' && typeof n.data?.hProperties?.['data-glossary-term'] === 'string') {
      out.push(n);
    }
  });
  return out;
}
function linkCount(tree: MdNode): number {
  return glossaryLinks(tree).length;
}

// ===========================================================================
describe('partitionSections — FR-005 section model', () => {
  it('opens with an implicit pre-H2 section, then one section per H2 (H3 nested)', () => {
    const children = [para(text('intro')), h2('A'), para(text('a')), h3('sub'), para(text('b')), h2('B')];
    const sections = partitionSections(children);
    expect(sections.map((s) => s.length)).toEqual([1, 4, 1]);
    // The implicit section holds the pre-H2 paragraph; H3 stays inside A's section.
    expect(sections[0][0].type).toBe('paragraph');
    expect(sections[1][0]).toEqual(h2('A'));
    expect(sections[1].some((n) => n.type === 'heading' && n.depth === 3)).toBe(true);
  });

  it('yields an empty implicit section when the document opens on an H2', () => {
    const sections = partitionSections([h2('A'), para(text('a'))]);
    expect(sections[0]).toEqual([]);
    expect(sections[1].length).toBe(2);
  });
});

// ===========================================================================
describe('computePageLinks — first eligible per section (FR-005)', () => {
  it('links the FIRST "cargo" in each of two H2 sections — two links total', () => {
    const tree = root(
      h2('Section A'),
      para(text('The cargo moved. More cargo here.')),
      h2('Section B'),
      para(text('Another cargo. And cargo again.')),
    );
    const { linksUsed } = computePageLinks(tree, undefined, index, EMPTY_IGNORE);
    expect(linkCount(tree)).toBe(2);
    // First mention linked, the paragraph's second "cargo" left as trailing text.
    const first = tree.children[1];
    expect(first.children!.map((n) => n.type)).toEqual(['text', 'link', 'text']);
    expect(first.children![0]).toEqual(text('The '));
    expect(first.children![2].value).toContain('More cargo here.');
    // Deduped by term across the whole page.
    expect(linksUsed).toHaveLength(1);
    expect(linksUsed[0].termName).toBe('Cargo');
  });

  it('counts the implicit pre-H2 section as its own section', () => {
    const tree = root(para(text('Intro cargo mention.')), h2('H'), para(text('cargo in section.')));
    computePageLinks(tree, undefined, index, EMPTY_IGNORE);
    expect(linkCount(tree)).toBe(2);
  });

  it('treats an H3 block as part of its parent H2 section (slot already taken → one link)', () => {
    const tree = root(h2('H2'), para(text('first cargo')), h3('H3'), para(text('second cargo')));
    computePageLinks(tree, undefined, index, EMPTY_IGNORE);
    expect(linkCount(tree)).toBe(1);
    expect(tree.children[1].children!.some((n) => n.type === 'link')).toBe(true);
    expect(tree.children[3].children!.some((n) => n.type === 'link')).toBe(false);
  });
});

// ===========================================================================
describe('computePageLinks — eligibility guards (FR-006)', () => {
  it('never links inside code / heading / an existing link', () => {
    const tree = root(
      h2('cargo in heading'),
      para(inlineCode('cargo'), text(' and '), plainLink('https://x', text('cargo')), text(' end')),
    );
    computePageLinks(tree, undefined, index, EMPTY_IGNORE);
    expect(linkCount(tree)).toBe(0);
  });

  it('matches whole-word only — "policyholder"/"cargohold" never match', () => {
    const messages: string[] = [];
    const tree = root(para(text('The policyholder read the cargohold manifest.')));
    computePageLinks(tree, undefined, index, EMPTY_IGNORE, (s, c) =>
      messages.push(formatUnresolvedWarning(s, c)),
    );
    expect(linkCount(tree)).toBe(0);
    expect(messages).toEqual([]); // no "policy" collision fired either
  });

  it('matches case-insensitively — "Cargo" links, preserving the surface casing', () => {
    const tree = root(para(text('Cargo at the start.')));
    computePageLinks(tree, undefined, index, EMPTY_IGNORE);
    const [link] = glossaryLinks(tree);
    expect(link.children![0].value).toBe('Cargo');
    expect(link.url).toBe('/glossary/shipping/#cargo');
  });

  it('links a multi-word surface as one node', () => {
    const tree = root(para(text('The bill of lading was signed.')));
    computePageLinks(tree, 'shipping', index, EMPTY_IGNORE);
    const [link] = glossaryLinks(tree);
    expect(link.children![0].value).toBe('bill of lading');
    expect(link.url).toBe('/glossary/shipping/#bill-of-lading');
  });
});

// ===========================================================================
describe('computePageLinks — opt-outs (FR-008)', () => {
  it('leaves an ignore-listed surface plain', () => {
    const tree = root(para(text('cargo everywhere')));
    computePageLinks(tree, undefined, index, new Set(['cargo']));
    expect(linkCount(tree)).toBe(0);
  });
});

// ===========================================================================
describe('computePageLinks — the shared link node (FR-009, #64 FR-001/FR-004)', () => {
  it('emits href + the dk-glossary-link class + data attrs, no target/rel; anchor + slug READ from the stored index', () => {
    const tree = root(para(text('one cargo here')));
    computePageLinks(tree, undefined, index, EMPTY_IGNORE);
    const [link] = glossaryLinks(tree);
    expect(link.url).toBe('/glossary/shipping/#cargo'); // stored contextSlug + anchor
    expect(link.data!.hProperties).toEqual({
      class: 'dk-glossary-link',
      'data-glossary-term': 'Cargo',
      'data-glossary-context': 'shipping',
      'data-glossary-anchor': 'cargo',
      'data-glossary-context-slug': 'shipping',
    });
  });
});

// ===========================================================================
describe('computePageLinks — unresolved collisions (FR-007, NFR-007)', () => {
  it('leaves the text plain and warns ONCE per distinct surface per page', () => {
    const messages: string[] = [];
    const tree = root(para(text('policy then policy and policy again')));
    computePageLinks(tree, undefined, index, EMPTY_IGNORE, (s, c) =>
      messages.push(formatUnresolvedWarning(s, c)),
    );
    expect(linkCount(tree)).toBe(0);
    expect(messages).toEqual([
      '[glossary] unresolved collision "policy" in hr, shipping — left unlinked',
    ]);
  });

  it('disambiguates via the page context — a matching glossary_context links it', () => {
    const tree = root(para(text('policy applies here')));
    computePageLinks(tree, 'hr', index, EMPTY_IGNORE);
    const [link] = glossaryLinks(tree);
    expect(link.url).toBe('/glossary/hr/#policy');
    expect(link.data!.hProperties!['data-glossary-context']).toBe('hr');
  });
});

// ===========================================================================
describe('computePageLinks — links-used incl. :term (ADR-0025 A-2)', () => {
  it('seeds the section from a pre-existing :term link so a later plain surface is not doubled', () => {
    const tree = root(h2('S'), para(termLink('cargo', 'Cargo', 'shipping'), text(' then cargo again')));
    const { linksUsed } = computePageLinks(tree, undefined, index, EMPTY_IGNORE);
    expect(linkCount(tree)).toBe(1); // the :term consumed the section slot
    expect(linksUsed).toHaveLength(1);
    expect(linksUsed[0].termName).toBe('Cargo');
  });

  it('collects BOTH a :term link and an auto-link, in document order, deduped by term', () => {
    const tree = root(
      h2('S'),
      para(
        termLink('bill of lading', 'Bill of Lading', 'shipping', 'bill-of-lading'),
        text(' and cargo moved'),
      ),
    );
    const { linksUsed } = computePageLinks(tree, undefined, index, EMPTY_IGNORE);
    expect(linkCount(tree)).toBe(2); // pre-existing :term + one auto-linked cargo
    expect(linksUsed.map((l) => l.termName)).toEqual(['Bill of Lading', 'Cargo']);
    expect(linksUsed[0].anchor).toBe('bill-of-lading');
  });

  it('produces a byte-identical links-used across two runs (NFR-004 determinism)', () => {
    const build = (): MdRoot =>
      root(h2('S'), para(termLink('cargo', 'Cargo', 'shipping'), text(' and a bill of lading')));
    const a = computePageLinks(build(), 'shipping', index, EMPTY_IGNORE).linksUsed;
    const b = computePageLinks(build(), 'shipping', index, EMPTY_IGNORE).linksUsed;
    expect(a).toEqual(b);
  });

  it('collectLinksUsed picks up a bare :term link even with no auto-links added', () => {
    const tree = root(para(termLink('cargo', 'Cargo', 'shipping')));
    expect(collectLinksUsed(tree)).toEqual([
      {
        surface: 'cargo',
        context: 'shipping',
        contextSlug: 'shipping',
        anchor: 'cargo',
        termName: 'Cargo',
      },
    ]);
  });

  it('reads a DE-COLLIDED stored anchor from data-glossary-anchor, matching the heading id (issue #17)', () => {
    // The auto-linker links `C++`; the emitted node + the used-list must carry the
    // stored `c-2` anchor (NOT slug('C++')==='c'), so the link points at the real
    // `## C++ {#c-2}` heading id the generator wrote.
    const tree = root(para(text('Use C++ in production.')));
    const { linksUsed } = computePageLinks(tree, undefined, index, EMPTY_IGNORE);
    const [link] = glossaryLinks(tree);
    expect(link.url).toBe('/glossary/langs/#c-2');
    expect(link.data!.hProperties!['data-glossary-anchor']).toBe('c-2');
    expect(linksUsed).toEqual([
      {
        surface: 'C++',
        context: 'langs',
        contextSlug: 'langs',
        anchor: 'c-2',
        termName: 'C++',
      },
    ]);
  });
});

// ===========================================================================
describe('computePageLinks — Unicode word boundaries (issue #17)', () => {
  it('does NOT link a term abutting a non-Latin letter, but still links ASCII-punctuation adjacency', () => {
    // `Cargoで` (trailing CJK) and `caféCargo` (leading accented letter) are INSIDE a
    // word under Unicode boundaries → left plain. `Cargo.` and `(Cargo)` are not.
    const notLinked = root(para(text('Cargoで shipped; caféCargo blended.')));
    computePageLinks(notLinked, undefined, index, EMPTY_IGNORE);
    expect(linkCount(notLinked)).toBe(0);

    const dot = root(para(text('The Cargo. arrived')));
    computePageLinks(dot, undefined, index, EMPTY_IGNORE);
    expect(linkCount(dot)).toBe(1);

    const paren = root(para(text('shipment (Cargo) here')));
    computePageLinks(paren, undefined, index, EMPTY_IGNORE);
    expect(linkCount(paren)).toBe(1);
  });
});

// ===========================================================================
describe('computePageLinks — presence gate (NFR-002)', () => {
  it('is byte-identical when the index has no surfaces', () => {
    const emptyIndex = indexOf({});
    const tree = root(para(text('cargo and policy')));
    const before = JSON.stringify(tree);
    const { linksUsed } = computePageLinks(tree, undefined, emptyIndex, EMPTY_IGNORE);
    expect(JSON.stringify(tree)).toBe(before);
    expect(linksUsed).toEqual([]);
  });
});

// ===========================================================================
describe('glossaryAutolink wrapper — gates', () => {
  const fileWith = (frontmatter: Record<string, unknown>) => {
    const messages: string[] = [];
    return {
      file: { data: { astro: { frontmatter } }, message: (r: string) => messages.push(r) },
      messages,
    };
  };

  it('is a no-op when no index is supplied', () => {
    const tree = root(para(text('cargo here')));
    const before = JSON.stringify(tree);
    glossaryAutolink()(tree, fileWith({}).file);
    expect(JSON.stringify(tree)).toBe(before);
  });

  it('is a no-op on a deck (kind: Presentation)', () => {
    const tree = root(para(text('cargo on a slide')));
    glossaryAutolink({ index })(tree, fileWith({ kind: 'Presentation' }).file);
    expect(linkCount(tree)).toBe(0);
  });

  it('is a no-op when glossary_autolink is false', () => {
    const tree = root(para(text('cargo here')));
    glossaryAutolink({ index })(tree, fileWith({ glossary_autolink: false }).file);
    expect(linkCount(tree)).toBe(0);
  });

  it('links normally on an ordinary page and reads glossary_context', () => {
    const tree = root(para(text('policy applies')));
    glossaryAutolink({ index })(tree, fileWith({ glossary_context: 'hr' }).file);
    expect(glossaryLinks(tree)[0].url).toBe('/glossary/hr/#policy');
  });

  it('re-emits one file.message per distinct unresolved collision', () => {
    const tree = root(para(text('policy then policy')));
    const { file, messages } = fileWith({});
    glossaryAutolink({ index })(tree, file);
    expect(messages).toEqual([
      '[glossary] unresolved collision "policy" in hr, shipping — left unlinked',
    ]);
  });

  it('honors the ignore-list passed at registration', () => {
    const tree = root(para(text('cargo here')));
    glossaryAutolink({ index, ignoreList: new Set(['cargo']) })(tree, fileWith({}).file);
    expect(linkCount(tree)).toBe(0);
  });
});
