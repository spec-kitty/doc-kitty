import { describe, it, expect } from 'vitest';
import {
  sectionRank,
  sectionLabel,
  rankForAgents,
  expectedDocType,
  SECTION_ORDER,
  SECTION_LABEL,
  SECTION_TYPE,
  includedInRssFeed,
  type DocEntry,
} from '../lib/metadata.js';
import {
  parseSectionRegistry,
  sectionOrder,
  sectionLabels,
  sectionTypes,
} from '../lib/sections.js';

// The section-registry contract (issue #18): the metadata helpers are PURE and
// parameterized on the resolved order/labels. These tests assert the registry
// DRIVES rank + label, while a no-registry call still falls back to the frozen
// SECTION_ORDER / SECTION_LABEL constants (protecting example/docs and any root
// without a sections.yaml).

const REGISTRY_YAML = `version: 1
sections:
  - id: context
    label: Context
    order: 10
  - id: architecture
    label: Architecture
    order: 20
  - id: adr
    label: Decision Records
    order: 30
  - id: glossary
    label: Reference
    order: 60
  - id: faq
    label: FAQ
    order: 25
`;

const registry = parseSectionRegistry(REGISTRY_YAML);
const order = sectionOrder(registry);
const labels = sectionLabels(registry);

describe('registry drives section ORDER (sectionRank)', () => {
  it('orders sections by the registry, not the frozen tuple', () => {
    expect(sectionRank('context', order)).toBeLessThan(sectionRank('architecture', order));
    expect(sectionRank('architecture', order)).toBeLessThan(sectionRank('adr', order));
  });

  it('ranks a section that is in the YAML but ABSENT from the old tuple', () => {
    // `faq` is not in SECTION_ORDER; via the registry it sorts by its `order` (25),
    // between architecture (20) and adr (30) — a finite rank, not unknown-last.
    expect(sectionRank('architecture', order)).toBeLessThan(sectionRank('faq', order));
    expect(sectionRank('faq', order)).toBeLessThan(sectionRank('adr', order));
    expect(sectionRank('faq', order)).toBeLessThan(sectionRank('nope', order));
  });

  it('keeps the root first and an unknown section last', () => {
    expect(sectionRank('', order)).toBe(-1);
    expect(sectionRank('context', order)).toBeLessThan(sectionRank('nope', order));
  });
});

describe('registry drives section LABEL (sectionLabel)', () => {
  it('resolves a label from the YAML', () => {
    expect(sectionLabel('adr', labels)).toBe('Decision Records');
  });

  it('returns undefined for an unknown section so the caller keeps its fallback', () => {
    expect(sectionLabel('nope', labels)).toBeUndefined();
  });
});

describe('glossary ships under a "Reference" group', () => {
  it('labels the glossary section "Reference"', () => {
    expect(sectionLabel('glossary', labels)).toBe('Reference');
  });

  it('ranks the glossary section FINITE (not unknown-last)', () => {
    expect(sectionRank('glossary', order)).toBeLessThan(sectionRank('nope', order));
    expect(Number.isFinite(sectionRank('glossary', order))).toBe(true);
  });
});

describe('a section is relocatable by editing sections.yaml alone (FR-013 proof)', () => {
  it('flips sectionRank order when two `order` values are swapped — no code edit', () => {
    const base = parseSectionRegistry(`version: 1
sections:
  - id: guides
    label: Guides
    order: 10
  - id: reference
    label: Reference
    order: 20
`);
    const baseOrder = sectionOrder(base);
    expect(sectionRank('guides', baseOrder)).toBeLessThan(sectionRank('reference', baseOrder));

    // Same sections, `order` values swapped in the data only.
    const swapped = parseSectionRegistry(`version: 1
sections:
  - id: guides
    label: Guides
    order: 20
  - id: reference
    label: Reference
    order: 10
`);
    const swappedOrder = sectionOrder(swapped);
    expect(sectionRank('reference', swappedOrder)).toBeLessThan(sectionRank('guides', swappedOrder));
  });
});

