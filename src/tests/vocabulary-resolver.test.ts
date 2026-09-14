import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  loadVocabulary,
  validate,
  run,
  SECTION_TYPE,
} from '../scripts/validate-frontmatter.mjs';
import { resolveGovernance, resetDeprecationNotice } from '../lib/vocabulary-loader.mjs';

/**
 * #40 — `_meta/vocabulary.yaml` override + resolver (contracts/vocabulary-override.md).
 *
 * The override lets an adopter alias / neutralize / forbid `type` (and `kind`)
 * terms through an on-disk file resolved `default → consumer`, read by the
 * standalone gate WITHOUT an Astro build, and applied to BOTH authored and
 * section-DERIVED values (FR-004/FR-005).
 *
 * SINGLE-SOURCED (#49 IC-02, WP01/WP02): the resolver + its fs loader now live
 * in ONE place — `vocabulary-core.mjs`'s `makeAxisResolver`/`parseVocabulary`
 * and `vocabulary-loader.mjs`'s `loadVocabulary` — re-exported through both
 * `src/lib/sections.ts` and `src/scripts/validate-frontmatter.mjs`. The former
 * mjs-vs-ts twin-parity block (NFR-004) is therefore RETARGETED to pin the ONE
 * resolver's RESOLVED output with LITERAL oracles over a non-default YAML (see
 * the final describe). The gate-wiring assertions below are NOT retargeted: they
 * prove `validate()` still APPLIES this resolver to authored AND section-derived
 * values (FR-004/FR-005) — a property single-sourcing the resolver does not
 * guarantee (F4).
 */

/** Write a `<docsRoot>/_meta/vocabulary.yaml` into a fresh temp dir and return it. */
function withVocabulary(yaml: string | null): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-vocab-'));
  if (yaml !== null) {
    mkdirSync(path.join(dir, '_meta'), { recursive: true });
    writeFileSync(path.join(dir, '_meta', 'vocabulary.yaml'), yaml, 'utf8');
  }
  return dir;
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

// A NON-DEFAULT vocabulary: aliases Feature → Mission AND forbids one term. It
// MUST diverge from the shipped default (which leaves `Feature` valid), otherwise
// "resolved" and "static default" would be indistinguishable and the parity
// assertion below would pass vacuously (NFR-004).
const ALIAS_YAML = `types:
  aliases:
    Feature: Mission
  forbidden:
    - Epic
`;

// Forbids Feature AND names its replacement via the alias (so the failure can
// name the allowed replacement — US2-2).
const FORBID_YAML = `types:
  aliases:
    Feature: Mission
  forbidden:
    - Feature
`;

