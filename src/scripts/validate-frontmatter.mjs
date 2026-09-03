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
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import { z } from 'zod';

// Mirrors `STATUSES`/`DOC_TYPES`/`KINDS` in src/lib/schema.ts (kept in sync by
// hand because that TS module imports Astro and cannot be loaded in bare Node;
// parity is enforced by src/tests/schema-validator-parity.test.ts).
export const STATUSES = ['draft', 'active', 'deprecated', 'superseded'];
export const DOC_TYPES = [
  'Context', 'Architecture', 'ADR', 'Template', 'Plan', 'Epic', 'Feature',
  'API', 'Configuration', 'Integration', 'Security', 'Guide', 'Operations',
  'Runbook', 'Migration', 'Changelog', 'Presentation',
];
// The canonical `kind` vocabulary (ADR-0009): four Divio quadrants + structural
// kinds. Open vocabulary — an unknown value warns, it does not fail.
export const KINDS = [
  'Tutorial', 'How-To', 'Reference', 'Explanation',
  'Hub', 'ADR', 'Changelog', 'Glossary', 'Presentation', 'Persona',
  'Planning', 'Feature', 'User-Journey',
];

// ---------------------------------------------------------------------------
// Index-basename detection (D-02) — the bare-Node twin of `readmeToIndexId` /
// `resolveIndexEntries` in `src/lib/metadata.ts`. The TS module cannot load in
// bare Node, so the detection + collision logic is hand-mirrored here (same
// discipline as the SECTION_TYPE mirror above); the parity test pins the two
// to identical output for identical input (D-06).
// ---------------------------------------------------------------------------

/** FR-002/C-001: the default is `README` ONLY — byte-identical to today (NFR-003). */
export const DEFAULT_INDEX_BASENAME = ['README'];

