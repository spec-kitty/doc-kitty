/**
 * Canonical, fs-free vocabulary + type-derivation core for the
 * **Common Docs — Kitty Variation** (#49 IC-01).
 *
 * THE SINGLE SOURCE OF TRUTH for section vocabulary sets, the section→type
 * derivation, the `_meta/vocabulary.yaml` resolver, and the index-basename
 * detection. Before this module the same knowledge lived hand-mirrored in three
 * places — `schema.ts` / `metadata.ts` (Astro-side toolkit) and
 * `validate-frontmatter.mjs` (the bare-Node gate) — and a resolved-vocabulary
 * parity test was the only line of defence against silent drift (NFR-004). This
 * module makes that drift impossible by construction: WP02 rewires both
 * consumers to import from here and deletes their twins.
 *
 * PURITY CONTRACT (C-001, NFR-001): this layer is **fs-free AND Astro-free** —
 * it imports NO `node:fs`, NO `node:path`/`node:process`, and NO
 * `astro`/`@astrojs/*`. It is therefore safe for `metadata.ts` (which must stay
 * fs-free and must never import `sections.ts`) to consume, and it loads under
 * plain `node` with no Astro build context. The filesystem half — reading
 * `_meta/vocabulary.yaml` / `_meta/sections.yaml` — lives in the thin
 * `./vocabulary-loader.mjs` layer, which imports the pure parsers from here.
 *
 * TYPING (D4/F6 — `allowJs` is global via astro's strict preset, and
 * `src/tsconfig.json` extends it): a `.d.ts` sidecar for a `./x.mjs` specifier
 * is IGNORED (TS resolves `.d.mts`/`.mts`), and a plain
 * `export const STATUSES = [...]` would infer `string[]`, making `z.enum(...)`
 * fail `astro check`. So the enum arrays carry literal-tuple types via a JSDoc
 * const assertion (`/** @type {const} *​/ ([...])`); WP02 derives the unions with
 * `typeof STATUSES[number]`. NO `.d.ts` sidecars.
 *
 * Extracted behavior-preserving (DISCIPLINED_REFACTORING) from:
 *   - enums: `schema.ts:34-53` (`DOC_TYPES`, `KINDS`) + the inline
 *     `doc_status` enum `schema.ts:174` / `validate-frontmatter.mjs:45`
 *     (`STATUSES`) — with `durable` APPENDED (#39/FR-004);
 *   - `SECTION_TYPE`: `metadata.ts:188-202`;
 *   - `expectedDocType`: `metadata.ts:235-263`;
 *   - resolver: `sections.ts:294-415` (`makeAxisResolver` /
 *     `parseVocabularyAxis` / `parseVocabulary` / `identityVocabulary`, incl.
 *     the gray-matter wrap-in-fences trick);
 *   - index-basename helpers: `metadata.ts:407-525` (`readmeToIndexId` /
 *     `resolveIndexEntries` + the `ROOT_ENTRY_ID` root-slug mapping) and the
 *     bare-Node detection twin `validate-frontmatter.mjs:60-135`
 *     (`isIndexPath` / `isRootIndex` / `detectIndexCollisions`).
 *
 * @module vocabulary-core
 */

import matter from 'gray-matter';

// ---------------------------------------------------------------------------
// Canonical vocabulary sets (single-sourced — #49 / data-model)
//
// Each is a JSDoc-const literal tuple so WP02 can write `z.enum(STATUSES)` and
// `typeof STATUSES[number]` against the inferred literal-union type.
// ---------------------------------------------------------------------------

/**
 * The Common Docs lifecycle enum (`doc_status`). Extends the pre-existing four
 * (`draft`, `active`, `deprecated`, `superseded`) with `durable` — a
 * never-retire throughline status (#39/FR-004). Additive: no existing value's
 * meaning or acceptance changes (NFR-002). `durable` is a PUBLISHED status
 * (satisfies `isPublished`, i.e. `!== 'draft'`).
 */