describe('loadVocabulary resolver unit — the single core (vocabulary-loader/-core)', () => {
  it('aliases a type term to its replacement (authored OR derived)', () => {
    const dir = withVocabulary(ALIAS_YAML);
    try {
      const vocab = loadVocabulary(dir);
      const r = vocab.resolveType('Feature');
      expect(r.effective).toBe('Mission');
      expect(r.forbidden).toBe(false);
      expect(r.aliasedFrom).toBe('Feature');
    } finally {
      cleanup(dir);
    }
  });

  it('forbids a type term and names the replacement', () => {
    const dir = withVocabulary(FORBID_YAML);
    try {
      const vocab = loadVocabulary(dir);
      const r = vocab.resolveType('Feature');
      expect(r.forbidden).toBe(true);
      // The alias supplies the replacement to name in the failure message.
      expect(r.effective).toBe('Mission');
    } finally {
      cleanup(dir);
    }
  });

  it('passes an unlisted term through unchanged', () => {
    const dir = withVocabulary(ALIAS_YAML);
    try {
      const vocab = loadVocabulary(dir);
      const r = vocab.resolveType('Guide');
      expect(r.effective).toBe('Guide');
      expect(r.forbidden).toBe(false);
      expect(r.aliasedFrom).toBeUndefined();
    } finally {
      cleanup(dir);
    }
  });

  it('resolves an undefined term to undefined (no crash)', () => {
    const dir = withVocabulary(ALIAS_YAML);
    try {
      const vocab = loadVocabulary(dir);
      const r = vocab.resolveType(undefined);
      expect(r.effective).toBeUndefined();
      expect(r.forbidden).toBe(false);
    } finally {
      cleanup(dir);
    }
  });

  it('absent file → identity resolver, `Feature` stays valid (NFR-002)', () => {
    const dir = withVocabulary(null);
    try {
      const vocab = loadVocabulary(dir);
      const r = vocab.resolveType('Feature');
      expect(r.effective).toBe('Feature');
      expect(r.forbidden).toBe(false);
    } finally {
      cleanup(dir);
    }
  });

  it('malformed file (non-mapping `types`) throws a clear error, not a silent default', () => {
    const dir = withVocabulary(`types: not-a-mapping\n`);
    try {
      expect(() => loadVocabulary(dir)).toThrow(/vocabulary/i);
    } finally {
      cleanup(dir);
    }
  });

  it('resolves a `kind` term symmetrically', () => {
    const dir = withVocabulary(`kinds:
  aliases:
    Feature: Capability
  forbidden:
    - Legacy
`);
    try {
      const vocab = loadVocabulary(dir);
      expect(vocab.resolveKind('Feature').effective).toBe('Capability');
      expect(vocab.resolveKind('Legacy').forbidden).toBe(true);
      expect(vocab.resolveKind('Reference').effective).toBe('Reference');
    } finally {
      cleanup(dir);
    }
  });
});

describe('gate wiring — resolver applied inside validate() (FR-004/FR-005)', () => {
  it('US2-1: an AUTHORED forbidden→aliased term fails naming the replacement', () => {
    const dir = withVocabulary(FORBID_YAML);
    try {
      const vocab = loadVocabulary(dir);
      const { problems } = validate(
        'plans/features/thing.md',
        { title: 'X', description: 'x'.repeat(60), doc_status: 'active', updated: '2026-08-27', type: 'Feature', kind: 'Feature' },
        SECTION_TYPE,
        vocab,
      );
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.join('\n')).toMatch(/forbidden/i);
      expect(problems.join('\n')).toMatch(/Mission/);
    } finally {
      cleanup(dir);
    }
  });

  it('US2-1 (alias only): an authored aliased term passes with the effective replacement', () => {
    const dir = withVocabulary(ALIAS_YAML);
    try {
      const vocab = loadVocabulary(dir);
      const { problems, warnings, effective } = validate(
        'plans/features/thing.md',
        { title: 'X', description: 'x'.repeat(60), doc_status: 'active', updated: '2026-08-27', type: 'Feature', kind: 'Feature' },
        SECTION_TYPE,
        vocab,
      );
      expect(problems).toEqual([]);
      expect(effective).toBe('Mission');
      // Authored Feature and derived Feature both resolve to Mission → no mismatch.
      expect(warnings.some((w) => /path suggests/.test(w))).toBe(false);
    } finally {
      cleanup(dir);
    }
  });

  it('US2-3: the override reaches DERIVED values — a plans/features page with NO type resolves to Mission, no warning', () => {
    const dir = withVocabulary(ALIAS_YAML);
    try {
      const vocab = loadVocabulary(dir);
      const { problems, warnings, effective } = validate(
        'plans/features/thing.md',
        { title: 'X', description: 'x'.repeat(60), doc_status: 'active', updated: '2026-08-27', kind: 'Reference' },
        SECTION_TYPE,
        vocab,
      );
      expect(problems).toEqual([]);
      // Derived `Feature` (plans/features → Feature) resolves through the override.
      expect(effective).toBe('Mission');
      expect(warnings.some((w) => /path suggests/.test(w))).toBe(false);
    } finally {
      cleanup(dir);
    }
  });

  it('US2-4: no override file → default vocabulary, `Feature` stays valid', () => {
    const dir = withVocabulary(null);
    try {
      const vocab = loadVocabulary(dir);
      const { problems, effective } = validate(
        'plans/features/thing.md',
        { title: 'X', description: 'x'.repeat(60), doc_status: 'active', updated: '2026-08-27', type: 'Feature', kind: 'Feature' },
        SECTION_TYPE,
        vocab,
      );
      expect(problems).toEqual([]);
      expect(effective).toBe('Feature');
    } finally {
      cleanup(dir);
    }
  });
});

