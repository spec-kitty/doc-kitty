import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { z } from 'zod';
import {
  validate,
  SECTION_TYPE,
  isGeneratedPage,
} from '../scripts/validate-frontmatter.mjs';
import { parseActor, isActor, normaliseInstant } from '../lib/vocabulary-core.mjs';
import { GHERKIN_PRODUCER, GLOSSARY_PRODUCER, makeStamp, isGeneratedStamp, toolkitVersion } from '../lib/generator-stamp.mjs';
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
  // NOTE: `err/bad-doc-status.md` (doc_status: archived) USED to live here as a
  // both-arms-REJECT row. documentation-charter WP03 made the status axis
  // extend-only + warn-not-fail (C-004/FR-005): an unknown-and-not-added status
  // now WARNS on the gate and BUILDS on the site (parity with the open `kind`
  // axis), so both arms ACCEPT it. It was RETARGETED — not deleted — to the
  // dedicated status describe below, which pins the new contract (both accept,
  // the gate warns). This row's removal reds if either side ever hard-fails an
  // unknown status again.
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

// #39 / FR-004 (WP03 add): `durable` is a new lifecycle status, added in exactly
// ONE place — the shared `STATUSES` enum in `vocabulary-core.mjs` — from which
// BOTH the build schema (`z.enum(STATUSES)` in schema.ts's `docKittyFields`) and
// the standalone gate (its own `z.enum(STATUSES)`) derive. This pins that both
// arms ACCEPT `durable`, the way `err/bad-doc-status.md` above pins both arms
// REJECT an unknown status. It is authored inline (not a fixture) to stay within
// this suite's owned files; the shape is otherwise a canonical valid page.
describe('schema/validator parity — the new `durable` status is accepted on both arms (#39)', () => {
  it('doc_status: durable — build schema accepts AND the gate accepts', () => {
    const data: Record<string, unknown> = {
      title: 'A durable, never-retired reference',
      description: 'x'.repeat(60),
      updated: '2026-09-01',
      doc_status: 'durable',
      type: 'Context',
      kind: 'Reference',
    };
    // Arm B (build schema, schema.ts) …
    expect(buildRejects(data)).toBe(false);
    // Arm A (standalone gate) …
    expect(validatorRejects('context/durable-ref.md', data)).toBe(false);
    // … and the two arms agree (no divergence on the shared enum).
    expect(buildRejects(data)).toBe(validatorRejects('context/durable-ref.md', data));
  });
});

// documentation-charter WP03 — the STATUS axis is extend-only + warn-not-fail
// (C-004/FR-005), consumed on BOTH twins:
//   • build schema (schema.ts): `doc_status` is an OPEN string — it never
//     hard-rejects a status (an adopter's charter-added value must still build),
//     mirroring the open `kind` axis;
//   • bare-Node gate (validate-frontmatter.mjs): the legal set is
//     `resolveGovernance(docsRoot).legalStatuses` (canonical ∪ charter-added,
//     defaulting to canonical `STATUSES` for the 2-arg parity form); an unknown
//     status WARNS (never fails), and a charter-added status is legal (no warn).
// So the two arms stay in PARITY (both accept every status); the gate carries the
// advisory. Authored inline (not new fixtures) to stay within owned files.
describe('schema/validator parity — status axis is extend-only + warn-not-fail (C-004/FR-005)', () => {
  it('an unknown status: build ACCEPTS (open) and the gate ACCEPTS but WARNS — the two arms agree', () => {
    const data = parse('err/bad-doc-status.md'); // doc_status: archived (not canonical, not added)
    // Arm B (build schema): open string — never rejects on the status value.
    expect(buildRejects(data)).toBe(false);
    // Arm A (gate): no hard problem, but the advisory warning fires.
    const { problems, warnings } = validate('bad-doc-status.md', data);
    expect(problems).toEqual([]);
    expect(warnings.join('\n')).toContain('`doc_status: archived` is not in the legal set');
    // … and the two arms do not diverge (both accept).
    expect(buildRejects(data)).toBe(validatorRejects('bad-doc-status.md', data));
  });

  it('a CHARTER-ADDED status is legal on the gate (no warn) and builds on the site', () => {
    const data: Record<string, unknown> = {
      title: 'An archived reference',
      description: 'x'.repeat(60),
      updated: '2026-09-01',
      doc_status: 'archived',
      type: 'Context',
      kind: 'Reference',
    };
    // With the charter resolving `archived` into the legal set, the gate accepts
    // it WITHOUT the advisory warning (the extend-only knob, C-004).
    const resolved = validate('context/archived.md', data, undefined, undefined, {
      legalStatuses: ['draft', 'active', 'deprecated', 'superseded', 'durable', 'archived'],
    });
    expect(resolved.problems).toEqual([]);
    expect(resolved.warnings.some((w) => /doc_status/.test(w))).toBe(false);
    // Build side is open, so it accepts the added status too (parity holds).
    expect(buildRejects(data)).toBe(false);
  });

  it('the same status is UNKNOWN (warns) when the charter does NOT add it (default legal set)', () => {
    const data: Record<string, unknown> = {
      title: 'An archived reference',
      description: 'x'.repeat(60),
      updated: '2026-09-01',
      doc_status: 'archived',
      type: 'Context',
      kind: 'Reference',
    };
    // Default legal set (canonical only): `archived` is unknown → warns, no fail.
    const { problems, warnings } = validate('context/archived.md', data);
    expect(problems).toEqual([]);
    expect(warnings.join('\n')).toContain('is not in the legal set');
  });
});