function normalizeIndexBasenames(indexBasename) {
  const list =
    indexBasename === undefined
      ? DEFAULT_INDEX_BASENAME
      : Array.isArray(indexBasename)
        ? indexBasename
        : [indexBasename];
  return list.length > 0 ? list : DEFAULT_INDEX_BASENAME;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function indexBasenamePattern(basenames) {
  return new RegExp(`(^|/)(${basenames.map(escapeRegExp).join('|')})$`, 'i');
}

/** Does `relPath` (ext included) name a configured section-index candidate? */
export function isIndexPath(relPath, indexBasename = DEFAULT_INDEX_BASENAME) {
  const withoutExt = relPath.replace(/\.mdx?$/i, '');
  return indexBasenamePattern(normalizeIndexBasenames(indexBasename)).test(withoutExt);
}

/**
 * The root-index exemption twin (US1-AS4): is `relPath` a BUNDLE-ROOT index
 * file (no directory segment) under the configured basename(s)? Mirrors the
 * root special-casing `ROOT_ENTRY_ID`/`readmeToIndexId` give the bundle root
 * in `src/lib/metadata.ts`.
 */
export function isRootIndex(relPath, indexBasename = DEFAULT_INDEX_BASENAME) {
  return !relPath.includes('/') && isIndexPath(relPath, indexBasename);
}

/**
 * Both-index collision detection (E-05, FR-004) — the bare-Node twin of
 * `resolveIndexEntries`'s collision half. Given every relPath under a root,
 * groups index-candidates by directory and reports every directory holding
 * MORE THAN ONE configured basename; the EARLIEST-configured basename wins
 * (ties broken by path sort), matching the TS loader's resolution exactly.
 */
export function detectIndexCollisions(relPaths, indexBasename = DEFAULT_INDEX_BASENAME) {
  const basenames = normalizeIndexBasenames(indexBasename);
  const pattern = indexBasenamePattern(basenames);
  const byDir = new Map();
  for (const p of relPaths) {
    const withoutExt = p.replace(/\.mdx?$/i, '');
    if (!pattern.test(withoutExt)) continue;
    const dir = withoutExt.replace(pattern, '$1').replace(/\/$/, '');
    const list = byDir.get(dir) ?? [];
    list.push(p);
    byDir.set(dir, list);
  }
  const rank = (f) => {
    const base = f.replace(/\.mdx?$/i, '').split('/').pop() ?? '';
    const idx = basenames.findIndex((b) => b.toLowerCase() === base.toLowerCase());
    return idx === -1 ? basenames.length : idx;
  };
  const collisions = [];
  for (const [dir, files] of byDir) {
    if (files.length <= 1) continue;
    const sorted = [...files].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    collisions.push({ dir, winner: sorted[0], demoted: sorted.slice(1) });
  }
  return collisions;
}

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
// the same zod primitives. Unlike the lenient site schema (which defaults
// `doc_status` and leaves `updated`/`type`/`kind` optional so partial stubs
// still build), this standalone gate enforces strict presence — as schema.ts's
// own comment delegates to it. `.passthrough()` tolerates forward-compatible
// extra keys.
export const frontmatterSchema = z
  .object({
    title: z.string().min(1, 'must be a non-empty string'),
    description: z
      .string()
      .min(1, 'must be a non-empty string')
      .max(DESCRIPTION_MAX, `must be at most ${DESCRIPTION_MAX} characters`),
    doc_status: z.enum(STATUSES),
    updated: z.coerce.date(),
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

// Frozen fallback `section → type` map, used when no `sections.yaml` registry is
// present (a registry-less tree still derives an expected `type`). MIRRORS the
// section defaults the registry carries and `SECTION_TYPE` in src/lib/metadata.ts
// — kept in sync by hand because that TS module cannot load in bare Node (same
// discipline as the zod-shape mirror above). When a registry IS present, its
// derived map is the authority and this is not consulted (issue #24).
export const SECTION_TYPE = {
  context: 'Context',
  architecture: 'Architecture',
  adr: 'ADR',
  plans: 'Plan',
  api: 'API',
  configuration: 'Configuration',
  integrations: 'Integration',
  security: 'Security',
  guides: 'Guide',
  operations: 'Operations',
  migrations: 'Migration',
  changelog: 'Changelog',
  presentations: 'Presentation',
};

/**
 * Read `<docsRoot>/_meta/sections.yaml` and return its `id → type` map, or
 * `null` when no registry is present (graceful fallback). Uses the SAME
 * gray-matter wrap-in-fences trick `src/lib/sections.ts` and `validate-catalog.mjs`
 * use to parse a top-level YAML mapping — no ad-hoc YAML parser. This is the
 * #24 wiring: the registry, not a hardcoded switch, is the section-default
 * `type` authority. Only entries that declare a string `type` are included.
 */
export function loadSectionTypes(docsRoot) {
  const file = join(docsRoot, '_meta', 'sections.yaml');
  if (!existsSync(file)) return null;
  let sections;
  try {
    const raw = readFileSync(file, 'utf8');
    const data = matter(['---', raw, '---', ''].join('\n')).data;
    sections = data && typeof data === 'object' ? data.sections : undefined;
  } catch {
    return null; // an unreadable/unparseable registry → graceful fallback
  }
  if (!Array.isArray(sections)) return null;
  const map = {};
  for (const rec of sections) {
    if (rec && typeof rec === 'object' && typeof rec.id === 'string' && typeof rec.type === 'string') {
      map[rec.id] = rec.type;
    }
  }
  return map;
}

/**
 * Read `<docsRoot>/_meta/sections.yaml` and return its `id → subtypes[]` map,
 * or `null` when no registry is present. Mirrors `sectionSubtypes` in
 * `src/lib/sections.ts` (E-02, FR-005, D-03) — only entries that declare a
 * `subtypes` list of `{match, type}` are included.
 */
export function loadSectionSubtypes(docsRoot) {
  const file = join(docsRoot, '_meta', 'sections.yaml');
  if (!existsSync(file)) return null;
  let sections;
  try {
    const raw = readFileSync(file, 'utf8');
    const data = matter(['---', raw, '---', ''].join('\n')).data;
    sections = data && typeof data === 'object' ? data.sections : undefined;
  } catch {
    return null;
  }
  if (!Array.isArray(sections)) return null;
  const map = {};
  for (const rec of sections) {
    if (rec && typeof rec === 'object' && typeof rec.id === 'string' && Array.isArray(rec.subtypes)) {
      map[rec.id] = rec.subtypes.filter(
        (r) => r && typeof r === 'object' && typeof r.match === 'string' && typeof r.type === 'string',
      );
    }
  }
  return map;
}

/**
 * Expected `type` for a path relative to the docs root (null = unknown).
 *
 * The section default comes from `typesBySection` — the registry-derived
 * `id → type` map (issue #24); omitted, it falls back to the frozen
 * {@link SECTION_TYPE}, so a registry-less tree still validates.
 *
 * Derivation order (E-06, most specific first): a registry `subtypes[].match`
 * on the first sub-path segment (`subtypesBySection`, FR-005/D-03) → the
 * short, stable BUILT-IN sub-path table kept IN CODE (an ADR `template.md` →
 * `Template`; `plans/epics/*` → `Epic`, `plans/features/*` → `Feature`;
 * `operations/runbooks/*` → `Runbook`) → the section default. Mirrors
 * `expectedDocType` in src/lib/metadata.ts (bare-Node copy; the TS module cannot
 * load here).
 */
export function expectedType(relPath, typesBySection = SECTION_TYPE, subtypesBySection) {
  const parts = relPath.split('/');
  const section = parts[0];
  const file = parts[parts.length - 1];
  const sectionDefault = typesBySection[section] ?? null;

  const registryRules = subtypesBySection?.[section];
  if (registryRules && parts.length > 1) {
    const rule = registryRules.find((r) => r.match === parts[1]);
    if (rule) return rule.type;
  }

  switch (section) {
    case 'adr': return file === 'template.md' ? 'Template' : sectionDefault;
    case 'plans':
      if (parts[1] === 'epics') return 'Epic';
      if (parts[1] === 'features') return 'Feature';
      return sectionDefault;
    case 'operations': return parts[1] === 'runbooks' ? 'Runbook' : sectionDefault;
    default: return sectionDefault;
  }
}

// ---------------------------------------------------------------------------
// Vocabulary override (#40) — hand-mirrored twin of `loadVocabulary` in
// src/lib/sections.ts. The TS module cannot load in bare Node, so the resolver
// is duplicated here (same discipline as the SECTION_TYPE / zod-shape mirrors);
// src/tests/vocabulary-resolver.test.ts pins the two twins to identical RESOLVED
// output for identical YAML (NFR-004). See sections.ts for the full contract.
// ---------------------------------------------------------------------------

/** Build a single-axis resolver (forbidden checked on the raw term; alias rewrites). */
function makeAxisResolver(axis) {
  return (term) => {
    if (term === undefined) return { effective: undefined, forbidden: false };
    const aliasTarget = axis.aliases[term];
    const forbidden = axis.forbidden.has(term);
    const effective = aliasTarget !== undefined ? aliasTarget : forbidden ? undefined : term;
    const result = { effective, forbidden };
    if (aliasTarget !== undefined) result.aliasedFrom = term;
    return result;
  };
}

/** Parse one axis mapping (`{ aliases?, forbidden? }`) with clear validation. */
function parseVocabularyAxis(raw, axisName, source) {
  const axis = { aliases: {}, forbidden: new Set() };
  if (raw == null) return axis;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${source}: vocabulary "${axisName}" must be a mapping with optional "aliases"/"forbidden"`);
  }
  const { aliases, forbidden } = raw;
  if (aliases != null) {
    if (typeof aliases !== 'object' || Array.isArray(aliases)) {
      throw new Error(`${source}: vocabulary "${axisName}.aliases" must be a mapping of term → replacement`);
    }
    for (const [from, to] of Object.entries(aliases)) {
      if (typeof to !== 'string') {
        throw new Error(`${source}: vocabulary "${axisName}.aliases.${from}" must map to a string term`);
      }
      axis.aliases[from] = to;
    }
  }
  if (forbidden != null) {
    if (!Array.isArray(forbidden)) {
      throw new Error(`${source}: vocabulary "${axisName}.forbidden" must be a list of terms`);
    }
    for (const term of forbidden) {
      if (typeof term !== 'string') {
        throw new Error(`${source}: vocabulary "${axisName}.forbidden" entries must be strings`);
      }
      axis.forbidden.add(term);
    }
  }
  return axis;
}

/** Parse a `vocabulary.yaml` body into a `{ resolveType, resolveKind }` resolver. */
export function parseVocabulary(raw, source = 'vocabulary.yaml') {
  const data = matter(['---', raw, '---', ''].join('\n')).data;
  if (data != null && (typeof data !== 'object' || Array.isArray(data))) {
    throw new Error(`${source}: vocabulary must be a YAML mapping with optional "types"/"kinds"`);
  }
  const typeAxis = parseVocabularyAxis(data?.types, 'types', source);
  const kindAxis = parseVocabularyAxis(data?.kinds, 'kinds', source);
  return {
    resolveType: makeAxisResolver(typeAxis),
    resolveKind: makeAxisResolver(kindAxis),
  };
}

/** The identity resolver (no aliases, no forbidden) — the shipped default vocab. */
export const IDENTITY_VOCAB = parseVocabulary('');

/**
 * Load `<docsRoot>/_meta/vocabulary.yaml` into a resolver. A MISSING file →
 * {@link IDENTITY_VOCAB} (shipped default, `Feature` valid, NFR-002); a
 * present-but-malformed file THROWS (authored — a silent skip would hide it).
 */
export function loadVocabulary(docsRoot) {
  const file = join(docsRoot, '_meta', 'vocabulary.yaml');
  if (!existsSync(file)) return IDENTITY_VOCAB;
  const raw = readFileSync(file, 'utf8');
  return parseVocabulary(raw, relative(process.cwd(), file));
}

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
  const { indexBasename = DEFAULT_INDEX_BASENAME, subtypesBySection, knownSectionIds } = options;
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
    const derived = expectedType(relPath, typesBySection, subtypesBySection); // may be null (orphan)
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
