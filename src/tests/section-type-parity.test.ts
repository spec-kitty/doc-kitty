/**
 * Parity gate for the section-default `type` authority (review F2/N3).
 *
 * Issue #24 made `sections.yaml` the section-default `type` authority, but a
 * registry-LESS tree still validates against a frozen fallback map — and that
 * fallback now lives in TWO hand-mirrored copies plus a duplicated sub-path
 * subtype switch:
 *
 *   - `SECTION_TYPE` + `expectedDocType` in `src/lib/metadata.ts` (the pure TS core,
 *     used by the build-side `schema.ts` derivation), and
 *   - `SECTION_TYPE` + `expectedType` in `src/scripts/validate-frontmatter.mjs`
 *     (a bare-Node copy, because the TS module cannot load in the standalone gate).
 *
 * The two are bound only by prose ("keep in sync by hand"). A one-sided edit would
 * make the CI gate and the build-side derivation silently disagree on a page's
 * expected `type` for every registry-less consumer — the round-1 whack-a-field
 * hazard, one level down. This test is the missing guard: it pins the two frozen
 * maps and the two derivations to each other, the way `remark-version-pin.test.ts`
 * pins #20/#21's parallel-pipeline mirror.
 */
import { describe, it, expect } from 'vitest';
import {
  SECTION_TYPE as METADATA_SECTION_TYPE,
  expectedDocType,
  readmeToIndexId,
  resolveIndexEntries,
} from '../lib/metadata.ts';
import { DOC_TYPES } from '../lib/schema.ts';
import {
  SECTION_TYPE as MJS_SECTION_TYPE,
  expectedType,
  isRootIndex,
  isIndexPath,
  detectIndexCollisions,
} from '../scripts/validate-frontmatter.mjs';

describe('section-type parity: metadata.ts ⇔ validate-frontmatter.mjs', () => {
  it('the two frozen SECTION_TYPE fallback maps are byte-identical', () => {
    expect(MJS_SECTION_TYPE).toEqual(METADATA_SECTION_TYPE);
  });

  // A shared path corpus exercising every section default plus every sub-path
  // subtype override the two derivations apply in code. If either copy drifts,
  // one of these rows diverges.
  const CORPUS = [
    'context/overview.md',
    'architecture/section-registry.md',
    'adr/0004-amend.md', // section default (ADR), NOT the template override
    'adr/template.md', // sub-path override → Template
    'plans/roadmap.md', // section default (Plan)
    'plans/epics/big.md', // sub-path override → Epic
    'plans/features/small.md', // sub-path override → Feature
    'api/index.md',
    'configuration/setup.md',
    'integrations/tracker.md',
    'security/policy.md',
    'guides/how-to.md',
    'operations/notes.md', // section default (Operations)
    'operations/runbooks/restart.md', // sub-path override → Runbook
    'migrations/v2.md',
    'changelog/2026-08-28-x.md',
    'presentations/deck.md',
    'unregistered-section/page.md', // no default → null on both
    'glossary/shipping/index.md', // registry-only section, no frozen default → null
  ];

  it.each(CORPUS)(
    'expectedDocType ≡ expectedType (frozen fallback) for %s',
    (relPath) => {
      // Both called with the frozen fallback (no registry arg), so they must agree
      // path-for-path. expectedDocType takes the map; expectedType defaults to the
      // .mjs frozen map — pass it explicitly for symmetry.
      expect(expectedDocType(relPath)).toBe(
        expectedType(relPath, MJS_SECTION_TYPE),
      );
    },
  );
});

// #41 / FR-011 (C-003): era-partitioned ADR trees (`adr/<era>/NNNN-*.md`) keep
// their `ADR` typing at ANY depth, and the basename-keyed `template.md` subtype
// still resolves under an era folder. This is a GUARD ONLY — it pins the existing
// first-path-segment switch on BOTH the ts (`expectedDocType`) and mjs
// (`expectedType`) derivations so a future refactor cannot silently break one
// copy, and it fails if the mapping is ever broadened to an `adr/**` glob (which
// would clobber the `template.md` subtype). It does NOT change the mapping.
describe('depth-tolerant ADR typing (#41 / FR-011 guard, both twins)', () => {
  const ERA_CASES: [string, string][] = [
    ['adr/3.x/0001-foo.md', 'ADR'],
    ['adr/3.x/0007-some-decision.md', 'ADR'],
    ['adr/2.x/legacy/0003-deep.md', 'ADR'],
    ['adr/3.x/template.md', 'Template'],
  ];

  it.each(ERA_CASES)(
    '%s → %s on the ts derivation (expectedDocType)',
    (relPath, want) => {
      expect(expectedDocType(relPath)).toBe(want);
    },
  );

  it.each(ERA_CASES)(
    '%s → %s on the mjs derivation (expectedType)',
    (relPath, want) => {
      expect(expectedType(relPath, MJS_SECTION_TYPE)).toBe(want);
    },
  );

  it('the two derivations agree on every era path (twin parity)', () => {
    for (const [relPath] of ERA_CASES) {
      expect(expectedDocType(relPath)).toBe(expectedType(relPath, MJS_SECTION_TYPE));
    }
  });
});

