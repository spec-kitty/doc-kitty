import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import {
  validate,
  frontmatterSchema,
} from '../scripts/validate-frontmatter.mjs';
import { collectDanglingRelated } from '../scripts/check-links.mjs';

/**
 * NFR-005 parity: the standalone validator's path-aware `validate()` and its
 * re-derived zod `frontmatterSchema` (the build-free mirror of `schema.ts`) must
 * agree on the pass/fail verdict for every fixture. The example site's `astro
 * build` is the other arm of the contract — it validates the same migrated docs
 * through the real `schema.ts`, so a genuine divergence would turn the build red.
 *
 * Warnings must be OBSERVABLY PRINTED (not a silent exit 0): the warning-side
 * fixtures are run through the CLI and their message text is asserted in the
 * captured output.
 */

const fixturesUrl = new URL('./fixtures/', import.meta.url);
const validatorPath = fileURLToPath(
  new URL('../scripts/validate-frontmatter.mjs', import.meta.url),
);

function parse(relFromFixtures: string): Record<string, unknown> {
  const abs = fileURLToPath(new URL(relFromFixtures, fixturesUrl));
  return matter(readFileSync(abs, 'utf8')).data as Record<string, unknown>;
}

// Schema-side error fixtures: `validate()` reports a problem AND the zod schema
// rejects. `relPath` is what the path-aware rules see.
const SCHEMA_ERRORS = [
  { file: 'err/missing-doc-status.md', relPath: 'missing-doc-status.md' },
  { file: 'err/missing-kind.md', relPath: 'missing-kind.md' },
  { file: 'err/description-too-long.md', relPath: 'description-too-long.md' },
  { file: 'err/bad-doc-status.md', relPath: 'bad-doc-status.md' },
  { file: 'err/moscow-no-rationale.md', relPath: 'moscow-no-rationale.md' },
  { file: 'err/moscow-bad-level.md', relPath: 'moscow-bad-level.md' },
  { file: 'err/audience-no-guidance.md', relPath: 'audience-no-guidance.md' },
  { file: 'err/hero-no-alt.md', relPath: 'hero-no-alt.md' },
  { file: 'err/related-object-no-ref.md', relPath: 'related-object-no-ref.md' },
];

describe('schema/validator parity — error fixtures (NFR-005)', () => {
  for (const { file, relPath } of SCHEMA_ERRORS) {
    it(`${file} fails both the validator and the zod schema`, () => {
      const data = parse(file);
      const { problems } = validate(relPath, data);
      const schema = frontmatterSchema.safeParse(data);
      expect(problems.length).toBeGreaterThan(0);
      expect(schema.success).toBe(false);
    });
  }
});

describe('valid fixture passes both arms', () => {
  it('valid/valid.md has no problems and resolves its related ref', () => {
    const data = parse('valid/valid.md');
    const { problems } = validate('valid.md', data);
    expect(problems).toEqual([]);
    expect(frontmatterSchema.safeParse(data).success).toBe(true);
    const root = fileURLToPath(new URL('valid/', fixturesUrl));
    expect(collectDanglingRelated(root, data)).toEqual([]);
  });
});

describe('reference integrity — a dangling bare related slug is an error', () => {
  it('err/related-dangling-slug.md is schema-valid but check-links flags it', () => {
    const data = parse('err/related-dangling-slug.md');
    // The shape is valid (a bare slug is a legal related entry) …
    expect(frontmatterSchema.safeParse(data).success).toBe(true);
    expect(validate('related-dangling-slug.md', data).problems).toEqual([]);
    // … but the ref does not resolve, so check-links reports it dangling.
    const root = fileURLToPath(new URL('err/', fixturesUrl));
    expect(collectDanglingRelated(root, data)).toContain('does/not/exist');
  });
});

// Warning-side fixtures: `validate()` reports a warning but NO problem (the
// schema still passes), and the CLI prints the message while exiting 0.
const WARNINGS = [
  { relPath: 'unknown-kind.md', needle: 'kind: Nonsense' },
  { relPath: 'short-description.md', needle: 'convention suggests' },
  { relPath: 'architecture/type-mismatch.md', needle: 'path suggests' },
  { relPath: 'architecture/unknown-type.md', needle: 'type: Bogus' },
];

describe('advisory warnings — pass (exit 0) but observably printed', () => {
  for (const { relPath, needle } of WARNINGS) {
    it(`warn/${relPath} warns without failing`, () => {
      const data = parse(`warn/${relPath}`);
      const { problems, warnings } = validate(relPath, data);
      expect(problems).toEqual([]);
      expect(frontmatterSchema.safeParse(data).success).toBe(true);
      expect(warnings.join('\n')).toContain(needle);
    });
  }

  it('the CLI prints every warning and still exits 0', () => {
    const warnRoot = fileURLToPath(new URL('warn/', fixturesUrl));
    const res = spawnSync('node', [validatorPath, warnRoot], {
      encoding: 'utf8',
    });
    const output = `${res.stdout}${res.stderr}`;
    expect(res.status).toBe(0);
    for (const { needle } of WARNINGS) {
      expect(output).toContain(needle);
    }
  });
});
