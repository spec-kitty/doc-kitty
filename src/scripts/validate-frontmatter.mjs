#!/usr/bin/env node
/**
 * Validate a Common Docs — Kitty Variation tree without a full Astro build.
 * Fast enough for a CI gate.
 *
 * Usage:
 *   node src/scripts/validate-frontmatter.mjs [<root> ...]   # default: docs
 *
 * Accepts one OR MORE roots and validates every `.md`/`.mdx` under each, so the
 * same gate covers both `docs/` (the toolkit's own docs) and `example/docs/`
 * (the deliverable site) — a schema/validator change can invalidate either tree.
 *
 * The frontmatter contract is the one declared in `src/lib/schema.ts`
 * (velvet-tiger/common-docs v1.2 + Kitty twists, finalized in ADR-0009): the
 * field shape is validated with the same `zod` primitives the toolkit schema
 * uses (re-derived here as a plain `z.object`, because `schema.ts` pulls
 * Astro/Starlight and cannot run in bare Node), and `gray-matter` parses the
 * frontmatter — no re-implementation of the field contract in ad-hoc string
 * checks. Path-aware rules that `schema.ts` documents but leaves to this
 * standalone gate (strict `doc_status`/`kind` presence, `type` presence by path,
 * `type` agreement against the section-default derived from the `sections.yaml`
 * registry, bundle-root README exemptions) are applied on top. The section
 * default now comes from `<root>/_meta/sections.yaml` (issue #24) — see
 * `loadSectionTypes`/`expectedType` — with the short sub-path subtype table kept
 * in code; a registry-less tree falls back to the frozen section-type map.
 *
 *   - README.md is the section index and (Kitty twist) carries frontmatter.
 *   - The bundle-root README.md is exempt from `type` and may carry okf_version,
 *     but still requires `doc_status` and `kind`.
 *   - log.md is a reserved, frontmatter-free change log — skipped.
 *
 * This module is importable (for the schema/validator parity test): the field
 * schema, the path rules, and the canonical vocabularies are exported, and the
 * CLI runner only executes when the file is invoked directly.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { z } from 'zod';
// Single source of truth (#49 IC-02): the canonical vocabulary sets, the
// section→type derivation, the vocabulary resolver, and the index-basename
// detection all live in the fs-free `vocabulary-core.mjs`; the filesystem
// readers (`loadVocabulary`, `loadSectionRegistry` + the lenient `sectionTypes`/
// `sectionSubtypes`) live in `vocabulary-loader.mjs`. This gate imports them and
// keeps NO hand-mirrored twin — the ~700-line duplicate this file used to carry
// is gone; its logic is imported, byte-for-byte, from the one core.
import {
  STATUSES,
  DOC_TYPES,
  KINDS,
  SECTION_TYPE,
  CANONICAL_REQUIRED,
  REQUIRED_FIELD_FLOOR,
  expectedDocType,
  isIndexPath,
  isRootIndex,
  detectIndexCollisions,
  identityVocabulary,
  parseVocabulary,
} from '../lib/vocabulary-core.mjs';
import {
  loadVocabulary,
  loadSectionRegistry,
  sectionTypes,
  sectionSubtypes,
  resolveGovernance,
} from '../lib/vocabulary-loader.mjs';

// Re-exported so existing importers keep their `validate-frontmatter.mjs` path
// while the definitions stay single-sourced in the core (NFR-001):
//   - `STATUSES` → assert-chrome-artifacts.mjs's `DOC_STATUS_LABELS`;
//   - `expectedType` (the core's `expectedDocType`, aliased) → section-type-parity
//     / deck-validator / section-rename tests, kept until WP03 rewrites them (F12);
//   - `SECTION_TYPE`/`DOC_TYPES`/`KINDS`/`parseVocabulary`/`loadVocabulary`/the
//     index-basename helpers → the parity + example-adopter test suites.
export {
  STATUSES,
  DOC_TYPES,
  KINDS,
  SECTION_TYPE,
  isIndexPath,
  isRootIndex,
  detectIndexCollisions,
  parseVocabulary,
  loadVocabulary,
};
export { expectedDocType as expectedType };

/**
 * FR-002/C-001: the default is `README` ONLY — byte-identical to today (NFR-003).
 * Kept as the gate's own `['README']` array form (the core's default is the
 * equivalent `'README'` string; `normalizeIndexBasenames` treats them
 * identically) because `index-basename.test.ts` pins this export to `['README']`.
 */
