import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { z } from 'zod';
import { validate, SECTION_TYPE } from '../scripts/validate-frontmatter.mjs';
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
  // RETARGETED (#38 / NFR-001): `kind` is now OPTIONAL in the standalone gate,
  // matching the already-lenient build schema, so a page that omits `kind` is
  // ACCEPTED on BOTH arms. This case was formerly in PRESENCE_LENIENT (gate
  // rejects). It was MOVED here — not deleted — so a positive assertion pins the
  // new contract: this row reds the moment `kind` becomes required again on
  // either side. (`type: Context` is present and canonical; the unregistered
  // `missing-kind.md` path derives nothing, so no mismatch warning fires.)
  { file: 'err/missing-kind.md', relPath: 'missing-kind.md', reject: false },
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
  // NOTE: `err/missing-kind.md` used to live here (gate-only strict rejection).
  // #38 made `kind` optional in the gate, so it was RETARGETED to the SHAPE_PARITY
  // accept path above (reject: false) — not deleted. See the comment there.
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

// #38 — optional, section-derived `type` + optional `kind` (US1 AS-1/2/3, FR-001/
// FR-002/FR-003). The gate no longer requires `type`; when absent it derives from
// the section registry (filling ONLY the absent case), accepts an absent `kind`,
// honors an authored `type` (authored wins), and reports an authored-vs-derived
// mismatch through the STRUCTURED `warnings[]` — never a hard problem, never
// console text. The absent-derivation (orphan) case is deterministic "untyped".
describe('optional/derived frontmatter contract (#38)', () => {
  it('AS-1: a registered-section page with no type and no kind passes; effective type is the section-derived type', () => {
    const data = parse('optional/registered-no-type-no-kind.md');
    // Under a registered section (frozen fallback: architecture → Architecture),
    // the absent `type` is derived and the absent `kind` is accepted.
    const { problems, warnings, effective } = validate('architecture/registered.md', data);
    expect(problems).toEqual([]);
    expect(effective).toBe('Architecture');
    // No mismatch warning: nothing was authored to disagree with the derivation.
    expect(warnings.some((w) => /path suggests/.test(w))).toBe(false);
  });

  it('AS-2: an authored type that conflicts with the derived type passes with a STRUCTURED mismatch warning (authored wins)', () => {
    const data = parse('optional/authored-type-conflict.md');
    // Authored `type: Guide` under architecture/ (derives Architecture).
    const { problems, warnings, effective } = validate('architecture/authored-type-conflict.md', data);
    expect(problems).toEqual([]);
    // Authored value wins — the effective type is the authored `Guide`.
    expect(effective).toBe('Guide');
    // The mismatch is observable on the structured return, not console text.
    expect(warnings).toContain('`type: Guide` but path suggests `Architecture`');
  });

  it('AS-3: an orphan page with no derivable type is accepted as deterministically untyped (no crash, no garbage type)', () => {
    const data = parse('optional/orphan-no-type.md');
    // `orphan-no-type.md` has no registered section → derivation yields nothing.
    const { problems, warnings, effective } = validate('orphan-no-type.md', data);
    expect(problems).toEqual([]);
    // The explicit "untyped" marker is a null effective type — never a fabricated
    // or empty string.
    expect(effective).toBeNull();
    expect(warnings.some((w) => /path suggests/.test(w))).toBe(false);
  });
});

// adopter-loader-migration WP01 (T007) — extend the schema/validator parity
// twin to cover the NEW basename + subtypes options: both arms must keep
// agreeing on SHAPE acceptance when the gate is called with the new `options`
// (FR-001/FR-005), and the new options must not introduce a shape-level
// divergence from the build schema (which has no path/basename awareness at
// all — it validates frontmatter SHAPE only, so a genuine parity risk here is
// the new 5th `validate()` param accidentally changing the DEFAULT verdict).
describe('index-basename + subtypes options do not perturb shape parity (NFR-001/NFR-005)', () => {
  it('a root index.md (opted-in basename) is exempt from `type`, same as README.md, on the gate; the build schema is path-agnostic on both', () => {
    const data = {
      title: 'Docs',
      description: 'a'.repeat(60),
      updated: '2026-09-01',
      doc_status: 'active',
      kind: 'Hub',
      okf_version: '0.2',
    };
    const readme = validate('README.md', data);
    const index = validate('index.md', data, undefined, undefined, {
      indexBasename: ['README', 'index'],
    });
    expect(readme.problems).toEqual([]);
    expect(index.problems).toEqual([]);
    // The build schema has no path awareness — a bare shape check accepts
    // either filename identically (parity is trivially true here BY DESIGN;
    // pinned so a future path-aware build-schema change is a deliberate one).
    expect(buildRejects(data)).toBe(false);
  });

  it('a page with NO authored type under an active registry subtypes rule: both arms accept (the #38 optional-type contract extended to subtypes)', () => {
    const data = {
      title: 'Missions overview',
      description: 'a'.repeat(60),
      updated: '2026-09-01',
      doc_status: 'active',
      kind: 'Planning',
    };
    const subtypesBySection = { plans: [{ match: 'missions', type: 'Mission' }] };
    const { problems, effective } = validate(
      'plans/missions/overview.md',
      data,
      SECTION_TYPE,
      undefined,
      { subtypesBySection },
    );
    expect(problems).toEqual([]);
    expect(effective).toBe('Mission');
    expect(buildRejects(data)).toBe(false);
  });

  it('the 5-arg options form is opt-in: the bare 2-arg call (used throughout this suite) is unaffected', () => {
    const data = parse('valid/valid.md');
    expect(validate('valid.md', data)).toEqual(validate('valid.md', data, SECTION_TYPE));
  });
});