export const STATUSES = /** @type {const} */ ([
  'draft',
  'active',
  'deprecated',
  'superseded',
  'durable',
]);

/** OKF `type` vocabulary — one value per Common Docs section (17 items). */
export const DOC_TYPES = /** @type {const} */ ([
  'Context',
  'Architecture',
  'ADR',
  'Template',
  'Plan',
  'Epic',
  'Feature',
  'API',
  'Configuration',
  'Integration',
  'Security',
  'Guide',
  'Operations',
  'Runbook',
  'Migration',
  'Changelog',
  'Presentation',
]);

/**
 * The canonical `kind` vocabulary (ADR-0009): the four Divio content quadrants
 * plus the structural kinds (13 items). Open vocabulary — the site schema
 * accepts any string; the standalone gate warns on a value outside this set.
 */
export const KINDS = /** @type {const} */ ([
  'Tutorial',
  'How-To',
  'Reference',
  'Explanation',
  'Hub',
  'ADR',
  'Changelog',
  'Glossary',
  'Presentation',
  'Persona',
  'Planning',
  'Feature',
  'User-Journey',
]);

// ---------------------------------------------------------------------------
// Section → type derivation (from `metadata.ts:188-263`)
// ---------------------------------------------------------------------------

/**
 * Frozen fallback `section → type` map: the section-default `type` for each
 * canonical section, used when no `sections.yaml` registry is present (a
 * registry-less docs tree still derives an expected `type`). MIRRORS the section
 * defaults the registry now carries; when a registry IS present, its
 * `sectionTypes(registry)` map is the authority and this is not consulted (issue
 * #24). Sub-path subtypes (ADR template, plan epics/features, ops runbooks) are
 * NOT in this map — they are applied on top by {@link expectedDocType}.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const SECTION_TYPE = Object.freeze({
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
});

/**
 * One registry `subtypes` rule (E-02): a first-sub-path-segment → `type` mapping.
 *
 * @typedef {object} SectionSubtypeRule
 * @property {string} match The first sub-path segment under the section folder,
 *   e.g. `"missions"`.
 * @property {string} type The `type` a page under that sub-path derives.
 */

/**
 * The expected frontmatter `type` for a page path (null = no expectation).
 *
 * PURE and parameterized (issue #24, FR-005/D-03): `typesBySection` is the
 * resolved `id → type` map — pass `sectionTypes(registry)` (from
 * `./vocabulary-loader.mjs`) to make the registry the section-default authority;
 * omitted, it falls back to the frozen {@link SECTION_TYPE}, so a docs root with
 * no `sections.yaml` still derives an expectation. `subtypesBySection` is the
 * resolved `id → subtypes[]` map — pass `sectionSubtypes(registry)`; omitted, no
 * registry subtypes apply.
 *
 * Derivation order (E-06, most specific first):
 *   1. a registry `subtypes[].match` on the first sub-path segment
 *      (`subtypesBySection`) — the data-driven rename path (FR-005);
 *   2. a short, stable BUILT-IN table of sub-path subtypes kept in code (an
 *      ADR `template.md` → `Template`; `plans/epics/*` → `Epic`,
 *      `plans/features/*` → `Feature`; `operations/runbooks/*` → `Runbook`) —
 *      the fallback, unaffected when a registry has no `subtypes` (C-001/NFR-003);
 *   3. the section (first path segment) default from `typesBySection`.
 * An unknown section yields `null` (no section default, no override) — the
 * caller treats a null expectation as "no check".
 *
 * @param {string} relPath Path relative to the docs root (e.g. `adr/0001-x.md`).
 * @param {Record<string, string>} [typesBySection=SECTION_TYPE] Resolved
 *   `id → type` map (registry-derived or the frozen fallback).
 * @param {Record<string, SectionSubtypeRule[]>} [subtypesBySection] Resolved
 *   `id → subtypes[]` map (registry-derived); omitted ⇒ no registry subtypes.
 * @returns {string | null} The expected `type`, or `null` for an unknown section.
 */
