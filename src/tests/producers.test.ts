/**
 * The producer registry (#330, ADR-0079 D6): every producer declares a role and,
 * for an ownership producer, an ownership scope. A page is generated only when
 * its producer's stamp AND its producer's scope match (the glossary keeps its
 * path-and-kind rule as its scope). These tests pin the registry itself; the
 * gates that read it keep their own, unedited tests.
 */
import { describe, expect, it } from 'vitest';
import { PRODUCER_REGISTRY, createProducerRegistry, inScope } from '../lib/producers.mjs';
import { PRODUCERS } from '../lib/generator-stamp.mjs';

const stamped = (by: string, extra: Record<string, unknown> = {}) => ({ generated: { by, at: '2026-11-22T00:00:00Z' }, ...extra });

describe('the built-in registry', () => {
  it('lists the ownership and provenance producers in registration order', () => {
    expect(PRODUCER_REGISTRY.ids('ownership')).toEqual(['doc-kitty-gherkin', 'doc-kitty-glossary']);
    expect(PRODUCER_REGISTRY.ids('provenance')).toEqual(['doc-kitty-scaffold']);
    expect(PRODUCER_REGISTRY.ids()).toEqual(['doc-kitty-gherkin', 'doc-kitty-glossary', 'doc-kitty-scaffold']);
  });

  it('is what PRODUCERS in generator-stamp exposes', () => {
    expect([...PRODUCERS]).toEqual(PRODUCER_REGISTRY.ids('ownership'));
  });

  it('maps a versioned stamp and a retired stamp to their producer', () => {
    expect(PRODUCER_REGISTRY.producerOfStamp('doc-kitty-gherkin/0.7.1')).toBe('doc-kitty-gherkin');
    expect(PRODUCER_REGISTRY.producerOfStamp('doc-kitty-gherkin/')).toBeUndefined();
    expect(PRODUCER_REGISTRY.producerOfStamp('doc-kitty-scaffold/0.7.1')).toBeUndefined();
    expect(PRODUCER_REGISTRY.producerOfStamp(42)).toBeUndefined();
    expect(PRODUCER_REGISTRY.retiredProducerOf('doc-kitty/glossary')).toBe('doc-kitty-glossary');
    expect(PRODUCER_REGISTRY.retiredProducerOf('doc-kitty-glossary/0.7.1')).toBeUndefined();
  });
});

describe('inScope', () => {
  it('a section scope without a section is any one top-level section, never the root', () => {
    const scope = { type: 'section' } as const;
    expect(inScope(scope, 'behaviour/a.md')).toBe(true);
    expect(inScope(scope, 'x/y/z.md')).toBe(true);
    expect(inScope(scope, 'README.md')).toBe(false);
  });

  it('a named section scope matches that section only, by whole segment', () => {
    const scope = { type: 'section', section: 'behaviour' } as const;
    expect(inScope(scope, 'behaviour/a/b.md')).toBe(true);
    expect(inScope(scope, 'other/a.md')).toBe(false);
    expect(inScope(scope, 'behaviourx/a.md')).toBe(false);
    expect(inScope(scope, 'behaviour')).toBe(false);
  });

  it('kinds restrict a scope to those page kinds', () => {
    const scope = { type: 'section', section: 'glossary', kinds: ['Glossary', 'Hub'] } as const;
    expect(inScope(scope, 'glossary/x.md', 'Glossary')).toBe(true);
    expect(inScope(scope, 'glossary/x.md', 'Hub')).toBe(true);
    expect(inScope(scope, 'glossary/x.md', 'Reference')).toBe(false);
    expect(inScope(scope, 'glossary/x.md')).toBe(false);
  });

  it('a directories scope matches pages under one of its directories inside its section', () => {
    const scope = { type: 'directories', section: 'packs', dirs: ['qa', 'built-in'] } as const;
    expect(inScope(scope, 'packs/qa/index.md')).toBe(true);
    expect(inScope(scope, 'packs/built-in/x/y.md')).toBe(true);
    expect(inScope(scope, 'packs/index.md')).toBe(false);
    expect(inScope(scope, 'packs/qaz/index.md')).toBe(false);
    expect(inScope(scope, 'other/qa/index.md')).toBe(false);
  });
});