export const DEFAULT_INDEX_BASENAME = ['README'];

/** The shipped-default identity resolver (no aliases/forbidden) — `Feature` valid. */
export const IDENTITY_VOCAB = identityVocabulary();

// Convention (docs/architecture/metadata-model.md): description is 50–180 chars.
// The upper bound is enforced as an error (a bounded description is the CI
// guardrail that matters); the lower bound is a non-fatal warning so short-but-
// clear one-liners are not padded just to satisfy a counter.
export const DESCRIPTION_MAX = 180;
export const DESCRIPTION_SOFT_MIN = 50;

const stamp = z.object({ by: z.string(), at: z.string() });

// A `related` entry: a bare slug or `{ ref, note? }` (ADR-0009). Ref integrity
// is check-links.mjs's job; this only shapes the entries. An object without
// `ref` fails both arms of the union — a real error.
const relatedRef = z.union([
  z.string(),
  z.object({ ref: z.string(), note: z.string().optional() }),
]);

const externalReference = z.union([
  z.object({ url: z.string(), title: z.string(), note: z.string().optional() }),
  z.object({ type: z.string(), id: z.string() }),
]);

// Field contract, re-derived from `docKittyFields` in src/lib/schema.ts using
// the same zod primitives. This gate owns strict PRESENCE (schema.ts's own
// comment delegates to it), but presence is no longer baked into the zod SHAPE:
// the charter's required-field policy (C-005/FR-006) can relax any canonical
// field EXCEPT the `title` floor, so requiredness is enforced imperatively in
// `validate()` against the resolved `requiredFields` set instead. This schema
// therefore validates SHAPE ONLY (a present field's type/bounds); the four
// canonical-required fields are `.optional()` here and their presence is checked
// against the policy below. `.passthrough()` tolerates forward-compatible keys.
//
// `doc_status` is likewise an OPEN string here (charter-aware, extend-only,
// C-004/FR-005): the LEGAL set is `resolveGovernance(docsRoot).legalStatuses`
// (canonical ∪ charter-added), consulted in `validate()` where a value outside
// it WARNS (parity with `kind`), never fails. The former `z.enum(STATUSES)`
// hard-rejected any added or unknown status — replaced to keep the warn-not-fail
// posture and let a charter extend the lifecycle (mirrors schema.ts's twin).
export const frontmatterSchema = z
  .object({
    title: z.string().min(1, 'must be a non-empty string').optional(),
    description: z
      .string()
      .min(1, 'must be a non-empty string')
      .max(DESCRIPTION_MAX, `must be at most ${DESCRIPTION_MAX} characters`)
      .optional(),
    doc_status: z.string().min(1, 'must be a non-empty string').optional(),
    updated: z.coerce.date().optional(),
    // Open vocabulary: an unknown `type` is an advisory warning (below), not a
    // schema error — matching the site schema's graceful-degradation posture
    // (ADR-0004, metadata-model.md).
    type: z.string().optional(),
    // `kind` is OPTIONAL (#38 / FR-002): an adopter is not forced to add a second
    // required field corpus-wide, matching the already-lenient site schema. When
    // present it must still be a non-empty string; when absent it is accepted (no
    // derivation source exists for `kind`).
    kind: z.string().min(1, 'must be a non-empty string').optional(),
    okf_version: z.string().optional(),
    authors: z.array(z.string()).optional(),
    related: z.array(relatedRef).optional(),
    external_references: z.array(externalReference).optional(),
    audience: z
      .array(z.object({ profile: z.string(), guidance_text: z.string() }))
      .optional(),
    moscow: z
      .object({
        level: z.enum(['Must', 'Should', 'Could', "Won't"]),
        rationale: z.string(),
      })
      .optional(),
    hero_image: z.object({ src: z.string(), alt: z.string() }).optional(),
    social_thumb: z
      .union([z.object({ src: z.string(), alt: z.string() }), z.string()])
      .optional(),
    tags: z.array(z.string()).optional(),
    resource: z.string().optional(),
    generated: stamp.optional(),
    verified: z.array(stamp).optional(),
    sources: z
      .array(z.object({ resource: z.string(), title: z.string() }))
      .optional(),
    stale_after: z.coerce.date().optional(),
    // Glossary page-local fields (ADR-0028, M4) — mirrored from `docKittyFields`
    // so the standalone gate and the site schema stay in parity. Both optional
    // and additive: a page with neither validates exactly as before (NFR-002).
    glossary_context: z.string().optional(),
    glossary_autolink: z.boolean().optional(),
    agent: z
      .object({
        discoverable: z.boolean().optional(),
        priority: z.number().min(0).max(1).optional(),
        keywords: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .passthrough();

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.mdx?$/i.test(name)) out.push(full);
  }
  return out;
}

// `SECTION_TYPE` (the frozen fallback map) and `expectedType` (the core's
// `expectedDocType`, aliased) are imported + re-exported at the top of this file:
// there is no twin here any more, so the bare-Node gate and the Astro-side
// toolkit derive `type` from the ONE core (NFR-001). Behavior is unchanged
// (DISCIPLINED_REFACTORING) — the deleted copies were byte-identical.

/**
 * Read `<docsRoot>/_meta/sections.yaml` and return its `id → type` map, or
 * `null` when no registry is present (graceful fallback). Delegates to the shared
 * LENIENT filesystem reader `loadSectionRegistry` (`vocabulary-loader.mjs`), which
 * reproduces this gate's original skip-malformed / null-on-non-array posture, then
 * projects it with `sectionTypes`. The `try/catch → null` preserves the gate's
 * prior graceful fallback on an unreadable/unparseable registry (the strict,
 * fail-loud authored-registry validation lives in `sections.ts`, on the build
 * path). Only entries that declare a string `type` appear. Signature unchanged
 * (`example-adopter.test.ts` imports it).
 */
export function loadSectionTypes(docsRoot) {
  let registry;
  try {
    registry = loadSectionRegistry(docsRoot);
  } catch {
    return null; // unreadable/unparseable registry → graceful fallback (as before)
  }
  return registry ? sectionTypes(registry) : null;
}

/**
 * Read `<docsRoot>/_meta/sections.yaml` and return its `id → subtypes[]` map, or
 * `null` when no registry is present. The subtypes twin of {@link loadSectionTypes}
 * (E-02, FR-005, D-03), delegating to the same shared lenient reader.
 */
export function loadSectionSubtypes(docsRoot) {
  let registry;
  try {
    registry = loadSectionRegistry(docsRoot);
  } catch {
    return null;
  }
  return registry ? sectionSubtypes(registry) : null;
}

// The vocabulary resolver (`makeAxisResolver`/`parseVocabulary`/`loadVocabulary`)
// and `IDENTITY_VOCAB` are single-sourced in `vocabulary-core.mjs` /
// `vocabulary-loader.mjs` and imported/re-exported at the top — the hand-mirrored
// twin this file used to carry (and the NFR-004 parity test that guarded it) is
// retired now that both sides resolve through the one implementation.

/**
 * Validate one file's parsed frontmatter.
 *
 * `typesBySection` is the registry-derived section-default `type` map (issue #24)
 * used to derive the expected `type`; it defaults to the frozen
 * {@link SECTION_TYPE} so a caller with no registry (and the parity test, which
 * calls `validate(relPath, data)`) still validates against the section defaults.
 *
 * `vocab` is the vocabulary override resolver (#40); it defaults to
 * {@link IDENTITY_VOCAB} so a caller with no `_meta/vocabulary.yaml` (and the
 * existing tests) behaves exactly as before. The resolver is applied to the
 * EFFECTIVE `type` — whether authored or section-derived — in the contract order
 * derive-if-absent → resolve (alias then forbidden) → validate.
 *
 * `options.indexBasename` is the configured section-index basename(s)
 * (FR-001/FR-002/D-01/D-02); defaults to `DEFAULT_INDEX_BASENAME` (`README`
 * only), so the root-index exemption below is byte-identical to today
 * (NFR-003). `options.subtypesBySection` is the registry `id → subtypes[]` map
 * (E-02/FR-005/D-03), consulted by `expectedType` ahead of the built-in
 * sub-path table. `options.knownSectionIds` is the FULL registered-id set
 * (US2-AS5) — when supplied (a real registry was loaded) and the page's
 * section is not in it, a warning is surfaced naming the unregistered id.
 *
 * `options.legalStatuses` is the resolved legal `doc_status` set (canonical ∪
 * charter-added, C-004/FR-005); a value outside it WARNS, never fails.
 * `options.requiredFields` is the resolved required-field set (C-005/FR-006); a
 * missing member is a hard problem, and the `title` floor is always required.
 * Both default to the shipped canonical behavior, so `validate(relPath, data)`
 * (the parity tests' 2-arg form) enforces exactly the pre-charter contract
 * except that an unknown status now warns instead of failing.
 *
 * @returns {{problems: string[], warnings: string[], effective: string | null | undefined}}
 *   `effective` is the resolved effective `type`: a string, `null` for a
 *   deterministically-untyped page (orphan/root with no derivation), or
 *   `undefined` for a `type`-exempt page (bundle-root index / generated glossary).
 */
export function validate(
  relPath,
  data,
  typesBySection = SECTION_TYPE,
  vocab = IDENTITY_VOCAB,
  options = {},
) {
  const {
    indexBasename = DEFAULT_INDEX_BASENAME,
    subtypesBySection,
    knownSectionIds,
    // Charter-resolved enforcement policy (WP03/IC-03). Both default to the
    // shipped canonical behavior so every existing caller (and the parity tests
    // that call `validate(relPath, data)`) validates exactly as before:
    //   • `legalStatuses` — the legal `doc_status` set (canonical ∪ charter-added,
    //     C-004/FR-005); a value outside it WARNS, never fails (parity with `kind`).
    //   • `requiredFields` — the required-field set (C-005/FR-006). The charter may
    //     relax any canonical field EXCEPT the `title` floor (always enforced).
    legalStatuses = STATUSES,
    requiredFields = CANONICAL_REQUIRED,
  } = options;
  const problems = [];
  const warnings = [];
  const isRootReadme = isRootIndex(relPath, indexBasename);

  // Generated glossary pages (M4, ADR-0026): the codegen writes real Markdown
  // under `<docs>/glossary/**` — the hub (`kind: Hub`) and one page per context
  // (`kind: Glossary`). They are MACHINE-GENERATED reference pages that carry the
  // minimal ADR-0026 frontmatter (title/description/kind/doc_status[/glossary_context])
  // and, deliberately, no authored `updated` timestamp or path-`type` — a fabricated
  // date would break the deterministic, byte-identical re-generation the mission
  // pins (NFR-004). So they are exempt from the authored-metadata presence rules
  // here, exactly as the bundle-root README and `log.md` are exempt above. This is
  // the standalone gate's job (the build schema is already lenient on both fields);
  // note the boundary is the `glossary/` segment, so the AUTHORED `glossary-demo/`
  // pages are held to the full contract.
  const isGeneratedGlossary =
    relPath.split('/')[0] === 'glossary' &&
    (data.kind === 'Glossary' || data.kind === 'Hub');

  const result = frontmatterSchema.safeParse(data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      // Generated glossary pages carry no `updated` by design — skip that issue.
      if (isGeneratedGlossary && issue.path[0] === 'updated') continue;
      const where = issue.path.length ? `\`${issue.path.join('.')}\`: ` : '';
      problems.push(`${where}${issue.message}`);
    }
  }

  // Required-field PRESENCE (C-005/FR-006). The zod shape above validates a
  // present field; requiredness is charter-tunable and therefore enforced here
  // against the resolved `requiredFields` set, unioned with the immovable
  // `title` floor (a charter can never relax it — WP01's `parseRequiredFields`
  // rejects that at parse time, but the union is a defence in depth here too).
  // Exemptions match the pre-charter gate exactly: the generated glossary pages
  // carry no authored `updated` (a fabricated date would break byte-identical
  // re-generation), so `updated` is not required of them; the bundle-root README
  // is `type`-exempt (handled below) but keeps its other required fields.
  const requiredSet = new Set([...requiredFields, ...REQUIRED_FIELD_FLOOR]);
  for (const field of requiredSet) {
    if (isGeneratedGlossary && field === 'updated') continue;
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      problems.push(`\`${field}\`: required`);
    }
  }

  // `doc_status` legality (C-004/FR-005): a value outside the resolved legal set
  // (canonical ∪ charter-added) is an advisory WARNING — parity with the open
  // `kind` axis below — never a hard failure. The former `z.enum(STATUSES)`
  // hard-rejected it; the warn-not-fail posture (spec C-001) is retained.
  if (
    typeof data.doc_status === 'string' &&
    data.doc_status.length > 0 &&
    !legalStatuses.includes(data.doc_status)
  ) {
    warnings.push(
      `\`doc_status: ${data.doc_status}\` is not in the legal set (${legalStatuses.join(', ')})`,
    );
  }

  // Path-aware `type` rules (schema.ts documents but leaves them to this gate),
  // now OPTIONAL + section-DERIVED + vocabulary-OVERRIDABLE (#38/#40). Contract
  // order: derive-if-absent → resolve (alias then forbidden) → validate.
  //   • `type` is optional. Absent → derive from the section registry (fills ONLY
  //     the absent case). Authored → the authored value wins.
  //   • The vocabulary override (#40) resolves the EFFECTIVE value — authored OR
  //     derived — so a forbidden term fails and an aliased term is neutralized on
  //     both paths (FR-004/FR-005).
  //   • A mismatch between an authored `type` and the derived expectation stays an
  //     ADVISORY `warnings[]` entry (authored wins, FR-003), never a hard problem.
  //   • When derivation yields nothing (root/orphan, no registered section), the
  //     page is accepted as deterministically UNTYPED (`effective === null`) — no
  //     crash, no fabricated type (US1 AS-3; documented in ADR-0004).
  //
  // `effective` is the resolved effective `type`; it stays `undefined` for a
  // `type`-exempt page (bundle-root README / generated glossary).
  let effective;
  if (isRootReadme || isGeneratedGlossary) {
    // Generated glossary pages carry no path-`type` (no authored section); the
    // bundle-root README is exempt from `type` too. Neither warns on its absence.
    if (isRootReadme && 'type' in data) {
      warnings.push('bundle-root README should not carry `type`');
    }
  } else {
    // US2-AS5: a real registry was supplied (`knownSectionIds`) but this
    // page's section isn't registered at all — the documented "renamed to an
    // unregistered id" condition, surfaced as a warning (never a silent
    // mis-type, never a hard failure). Distinct from the ordinary orphan case
    // (no registry at all / a registry-less frozen fallback), which stays
    // silent, matching AS-3.
    const section = relPath.split('/')[0];
    if (knownSectionIds && !knownSectionIds.has(section)) {
      warnings.push(
        `section "${section}" (from "${relPath}") is not registered in sections.yaml — ` +
          `falling back to the documented default (untyped); if this is a renamed section, ` +
          `add a registry entry for "${section}"`,
      );
    }
    const authored = 'type' in data ? data.type : undefined;
    const derived = expectedDocType(relPath, typesBySection, subtypesBySection); // may be null (orphan)
    // The effective source: authored wins, else the derived value (null → untyped).
    const source = authored !== undefined ? authored : derived ?? undefined;
    const resolved = vocab.resolveType(source);
    effective = resolved.effective ?? null;

    if (resolved.forbidden) {
      // Forbidden by the vocabulary override — a hard problem naming the override
      // and, when an alias supplies one, the allowed replacement (FR-005).
      const raw = resolved.aliasedFrom ?? source;
      const replacement = resolved.effective ? ` — use \`${resolved.effective}\` instead` : '';
      problems.push(`\`type: ${raw}\` is forbidden by the vocabulary override${replacement}`);
    } else if (authored !== undefined) {
      // An authored value present: canonical-set + mismatch-vs-derived advisories,
      // computed on the RESOLVED values so the override is honored on both sides.
      const effAuthored = resolved.effective;
      if (effAuthored !== undefined && !DOC_TYPES.includes(effAuthored)) {
        // Open vocabulary: an unknown `type` degrades to an advisory warning.
        warnings.push(`\`type: ${effAuthored}\` is not in the canonical set (${DOC_TYPES.join(', ')})`);
      } else if (derived != null) {
        const effDerived = vocab.resolveType(derived).effective;
        if (effAuthored !== effDerived) {
          warnings.push(`\`type: ${effAuthored}\` but path suggests \`${effDerived}\``);
        }
      }
    }
    // Authored absent: the derived (or null) value is accepted silently — no
    // "missing required `type`" problem (the #38 relaxation).
  }

  // `kind` is required (enforced by the schema above); an unknown value is a
  // non-fatal, observably-printed warning (open vocabulary, ADR-0009).
  if (typeof data.kind === 'string' && data.kind.length > 0 && !KINDS.includes(data.kind)) {
    warnings.push(`\`kind: ${data.kind}\` is not in the canonical set (${KINDS.join(', ')})`);
  }

  // FR-022 / ADR-0021 D1: a `kind: Presentation` page MUST live under
  // `presentations/`. This is the path+kind invariant the out-of-frame deck
  // route override depends on — a `Presentation` filed anywhere else would be a
  // silent in-frame render (the route only shadows `/presentations/*`), so it is
  // a BLOCKING error, not a warning. The check keys off the first path segment,
  // mirroring `sectionOf`; the bundle-root README (no slash) can never match.
  if (data.kind === 'Presentation' && relPath.split('/')[0] !== 'presentations') {
    problems.push(
      '`kind: Presentation` must live under `presentations/` (ADR-0021 path+kind invariant, FR-022)',
    );
  }

  // Kind-aware requiredness for `kind: Persona` (ADR-0019). The build zod schema
  // stays lenient — these three persona-attribute fields are optional there — so
  // requiredness lives HERE, the one place that already owns contextual presence
  // rules (parity discipline, mirroring the strict `type`/`doc_status` handling
  // above). `role` is a non-empty string; `goals`/`responsibilities` are non-empty
  // string arrays. Enforced regardless of `doc_status`, so a draft persona is held
  // to the same identity contract as a published one.
  if (data.kind === 'Persona') {
    if (typeof data.role !== 'string' || data.role.trim().length === 0) {
      problems.push('`role`: persona requires a non-empty string');
    }
    for (const field of ['goals', 'responsibilities']) {
      const value = data[field];
      if (
        !Array.isArray(value) ||
        value.length === 0 ||
        !value.every((item) => typeof item === 'string' && item.trim().length > 0)
      ) {
        problems.push(`\`${field}\`: persona requires a non-empty list of non-empty strings`);
      }
    }
  }

  // Soft lower bound on description length (non-fatal).
  if (typeof data.description === 'string') {
    const len = data.description.trim().length;
    if (len > 0 && len < DESCRIPTION_SOFT_MIN) {
      warnings.push(
        `description is ${len} chars; convention suggests ${DESCRIPTION_SOFT_MIN}–${DESCRIPTION_MAX}`,
      );
    }
  }

  return { problems, warnings, effective };
}