export function expectedDocType(
  relPath,
  typesBySection = SECTION_TYPE,
  subtypesBySection,
) {
  const parts = relPath.split('/');
  const section = parts[0] ?? '';
  const file = parts[parts.length - 1] ?? '';
  const sectionDefault = typesBySection[section] ?? null;

  const registryRules = subtypesBySection?.[section];
  if (registryRules && parts.length > 1) {
    const rule = registryRules.find((r) => r.match === parts[1]);
    if (rule) return rule.type;
  }

  switch (section) {
    case 'adr':
      return file === 'template.md' ? 'Template' : sectionDefault;
    case 'plans':
      if (parts[1] === 'epics') return 'Epic';
      if (parts[1] === 'features') return 'Feature';
      return sectionDefault;
    case 'operations':
      return parts[1] === 'runbooks' ? 'Runbook' : sectionDefault;
    default:
      return sectionDefault;
  }
}

// ---------------------------------------------------------------------------
// Vocabulary override resolver (#40) — pure, string-in/resolver-out halves of
// `sections.ts:294-415`. The fs half (`loadVocabulary` reading
// `_meta/vocabulary.yaml`) lives in `./vocabulary-loader.mjs`.
// ---------------------------------------------------------------------------

/**
 * The result of resolving a single term against one vocabulary axis.
 *
 * @typedef {object} VocabularyResolution
 * @property {string | undefined} effective The effective term after applying the
 *   alias. `undefined` when the input was `undefined`, or when the term is
 *   forbidden with no alias to redirect to.
 * @property {boolean} forbidden True when the RAW input term is on the axis's
 *   `forbidden` list.
 * @property {string} [aliasedFrom] The raw input term when an alias (or a forbid)
 *   rewrote it; else absent.
 */

/**
 * A resolver over the two vocabulary axes (`type` and `kind`).
 *
 * @typedef {object} VocabularyResolver
 * @property {(term: string | undefined) => VocabularyResolution} resolveType
 * @property {(term: string | undefined) => VocabularyResolution} resolveKind
 */

/**
 * One parsed axis: alias map + forbidden set.
 *
 * @typedef {object} VocabularyAxis
 * @property {Record<string, string>} aliases
 * @property {Set<string>} forbidden
 */

/**
 * Build a single-axis resolver. Semantics (contracts/vocabulary-override.md):
 *   - `forbidden` is checked on the RAW input term and takes precedence, so a
 *     banned term fails even when an alias would otherwise redirect it (the alias
 *     then merely SUPPLIES the replacement to name in the failure);
 *   - an alias rewrites the term to its replacement (the neutralize path);
 *   - an unlisted term passes through unchanged (identity).
 * An empty axis is the identity resolver (the shipped default → `Feature` valid).
 *
 * @param {VocabularyAxis} axis
 * @returns {(term: string | undefined) => VocabularyResolution}
 */
export function makeAxisResolver(axis) {
  return (term) => {
    if (term === undefined) return { effective: undefined, forbidden: false };
    const aliasTarget = axis.aliases[term];
    const forbidden = axis.forbidden.has(term);
    const effective = aliasTarget !== undefined ? aliasTarget : forbidden ? undefined : term;
    /** @type {VocabularyResolution} */
    const result = { effective, forbidden };
    if (aliasTarget !== undefined) result.aliasedFrom = term;
    return result;
  };
}

/**
 * Parse one axis mapping (`{ aliases?, forbidden? }`) with clear validation.
 *
 * @param {unknown} raw
 * @param {string} axisName
 * @param {string} source
 * @returns {VocabularyAxis}
 */