describe('section-type / DOC_TYPES coupling (review N3)', () => {
  // Guard the one intentional gap the round-2 correctness lens flagged: the
  // registry's `glossary → Glossary` section-default `type` is NOT in the
  // canonical DOC_TYPES set. This is inert today ONLY because every generated
  // page under `glossary/` is `kind: Glossary|Hub` and exempt from the type
  // check. This test documents the coupling so a future change that either adds
  // `Glossary` to DOC_TYPES or lands an authored, type-declaring page under
  // `glossary/` is a deliberate decision, not a silent surprise.
  it('the frozen fallback declares no non-canonical section default', () => {
    for (const [section, type] of Object.entries(METADATA_SECTION_TYPE)) {
      expect(
        DOC_TYPES.includes(type as (typeof DOC_TYPES)[number]),
        `frozen SECTION_TYPE['${section}'] = '${type}' must be in DOC_TYPES`,
      ).toBe(true);
    }
  });
});

// adopter-loader-migration WP01 (T007) — extend the parity twin to cover the
// NEW index-basename detection + registry-subtypes derivation this mission
// adds (D-06, NFR-001). 0 drift between `src/lib/metadata.ts` and
// `src/scripts/validate-frontmatter.mjs` on every case below.
describe('index-basename detection parity: readmeToIndexId/isRootIndex ⇔ isIndexPath/isRootIndex (both twins)', () => {
  const DEFAULT_CASES = ['README.md', 'index.md', 'guides/README.md', 'guides/index.md'];
  const OPTED_IN_CASES = ['README.md', 'index.md', 'guides/README.md', 'guides/index.md', 'guides/Index.md'];

  it.each(DEFAULT_CASES)('%s: root-index verdict agrees under the DEFAULT basename', (relPath) => {
    const tsIsRoot = readmeToIndexId(relPath) === '' && !relPath.includes('/');
    expect(tsIsRoot).toBe(isRootIndex(relPath));
  });

  it.each(OPTED_IN_CASES)(
    '%s: root-index verdict agrees under an OPTED-IN ["README","index"] basename',
    (relPath) => {
      const opts = { indexBasename: ['README', 'index'] };
      const tsIsRoot = readmeToIndexId(relPath, opts) === '' && !relPath.includes('/');
      expect(tsIsRoot).toBe(isRootIndex(relPath, ['README', 'index']));
    },
  );

  it.each(OPTED_IN_CASES)('%s: index-path detection agrees (whole-tree collision inputs)', (relPath) => {
    // `resolveIndexEntries`'s per-path candidacy test mirrors `isIndexPath`.
    const { ids } = resolveIndexEntries([relPath], { indexBasename: ['README', 'index'] });
    const tsCollapsed = ids.get(relPath) !== relPath.replace(/\.mdx?$/i, '');
    expect(tsCollapsed).toBe(isIndexPath(relPath, ['README', 'index']));
  });

  it('both-index collision resolution agrees (E-05): same winner, same demoted set', () => {
    const paths = ['guides/README.md', 'guides/index.md', 'guides/deploy.md', 'index.md', 'README.md'];
    const tsResult = resolveIndexEntries(paths, { indexBasename: ['README', 'index'] });
    const mjsResult = detectIndexCollisions(paths, ['README', 'index']);
    expect(mjsResult).toEqual(tsResult.collisions);
  });
});

// adopter-loader-migration WP01 (T007) — registry `subtypes` derivation
// parity (E-02/E-06/FR-005/D-03): a sub-path rename resolved identically by
// both twins, with the built-in table intact as the fallback.
describe('registry-subtypes derivation parity: expectedDocType ⇔ expectedType (both twins)', () => {
  const typesBySection = { plans: 'Plan' };
  const subtypesBySection = { plans: [{ match: 'missions', type: 'Mission' }] };

  const CASES = [
    'plans/missions/x.md', // registry subtypes rule fires
    'plans/features/small.md', // registry has no rule for "features" here → falls to built-in table
    'plans/epics/big.md', // built-in table (registry declares no epics rule)
    'plans/roadmap.md', // section default
  ];

  it.each(CASES)('%s: expectedDocType ≡ expectedType under an active registry subtypes map', (relPath) => {
    expect(expectedDocType(relPath, typesBySection, subtypesBySection)).toBe(
      expectedType(relPath, typesBySection, subtypesBySection),
    );
  });

  it('absent subtypesBySection: both twins fall through to the built-in table identically', () => {
    for (const relPath of CASES) {
      expect(expectedDocType(relPath, typesBySection)).toBe(expectedType(relPath, typesBySection));
    }
  });
});
