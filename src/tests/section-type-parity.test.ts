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
} from '../lib/metadata.ts';
import { DOC_TYPES } from '../lib/schema.ts';
import {
  SECTION_TYPE as MJS_SECTION_TYPE,
  expectedType,
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
