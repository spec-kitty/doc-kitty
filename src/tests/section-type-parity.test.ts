/**
 * Section-default `type` authority — behavior pin (review F2/N3; WP03 retarget).
 *
 * Issue #24 made `sections.yaml` the section-default `type` authority, but a
 * registry-LESS tree still validates against a frozen fallback map + a sub-path
 * subtype switch. This map + derivation ONCE lived in two hand-mirrored copies
 * (`SECTION_TYPE`/`expectedDocType` in `src/lib/metadata.ts` and
 * `SECTION_TYPE`/`expectedType` in `src/scripts/validate-frontmatter.mjs`), and
 * this suite was a twin-parity guard asserting the two copies agreed.
 *
 * RETARGETED (WP03 / #49 IC-03, F2/F3): WP01/WP02 single-sourced the enum,
 * `SECTION_TYPE`, and `expectedDocType` into the fs-free `vocabulary-core.mjs`.
 * `metadata.ts` re-exports `SECTION_TYPE`/`expectedDocType`, and
 * `validate-frontmatter.mjs` re-exports the SAME `expectedDocType` under the
 * alias `expectedType`. So a copy-vs-copy comparison is now tautological (one
 * implementation). This suite is retargeted to pin the ONE derivation's output
 * with LITERAL oracles — a per-row expected `type` on the whole path corpus, the
 * era-depth cases, the DOC_TYPES coupling, and the index-basename/registry-
 * subtypes behavior — so extraction drift in the single core still reds it.
 *
 * DROPPED as now-structural (single-sourcing makes them tautological):
 *   - `MJS_SECTION_TYPE toEqual METADATA_SECTION_TYPE` — the two names are the
 *     SAME frozen object (both re-export `vocabulary-core.mjs`'s `SECTION_TYPE`).
 *   - the corpus / era "both derivations agree" A===B compares — `expectedType`
 *     IS `expectedDocType` (a re-export alias); this fact is asserted ONCE below
 *     (`expect(expectedType).toBe(expectedDocType)`) instead of per row, and the
 *     behavioral content is preserved as literal oracles.
 *
 * STILL A GENUINE TWO-ARM GUARD (kept + literal-asserted): the index-basename
 * detection block compares `metadata.ts`'s INDEPENDENT TS implementations
 * (`readmeToIndexId`/`resolveIndexEntries`) against `vocabulary-core.mjs`'s
 * `isRootIndex`/`isIndexPath`/`detectIndexCollisions` — two distinct
 * implementations, so their agreement is NOT structural and is retained.
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
  expectedType,
  isRootIndex,
  isIndexPath,
  detectIndexCollisions,
} from '../scripts/validate-frontmatter.mjs';

describe('section-type derivation — single-sourced core (metadata.ts ⇔ gate alias)', () => {
  // Single, explicit proof of the single-sourcing that makes the former
  // per-row copy-vs-copy compares tautological: the gate's `expectedType`
  // export is the SAME function object as `metadata.ts`'s `expectedDocType`
  // (both re-export `vocabulary-core.mjs`). This replaces the dropped
  // "derivations agree" assertions with one identity check; the LITERAL
  // oracles below then pin the behavior of that one function.
  it('the gate `expectedType` export is the same binding as `expectedDocType`', () => {
    expect(expectedType).toBe(expectedDocType);
  });

  // The whole-path corpus, now with a per-row LITERAL expected type (F2): every
  // section default plus every sub-path subtype override the derivation applies.
  // A drift in the single core reds the specific row whose mapping changed.
  const CORPUS: [string, string | null][] = [
    ['context/overview.md', 'Context'],
    ['architecture/section-registry.md', 'Architecture'],
    ['adr/0004-amend.md', 'ADR'], // section default (ADR), NOT the template override
    ['adr/template.md', 'Template'], // sub-path override → Template
    ['plans/roadmap.md', 'Plan'], // section default (Plan)
    ['plans/epics/big.md', 'Epic'], // sub-path override → Epic
    ['plans/features/small.md', 'Feature'], // sub-path override → Feature
    ['api/index.md', 'API'],
    ['configuration/setup.md', 'Configuration'],
    ['integrations/tracker.md', 'Integration'],
    ['security/policy.md', 'Security'],
    ['guides/how-to.md', 'Guide'],
    ['operations/notes.md', 'Operations'], // section default (Operations)
    ['operations/runbooks/restart.md', 'Runbook'], // sub-path override → Runbook
    ['migrations/v2.md', 'Migration'],
    ['changelog/2026-08-28-x.md', 'Changelog'],
    ['presentations/deck.md', 'Presentation'],
    ['unregistered-section/page.md', null], // no default → null
    ['glossary/shipping/index.md', null], // registry-only section, no frozen default → null
  ];

  it.each(CORPUS)(
    'expectedDocType(%s) === frozen-fallback literal',
    (relPath, want) => {
      expect(expectedDocType(relPath)).toBe(want);
    },
  );
});

// #41 / FR-011 (C-003): era-partitioned ADR trees (`adr/<era>/NNNN-*.md`) keep
// their `ADR` typing at ANY depth, and the basename-keyed `template.md` subtype
// still resolves under an era folder. This pins the existing first-path-segment
// switch on the single derivation with LITERAL oracles — it fails if the mapping
// is ever broadened to an `adr/**` glob (which would clobber the `template.md`
// subtype). It does NOT change the mapping.
describe('depth-tolerant ADR typing (#41 / FR-011 guard, literal oracles)', () => {
  const ERA_CASES: [string, string][] = [
    ['adr/3.x/0001-foo.md', 'ADR'],
    ['adr/3.x/0007-some-decision.md', 'ADR'],
    ['adr/2.x/legacy/0003-deep.md', 'ADR'],
    ['adr/3.x/template.md', 'Template'],
  ];

  it.each(ERA_CASES)(
    'expectedDocType(%s) === %s at any depth',
    (relPath, want) => {
      expect(expectedDocType(relPath)).toBe(want);
    },
  );
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

// index-basename detection is a GENUINE TWO-ARM guard (F2 retained): `metadata.ts`
// carries its OWN TS implementation (`readmeToIndexId`/`resolveIndexEntries`,
// built on local `normalizeIndexBasenames`/`indexBasenamePattern`), while the gate
// imports `isRootIndex`/`isIndexPath`/`detectIndexCollisions` from
// `vocabulary-core.mjs`. These are DISTINCT implementations, so their agreement is
// not structural — kept, and every row now pins an explicit LITERAL verdict too.
describe('index-basename detection: metadata.ts TS impl ⇔ core mjs impl (two-arm + literals)', () => {
  // [path, expected-root-index-under-DEFAULT-basename]
  const DEFAULT_CASES: [string, boolean][] = [
    ['README.md', true],
    ['index.md', false],
    ['guides/README.md', false],
    ['guides/index.md', false],
  ];
  // [path, expected-root-index, expected-index-path] under opted-in ["README","index"]
  const OPTED_CASES: [string, boolean, boolean][] = [
    ['README.md', true, true],
    ['index.md', true, true],
    ['guides/README.md', false, true],
    ['guides/index.md', false, true],
    ['guides/Index.md', false, true],
  ];

  it.each(DEFAULT_CASES)(
    '%s: root-index verdict = %s under the DEFAULT basename (both arms)',
    (relPath, wantRoot) => {
      const tsIsRoot = readmeToIndexId(relPath) === '' && !relPath.includes('/');
      expect(tsIsRoot).toBe(wantRoot); // metadata.ts TS arm
      expect(isRootIndex(relPath)).toBe(wantRoot); // core mjs arm
    },
  );

  it.each(OPTED_CASES)(
    '%s: root-index=%s, index-path=%s under an OPTED-IN ["README","index"] basename (both arms)',
    (relPath, wantRoot, wantIndexPath) => {
      const opts = { indexBasename: ['README', 'index'] };
      const tsIsRoot = readmeToIndexId(relPath, opts) === '' && !relPath.includes('/');
      // `resolveIndexEntries`'s per-path candidacy test mirrors `isIndexPath`.
      const { ids } = resolveIndexEntries([relPath], opts);
      const tsIsIndexPath = ids.get(relPath) !== relPath.replace(/\.mdx?$/i, '');
      // metadata.ts TS arm …
      expect(tsIsRoot).toBe(wantRoot);
      expect(tsIsIndexPath).toBe(wantIndexPath);
      // … core mjs arm.
      expect(isRootIndex(relPath, ['README', 'index'])).toBe(wantRoot);
      expect(isIndexPath(relPath, ['README', 'index'])).toBe(wantIndexPath);
    },
  );

  it('both-index collision resolution (E-05): literal winner/demoted, and both arms agree', () => {
    const paths = ['guides/README.md', 'guides/index.md', 'guides/deploy.md', 'index.md', 'README.md'];
    const EXPECTED = [
      { dir: 'guides', winner: 'guides/README.md', demoted: ['guides/index.md'] },
      { dir: '', winner: 'README.md', demoted: ['index.md'] },
    ];
    const tsResult = resolveIndexEntries(paths, { indexBasename: ['README', 'index'] });
    const mjsResult = detectIndexCollisions(paths, ['README', 'index']);
    // Literal oracle: README wins over index at each directory (earliest-configured
    // basename), the other is demoted; root and `guides/` both collide.
    expect(tsResult.collisions).toEqual(EXPECTED); // metadata.ts TS arm
    expect(mjsResult).toEqual(EXPECTED); // core mjs arm
  });
});

// registry `subtypes` derivation (E-02/E-06/FR-005/D-03): a sub-path rename
// resolved by the single derivation, with the built-in table intact as the
// fallback. Retargeted from a copy-vs-copy compare to LITERAL oracles.
describe('registry-subtypes derivation — rule-firing vs built-in fall-through (literal oracles)', () => {
  const typesBySection = { plans: 'Plan' };
  const subtypesBySection = { plans: [{ match: 'missions', type: 'Mission' }] };

  // [path, expected-with-active-subtypes-map]
  const WITH_SUBTYPES: [string, string][] = [
    ['plans/missions/x.md', 'Mission'], // registry subtypes rule fires
    ['plans/features/small.md', 'Feature'], // no rule for "features" → built-in table
    ['plans/epics/big.md', 'Epic'], // built-in table (no epics rule)
    ['plans/roadmap.md', 'Plan'], // section default
  ];
  // [path, expected-with-NO-subtypes-map] (built-in table only)
  const NO_SUBTYPES: [string, string][] = [
    ['plans/missions/x.md', 'Plan'], // no rule → section default (no built-in missions subtype)
    ['plans/features/small.md', 'Feature'],
    ['plans/epics/big.md', 'Epic'],
    ['plans/roadmap.md', 'Plan'],
  ];

  it.each(WITH_SUBTYPES)(
    'expectedDocType(%s) === %s under an active registry subtypes map',
    (relPath, want) => {
      expect(expectedDocType(relPath, typesBySection, subtypesBySection)).toBe(want);
    },
  );

  it.each(NO_SUBTYPES)(
    'expectedDocType(%s) === %s with NO subtypes map (built-in table fall-through)',
    (relPath, want) => {
      expect(expectedDocType(relPath, typesBySection)).toBe(want);
    },
  );
});
