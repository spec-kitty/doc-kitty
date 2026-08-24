import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { z } from 'zod';
import { validate } from '../scripts/validate-frontmatter.mjs';
import { collectDanglingRelated } from '../scripts/check-links.mjs';
import { docKittyFields } from '../lib/schema.ts';

/**
 * NFR-005 parity: the ACTUAL build schema in `src/lib/schema.ts` and the
 * standalone `validate-frontmatter.mjs` gate must agree on every fixture.
 *
 * The two arms are genuinely INDEPENDENT here:
 *   - Arm A (standalone gate): `validate()` from the `.mjs` — its re-derived zod
 *     shape plus the path-aware presence rules.
 *   - Arm B (build schema): `z.object(docKittyFields)` — the exact zod field
 *     object `docKittyDocsSchema()` extends Starlight's schema with. The full
 *     `docKittyDocsSchema()` pulls `@astrojs/starlight/schema`; the isolated
 *     field object carries NO Astro dependency, so it runs in bare vitest and is
 *     the same shape the `astro build` applies to frontmatter.
 *
 * Earlier this test imported BOTH arms from the `.mjs` (tautological). Binding
 * arm B to `schema.ts` is what makes a real divergence — e.g. a `type` hard-enum
 * on one side, a `.url()` on `resource`, a dropped `description.max(180)` —
 * flip this suite red (DIRECTIVE_043: bind the gate to the canonical source).
 */

const fixturesUrl = new URL('./fixtures/', import.meta.url);
const validatorPath = fileURLToPath(
  new URL('../scripts/validate-frontmatter.mjs', import.meta.url),
);

// Arm B: the real build-schema field shape from schema.ts.
const buildSchema = z.object(docKittyFields);

function parse(relFromFixtures: string): Record<string, unknown> {
  const abs = fileURLToPath(new URL(relFromFixtures, fixturesUrl));
  return matter(readFileSync(abs, 'utf8')).data as Record<string, unknown>;
}

/** Does the standalone gate report a hard problem for this fixture? */
function validatorRejects(relPath: string, data: Record<string, unknown>): boolean {
  return validate(relPath, data).problems.length > 0;
}

/** Does the build schema (schema.ts) reject this fixture's SHAPE? */
function buildRejects(data: Record<string, unknown>): boolean {
  return !buildSchema.safeParse(data).success;
}

// Shape-level fixtures: BOTH arms must reach the SAME verdict. A mismatch here
// means schema.ts and the .mjs validator disagree on the shared field contract.
const SHAPE_PARITY: { file: string; relPath: string; reject: boolean }[] = [
  { file: 'err/description-too-long.md', relPath: 'description-too-long.md', reject: true },
  { file: 'err/bad-doc-status.md', relPath: 'bad-doc-status.md', reject: true },
  { file: 'err/moscow-no-rationale.md', relPath: 'moscow-no-rationale.md', reject: true },
  { file: 'err/moscow-bad-level.md', relPath: 'moscow-bad-level.md', reject: true },
  { file: 'err/audience-no-guidance.md', relPath: 'audience-no-guidance.md', reject: true },
  { file: 'err/hero-no-alt.md', relPath: 'hero-no-alt.md', reject: true },
  { file: 'err/related-object-no-ref.md', relPath: 'related-object-no-ref.md', reject: true },
  { file: 'valid/valid.md', relPath: 'valid.md', reject: false },
  // Persona with all required attribute fields (ADR-0019): both arms accept —
  // the build schema treats role/goals/responsibilities as optional and the
  // validator's kind-aware requiredness is satisfied.
  { file: 'persona/valid-persona.md', relPath: 'valid-persona.md', reject: false },
];

describe('schema/validator parity — shared shape contract (NFR-005)', () => {
  for (const { file, relPath, reject } of SHAPE_PARITY) {
    it(`${file}: schema.ts and the standalone validator agree`, () => {
      const data = parse(file);
      const buildReject = buildRejects(data);
      const gateReject = validatorRejects(relPath, data);
      // The two arms must not diverge …
      expect(buildReject).toBe(gateReject);
      // … and both must land on the expected verdict.
      expect(gateReject).toBe(reject);
    });
  }
});

// Documented, INTENTIONAL divergence (schema.ts comment): the build schema is
// deliberately lenient on presence so partially-scaffolded stubs still build
// (`doc_status` defaults to draft; `kind`/`updated` are optional), while the
// standalone gate enforces strict presence by path. This pins that contract: if
// schema.ts ever makes these required (breaking stubs) or the gate stops
// rejecting them, the assertion flips red.
const PRESENCE_LENIENT: { file: string; relPath: string }[] = [
  { file: 'err/missing-doc-status.md', relPath: 'missing-doc-status.md' },
  { file: 'err/missing-kind.md', relPath: 'missing-kind.md' },
  // A persona missing a required attribute field (ADR-0019): the build schema
  // is lenient (role/goals/responsibilities are optional there — schema.ts keeps
  // no per-kind discriminated union), while the standalone validator enforces
  // requiredness for `kind === Persona` and rejects. Same gate-only strict layer
  // as the missing-kind / missing-doc-status cases.
  { file: 'persona/missing-role.md', relPath: 'missing-role.md' },
];

describe('schema/validator parity — presence is the gate-only strict layer', () => {
  for (const { file, relPath } of PRESENCE_LENIENT) {
    it(`${file}: build schema accepts (lenient), the gate rejects (strict)`, () => {
      const data = parse(file);
      expect(buildRejects(data)).toBe(false);
      expect(validatorRejects(relPath, data)).toBe(true);
    });
  }
});

describe('reference integrity — a dangling bare related slug is an error', () => {
  it('err/related-dangling-slug.md is schema-valid but check-links flags it', () => {
    const data = parse('err/related-dangling-slug.md');
    // The shape is valid on both arms (a bare slug is a legal related entry) …
    expect(buildRejects(data)).toBe(false);
    expect(validatorRejects('related-dangling-slug.md', data)).toBe(false);
    // … but the ref does not resolve, so check-links reports it dangling.
    const root = fileURLToPath(new URL('err/', fixturesUrl));
    expect(collectDanglingRelated(root, data)).toContain('does/not/exist');
  });
});

// Warning-side fixtures: BOTH arms accept (advisory warnings are never hard
// errors), and the CLI prints the message while exiting 0.
const WARNINGS = [
  { relPath: 'unknown-kind.md', needle: 'kind: Nonsense' },
  { relPath: 'short-description.md', needle: 'convention suggests' },
  { relPath: 'architecture/type-mismatch.md', needle: 'path suggests' },
  { relPath: 'architecture/unknown-type.md', needle: 'type: Bogus' },
];

describe('advisory warnings — pass (exit 0) on both arms but observably printed', () => {
  for (const { relPath, needle } of WARNINGS) {
    it(`warn/${relPath} warns without failing either arm`, () => {
      const data = parse(`warn/${relPath}`);
      const { problems, warnings } = validate(relPath, data);
      expect(problems).toEqual([]);
      expect(buildRejects(data)).toBe(false);
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