export function parseVocabularyAxis(raw, axisName, source) {
  /** @type {VocabularyAxis} */
  const axis = { aliases: {}, forbidden: new Set() };
  if (raw == null) return axis;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(
      `${source}: vocabulary "${axisName}" must be a mapping with optional "aliases"/"forbidden"`,
    );
  }
  const { aliases, forbidden } = /** @type {Record<string, unknown>} */ (raw);
  if (aliases != null) {
    if (typeof aliases !== 'object' || Array.isArray(aliases)) {
      throw new Error(
        `${source}: vocabulary "${axisName}.aliases" must be a mapping of term → replacement`,
      );
    }
    for (const [from, to] of Object.entries(/** @type {Record<string, unknown>} */ (aliases))) {
      if (typeof to !== 'string') {
        throw new Error(
          `${source}: vocabulary "${axisName}.aliases.${from}" must map to a string term`,
        );
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

/**
 * Parse a `vocabulary.yaml` body (the raw file text) into a
 * {@link VocabularyResolver}.
 *
 * Uses the same wrap-in-fences gray-matter trick as `parseSectionRegistry`
 * (`sections.ts`) / `validate-catalog.mjs` — the top-level YAML mapping is
 * wrapped as a frontmatter block so gray-matter's YAML engine parses it, no
 * ad-hoc parser. A malformed axis (a non-mapping `types`/`kinds`, a non-string
 * alias target, a non-list `forbidden`) throws a clear, actionable error rather
 * than falling back silently. `gray-matter` is a pure string transform here (no
 * filesystem access), so this stays fs-free.
 *
 * @param {string} raw
 * @param {string} [source='vocabulary.yaml']
 * @returns {VocabularyResolver}
 */
export function parseVocabulary(raw, source = 'vocabulary.yaml') {
  const data = /** @type {{ types?: unknown; kinds?: unknown } | null} */ (
    matter(['---', raw, '---', ''].join('\n')).data
  );
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

/**
 * The identity resolver (no aliases, no forbidden terms) — the shipped default.
 *
 * @returns {VocabularyResolver}
 */
export function identityVocabulary() {
  return parseVocabulary('');
}

// ---------------------------------------------------------------------------
// Index-basename detection (from `metadata.ts:407-525` +
// `validate-frontmatter.mjs:60-135`) — pure, fs-free. The caller supplies the
// path list (a directory walk lives in the fs layer), keeping this Astro/fs-free.
// ---------------------------------------------------------------------------

/**
 * The default section-index basename (FR-002, C-001): `README` stays the default
 * so doc-kitty's own tree and an existing adopter are byte-identical with no
 * `indexBasename` configured (NFR-003).
 */
export const DEFAULT_INDEX_BASENAME = 'README';

/**
 * One or more section-index basenames (no extension), matched
 * case-insensitively against a file's leaf name. A single string or a set —
 * `['README', 'index']` lets one build collapse BOTH conventions at once
 * (data-model E-01, contract C-IB). Omitted/default is the single basename
 * `"README"`.
 *
 * @typedef {string | string[]} IndexBasenameOption
 */

/**
 * Options every index-detecting helper below shares.
 *
 * @typedef {object} IndexBasenameOptions
 * @property {IndexBasenameOption} [indexBasename]
 */

/**
 * Normalize the option to a non-empty ordered list (config order = priority).
 *
 * @param {IndexBasenameOption} [indexBasename]
 * @returns {string[]}
 */
function normalizeIndexBasenames(indexBasename) {
  const list =
    indexBasename === undefined
      ? [DEFAULT_INDEX_BASENAME]
      : Array.isArray(indexBasename)
        ? indexBasename
        : [indexBasename];
  return list.length > 0 ? list : [DEFAULT_INDEX_BASENAME];
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A case-insensitive `(^|/)(basename1|basename2|…)$` matcher over the set.
 *
 * @param {string[]} basenames
 * @returns {RegExp}
 */
function indexBasenamePattern(basenames) {
  return new RegExp(`(^|/)(${basenames.map(escapeRegExp).join('|')})$`, 'i');
}

/**
 * Map a file path under the content root to its route slug, applying the
 * configurable index-basename rule (FR-001/FR-002, D-01). Case-insensitive.
 *
 * With the default (`indexBasename` omitted → `"README"` only):
 *   "README.md"                -> ""              (bundle root)
 *   "architecture/README.md"   -> "architecture"
 *   "architecture/overview.md" -> "architecture/overview"
 *
 * Sibling-unaware: for the multi-candidate collision case (E-05) use
 * {@link resolveIndexEntries} instead.
 *
 * @param {string} entry
 * @param {IndexBasenameOptions} [options={}]
 * @returns {string}
 */
export function readmeToIndexId(entry, options = {}) {
  const withoutExt = entry.replace(/\.mdx?$/i, '');
  const pattern = indexBasenamePattern(normalizeIndexBasenames(options.indexBasename));
  const asIndex = withoutExt.replace(pattern, '$1');
  return asIndex.replace(/\/$/, '');
}

/**
 * One resolved both-index collision (E-05): a directory with 2+ candidates.
 *
 * @typedef {object} IndexCollision
 * @property {string} dir The directory the collision occurred in ('' for root).
 * @property {string} winner The path that won and became the section index.
 * @property {string[]} demoted The rest — demoted to ordinary pages.
 */

/**
 * The result of a whole-tree, collision-aware index resolution.
 *
 * @typedef {object} ResolveIndexEntriesResult
 * @property {Map<string, string>} ids Every input path mapped to its slug id.
 * @property {IndexCollision[]} collisions Every directory with >1 candidate.
 */

/**
 * Collision-aware, whole-tree twin of {@link readmeToIndexId} (E-05, FR-004).
 * Given every Markdown path under a content root, resolves each to its route
 * slug id; when a directory contains MULTIPLE configured-basename candidates
 * (e.g. both `README.md` and `index.md`), the file matching the EARLIEST-
 * configured basename wins the section-index id; the rest are demoted to ordinary
 * pages (their id keeps the basename segment) and reported in `collisions`, so
 * the ambiguity is never silently resolved. A tie between same-rank basenames is
 * broken by path sort order. Fs-free — the caller supplies the path list.
 *
 * @param {readonly string[]} paths
 * @param {IndexBasenameOptions} [options={}]
 * @returns {ResolveIndexEntriesResult}
 */
export function resolveIndexEntries(paths, options = {}) {
  const basenames = normalizeIndexBasenames(options.indexBasename);
  const pattern = indexBasenamePattern(basenames);

  /** @type {Map<string, string[]>} */
  const byDir = new Map();
  for (const p of paths) {
    const withoutExt = p.replace(/\.mdx?$/i, '');
    if (!pattern.test(withoutExt)) continue;
    const dir = withoutExt.replace(pattern, '$1').replace(/\/$/, '');
    const list = byDir.get(dir) ?? [];
    list.push(p);
    byDir.set(dir, list);
  }

  /** @param {string} file */
  const rankOf = (file) => {
    const base = file.replace(/\.mdx?$/i, '').split('/').pop() ?? '';
    const idx = basenames.findIndex((b) => b.toLowerCase() === base.toLowerCase());
    return idx === -1 ? basenames.length : idx;
  };

  /** @type {Set<string>} */
  const demoted = new Set();
  /** @type {IndexCollision[]} */
  const collisions = [];
  for (const [dir, files] of byDir) {
    if (files.length <= 1) continue;
    const sorted = [...files].sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b));
    const [winner, ...rest] = sorted;
    for (const loser of rest) demoted.add(loser);
    collisions.push({ dir, winner: /** @type {string} */ (winner), demoted: rest });
  }

  /** @type {Map<string, string>} */
  const ids = new Map();
  for (const p of paths) {
    ids.set(p, demoted.has(p) ? p.replace(/\.mdx?$/i, '') : readmeToIndexId(p, options));
  }
  return { ids, collisions };
}

/**
 * Astro's content store requires a non-empty entry id, so the bundle root
 * (whose convention route slug is `""`) is stored under this reserved id —
 * which is also Starlight's own root id, keeping it served at `/`.
 */
export const ROOT_ENTRY_ID = 'index';

/**
 * Map a stored Astro entry id back to the convention's route slug ("" for root).
 *
 * @param {string} id
 * @returns {string}
 */
export function slugFromEntryId(id) {
  return id === ROOT_ENTRY_ID ? '' : id;
}

/**
 * Does `relPath` (ext included) name a configured section-index candidate? The
 * bare-Node detection twin of the {@link readmeToIndexId} pattern
 * (`validate-frontmatter.mjs:89-92`).
 *
 * @param {string} relPath
 * @param {IndexBasenameOption} [indexBasename=DEFAULT_INDEX_BASENAME]
 * @returns {boolean}
 */
export function isIndexPath(relPath, indexBasename = DEFAULT_INDEX_BASENAME) {
  const withoutExt = relPath.replace(/\.mdx?$/i, '');
  return indexBasenamePattern(normalizeIndexBasenames(indexBasename)).test(withoutExt);
}

/**
 * Is `relPath` a BUNDLE-ROOT index file (no directory segment) under the
 * configured basename(s)? The root-index exemption twin (US1-AS4) mirroring the
 * `ROOT_ENTRY_ID`/`readmeToIndexId` root special-casing
 * (`validate-frontmatter.mjs:100-102`).
 *
 * @param {string} relPath
 * @param {IndexBasenameOption} [indexBasename=DEFAULT_INDEX_BASENAME]
 * @returns {boolean}
 */
export function isRootIndex(relPath, indexBasename = DEFAULT_INDEX_BASENAME) {
  return !relPath.includes('/') && isIndexPath(relPath, indexBasename);
}

/**
 * Both-index collision detection (E-05, FR-004) — the flat-list bare-Node twin
 * of {@link resolveIndexEntries}'s collision half
 * (`validate-frontmatter.mjs:111-135`). Groups index-candidates by directory and
 * reports every directory holding MORE THAN ONE configured basename; the
 * EARLIEST-configured basename wins (ties broken by path sort), matching the
 * loader's resolution exactly.
 *
 * @param {readonly string[]} relPaths
 * @param {IndexBasenameOption} [indexBasename=DEFAULT_INDEX_BASENAME]
 * @returns {IndexCollision[]}
 */
export function detectIndexCollisions(relPaths, indexBasename = DEFAULT_INDEX_BASENAME) {
  const basenames = normalizeIndexBasenames(indexBasename);
  const pattern = indexBasenamePattern(basenames);
  /** @type {Map<string, string[]>} */
  const byDir = new Map();
  for (const p of relPaths) {
    const withoutExt = p.replace(/\.mdx?$/i, '');
    if (!pattern.test(withoutExt)) continue;
    const dir = withoutExt.replace(pattern, '$1').replace(/\/$/, '');
    const list = byDir.get(dir) ?? [];
    list.push(p);
    byDir.set(dir, list);
  }
  /** @param {string} f */
  const rank = (f) => {
    const base = f.replace(/\.mdx?$/i, '').split('/').pop() ?? '';
    const idx = basenames.findIndex((b) => b.toLowerCase() === base.toLowerCase());
    return idx === -1 ? basenames.length : idx;
  };
  /** @type {IndexCollision[]} */
  const collisions = [];
  for (const [dir, files] of byDir) {
    if (files.length <= 1) continue;
    const sorted = [...files].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    collisions.push({ dir, winner: sorted[0], demoted: sorted.slice(1) });
  }
  return collisions;
}
