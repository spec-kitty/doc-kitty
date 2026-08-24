import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import {
  buildCatalog,
  resolveCitation,
  type BibliographyRecord,
  type ToolRecord,
} from '../lib/catalog.js';
import {
  resolveProfile,
  type DocsIndex,
  type ExternalReference,
  type AudienceEntry,
} from '../lib/metadata.js';

/**
 * NFR-005 — resolver-lane fixtures (WP06/T033).
 *
 * These `.md` fixtures are the corpus-of-record for the RESOLVER lane (not the
 * schema/validator parity test — that lane owns shape, this one owns resolution
 * verdicts, post-spec R3). Each fixture is parsed with the same `gray-matter`
 * engine the standalone gates use, and its authored metadata is fed through the
 * SAME pure resolvers the build calls, so the throw/soft-miss verdicts are bound
 * to real authored frontmatter, not inline literals.
 *
 * The fixtures live under `src/tests/fixtures/` (OUTSIDE `example/docs/`) so they
 * never enter the example build tree or trip `validate:example`/`validate:catalog`.
 */

const fixturesUrl = new URL('./fixtures/', import.meta.url);

function parse(relFromFixtures: string): Record<string, unknown> {
  const abs = fileURLToPath(new URL(relFromFixtures, fixturesUrl));
  return matter(readFileSync(abs, 'utf8')).data as Record<string, unknown>;
}

// A catalog that HAS `divio-2017` (so the unknown-type fixture isolates the type
// error, not an id miss) but does NOT have the missing-id fixture's id.
const biblio: BibliographyRecord[] = [
  { id: 'divio-2017', title: 'The documentation system', url: 'https://documentation.divio.com' },
];
const tools: ToolRecord[] = [{ id: 'revealjs', name: 'reveal.js', url: 'https://revealjs.com' }];
const catalog = buildCatalog(biblio, tools);

// A docs index WITHOUT the dangling fixture's `ghost-profile-with-no-page` page,
// but with a real persona so resolveProfile is exercised non-trivially.
const index: DocsIndex = {
  'context/audience/example-persona': {
    slug: 'context/audience/example-persona',
    title: 'Marzipan the Mapmaker',
    kind: 'Persona',
    doc_status: 'active',
  },
};

describe('resolver-lane fixtures — catalog citation misses are build-fatal (FR-008)', () => {
  it('catalog/missing-id.md: a cited id absent from the catalog throws', () => {
    const refs = parse('catalog/missing-id.md').external_references as ExternalReference[];
    expect(Array.isArray(refs)).toBe(true);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(() => resolveCitation(ref, catalog)).toThrow(/no bibliography entry for id/);
    }
  });

  it('catalog/unknown-type.md: a catalog type that is neither biblio nor tool throws', () => {
    const refs = parse('catalog/unknown-type.md').external_references as ExternalReference[];
    expect(Array.isArray(refs)).toBe(true);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(() => resolveCitation(ref, catalog)).toThrow(/unknown catalog type/);
    }
  });
});

describe('resolver-lane fixtures — a dangling audience profile is a soft miss (FR-002)', () => {
  it('err/audience-dangling-profile.md: an unresolvable profile returns null (never throws)', () => {
    const audience = parse('err/audience-dangling-profile.md').audience as AudienceEntry[];
    expect(Array.isArray(audience)).toBe(true);
    expect(audience.length).toBeGreaterThan(0);
    for (const entry of audience) {
      // Soft miss: null, not an exception (asymmetric with the related build-fatal).
      expect(resolveProfile(entry.profile, index)).toBeNull();
    }
    // Sanity: the same resolver DOES resolve a present persona, so the null above
    // is a genuine miss, not a broken resolver.
    expect(resolveProfile('example-persona', index)).toEqual({
      href: '/context/audience/example-persona/',
      title: 'Marzipan the Mapmaker',
    });
  });
});