describe('ownerOfPage', () => {
  // Positive control for SC-004: a do-nothing scope check (always in scope) fails
  // the "outside its directories" assertions below.
  it('a directories-scoped test producer owns its stamped pages inside its scope only', () => {
    const registry = createProducerRegistry([
      { id: 'test-packs', role: 'ownership', scope: { type: 'directories', section: 'packs', dirs: ['qa'] } },
    ]);
    expect(registry.ownerOfPage('packs/qa/index.md', stamped('test-packs/1.0.0'))).toBe('test-packs');
    expect(registry.ownerOfPage('packs/other/index.md', stamped('test-packs/1.0.0'))).toBeUndefined();
    expect(registry.ownerOfPage('guides/x.md', stamped('test-packs/1.0.0'))).toBeUndefined();
    expect(registry.ownerOfPage('packs/qa/index.md', {})).toBeUndefined();
    expect(registry.ownerOfPage('packs/qa/index.md', stamped('someone-else/1.0.0'))).toBeUndefined();
  });

  it('recognises a Gherkin page by its stamp in any one section', () => {
    expect(PRODUCER_REGISTRY.ownerOfPage('behaviour/shipping/a.md', stamped('doc-kitty-gherkin/9.9.9'))).toBe(
      'doc-kitty-gherkin',
    );
    expect(PRODUCER_REGISTRY.ownerOfPage('README.md', stamped('doc-kitty-gherkin/9.9.9'))).toBeUndefined();
    expect(PRODUCER_REGISTRY.ownerOfPage('behaviour/shipping/a.md', {})).toBeUndefined();
  });

  it('a caller that knows the configured section narrows the scope', () => {
    const scopes = { 'doc-kitty-gherkin': { type: 'section', section: 'features' } as const };
    expect(PRODUCER_REGISTRY.ownerOfPage('behaviour/a.md', stamped('doc-kitty-gherkin/9.9.9'), { scopes })).toBeUndefined();
    expect(PRODUCER_REGISTRY.ownerOfPage('features/a.md', stamped('doc-kitty-gherkin/9.9.9'), { scopes })).toBe(
      'doc-kitty-gherkin',
    );
  });

  it('recognises a glossary page by its path and kind, and a glossary stamp alone never exempts a page', () => {
    expect(PRODUCER_REGISTRY.ownerOfPage('glossary/x.md', { kind: 'Glossary' })).toBe('doc-kitty-glossary');
    expect(PRODUCER_REGISTRY.ownerOfPage('glossary-demo/x.md', { kind: 'Glossary' })).toBeUndefined();
    expect(PRODUCER_REGISTRY.ownerOfPage('guides/x.md', stamped('doc-kitty-glossary/9.9.9'))).toBeUndefined();
  });

  it('a provenance stamp never owns a page', () => {
    expect(PRODUCER_REGISTRY.ownerOfPage('behaviour/a.md', stamped('doc-kitty-scaffold/9.9.9'))).toBeUndefined();
  });
});

describe('createProducerRegistry', () => {
  it('refuses an inconsistent registry', () => {
    expect(() =>
      createProducerRegistry([
        { id: 'a', role: 'provenance' },
        { id: 'a', role: 'provenance' },
      ]),
    ).toThrow(/duplicate/);
    expect(() => createProducerRegistry([{ id: 'a', role: 'ownership' }])).toThrow(/scope/);
    expect(() => createProducerRegistry([{ id: 'a', role: 'provenance', scope: { type: 'section' } }])).toThrow(
      /scope/,
    );
    expect(() =>
      createProducerRegistry([{ id: 'a', role: 'ownership', scope: { type: 'galaxy' } as never }]),
    ).toThrow(/scope type/);
    expect(() =>
      createProducerRegistry([{ id: 'a', role: 'ownership', scope: { type: 'directories', section: 'p', dirs: [] } }]),
    ).toThrow(/dirs/);
  });

  it('type-checks a scope: section, kinds and dirs must be strings', () => {
    const own = (scope: unknown) => () => createProducerRegistry([{ id: 'a', role: 'ownership', scope: scope as never }]);
    expect(own({ type: 'section', section: 3 })).toThrow(/section/);
    expect(own({ type: 'section', section: '' })).toThrow(/section/);
    expect(own({ type: 'section', section: 'a/b' })).toThrow(/section/);
    expect(own({ type: 'section', section: 'x', kinds: 'Glossary' })).toThrow(/kinds/);
    expect(own({ type: 'section', section: 'x', kinds: [1] })).toThrow(/kinds/);
    expect(own({ type: 'directories', section: 'packs', dirs: ['qa', 7] })).toThrow(/dirs/);
    expect(own({ type: 'directories', section: 'packs', dirs: ['a/b'] })).toThrow(/dirs/);
  });

  it('refuses a scope-recognised producer whose scope is every section', () => {
    // It would own every non-root page in the tree, stamp or no stamp.
    expect(() =>
      createProducerRegistry([{ id: 'a', role: 'ownership', scope: { type: 'section' }, recognition: 'scope' }]),
    ).toThrow(/recognition 'scope'.*section/);
    expect(() =>
      createProducerRegistry([{ id: 'a', role: 'ownership', scope: { type: 'section', section: 'x' }, recognition: 'scope' }]),
    ).not.toThrow();
    expect(() =>
      createProducerRegistry([{ id: 'a', role: 'ownership', scope: { type: 'section' }, recognition: 'guess' as never }]),
    ).toThrow(/recognition/);
  });

  it('returns a frozen registry', () => {
    expect(Object.isFrozen(PRODUCER_REGISTRY)).toBe(true);
  });
});

describe('isGeneratedPage (frontmatter gate)', () => {
  it('takes the narrowed scopes as an options object', async () => {
    const { isGeneratedPage } = await import('../scripts/validate-frontmatter.mjs');
    const page = stamped('doc-kitty-gherkin/9.9.9');
    expect(isGeneratedPage('behaviour/a.md', page)).toBe(true);
    const producerScopes = { 'doc-kitty-gherkin': { type: 'section', section: 'features' } };
    expect(isGeneratedPage('behaviour/a.md', page, { producerScopes })).toBe(false);
    expect(isGeneratedPage('features/a.md', page, { producerScopes })).toBe(true);
  });
});
