import { describe, it, expect } from 'vitest';
import {
  sectionRank,
  SECTION_ORDER,
  SECTION_LABEL,
  includedInRssFeed,
  type DocEntry,
} from '../lib/metadata.js';

describe('presentations section wiring (FR-011 / T014)', () => {
  it('ranks presentations finite (known, not unknown-last)', () => {
    const rank = sectionRank('presentations');
    expect(Number.isFinite(rank)).toBe(true);
    // A known section ranks strictly below the unknown-last sentinel.
    expect(rank).toBeLessThan(sectionRank('nope'));
    expect(rank).toBe(SECTION_ORDER.indexOf('presentations'));
  });

  it('orders presentations after changelog', () => {
    expect(sectionRank('changelog')).toBeLessThan(sectionRank('presentations'));
  });

  it('labels presentations with its human-readable name', () => {
    expect(SECTION_LABEL['presentations']).toBe('Presentations');
  });

  it('leaves the pre-existing section grouping unchanged (only presentations appended)', () => {
    expect(SECTION_ORDER[SECTION_ORDER.length - 1]).toBe('presentations');
    // Every other section keeps its original rank order.
    expect(sectionRank('context')).toBeLessThan(sectionRank('architecture'));
    expect(sectionRank('migrations')).toBeLessThan(sectionRank('changelog'));
  });
});

describe('RSS excludes kind:Presentation (FR-011 / T013)', () => {
  const deck: DocEntry = {
    slug: 'presentations/kickoff',
    data: { title: 'Kickoff Deck', doc_status: 'active', kind: 'Presentation' },
  };
  const normalDoc: DocEntry = {
    slug: 'guides/deploy',
    data: { title: 'Deploy', doc_status: 'active', kind: 'guide' },
  };

  it('drops a kind:Presentation entry from the feed', () => {
    expect(includedInRssFeed(deck)).toBe(false);
  });

  it('keeps a normal (non-Presentation) doc in the feed', () => {
    expect(includedInRssFeed(normalDoc)).toBe(true);
  });

  it('excludes a deck regardless of where it is filed (keyed on kind, not path)', () => {
    const misfiledDeck: DocEntry = {
      slug: 'guides/some-deck',
      data: { title: 'Misfiled Deck', doc_status: 'active', kind: 'Presentation' },
    };
    expect(includedInRssFeed(misfiledDeck)).toBe(false);
  });

  it('keeps a doc with no kind (undefined) in the feed', () => {
    const noKind: DocEntry = {
      slug: 'context/intro',
      data: { title: 'Intro', doc_status: 'active' },
    };
    expect(includedInRssFeed(noKind)).toBe(true);
  });
});
