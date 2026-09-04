/**
 * Golden-master oracle for the canonical vocabulary core (#49 IC-01, WP01/T003).
 *
 * This is the INDEPENDENT ORACLE that proves the WP01 extraction is
 * behavior-preserving. In WP02 both the toolkit (`metadata.ts`/`sections.ts`)
 * and the bare-Node gate (`validate-frontmatter.mjs`) are rewired to resolve to
 * this one core, which makes the existing twin-vs-twin parity tests tautological.
 * So the guard against semantic drift is NOT a twin comparison — it is these
 * LITERAL expected values, derived by tracing the CURRENT behavior of
 * `metadata.ts:188-263,407-525` and `validate-frontmatter.mjs:45,60-135,328-420`
 * and committed as fixed oracles (F3). If the extraction drifts, these red.
 *
 * Mission: metadata-vocab-hub-consolidation-01M1MFVT, WP01.
 */
import { describe, it, expect } from 'vitest';
import {
  STATUSES,
  DOC_TYPES,
  KINDS,
  SECTION_TYPE,
  expectedDocType,
  parseVocabulary,
  identityVocabulary,
  makeAxisResolver,
  readmeToIndexId,
  resolveIndexEntries,
  detectIndexCollisions,
  isRootIndex,
  isIndexPath,
  slugFromEntryId,
  ROOT_ENTRY_ID,
  DEFAULT_INDEX_BASENAME,
} from '../lib/vocabulary-core.mjs';

describe('vocabulary sets (single-sourced enums)', () => {
  it('STATUSES appends `durable` to the pre-existing four, in order (#39/FR-004)', () => {
    expect(STATUSES).toEqual(['draft', 'active', 'deprecated', 'superseded', 'durable']);
  });

  it('DOC_TYPES is the 17-item OKF type vocabulary in canonical order', () => {
    expect(DOC_TYPES).toEqual([
      'Context',
      'Architecture',
      'ADR',
      'Template',
      'Plan',
      'Epic',
      'Feature',
      'API',
      'Configuration',
      'Integration',
      'Security',
      'Guide',
      'Operations',
      'Runbook',
      'Migration',
      'Changelog',
      'Presentation',
    ]);
    expect(DOC_TYPES).toHaveLength(17);
  });

  it('KINDS is the 13-item kind vocabulary in canonical order', () => {
    expect(KINDS).toEqual([
      'Tutorial',
      'How-To',
      'Reference',
      'Explanation',
      'Hub',
      'ADR',
      'Changelog',
      'Glossary',
      'Presentation',
      'Persona',
      'Planning',
      'Feature',
      'User-Journey',
    ]);
    expect(KINDS).toHaveLength(13);
  });

  it('SECTION_TYPE is the frozen section→type fallback map', () => {
    expect(SECTION_TYPE).toEqual({
      context: 'Context',
      architecture: 'Architecture',
      adr: 'ADR',
      plans: 'Plan',
      api: 'API',
      configuration: 'Configuration',
      integrations: 'Integration',
      security: 'Security',
      guides: 'Guide',
      operations: 'Operations',
      migrations: 'Migration',
      changelog: 'Changelog',
      presentations: 'Presentation',
    });
    expect(Object.isFrozen(SECTION_TYPE)).toBe(true);
  });
});