// RETARGETED (WP03 / #49 IC-03, F3): this block used to load the resolver from
// BOTH `sections.ts` (ts) and `validate-frontmatter.mjs` (mjs) and assert the two
// twins resolved the same YAML identically. WP01/WP02 single-sourced the resolver
// into `vocabulary-core.mjs`/`vocabulary-loader.mjs`, so a twin comparison is now
// tautological (both imports are the SAME function). It is RETARGETED — not
// deleted — to pin the ONE resolver's RESOLVED output with LITERAL oracles over
// the non-default `ALIAS_YAML` (alias / forbidden / kind axes) so extraction
// drift in the single core still reds this suite. NFR-004's "same YAML → same
// result" guarantee is now structural (one implementation); its BEHAVIORAL
// content is preserved below as explicit literals.
describe('NFR-004 (retargeted) — the single resolver pins RESOLVED output over a non-default YAML', () => {
  it('resolves alias / forbidden / kind literally for ALIAS_YAML', () => {
    const dir = withVocabulary(ALIAS_YAML);
    try {
      const vocab = loadVocabulary(dir);
      // Alias axis: Feature → Mission, not forbidden.
      expect(vocab.resolveType('Feature').effective).toBe('Mission');
      expect(vocab.resolveType('Feature').forbidden).toBe(false);
      // Forbidden term verdict (ALIAS_YAML forbids `Epic`): a distinct literal the
      // unit block above never exercises over ALIAS_YAML.
      expect(vocab.resolveType('Epic').forbidden).toBe(true);
      // Kind axis is unconfigured in ALIAS_YAML → identity (unlisted passthrough).
      expect(vocab.resolveKind('Reference').effective).toBe('Reference');
      expect(vocab.resolveKind('Reference').forbidden).toBe(false);
    } finally {
      cleanup(dir);
    }
  });

  it('resolves the identity (absent-file) case to the input term unchanged', () => {
    const dir = withVocabulary(null);
    try {
      const vocab = loadVocabulary(dir);
      expect(vocab.resolveType('Feature').effective).toBe('Feature');
      expect(vocab.resolveType('Feature').forbidden).toBe(false);
    } finally {
      cleanup(dir);
    }
  });
});

