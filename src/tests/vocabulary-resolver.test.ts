import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadVocabulary as loadVocabularyTs } from '../lib/sections.js';
import {
  loadVocabulary as loadVocabularyMjs,
  validate,
  SECTION_TYPE,
} from '../scripts/validate-frontmatter.mjs';

/**
 * #40 — `_meta/vocabulary.yaml` override + resolver (contracts/vocabulary-override.md).
 *
 * The override lets an adopter alias / neutralize / forbid `type` (and `kind`)
 * terms through an on-disk file resolved `default → consumer`, read by the
 * standalone gate WITHOUT an Astro build, and applied to BOTH authored and
 * section-DERIVED values (FR-004/FR-005).
 *
 * Two hand-mirrored twins carry the resolver — `loadVocabulary` in
 * `src/lib/sections.ts` (the canonical unit) and its copy in
 * `src/scripts/validate-frontmatter.mjs` (the bare-Node gate). NFR-004 requires
 * they resolve the SAME YAML to the SAME result — asserted here on the RESOLVED
 * output, not on any static default array.
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

describe('loadVocabulary resolver unit — sections.ts (canonical)', () => {
  it('aliases a type term to its replacement (authored OR derived)', () => {
    const dir = withVocabulary(ALIAS_YAML);
    try {
      const vocab = loadVocabularyTs(dir);
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
      const vocab = loadVocabularyTs(dir);
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
      const vocab = loadVocabularyTs(dir);
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
      const vocab = loadVocabularyTs(dir);
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
      const vocab = loadVocabularyTs(dir);
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
      expect(() => loadVocabularyTs(dir)).toThrow(/vocabulary/i);
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
      const vocab = loadVocabularyTs(dir);
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
      const vocab = loadVocabularyMjs(dir);
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
      const vocab = loadVocabularyMjs(dir);
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
      const vocab = loadVocabularyMjs(dir);
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
      const vocab = loadVocabularyMjs(dir);
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

describe('NFR-004 — mjs and ts twins resolve the SAME YAML identically (resolved output)', () => {
  it('both resolvers alias Feature → Mission for the same non-default YAML', () => {
    const dir = withVocabulary(ALIAS_YAML);
    try {
      const ts = loadVocabularyTs(dir);
      const mjs = loadVocabularyMjs(dir);
      // Assert on the RESOLVED output, not the static default arrays.
      expect(ts.resolveType('Feature').effective).toBe('Mission');
      expect(mjs.resolveType('Feature').effective).toBe('Mission');
      expect(mjs.resolveType('Feature').effective).toBe(ts.resolveType('Feature').effective);
      // And they agree on the forbidden term's verdict, too.
      expect(mjs.resolveType('Epic').forbidden).toBe(ts.resolveType('Epic').forbidden);
      expect(ts.resolveType('Epic').forbidden).toBe(true);
      // Kind axis parity as well.
      expect(mjs.resolveKind('Reference').effective).toBe(ts.resolveKind('Reference').effective);
    } finally {
      cleanup(dir);
    }
  });

  it('both resolvers agree on the identity (absent-file) case', () => {
    const dir = withVocabulary(null);
    try {
      const ts = loadVocabularyTs(dir);
      const mjs = loadVocabularyMjs(dir);
      expect(mjs.resolveType('Feature').effective).toBe(ts.resolveType('Feature').effective);
      expect(mjs.resolveType('Feature').effective).toBe('Feature');
    } finally {
      cleanup(dir);
    }
  });
});