// documentation-charter WP03 — the REQUIRED-FIELD policy (C-005/FR-006), consumed
// on BOTH twins. The build schema is deliberately lenient on presence (stubs must
// build), so requiredness is the GATE's job, now driven by the resolved policy:
//   • default policy = canonical required set (title/description/doc_status/updated);
//   • the charter may RELAX any non-floor field (here `updated`), and a page
//     omitting it then passes the gate;
//   • `title` is a FLOOR — always required, even under a relaxed policy.
describe('schema/validator parity — required-field policy is charter-tunable (C-005/FR-006)', () => {
  const missingUpdated: Record<string, unknown> = {
    title: 'No updated field',
    description: 'x'.repeat(60),
    doc_status: 'active',
    type: 'Context',
    kind: 'Reference',
  };

  it('default policy: the gate REQUIRES `updated` (rejects when absent); the build schema stays lenient', () => {
    expect(buildRejects(missingUpdated)).toBe(false); // build lenient (updated optional)
    const { problems } = validate('context/no-updated.md', missingUpdated);
    expect(problems).toContain('`updated`: required');
  });

  it('a RELAXED policy (updated made optional): the gate ACCEPTS the same page', () => {
    const { problems } = validate('context/no-updated.md', missingUpdated, undefined, undefined, {
      requiredFields: ['title', 'description', 'doc_status'], // `updated` relaxed
    });
    expect(problems).toEqual([]);
  });

  it('the `title` FLOOR is always required — even when the policy list omits it', () => {
    const noTitle: Record<string, unknown> = {
      description: 'x'.repeat(60),
      doc_status: 'active',
      kind: 'Reference',
    };
    // Even a policy that (illegally) omits title still fails on the floor.
    const { problems } = validate('context/no-title.md', noTitle, undefined, undefined, {
      requiredFields: ['description'],
    });
    expect(problems).toContain('`title`: required');
  });
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

// ADR-0046 WP07 — gate parity for GENERATED pages. The build schema is lenient on
// `updated`/`type` for every page; the standalone gate exempts only MACHINE-
// GENERATED pages from those authored-metadata rules. Recognition is keyed on the
// `generated.by` MARKER (`doc-kitty/gherkin`), plus the
// glossary path rule (a glossary stamp grants no exemption; the path alone does). The marker — not the path — is what makes a
// Gherkin feature page exempt: the SAME page with its `generated` block removed
// must fail exactly like an authored page missing `updated`.
//
// Mutation evidence (05-verification.md, "Gate parity"): keying the exemption on
// the path only (`relPath.startsWith('behaviour/')`) turns the "stamp removed",
// "foreign stamp" and "custom section" cases below red.
describe('schema/validator parity — generated pages are exempt by marker (ADR-0046)', () => {
  const FEATURE_REL = 'behaviour/shipping/book-consignment.md';

  /** A deep-ish copy of the fixture's frontmatter with `generated` dropped or replaced. */
  function withStamp(data: Record<string, unknown>, stamp: unknown): Record<string, unknown> {
    const copy: Record<string, unknown> = { ...data };
    if (stamp === undefined) delete copy.generated;
    else copy.generated = stamp;
    return copy;
  }

  it('the gate detects stamps by producer prefix; the retired unversioned stamp is not recognised (#210)', () => {
    const gate = readFileSync(new URL('../scripts/validate-frontmatter.mjs', import.meta.url), 'utf8');
    expect(gate).not.toMatch(/['"]doc-kitty\/(?:gherkin|glossary)['"]/);
    expect(isGeneratedStamp('doc-kitty-gherkin/0.3.0')).toBe(true);
    expect(isGeneratedStamp('doc-kitty-gherkin/0.3.0', 'doc-kitty-gherkin')).toBe(true);
    expect(isGeneratedStamp('doc-kitty-gherkin/0.3.0', 'doc-kitty-glossary')).toBe(false);
    expect(isGeneratedStamp('doc-kitty/gherkin')).toBe(false); // retired in 0.4.0 (#210)
    expect(isGeneratedStamp('someone-else')).toBe(false);
  });

  // FR-006 positive control, two-sided: a test that only asserted the exempt case
  // would also pass on a no-op that exempts everything.
  it('a versioned stamp (`doc-kitty-gherkin/9.9.9`) is exempt; the same body authored (no stamp) is NOT', () => {
    const base = parse('generated/feature-page.md');
    const stamped = withStamp(base, { by: 'doc-kitty-gherkin/9.9.9', at: '2026-10-18T09:30:00Z' });
    expect(isGeneratedPage(FEATURE_REL, stamped)).toBe(true);
    expect(validate(FEATURE_REL, stamped).problems).toEqual([]);
    const authored = withStamp(base, undefined);
    expect(isGeneratedPage(FEATURE_REL, authored)).toBe(false);
    expect(validate(FEATURE_REL, authored).problems).toEqual(['`updated`: required']);
    expect(buildRejects(stamped)).toBe(false);
    // A scaffold stamp is provenance only: the scaffolded page is AUTHORED, so it
    // is not exempt (the same page with an ownership stamp is).
    const scaffolded = withStamp(base, { by: 'doc-kitty-scaffold/9.9.9', at: '2026-10-18T09:30:00Z' });
    expect(isGeneratedPage(FEATURE_REL, scaffolded)).toBe(false);
    expect(isGeneratedStamp('doc-kitty-scaffold/9.9.9')).toBe(false);
    // A glossary stamp grants no exemption either: glossary pages are exempt by the
    // `glossary/` path rule, so an authored page elsewhere cannot opt out by claiming one.
    const claimed = withStamp(base, { by: `${GLOSSARY_PRODUCER}/9.9.9`, at: '2026-10-18T09:30:00Z' });
    expect(isGeneratedPage(FEATURE_REL, claimed)).toBe(false);
    expect(validate(FEATURE_REL, claimed).problems).toEqual(['`updated`: required']);
  });

  it('a generated feature page WITHOUT `updated` passes the gate, and the build schema accepts it too', () => {
    const data = parse('generated/feature-page.md');
    expect(data.updated).toBeUndefined();
    expect((data.generated as { by: string }).by).toBe(`${GHERKIN_PRODUCER}/0.3.0`);
    expect(isGeneratedPage(FEATURE_REL, data)).toBe(true);
    const { problems, warnings, effective } = validate(FEATURE_REL, data);
    expect(problems).toEqual([]);
    expect(warnings).toEqual([]);
    expect(effective).toBeUndefined(); // `type`-exempt, like the glossary pages
    expect(buildRejects(data)).toBe(false);
  });

  it('a generated feature hub WITHOUT `updated` passes the gate (both arms accept)', () => {
    const data = parse('generated/feature-hub.md');
    const { problems } = validate('behaviour/README.md', data, undefined, undefined, {
      indexBasename: ['README', 'index'],
    });
    expect(problems).toEqual([]);
    expect(buildRejects(data)).toBe(false);
  });

  it('the SAME page with `generated` removed fails with the standard missing-`updated` error', () => {
    const data = withStamp(parse('generated/feature-page.md'), undefined);
    expect(isGeneratedPage(FEATURE_REL, data)).toBe(false);
    const { problems } = validate(FEATURE_REL, data);
    // Exactly the error an authored page gets (see the required-field policy block).
    expect(problems).toEqual(['`updated`: required']);
    // The build schema stays lenient — presence is the gate-only strict layer.
    expect(buildRejects(data)).toBe(false);
  });

  it('a page stamped `generated.by: "someone-else"` is NOT exempt', () => {
    const data = withStamp(parse('generated/feature-page.md'), {
      by: 'someone-else',
      at: '2026-10-18T09:30:00Z',
      content_hash: 'sha256:aa67f517f6ea',
    });
    expect(isGeneratedPage(FEATURE_REL, data)).toBe(false);
    expect(validate(FEATURE_REL, data).problems).toEqual(['`updated`: required']);
  });

  it('the exemption follows the marker to a custom section (gherkin.section is configurable)', () => {
    const data = parse('generated/feature-page.md');
    const rel = 'specs/shipping/book-consignment.md';
    expect(isGeneratedPage(rel, data)).toBe(true);
    expect(validate(rel, data).problems).toEqual([]);
  });

  it('a generated page that DOES supply `updated` (an `@dk:updated=` tag) is held to its shape', () => {
    const base = parse('generated/feature-page.md');
    expect(validate(FEATURE_REL, { ...base, updated: '2026-09-01' }).problems).toEqual([]);
    const bad = validate(FEATURE_REL, { ...base, updated: 'not-a-date' }).problems;
    expect(bad.some((p) => p.startsWith('`updated`:'))).toBe(true);
  });

  it('legacy glossary output (no `generated` stamp) still validates unchanged via the path rule', () => {
    const hub = parse('generated/glossary-hub.md');
    const ctx = parse('generated/glossary-context.md');
    expect(hub.generated).toBeUndefined();
    expect(ctx.generated).toBeUndefined();
    expect(isGeneratedPage('glossary/index.md', hub)).toBe(true);
    expect(isGeneratedPage('glossary/hr/index.md', ctx)).toBe(true);
    expect(validate('glossary/index.md', hub).problems).toEqual([]);
    expect(validate('glossary/hr/index.md', ctx).problems).toEqual([]);
    // The boundary is the `glossary/` segment: the same page elsewhere (e.g. the
    // AUTHORED `glossary-demo/` folder) is held to the full contract.
    expect(isGeneratedPage('glossary-demo/hr.md', ctx)).toBe(false);
    expect(validate('glossary-demo/hr.md', ctx).problems).toEqual(['`updated`: required']);
  });

  it('a `doc-kitty/glossary` stamp is NOT an exemption (no pipeline writes it — it would be a bypass)', () => {
    const ctx = { ...parse('generated/glossary-context.md'), generated: { by: 'doc-kitty/glossary', at: 'x' } };
    expect(isGeneratedPage('vocab/hr.md', ctx)).toBe(false);
    const { problems } = validate('vocab/hr.md', ctx);
    expect(problems).toContain('`updated`: required');
    // 0.4.0 (#210): the retired unversioned stamp is itself an error telling the author to regenerate.
    expect(problems.some((p) => /legacy stamp.*regenerate/.test(p))).toBe(true);
    // …while real glossary output, under `glossary/`, stays exempt by the path rule.
    expect(isGeneratedPage('glossary/hr/index.md', ctx)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// OKF alignment (#177, FR-001..FR-004/FR-008/FR-021..FR-023, NFR-002/NFR-004):
// the new metadata forms are judged IDENTICALLY by both twins (accept/reject);
// the advisory WARNING class is the standalone validator's job only — the Zod
// twin has no warning channel, so warnings are asserted on the validator alone.
// ---------------------------------------------------------------------------
describe('schema/validator parity — OKF metadata forms (#177)', () => {
  const page = (extra: Record<string, unknown>): Record<string, unknown> => ({
    title: 'An OKF form',
    description: 'x'.repeat(60),
    updated: '2026-10-18T09:30:00Z',
    doc_status: 'active',
    type: 'Context',
    kind: 'Reference',
    ...extra,
  });
  const index = (extra: Record<string, unknown>): Record<string, unknown> => ({
    title: 'Index',
    description: 'x'.repeat(60),
    updated: '2026-10-18T09:30:00Z',
    doc_status: 'active',
    kind: 'Hub',
    ...extra,
  });

  // [name, relPath, data, reject, warning needle (null = no warning at all)]
  const ROWS: [string, string, Record<string, unknown>, boolean, string | null][] = [
    ['UTC updated', 'context/x.md', page({}), false, null],
    ['UTC updated with fraction', 'context/x.md', page({ updated: '2026-10-18T09:30:00.123Z' }), false, null],
    ['updated already parsed to a Date by YAML', 'context/x.md', page({ updated: new Date('2026-10-18T09:30:00Z') }), false, null],
    ['date-only updated', 'context/x.md', page({ updated: '2026-10-18' }), false, 'date-only'],
    // Orchestrator ruling (ADR-0059): a non-Z offset is a valid instant, with a sanity warning.
    ['non-Z offset updated', 'context/x.md', page({ updated: '2026-10-18T09:30:00+02:00' }), false, 'Z'],
    ['garbage updated', 'context/x.md', page({ updated: 'not-a-date' }), true, null],
    // NFR-004: every instant form that built on 0.2.x (z.coerce.date) keeps building.
    ['zoneless date-time updated (read as UTC)', 'context/x.md', page({ updated: '2024-05-01T10:00:00' }), false, 'no zone'],
    ['compact +HHMM offset updated', 'context/x.md', page({ updated: '2024-05-01T10:00:00+0200' }), false, 'not UTC'],
    ['short +HH offset updated', 'context/x.md', page({ updated: '2024-05-01T10:00:00+02' }), false, 'not UTC'],
    ['time without seconds updated', 'context/x.md', page({ updated: '2024-05-01T10:00Z' }), false, null],
    ['non-ISO updated that Date parses', 'context/x.md', page({ updated: 'May 1, 2024' }), false, 'not ISO'],
    ['out-of-range offset updated (Date rejects it too)', 'context/x.md', page({ updated: '2024-05-01T10:00:00+25:99' }), true, null],
    ['zoneless stale_after', 'context/x.md', page({ stale_after: '2027-01-01T00:00:00' }), false, 'no zone'],
    ['email author', 'context/x.md', page({ authors: ['jane@example.com'] }), false, 'human:jane'],
    ['human actor author', 'context/x.md', page({ authors: ['human:jane'] }), false, null],
    ['tool actor author', 'context/x.md', page({ authors: ['doc-kitty-gherkin/0.3.0'] }), false, null],
    ['process actor author', 'context/x.md', page({ authors: ['process:ci'] }), false, null],
    ['root index okf_version "0.2"', 'README.md', index({ okf_version: '0.2' }), false, null],
    ['root index okf_version 0.2 unquoted', 'README.md', index({ okf_version: 0.2 }), false, 'okf_version'],
    ['root index okf_version "0.1"', 'README.md', index({ okf_version: '0.1' }), false, 'okf_version'],
    ['section index missing okf_version', 'context/README.md', index({}), false, 'okf_version'],
    ['bare-mapping verified', 'context/x.md', page({ verified: { by: 'human:jane', at: '2026-10-18T00:00:00Z' } }), false, null],
    ['list verified', 'context/x.md', page({ verified: [{ by: 'human:jane', at: '2026-10-18T00:00:00Z' }] }), false, null],
    ['UTC stale_after', 'context/x.md', page({ stale_after: '2027-01-01T00:00:00Z' }), false, null],
    ['date-only stale_after', 'context/x.md', page({ stale_after: '2027-01-01' }), false, null],
    ['generated with content_hash', 'context/x.md', page({ generated: { by: 'doc-kitty-gherkin/0.3.0', at: '2026-10-18T09:30:00Z', content_hash: 'sha256:0123456789ab' } }), false, null],
    ['generated.at already a Date', 'context/x.md', page({ generated: { by: 'doc-kitty-gherkin/0.3.0', at: new Date('2026-10-18T09:30:00Z') } }), false, null],
  ];

  for (const [name, relPath, data, reject, needle] of ROWS) {
    it(`${name}: both twins agree (${reject ? 'reject' : 'accept'}); warning ${needle ? `contains "${needle}"` : 'none'}`, () => {
      expect(buildRejects(data)).toBe(reject);
      expect(validatorRejects(relPath, data)).toBe(reject);
      if (reject) return;
      const { warnings } = validate(relPath, data);
      if (needle === null) expect(warnings).toEqual([]);
      else expect(warnings.join('\n')).toContain(needle);
    });
  }

  it('the Zod twin normalises bare `verified` to a list and a Date `at` to a string', () => {
    const parsed = buildSchema.parse(
      page({ verified: { by: 'human:jane', at: new Date('2026-10-18T00:00:00Z') } }),
    );
    expect(parsed.verified).toEqual([{ by: 'human:jane', at: '2026-10-18T00:00:00Z' }]);
  });
});

describe('vocabulary-core metadata rules (#177, C-009)', () => {
  it('parseActor/isActor recognise the three actor forms and flag emails separately', () => {
    expect(parseActor('human:jane')).toEqual({ kind: 'human', id: 'jane' });
    expect(parseActor('process:ci')).toEqual({ kind: 'process', id: 'ci' });
    expect(parseActor('doc-kitty-gherkin/0.3.0')).toEqual({
      kind: 'tool',
      name: 'doc-kitty-gherkin',
      version: '0.3.0',
    });
    expect(parseActor('jane@example.com')?.kind).toBe('email');
    expect(isActor('jane@example.com')).toBe(false);
    expect(isActor('human:jane')).toBe(true);
    for (const bad of ['', 'human:', 'human:a b', 'Tool/1', 'jane', 'tool/', 42, null]) {
      expect(parseActor(bad as string)).toBeNull();
    }
  });

  it('normaliseInstant: Z / fraction / date-only (midnight UTC, dateOnly) / offset / invalid', () => {
    expect(normaliseInstant('2026-10-18T09:30:00Z')).toMatchObject({ dateOnly: false });
    expect(normaliseInstant('2026-10-18T09:30:00.123Z')?.date.getUTCMilliseconds()).toBe(123);
    const d = normaliseInstant('2026-10-18');
    expect(d?.dateOnly).toBe(true);
    expect(d?.date.toISOString()).toBe('2026-10-18T00:00:00.000Z');
    expect(normaliseInstant('2026-10-18T09:30:00+02:00')?.date.toISOString()).toBe('2026-10-18T07:30:00.000Z');
    expect(normaliseInstant(new Date('2026-10-18T09:30:00Z'))?.dateOnly).toBe(false);
    for (const bad of ['', 'not-a-date', '2026-13-01', '2024-05-01T10:00:00+25:99', '2024-05-01T10:00:00+02:60', null, undefined]) {
      expect(normaliseInstant(bad as string)).toBeNull();
    }
  });

  it('normaliseInstant keeps main\'s accept-set (NFR-004): zoneless, compact offsets, no seconds, anything Date parses', () => {
    expect(normaliseInstant('2024-05-01T10:00:00')).toMatchObject({ noZone: true, nonIso: false });
    expect(normaliseInstant('2024-05-01T10:00:00')?.date.toISOString()).toBe('2024-05-01T10:00:00.000Z');
    expect(normaliseInstant('2024-05-01T10:00:00+0200')?.date.toISOString()).toBe('2024-05-01T08:00:00.000Z');
    expect(normaliseInstant('2024-05-01T10:00:00-02')?.date.toISOString()).toBe('2024-05-01T12:00:00.000Z');
    expect(normaliseInstant('2024-05-01T10:00:00+0200')).toMatchObject({ nonUtc: true });
    expect(normaliseInstant('2024-05-01T10:00Z')).toMatchObject({ noZone: false, nonIso: false });
    expect(normaliseInstant('2024-05-01T10:00Z')?.date.toISOString()).toBe('2024-05-01T10:00:00.000Z');
    expect(normaliseInstant('May 1, 2024')).toMatchObject({ nonIso: true });
    // An ISO-shaped date that is not on the calendar still builds (rolled over), but is flagged as such, not as non-ISO.
    expect(normaliseInstant('2026-02-30')).toMatchObject({ rolledOver: true, nonIso: false });
    expect(normaliseInstant('2026-02-30')?.date.toISOString()).toBe('2026-03-02T00:00:00.000Z');
    expect(normaliseInstant('2026-02-28')).toMatchObject({ rolledOver: false });
  });
});

describe('generator-stamp (#177, FR-008, C-004)', () => {
  const NOW = new Date('2026-10-18T09:30:00.456Z');

  it('toolkitVersion() is the published src/package.json version', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(toolkitVersion()).toBe(pkg.version);
  });

  it('makeStamp: versioned producer, 12-hex content hash, whole-second UTC `at`', () => {
    const stamp = makeStamp({ producer: 'doc-kitty-gherkin', hash: 'a'.repeat(64), now: NOW });
    expect(stamp).toEqual({
      by: `doc-kitty-gherkin/${toolkitVersion()}`,
      at: '2026-10-18T09:30:00Z',
      content_hash: `sha256:${'a'.repeat(12)}`,
    });
  });

  it('makeStamp keeps `at` while the content hash is unchanged (even across a version bump), moves it when it changes', () => {
    const previous = { by: 'doc-kitty-gherkin/0.0.1', at: '2026-01-01T00:00:00Z', content_hash: `sha256:${'a'.repeat(12)}` };
    expect(makeStamp({ producer: 'doc-kitty-gherkin', hash: 'a'.repeat(64), previous, now: NOW }).at).toBe(
      '2026-01-01T00:00:00Z',
    );
    expect(makeStamp({ producer: 'doc-kitty-gherkin', hash: 'b'.repeat(64), previous, now: NOW }).at).toBe(
      '2026-10-18T09:30:00Z',
    );
  });
});

// NFR-004 proof that survives the migration of our own trees: a frozen tree of
// OLD-form pages, so "exit 0 + advisories" is asserted here and not by running
// the gate on the (soon clean) live docs.
describe('NFR-004 — old-forms tree: advisories only, exit code 0, Zod twin parses every page', () => {
  const oldRoot = fileURLToPath(new URL('old-forms/', fixturesUrl));

  it('the CLI exits 0 and prints every advisory warning', () => {
    const res = spawnSync('node', [validatorPath, oldRoot], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    const out = `${res.stdout}${res.stderr}`;
    expect(out).toContain('is date-only');
    expect(out).toContain('human:jane');
    expect(out).toContain('index file is missing `okf_version`');
    expect(out).toContain('has no zone');
    expect(out).toContain('is not UTC');
    expect(out).toContain('is not ISO-8601');
    expect(out).toMatch(/okf_version: 0\.2` is not the string "0\.2"/);
    expect(out).toContain('old-forms/README.md'); // each warning names its file
  });

  it('the Zod twin parses every page of the tree', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.md') ? [`${dir}/${e.name}`] : [],
      );
    const files = walk(oldRoot);
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      const data = matter(readFileSync(f, 'utf8')).data;
      expect(buildSchema.safeParse(data).success, f).toBe(true);
    }
  });
});