// documentation-charter WP03 (IC-03) — the gate consumes the CHARTER-resolved
// statuses + required-field policy the same way `run()` does: it resolves the
// governance for a docs root via `resolveGovernance` and threads
// `legalStatuses`/`requiredFields` into `validate()`. This proves the wiring
// end-to-end (a real charter file → resolved policy → gate verdict), composed
// with the vocabulary override that this suite already covers.
describe('gate wiring — charter-resolved statuses + required policy (C-004/C-005, WP03)', () => {
  /** Write a `<docsRoot>/_meta/charter.yaml` into a fresh temp dir and return it. */
  function withCharter(body: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-charter-gate-'));
    mkdirSync(path.join(dir, '_meta'), { recursive: true });
    writeFileSync(path.join(dir, '_meta', 'charter.yaml'), body, 'utf8');
    resetDeprecationNotice();
    return dir;
  }

  const CHARTER = `version: 1
statuses:
  add: [ archived ]
required_fields:
  optional: [ updated ]
`;

  it('a charter-added status validates as legal (no warning), and the relaxed field may be absent', () => {
    const dir = withCharter(CHARTER);
    try {
      const g = resolveGovernance(dir, { emitDeprecation: false });
      // A page using the charter-added status AND omitting the relaxed `updated`.
      const { problems, warnings } = validate(
        'context/archived-page.md',
        { title: 'Archived', description: 'x'.repeat(60), doc_status: 'archived', kind: 'Reference' },
        SECTION_TYPE,
        loadVocabulary(dir),
        { legalStatuses: g.legalStatuses, requiredFields: g.requiredFields.required },
      );
      expect(problems).toEqual([]); // updated relaxed → not required; archived is legal
      expect(warnings.some((w) => /doc_status/.test(w))).toBe(false);
    } finally {
      cleanup(dir);
    }
  });

  it('the `title` floor is still enforced under a charter, and an unknown status still warns', () => {
    const dir = withCharter(CHARTER);
    try {
      const g = resolveGovernance(dir, { emitDeprecation: false });
      const { problems, warnings } = validate(
        'context/bad.md',
        { description: 'x'.repeat(60), doc_status: 'mystery', kind: 'Reference' }, // no title, unknown status
        SECTION_TYPE,
        loadVocabulary(dir),
        { legalStatuses: g.legalStatuses, requiredFields: g.requiredFields.required },
      );
      expect(problems).toContain('`title`: required'); // floor holds
      expect(warnings.join('\n')).toContain('`doc_status: mystery` is not in the legal set');
    } finally {
      cleanup(dir);
    }
  });

  // #99 — the standalone gate's `run()` must read the `type`/`kind` forbidden
  // check from the CHARTER-aware `resolveGovernance` (per-axis charter→legacy→
  // default), not a legacy-only `loadVocabulary(root)`. Before the fix `run()`
  // fed `validate()` the legacy resolver, so a term forbidden ONLY in
  // `_meta/charter.yaml` (no `_meta/vocabulary.yaml`) slipped through the gate.
  // This test drives `run()` end-to-end and would PASS the forbidden page under
  // the old (legacy-only) source — it fails without the resolver-source swap.
  it('#99: a type forbidden ONLY in charter.yaml (no legacy vocabulary.yaml) fails the run() gate', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-charter-forbid-'));
    mkdirSync(path.join(dir, '_meta'), { recursive: true });
    // Charter forbids `type: Epic`; deliberately NO legacy `_meta/vocabulary.yaml`.
    writeFileSync(
      path.join(dir, '_meta', 'charter.yaml'),
      'version: 1\nvocabulary:\n  types:\n    forbidden: [ Epic ]\n',
      'utf8',
    );
    mkdirSync(path.join(dir, 'context'), { recursive: true });
    writeFileSync(
      path.join(dir, 'context', 'page.md'),
      [
        '---',
        'title: A Page',
        `description: ${'x'.repeat(60)}`,
        'doc_status: active',
        'updated: 2026-01-01',
        'type: Epic',
        'kind: Reference',
        '---',
        '',
        '# A Page',
        '',
      ].join('\n'),
      'utf8',
    );
    resetDeprecationNotice();

    // The gap #99 closes: the legacy-only loader (the gate's OLD source) does NOT
    // forbid the charter-only term; the charter-aware resolver (the NEW source) does.
    expect(loadVocabulary(dir).resolveType('Epic').forbidden).toBe(false);
    expect(resolveGovernance(dir, { emitDeprecation: false }).resolveType('Epic').forbidden).toBe(
      true,
    );

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      // With the fix, `run()` fails the forbidden `type: Epic` (exit 1) and names it.
      expect(() => run(['node', 'validate-frontmatter.mjs', dir])).toThrow('process.exit:1');
      const errors = errSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(errors).toMatch(/`type: Epic` is forbidden/);
    } finally {
      exitSpy.mockRestore();
      errSpy.mockRestore();
      warnSpy.mockRestore();
      logSpy.mockRestore();
      cleanup(dir);
    }
  });

  it('a MALFORMED charter fails closed at resolution (the gate surfaces it as a hard failure)', () => {
    // required_fields.optional listing the `title` floor → parseRequiredFields
    // throws (C-005). `run()` catches this and reports a hard gate failure.
    const dir = withCharter('version: 1\nrequired_fields:\n  optional: [ title ]\n');
    try {
      expect(() => resolveGovernance(dir, { emitDeprecation: false })).toThrow(/title/);
    } finally {
      cleanup(dir);
    }
  });
});