describe('no-registry fallback (protects example/docs and registry-free roots)', () => {
  it('sectionRank falls back to the frozen SECTION_ORDER when no order is passed', () => {
    expect(sectionRank('context')).toBe(SECTION_ORDER.indexOf('context'));
    expect(sectionRank('context')).toBeLessThan(sectionRank('architecture'));
    expect(sectionRank('changelog')).toBeLessThan(sectionRank('nope'));
  });

  it('sectionLabel falls back to the frozen SECTION_LABEL when no labels are passed', () => {
    expect(sectionLabel('adr')).toBe(SECTION_LABEL['adr']);
    expect(sectionLabel('presentations')).toBe('Presentations');
  });

  it('rankForAgents falls back to SECTION_ORDER when no order is passed', () => {
    const entries: DocEntry[] = [
      { slug: 'guides/deploy', data: { title: 'Deploy', doc_status: 'active' } },
      { slug: 'context/intro', data: { title: 'Intro', doc_status: 'active' } },
    ];
    expect(rankForAgents(entries).map((e) => e.slug)).toEqual([
      'context/intro',
      'guides/deploy',
    ]);
  });
});

// The section-default `type` authority (issue #24): expectedDocType is PURE and
// parameterized on the registry-derived `id → type` map. The registry DRIVES the
// section default; a no-map call falls back to the frozen SECTION_TYPE; a short
// sub-path subtype table is applied on top in code either way.
describe('registry drives section-default TYPE (expectedDocType)', () => {
  // A registry whose `guides` type deliberately DIFFERS from the frozen fallback
  // ('Guide') — proving the derivation follows the registry, not a hardcode.
  const reg = parseSectionRegistry(`version: 1
sections:
  - id: architecture
    label: Architecture
    order: 20
    type: Architecture
  - id: adr
    label: Decision Records
    order: 30
    type: ADR
  - id: guides
    label: Handbook
    order: 40
    type: Handbook
  - id: plans
    label: Plans
    order: 50
    type: Plan
  - id: operations
    label: Operations
    order: 60
    type: Operations
`);
  const types = sectionTypes(reg);

  it('derives the section default from the registry', () => {
    expect(expectedDocType('architecture/overview.md', types)).toBe('Architecture');
    // A section README takes the section type.
    expect(expectedDocType('architecture/README.md', types)).toBe('Architecture');
  });

  it('follows the registry when its type differs from the frozen fallback', () => {
    // Frozen SECTION_TYPE maps guides → 'Guide'; the registry says 'Handbook'.
    expect(SECTION_TYPE['guides']).toBe('Guide');
    expect(expectedDocType('guides/deploy.md', types)).toBe('Handbook');
  });

  it('applies sub-path subtypes on top of the section default (kept in code)', () => {
    expect(expectedDocType('adr/0001-some-decision.md', types)).toBe('ADR');
    expect(expectedDocType('adr/template.md', types)).toBe('Template');
    expect(expectedDocType('plans/epics/big.md', types)).toBe('Epic');
    expect(expectedDocType('plans/features/thing.md', types)).toBe('Feature');
    expect(expectedDocType('plans/roadmap.md', types)).toBe('Plan');
    expect(expectedDocType('operations/runbooks/restart.md', types)).toBe('Runbook');
    expect(expectedDocType('operations/deploy.md', types)).toBe('Operations');
  });

  it('returns null for a section absent from the registry (no expectation)', () => {
    // `context` is not in this registry map → no section default, no check.
    expect(expectedDocType('context/intro.md', types)).toBeNull();
  });

  it('falls back to the frozen SECTION_TYPE map when no map is passed', () => {
    expect(expectedDocType('guides/deploy.md')).toBe('Guide');
    expect(expectedDocType('context/intro.md')).toBe('Context');
    expect(expectedDocType('adr/template.md')).toBe('Template');
    expect(expectedDocType('operations/runbooks/x.md')).toBe('Runbook');
  });
});

describe('rankForAgents honours the registry order argument', () => {
  it('sorts by the registry-derived section order', () => {
    const glossaryDoc: DocEntry = {
      slug: 'glossary/shipping',
      data: { title: 'Shipping', doc_status: 'active' },
    };
    const contextDoc: DocEntry = {
      slug: 'context/intro',
      data: { title: 'Intro', doc_status: 'active' },
    };
    const ranked = rankForAgents([glossaryDoc, contextDoc], order).map((e) => e.slug);
    // context (order 10) precedes glossary (order 60) via the registry.
    expect(ranked).toEqual(['context/intro', 'glossary/shipping']);
  });
});

// The RSS exclusion of `kind: Presentation` decks (FR-011 / T013) is orthogonal
// to the registry and stays keyed on frontmatter `kind`, never the section path.
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