describe('expectedDocType — section→type derivation (metadata.ts:235-263)', () => {
  it('derives the section default for a plain section page', () => {
    expect(expectedDocType('adr/0001-choice.md')).toBe('ADR');
    expect(expectedDocType('context/overview.md')).toBe('Context');
    expect(expectedDocType('integrations/webhooks.md')).toBe('Integration');
  });

  it('applies the built-in ADR template subtype (any depth — keyed on leaf name)', () => {
    expect(expectedDocType('adr/template.md')).toBe('Template');
    // `file` is the LAST path segment, so a template.md nested under adr still hits.
    expect(expectedDocType('adr/legacy/template.md')).toBe('Template');
    // A non-template ADR at depth keeps the section default.
    expect(expectedDocType('adr/era-2026/0005-choice.md')).toBe('ADR');
  });

  it('applies the built-in plans epics/features subtypes', () => {
    expect(expectedDocType('plans/epics/e.md')).toBe('Epic');
    expect(expectedDocType('plans/features/f.md')).toBe('Feature');
    // Deeper still resolves on the first sub-path segment.
    expect(expectedDocType('plans/features/era-1/f.md')).toBe('Feature');
    // A plans page not under epics/features keeps the section default.
    expect(expectedDocType('plans/roadmap.md')).toBe('Plan');
  });

  it('applies the built-in operations runbooks subtype', () => {
    expect(expectedDocType('operations/runbooks/r.md')).toBe('Runbook');
    expect(expectedDocType('operations/oncall.md')).toBe('Operations');
  });

  it('lets a registry subtype win over the built-in table (E-06 precedence)', () => {
    const subtypes = { plans: [{ match: 'missions', type: 'Mission' }] };
    expect(expectedDocType('plans/missions/m.md', SECTION_TYPE, subtypes)).toBe('Mission');
    // Registry subtype takes precedence even where a built-in subtype exists.
    const override = { plans: [{ match: 'features', type: 'Capability' }] };
    expect(expectedDocType('plans/features/f.md', SECTION_TYPE, override)).toBe('Capability');
  });

  it('honors a registry-derived section-default map over the frozen fallback', () => {
    const typesBySection = { plans: 'Roadmap' };
    expect(expectedDocType('plans/roadmap.md', typesBySection)).toBe('Roadmap');
  });

  it('does not fire a registry subtype when the section has no sub-path segment', () => {
    const subtypes = { plans: [{ match: 'missions', type: 'Mission' }] };
    expect(expectedDocType('plans', { plans: 'Plan' }, subtypes)).toBe('Plan');
  });

  it('returns null for an unknown section (no section default, no override)', () => {
    expect(expectedDocType('unknown-section/p.md')).toBeNull();
    expect(expectedDocType('faq/what.md')).toBeNull();
  });
});

describe('index-basename detection (metadata.ts:407-525 + validate-frontmatter twin)', () => {
  it('the default basename is README', () => {
    expect(DEFAULT_INDEX_BASENAME).toBe('README');
  });

  it('readmeToIndexId collapses README to the section slug (default)', () => {
    expect(readmeToIndexId('README.md')).toBe('');
    expect(readmeToIndexId('architecture/README.md')).toBe('architecture');
    expect(readmeToIndexId('architecture/overview.md')).toBe('architecture/overview');
    // A stray index.md is NOT collapsed under the default (NFR-003).
    expect(readmeToIndexId('architecture/index.md')).toBe('architecture/index');
  });

  it('readmeToIndexId collapses index too when opted in', () => {
    expect(readmeToIndexId('architecture/index.md', { indexBasename: ['README', 'index'] })).toBe(
      'architecture',
    );
  });

  it('isRootIndex verdict: default (README only) vs opted-in [README, index]', () => {
    // Default: README at root is the bundle root; a stray index.md is not.
    expect(isRootIndex('README.md')).toBe(true);
    expect(isRootIndex('index.md')).toBe(false);
    // A section-level README is not the ROOT index.
    expect(isRootIndex('adr/README.md')).toBe(false);
    // Opted-in: index.md at root now counts.
    expect(isRootIndex('index.md', ['README', 'index'])).toBe(true);
    expect(isRootIndex('README.md', ['README', 'index'])).toBe(true);
  });

  it('isIndexPath matches configured basenames case-insensitively', () => {
    expect(isIndexPath('guides/README.md')).toBe(true);
    expect(isIndexPath('guides/readme.mdx')).toBe(true);
    expect(isIndexPath('guides/index.md')).toBe(false);
    expect(isIndexPath('guides/index.md', ['README', 'index'])).toBe(true);
  });

  it('resolveIndexEntries picks the earliest-configured basename as winner and demotes the rest', () => {
    const paths = ['guide/README.md', 'guide/index.md', 'guide/page.md'];
    const { ids, collisions } = resolveIndexEntries(paths, {
      indexBasename: ['README', 'index'],
    });
    expect(collisions).toEqual([
      { dir: 'guide', winner: 'guide/README.md', demoted: ['guide/index.md'] },
    ]);
    expect(ids.get('guide/README.md')).toBe('guide'); // winner → section index
    expect(ids.get('guide/index.md')).toBe('guide/index'); // demoted → ordinary page
    expect(ids.get('guide/page.md')).toBe('guide/page'); // untouched ordinary page
  });

  it('detectIndexCollisions (flat twin) reports the same winner + demoted set', () => {
    const paths = ['guide/README.md', 'guide/index.md', 'guide/page.md'];
    expect(detectIndexCollisions(paths, ['README', 'index'])).toEqual([
      { dir: 'guide', winner: 'guide/README.md', demoted: ['guide/index.md'] },
    ]);
  });

  it('slugFromEntryId maps the reserved root entry id back to the empty slug', () => {
    expect(ROOT_ENTRY_ID).toBe('index');
    expect(slugFromEntryId('index')).toBe('');
    expect(slugFromEntryId('architecture')).toBe('architecture');
  });
});

