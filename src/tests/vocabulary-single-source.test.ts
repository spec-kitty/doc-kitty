/**
 * Single-source + purity structural gate (#49 NFR-001 / F8 / F9, WP01/T004).
 *
 * Makes "impossible by construction" a committed, enforced invariant rather than
 * a promise. Two guarantees:
 *
 *   1. PURITY (C-001): `vocabulary-core.mjs` imports NO `node:fs`/`fs` and NO
 *      `astro`/`@astrojs/*`, so it is safe for the fs-free `metadata.ts` and
 *      loads under plain `node` with no Astro build context. This is strict from
 *      day one.
 *
 *   2. SINGLE SOURCE (NFR-001): the canonical vocabulary symbols — `SECTION_TYPE`,
 *      `expectedDocType`/`expectedType`, the resolver (`makeAxisResolver` /
 *      `parseVocabulary`), and the `STATUSES`/`DOC_TYPES`/`KINDS` arrays — are
 *      DEFINED only in the core. A definition anywhere else reds this test.
 *
 * SHRINK-ONLY RATCHET (frozen-baseline tactic): WP01 only CREATES the core; it
 * does NOT rewire the existing consumers — that is WP02 (IC-02), which deletes
 * the hand-mirrored twins in `metadata.ts` / `schema.ts` / `sections.ts` /
 * `validate-frontmatter.mjs`. Those twins are therefore STILL PRESENT during
 * WP01. To make this gate green NOW while still blocking ALL NEW drift, the
 * known twins are pinned in {@link LEGACY_TWIN_DEFINITIONS} as a baseline. The
 * ratchet only shrinks: a definition in ANY file not in the baseline (and not
 * the core) fails immediately, and WP02 MUST delete each twin AND remove its
 * baseline entry until the baseline is empty and single-sourcing is absolute.
 *
 * Mission: metadata-vocab-hub-consolidation-01M1MFVT, WP01.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORE_RELPATH = 'lib/vocabulary-core.mjs';

/**
 * The canonical symbols that must live in exactly one place (the core). Each
 * regex matches a DEFINITION (a `const X =` / `function X(`), never an import or
 * a usage.
 */
const CANONICAL_DEFINITIONS: Record<string, RegExp> = {
  SECTION_TYPE: /\b(?:export\s+)?const\s+SECTION_TYPE\b/,
  STATUSES: /\b(?:export\s+)?const\s+STATUSES\b/,
  DOC_TYPES: /\b(?:export\s+)?const\s+DOC_TYPES\b/,
  KINDS: /\b(?:export\s+)?const\s+KINDS\b/,
  expectedDocType: /\bfunction\s+expectedDocType\b/,
  expectedType: /\bfunction\s+expectedType\b/,
  makeAxisResolver: /\bfunction\s+makeAxisResolver\b/,
  parseVocabulary: /\bfunction\s+parseVocabulary\b/,
};

/**
 * BASELINE (shrink-only): the legacy hand-mirrored twins that WP02/IC-02 had not
 * yet deleted. Each key WAS a `src/`-relative file; each value the canonical
 * symbols it was still permitted to define during the WP01→WP02 transition.
 *
 * END STATE REACHED (WP02): every twin has been deleted and its consumer rewired
 * onto the one core (`metadata.ts` / `schema.ts` / `sections.ts` /
 * `validate-frontmatter.mjs` / `new-doc.mjs` / `scaffold.mjs` all import from
 * `vocabulary-core.mjs` / `vocabulary-loader.mjs`), so the baseline is now `{}`
 * and single-sourcing is absolute — the "no canonical symbol defined outside the
 * core" test below now has zero exceptions. (Shrinking this to `{}` is the
 * WP01-documented WP02 handoff; the rot-guard test requires it once the twins are
 * gone, otherwise it reds on a stale pin.)
 */
const LEGACY_TWIN_DEFINITIONS: Record<string, string[]> = {};

/** Recursively collect `.ts`/`.mjs`/`.js` source files under a directory. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'tests' || name === 'fixtures') continue;
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) {
      out.push(...collectSourceFiles(abs));
    } else if (/\.(ts|mjs|js)$/.test(name) && !/\.d\.ts$/.test(name)) {
      out.push(abs);
    }
  }
  return out;
}

describe('vocabulary-core is fs-free and Astro-free (C-001, purity)', () => {
  const core = readFileSync(path.join(SRC_ROOT, CORE_RELPATH), 'utf8');

  it('imports no node:fs / fs', () => {
    // Match an actual import specifier, not the word "fs" inside prose/JSDoc.
    expect(core).not.toMatch(/from\s+['"](?:node:)?fs['"]/);
    expect(core).not.toMatch(/require\(\s*['"](?:node:)?fs['"]\s*\)/);
  });

  it('imports no node:path / node:process (kept dependency-light like metadata.ts)', () => {
    expect(core).not.toMatch(/from\s+['"]node:(?:path|process)['"]/);
  });

  it('imports no astro / @astrojs', () => {
    expect(core).not.toMatch(/from\s+['"](?:astro|@astrojs)[/'"]/);
  });
});

describe('canonical vocabulary is single-sourced in the core (NFR-001)', () => {
  const core = readFileSync(path.join(SRC_ROOT, CORE_RELPATH), 'utf8');

  it('the core defines every canonical symbol', () => {
    for (const [symbol, pattern] of Object.entries(CANONICAL_DEFINITIONS)) {
      // `expectedType` is the bare-Node twin name; the core exposes it as
      // `expectedDocType`, so only that one is required in the core.
      if (symbol === 'expectedType') continue;
      expect(core, `core must define ${symbol}`).toMatch(pattern);
    }
  });

  it('no canonical symbol is defined outside the core except the pinned legacy twins (shrink-only)', () => {
    const files = collectSourceFiles(SRC_ROOT);
    const offenders: string[] = [];

    for (const abs of files) {
      const rel = path.relative(SRC_ROOT, abs).split(path.sep).join('/');
      if (rel === CORE_RELPATH) continue; // the one authoritative home
      const text = readFileSync(abs, 'utf8');
      const allowed = new Set(LEGACY_TWIN_DEFINITIONS[rel] ?? []);
      for (const [symbol, pattern] of Object.entries(CANONICAL_DEFINITIONS)) {
        if (pattern.test(text) && !allowed.has(symbol)) {
          offenders.push(`${rel} redefines ${symbol}`);
        }
      }
    }

    expect(
      offenders,
      `Canonical vocabulary must be defined only in ${CORE_RELPATH}. New definitions found:\n` +
        `${offenders.join('\n')}\n` +
        `If this is a legacy twin WP02 has not yet removed, that is a bug — WP02 deletes twins ` +
        `and SHRINKS LEGACY_TWIN_DEFINITIONS toward {}.`,
    ).toEqual([]);
  });

  it('the legacy-twin baseline only shrinks: every pinned file still defines what it claims', () => {
    // Guards the ratchet from rot — a stale allowlist entry (a twin already
    // deleted but still pinned) must be removed, not left masking a real gap.
    for (const [rel, symbols] of Object.entries(LEGACY_TWIN_DEFINITIONS)) {
      const text = readFileSync(path.join(SRC_ROOT, rel), 'utf8');
      for (const symbol of symbols) {
        expect(
          text,
          `${rel} is pinned to still define ${symbol}; if WP02 removed it, drop the baseline entry`,
        ).toMatch(CANONICAL_DEFINITIONS[symbol]);
      }
    }
  });
});
