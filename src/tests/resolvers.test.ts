import { describe, it, expect } from 'vitest';
import {
  resolveRelated,
  resolveProfile,
  humanizeProfile,
  resolveCitation,
  type DocsIndex,
  type CitationCatalog,
} from '../lib/metadata.js';

const index: DocsIndex = {
  'architecture/overview': {
    slug: 'architecture/overview',
    title: 'Architecture Overview',
    kind: 'Explanation',
    doc_status: 'active',
    description: 'How the system fits together.',
  },
  'guides/no-desc': {
    slug: 'guides/no-desc',
    title: 'A Guide',
    kind: 'How-To',
    doc_status: 'active',
  },
  'context/audience/backend-dev': {
    slug: 'context/audience/backend-dev',
    title: 'Backend Developer',
    kind: 'Persona',
    doc_status: 'active',
    description: 'Persona page.',
  },
};

describe('resolveRelated', () => {
  it('resolves a bare slug, card text falling back to the target description', () => {
    expect(resolveRelated('architecture/overview', index)).toEqual({
      ref: 'architecture/overview',
      title: 'Architecture Overview',
      kind: 'Explanation',
      doc_status: 'active',
      note: 'How the system fits together.',
    });
  });

  it('prefers the entry note over the target description (precedence)', () => {
    const resolved = resolveRelated(
      { ref: 'architecture/overview', note: 'Start here for the big picture.' },
      index,
    );
    expect(resolved.note).toBe('Start here for the big picture.');
    expect(resolved.title).toBe('Architecture Overview');
  });

  it('omits note when neither an entry note nor a target description exists', () => {
    const resolved = resolveRelated('guides/no-desc', index);
    expect(resolved).toEqual({
      ref: 'guides/no-desc',
      title: 'A Guide',
      kind: 'How-To',
      doc_status: 'active',
    });
    expect('note' in resolved).toBe(false);
  });

  it('throws (build-fatal) on a dangling reference', () => {
    expect(() => resolveRelated('does/not/exist', index)).toThrow(/dangling related reference/);
    expect(() => resolveRelated({ ref: 'nope' }, index)).toThrow(/nope/);
  });
});

describe('resolveProfile', () => {
  it('resolves a profile slug to its context/audience page href + title', () => {
    expect(resolveProfile('backend-dev', index)).toEqual({
      href: '/context/audience/backend-dev/',
      title: 'Backend Developer',
    });
  });

  it('returns null (soft miss) when the persona page is absent', () => {
    expect(resolveProfile('nonexistent', index)).toBeNull();
  });
});

describe('humanizeProfile', () => {
  it('title-cases a kebab slug', () => {
    expect(humanizeProfile('backend-dev')).toBe('Backend Dev');
  });
  it('handles underscores and single words', () => {
    expect(humanizeProfile('product_owner')).toBe('Product Owner');
    expect(humanizeProfile('architect')).toBe('Architect');
  });
});

const catalog: CitationCatalog = {
  bibliography: {
    'divio-2017': {
      id: 'divio-2017',
      title: 'The documentation system',
      url: 'https://documentation.divio.com',
    },
  },
  tools: {
    revealjs: {
      id: 'revealjs',
      name: 'reveal.js',
      url: 'https://revealjs.com',
    },
  },
};

describe('resolveCitation', () => {
  it('passes an inline reference through unchanged', () => {
    const inline = { url: 'https://example.com', title: 'Example', note: 'see also' };
    expect(resolveCitation(inline, catalog)).toEqual(inline);
  });

  it('resolves a biblio catalog reference', () => {
    expect(resolveCitation({ type: 'biblio', id: 'divio-2017' }, catalog)).toEqual(
      catalog.bibliography['divio-2017'],
    );
  });

  it('resolves a tool catalog reference', () => {
    expect(resolveCitation({ type: 'tool', id: 'revealjs' }, catalog)).toEqual(
      catalog.tools.revealjs,
    );
  });

  it('throws (build-fatal) on a missing catalog id', () => {
    expect(() => resolveCitation({ type: 'biblio', id: 'ghost' }, catalog)).toThrow(
      /no bibliography entry for id "ghost"/,
    );
    expect(() => resolveCitation({ type: 'tool', id: 'ghost' }, catalog)).toThrow(
      /no tool entry for id "ghost"/,
    );
  });

  it('throws (build-fatal) on an unknown catalog type', () => {
    expect(() => resolveCitation({ type: 'journal', id: 'divio-2017' }, catalog)).toThrow(
      /unknown catalog type "journal"/,
    );
  });
});
