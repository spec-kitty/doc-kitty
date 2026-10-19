/**
 * #210 (0.4.0): the legacy generator-stamp forms are retired. A page carrying
 * only the unversioned `doc-kitty/gherkin` stamp, or a `sha256:` hash in
 * `generated.at` instead of `generated.content_hash`, is no longer treated as
 * generated: the frontmatter gate fails it with a message telling the author to
 * regenerate, rather than silently dropping the generated-page exemptions.
 */
import { describe, it, expect } from 'vitest';
import { validate, isGeneratedPage } from '../scripts/validate-frontmatter.mjs';
import * as stampModule from '../lib/generator-stamp.mjs';
import { isGeneratedStamp, stampContentHash } from '../lib/generator-stamp.mjs';

const legacyGherkinPage = {
  title: 'Book a consignment',
  description: 'A generated page still carrying the retired unversioned generated.by stamp.',
  kind: 'Specification',
  doc_status: 'active',
  generated: { by: 'doc-kitty/gherkin', at: 'sha256:aa67f517f6ea' },
};

describe('#210 legacy generator stamps are retired', () => {
  it('a page carrying only a legacy stamp fails validation and is told to regenerate', () => {
    const { problems } = validate('behaviour/book-consignment.md', legacyGherkinPage);
    const text = problems.join('\n');
    expect(text).toContain('generated');
    expect(text).toMatch(/regenerate/i);
  });

  it('a legacy glossary stamp with a sha256 `at` fails the same way', () => {
    const { problems } = validate('glossary/README.md', {
      title: 'Glossary',
      kind: 'Hub',
      doc_status: 'active',
      generated: { by: 'doc-kitty/glossary', at: 'sha256:000000000000' },
    });
    const text = problems.join('\n');
    expect(text).toMatch(/regenerate/i);
    // The glossary is rewritten by the build, never by the Gherkin generator.
    expect(text).toMatch(/astro build/);
    expect(text).not.toMatch(/generate-feature-pages|generate:features/);
  });

  it('a legacy Gherkin stamp names the feature-page generator, not the glossary', () => {
    const text = stampModule.retiredStampProblem(legacyGherkinPage.generated) ?? '';
    expect(text).toMatch(/dockitty-generate-feature-pages/);
    expect(text).not.toMatch(/glossary/);
  });

  it('a sha256 `at` with no recognised producer names both regeneration routes', () => {
    const text = stampModule.retiredStampProblem({ at: 'sha256:000000000000' }) ?? '';
    expect(text).toMatch(/dockitty-generate-feature-pages/);
    expect(text).toMatch(/astro build/);
  });

  it('a versioned stamp whose `at` is still a sha256 hash (no content_hash) fails too', () => {
    const { problems } = validate('behaviour/book-consignment.md', {
      ...legacyGherkinPage,
      generated: { by: 'doc-kitty-gherkin/0.3.0', at: 'sha256:aa67f517f6ea' },
    });
    expect(problems.join('\n')).toMatch(/regenerate/i);
  });

  it('a sha256 hash in `at` with `content_hash: null` fails too', () => {
    const { problems } = validate('behaviour/book-consignment.md', {
      ...legacyGherkinPage,
      generated: { by: 'doc-kitty-gherkin/0.3.0', at: 'sha256:aa67f517f6ea', content_hash: null },
    });
    expect(problems.join('\n')).toMatch(/regenerate/i);
  });

  it('the legacy stamp no longer makes a page generated', () => {
    expect(isGeneratedStamp('doc-kitty/gherkin')).toBe(false);
    expect(isGeneratedStamp('doc-kitty/gherkin', 'doc-kitty-gherkin')).toBe(false);
    expect(isGeneratedPage('behaviour/book-consignment.md', legacyGherkinPage)).toBe(false);
  });

  it('the `sha256:` `at` fallback is no longer read as the content hash', () => {
    expect(stampContentHash({ at: 'sha256:abcdef012345' })).toBeUndefined();
    expect(stampContentHash({ at: 'sha256:abcdef012345', content_hash: 'sha256:0123456789ab' })).toBe(
      'sha256:0123456789ab',
    );
  });

  it('the legacy allow-lists are no longer exported', () => {
    const exported = Object.keys(stampModule);
    expect(exported).not.toContain('LEGACY_STAMPS');
    expect(exported).not.toContain('LEGACY_STAMP_BY_PRODUCER');
    expect(exported).not.toContain('LEGACY_GENERATED_BY');
  });

  it('a current stamp still validates cleanly', () => {
    const { problems } = validate('behaviour/book-consignment.md', {
      ...legacyGherkinPage,
      generated: { by: 'doc-kitty-gherkin/0.3.0', at: '2026-10-18T09:30:00Z', content_hash: 'sha256:aa67f517f6ea' },
    });
    expect(problems).toEqual([]);
  });
});