describe('vocabulary resolver (sections.ts:294-415 — pure halves)', () => {
  it('identityVocabulary passes terms through unchanged (shipped default)', () => {
    const vocab = identityVocabulary();
    expect(vocab.resolveType('Feature')).toEqual({ effective: 'Feature', forbidden: false });
    expect(vocab.resolveKind('How-To')).toEqual({ effective: 'How-To', forbidden: false });
    // An undefined input resolves to undefined, never forbidden.
    expect(vocab.resolveType(undefined)).toEqual({ effective: undefined, forbidden: false });
  });

  it('an empty YAML parses to the identity resolver', () => {
    const vocab = parseVocabulary('');
    expect(vocab.resolveType('Feature')).toEqual({ effective: 'Feature', forbidden: false });
  });

  it('an alias rewrites effective and records aliasedFrom', () => {
    const vocab = parseVocabulary('types:\n  aliases:\n    Feature: Capability\n');
    expect(vocab.resolveType('Feature')).toEqual({
      effective: 'Capability',
      forbidden: false,
      aliasedFrom: 'Feature',
    });
    // An unlisted term still passes through (identity), no aliasedFrom.
    expect(vocab.resolveType('ADR')).toEqual({ effective: 'ADR', forbidden: false });
  });

  it('a forbidden term yields effective undefined + forbidden true (no alias to redirect)', () => {
    const vocab = parseVocabulary('types:\n  forbidden:\n    - Legacy\n');
    expect(vocab.resolveType('Legacy')).toEqual({ effective: undefined, forbidden: true });
  });

  it('forbidden is checked on the raw term but an alias still supplies the replacement', () => {
    const vocab = parseVocabulary(
      'types:\n  aliases:\n    Legacy: Modern\n  forbidden:\n    - Legacy\n',
    );
    expect(vocab.resolveType('Legacy')).toEqual({
      effective: 'Modern',
      forbidden: true,
      aliasedFrom: 'Legacy',
    });
  });

  it('resolves the kind axis independently of the type axis', () => {
    const vocab = parseVocabulary('kinds:\n  aliases:\n    How-To: Recipe\n');
    expect(vocab.resolveKind('How-To')).toEqual({
      effective: 'Recipe',
      forbidden: false,
      aliasedFrom: 'How-To',
    });
    // The type axis is untouched by a kinds-only override.
    expect(vocab.resolveType('How-To')).toEqual({ effective: 'How-To', forbidden: false });
  });

  it('makeAxisResolver honors alias-over-forbidden and identity directly', () => {
    const resolve = makeAxisResolver({
      aliases: { A: 'B' },
      forbidden: new Set(['C']),
    });
    expect(resolve('A')).toEqual({ effective: 'B', forbidden: false, aliasedFrom: 'A' });
    expect(resolve('C')).toEqual({ effective: undefined, forbidden: true });
    expect(resolve('D')).toEqual({ effective: 'D', forbidden: false });
    expect(resolve(undefined)).toEqual({ effective: undefined, forbidden: false });
  });

  it('throws a clear error on a malformed axis (authored file — never silent)', () => {
    expect(() => parseVocabulary('types:\n  - not-a-mapping\n')).toThrow(/must be a mapping/);
    expect(() => parseVocabulary('types:\n  forbidden: not-a-list\n')).toThrow(/must be a list/);
  });
});
