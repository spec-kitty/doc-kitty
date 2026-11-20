/** Print order (ADR-0081 D-06): index first, then sidebar.order, title, slug; decks out. */
import { describe, it, expect } from 'vitest';
import { sectionPages, siteSections, type PrintEntry } from '../lib/print/order.js';

const e = (slug: string, title: string, extra: Partial<PrintEntry['data']> = {}): PrintEntry => ({
  slug,
  data: { title, ...extra },
});

const ENTRIES = [
  e('architecture', 'Architecture'),
  e('architecture/zeta', 'Zeta'),
  e('architecture/alpha', 'Alpha'),
  e('architecture/pinned', 'Pinned last by title', { sidebar: { order: 1 } }),
  e('architecture/alpha/child', 'Alpha child'),
  e('architecture/noindex/leaf', 'Leaf in a folder without an index'),
  e('architecture/deck', 'A deck', { kind: 'Presentation' }),
  e('architecture-notes/other', 'Another section with a shared prefix'),
  e('guides', 'Guides'),
  e('', 'Home'),
];

describe('sectionPages', () => {
  it('puts the index apart and walks the rest depth first', () => {
    const { index, pages } = sectionPages(ENTRIES, 'architecture', ['Presentation']);
    expect(index?.slug).toBe('architecture');
    // `pinned` has an order; then pages before folders (`zeta`), then folders by title.
    expect(pages.map((p) => p.slug)).toEqual([
      'architecture/pinned',
      'architecture/zeta',
      'architecture/alpha',
      'architecture/alpha/child',
      'architecture/noindex/leaf',
    ]);
  });

  it('never holds an excluded kind, and does not leak a prefix-sharing section', () => {
    const { pages } = sectionPages(ENTRIES, 'architecture', ['Presentation']);
    expect(pages.some((p) => p.data.kind === 'Presentation')).toBe(false);
    expect(pages.some((p) => p.slug.startsWith('architecture-notes'))).toBe(false);
    // Control: with no exclusion the deck is there.
    expect(sectionPages(ENTRIES, 'architecture', []).pages.some((p) => p.slug === 'architecture/deck')).toBe(true);
  });

  it('reads numbers in titles as numbers, and puts pages before folders on a tie', () => {
    const book = [
      e('book', 'Book'),
      e('book/ch-10', 'Chapter 10'),
      e('book/ch-2', 'Chapter 2'),
      e('book/part', 'A part folder', { sidebar: { order: 1 } }),
      e('book/part/x', 'Inside'),
      e('book/intro', 'Introduction', { sidebar: { order: 1 } }),
    ];
    expect(sectionPages(book, 'book', []).pages.map((p) => p.slug)).toEqual([
      'book/intro',
      'book/part',
      'book/part/x',
      'book/ch-2',
      'book/ch-10',
    ]);
  });

  it('handles a section with only its index page', () => {
    expect(sectionPages(ENTRIES, 'guides', []).pages).toEqual([]);
  });
});

describe('siteSections', () => {
  const slugs = ['', 'context', 'architecture/x', 'rhetoric/y', 'changelog', 'glossary-demo/a', 'zz-extra'];
  it('orders main, unregistered folders, then appendix; drops excluded and omitted', () => {
    expect(
      siteSections(['context', 'architecture', 'rhetoric', 'changelog', 'empty'], slugs, {
        excludeSections: ['changelog'],
        omit: [],
        appendix: ['rhetoric'],
      }),
    ).toEqual({ main: ['context', 'architecture'], unregistered: ['glossary-demo'], loose: ['zz-extra'], appendix: ['rhetoric'] });
  });

  it('omit leaves a section out of the whole-site order', () => {
    expect(siteSections(['context', 'architecture'], slugs, { excludeSections: [], omit: ['context'], appendix: [] }).main).toEqual([
      'architecture',
    ]);
  });
});