/**
 * Parse `--index-basename README,index` off argv into the option shape
 * `validate()`/`isRootIndex` accept, plus the remaining positional roots.
 * Absent → `undefined` (validate()'s own default, `README` only — NFR-003).
 */
function parseCliArgs(argv) {
  const args = argv.slice(2);
  const flagIdx = args.indexOf('--index-basename');
  let indexBasename;
  let roots = args;
  if (flagIdx !== -1) {
    const value = args[flagIdx + 1];
    indexBasename = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    roots = [...args.slice(0, flagIdx), ...args.slice(flagIdx + 2)];
  }
  return { roots, indexBasename };
}

/** CLI entry point: validate every `.md`/`.mdx` under each given root. */
export function run(argv) {
  const { roots: parsedRoots, indexBasename } = parseCliArgs(argv);
  const roots = parsedRoots.length === 0 ? ['docs'] : parsedRoots;

  let failures = 0;
  let warned = 0;
  let total = 0;

  for (const root of roots) {
    let files;
    try {
      files = walk(root);
    } catch (err) {
      console.error(`✖ cannot read docs dir "${root}": ${err.message}`);
      process.exit(2);
    }
    total += files.length;

    // Charter-resolved enforcement policy for THIS root (WP03/IC-03): the legal
    // `doc_status` set (canonical ∪ charter-added) and the required-field policy
    // come from `resolveGovernance`, consuming `<root>/_meta/charter.yaml` (per-
    // axis precedence over the legacy files, WP02). A MALFORMED charter is a HARD
    // gate failure (C-006/FR-010) — never silently ignored, never partially
    // applied — so the throw is caught and reported, and this root is skipped
    // (the run still exits non-zero at the end). `emitDeprecation: false` keeps
    // the gate quiet about legacy-file migration (the build path owns that nudge);
    // the gate's job here is enforcement, not the once-per-build notice.
    let governance;
    try {
      governance = resolveGovernance(root, { emitDeprecation: false });
    } catch (err) {
      console.error(`✖ ${root}: ${err.message}`);
      failures++;
      continue;
    }
    const legalStatuses = governance.legalStatuses;
    const requiredFields = governance.requiredFields.required;

    // Section-default `type` authority for THIS root: the registry when present,
    // else the frozen fallback so a registry-less tree still validates (issue #24).
    const registryTypes = loadSectionTypes(root);
    const typesBySection = registryTypes ?? SECTION_TYPE;
    // Registry `subtypes` (E-02/FR-005) for THIS root — `undefined` when no
    // registry is present.
    const subtypesBySection = loadSectionSubtypes(root) ?? undefined;
    // NOTE (US2-AS5): `validate()`'s `knownSectionIds` option DELIBERATELY is
    // NOT wired into this default CLI run. doc-kitty's own corpus and the
    // example both carry real, LONG-STANDING unregistered top-level folders
    // (`ops`, `glossary-demo`, …) that ADR-0004 explicitly tolerates — this
    // gate cannot distinguish "unregistered by design" from "renamed and
    // forgot to register", so wiring it here would manufacture a false-positive
    // warning on every existing gate run (an NFR-003 regression in spirit, even
    // though it would not fail the gate). The capability is real and tested
    // (`section-rename.test.ts`, `validate()`'s `knownSectionIds` option) for a
    // caller that DOES have that positive signal (e.g. a scoped rename check).
    // Vocabulary override for THIS root (#40): `<root>/_meta/vocabulary.yaml` when
    // present, else the shipped-default identity resolver (`Feature` valid).
    const vocab = loadVocabulary(root);

    const rels = files.map((f) => relative(root, f).split('\\').join('/'));

    // E-05/FR-004: both-index collision — the configured basename wins, the
    // rest are demoted; report every collision as a warning (never silent).
    for (const collision of detectIndexCollisions(rels, indexBasename)) {
      warned++;
      const label = collision.dir === '' ? '(root)' : collision.dir;
      console.warn(
        `⚠ ${root}: both "${collision.winner}" and ${collision.demoted
          .map((d) => `"${d}"`)
          .join(', ')} are section-index candidates in ${label} — "${collision.winner}" wins ` +
          `as the section index; the rest are ordinary pages (E-05).`,
      );
    }

    for (const file of files) {
      const rel = relative(root, file).split('\\').join('/');
      if (/(^|\/)log\.md$/i.test(rel)) continue; // reserved, frontmatter-free

      const raw = readFileSync(file, 'utf8');
      let parsed;
      try {
        parsed = matter(raw);
      } catch (err) {
        console.error(`✖ ${relative('.', file)}: unparseable frontmatter — ${err.message}`);
        failures++;
        continue;
      }
      const { problems, warnings } = validate(rel, parsed.data ?? {}, typesBySection, vocab, {
        indexBasename,
        subtypesBySection,
        legalStatuses,
        requiredFields,
      });
      if (problems.length) {
        failures++;
        console.error(`✖ ${relative('.', file)}`);
        for (const p of problems) console.error(`    - ${p}`);
      }
      for (const w of warnings) {
        warned++;
        console.warn(`⚠ ${relative('.', file)}: ${w}`);
      }
    }
  }

  if (failures) {
    console.error(`\n${failures} file(s) failed validation${warned ? `, ${warned} warning(s)` : ''}.`);
    process.exit(1);
  }
  console.log(
    `✓ ${total} file(s) valid against Common Docs — Kitty Variation across ${roots.length} root(s): ${roots.join(', ')}${warned ? ` (${warned} warning(s))` : ''}.`,
  );
}

// Run the CLI only when invoked directly, so the module can be imported by tests.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run(process.argv);
}
