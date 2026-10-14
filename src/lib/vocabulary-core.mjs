/**
 * Canonical, fs-free vocabulary + type-derivation core for the
 * **DocKitty** (#49 IC-01).
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
 *   - index-basename DETECTION helpers: the bare-Node half
 *     `validate-frontmatter.mjs:60-135` (`isIndexPath` / `isRootIndex` /
 *     `detectIndexCollisions`). The id-MAPPING half (`readmeToIndexId` /
 *     `resolveIndexEntries`) and the route rule built on it (`routeOfSlug`,
 *     `buildRouteTable`, `resolveRelativeDocLink`) live here too: the one
 *     implementation `metadata.ts` re-exports. `slugFromEntryId` /
 *     `ROOT_ENTRY_ID` stay in `metadata.ts`.
 *
 * @module vocabulary-core
 */

import matter from 'gray-matter';

// ---------------------------------------------------------------------------
// The one code-unit string comparator (#85/#88, C-004)
// ---------------------------------------------------------------------------

/**
 * THE single code-unit string comparator: orders two strings by their UTF-16
 * code units (what JS relational operators do), returning `-1`/`0`/`1`.
 *
 * WHY it lives here (#88/FR-004, C-004): the `a < b ? -1 : a > b ? 1 : 0` idiom
 * and bare `localeCompare` calls were duplicated across the `.ts` modules, their
 * pure-ESM `.mjs` twins, and the glossary generators. A code-unit comparison is
 * locale-INDEPENDENT by construction — CI, a contributor's machine, and a
 * container with a different `LANG` all agree — which is exactly the class of
 * nondeterminism the determinism-hardening mission removes. This is the ONE home
 * for that comparator; `metadata.ts`'s `compareSlug` (#85) is its slug-typed
 * alias, and every id/path/number sort and the two inline glossary twins route
 * through it (research D2). No new inline `a<b?…` twin or bare `localeCompare`
 * may be introduced.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} `-1` if `a < b`, `1` if `a > b`, else `0`.
 */
export function compareCodeUnit(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// The one anchor/path slug rule (hoisted from `glossary/anchor.ts`, ADR-0046)
// ---------------------------------------------------------------------------

/**
 * `slug(name)` — the **single** deterministic slug function (D6, NFR-004): the
 * glossary anchor rule, also used by the Gherkin page generator for output path
 * segments. Hoisted here verbatim from `glossary/anchor.ts` (which re-exports it)
 * so the bare-Node `generate-feature-pages.mjs --check` gate can import it without
 * TS. Do **not** duplicate this rule anywhere — a second slug function is a review
 * finding (drift risk).
 *
 * Rule: lowercase, trim, collapse every run of non-alphanumerics to a single `-`,
 * then strip leading/trailing `-`. Pure and deterministic — no randomness, no date,
 * no locale — so the same `name` always yields the same anchor (INV-G2), and the
 * output is idempotent: `slug(slug(x)) === slug(x)` (its only characters are
 * `[a-z0-9]` and single interior `-`).
 *
 * @param {string} name
 * @returns {string}
 */
export function slug(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * `humanizeSection(name)` — the TOP-LEVEL folder-name → display-title rule
 * (hoisted from `sections.ts`): split on runs of `-`, `_`, `/` and whitespace,
 * drop empty words, upper-case each word's first character, join with one space
 * (`shipping-ops` → `Shipping Ops`). The registry sidebar titles an unregistered
 * top-level section group with it, and the Gherkin generator uses it for the
 * section's own root hub. NESTED directories use {@link humaniseDirectoryName}
 * (sentence case), as the sidebar does. Pure and locale-free (`toUpperCase` of
 * one character).
 *
 * @param {string} name
 * @returns {string}
 */
export function humanizeSection(name) {
  return name
    .split(/[-_/\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * `humaniseDirectoryName(name)` — the NESTED folder-name → display-title rule
 * the sidebar shaping uses (`route-shaping.ts` re-exports it): split on runs of
 * `-`, `_` and whitespace, join with one space, upper-case only the first
 * character (`book-one` → `Book one`). The Gherkin generator titles its nested
 * directory hubs with it so a hub and its sidebar group agree.
 *
 * @param {string} name
 * @returns {string}
 */
export function humaniseDirectoryName(name) {
  const words = name.split(/[-_\s]+/).filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

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

/**
 * OKF `type` vocabulary — one value per Common Docs section (18 items).
 * `Specification` is APPENDED (ADR-0046) for the opt-in, registry-declared
 * Gherkin `behaviour` section; it has no frozen {@link SECTION_TYPE} fallback.
 */
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
  'Specification',
]);

/**
 * The canonical `kind` vocabulary (ADR-0009): the four Divio content quadrants
 * plus the structural kinds (14 items). `Specification` is APPENDED (ADR-0046):
 * a page generated from a Gherkin `.feature` file. Open vocabulary — the site schema
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
  'Specification',
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
// Documentation Charter axes (documentation-charter WP01, D-03/D-04) — the
// extend-only `statuses` axis, the required-field policy (with a `title` floor),
// and the unified `parseCharter(raw)` resolver. These EXTEND the pure core with
// two more governable axes and fold all four (types/kinds/statuses/required) into
// one `ResolvedCharter` shape (data-model, contracts/charter-resolution-contract).
// The fail-closed guards below keep canonical governance non-removable (C-004,
// C-005); the fs half (reading `_meta/charter.yaml`, the legacy fallback, the
// deprecation notice) is WP02's `./vocabulary-loader.mjs`, so this stays fs-free.
// ---------------------------------------------------------------------------

/**
 * The canonical required frontmatter fields the standalone gate enforces —
 * traced from the strict-presence `frontmatterSchema` in
 * `src/scripts/validate-frontmatter.mjs` (`title`/`description`/`doc_status`/
 * `updated` are `z`-required; everything else is optional there). A charter may
 * relax a NON-floor field via `required_fields.optional` (D-04); `title` is a
 * hard floor and can never be relaxed (C-005).
 */
export const CANONICAL_REQUIRED = /** @type {const} */ ([
  'title',
  'description',
  'doc_status',
  'updated',
]);

/** The required-field floor — always required regardless of charter (C-005). */
export const REQUIRED_FIELD_FLOOR = /** @type {const} */ (['title']);

/** Sentinel `resolveStatus` returns for a status outside the legal set (warn). */
export const UNKNOWN_STATUS = 'UNKNOWN';

/** The reserved canonical statuses, as a set — extend-only, never removable. */
const CANONICAL_STATUS_SET = new Set(STATUSES);

/**
 * The resolved statuses axis: the deterministic legal set and its resolver.
 *
 * @typedef {object} StatusesResolution
 * @property {string[]} legalStatuses Canonical ∪ added — canonical first, then
 *   the added values (deduped, code-unit sorted). Deterministic across builds.
 * @property {(term: string | undefined) => string} resolveStatus Returns the
 *   term when it is legal, else {@link UNKNOWN_STATUS} (a downstream warn signal,
 *   mirroring the open `kinds` axis).
 */

/**
 * Parse the extend-only `statuses` axis of a charter (D-03/C-004).
 *
 * ADDITIVE by construction: `statuses.add` (a list of strings) extends the
 * canonical {@link STATUSES}; the canonical values stay reserved and can never be
 * removed, forbidden, or aliased away. This reuses {@link parseVocabularyAxis} to
 * parse and validate any authored `aliases`/`forbidden` (so a malformed shape
 * fails closed with the shared message), then rejects — fail-closed — any
 * `forbidden` entry or `aliases` source that names a canonical status. The
 * resulting `legalStatuses` is deterministic: canonical order first, then the
 * added values deduplicated (against canonical and each other) and code-unit
 * sorted, so the order is stable across runs regardless of authored order.
 *
 * @param {unknown} raw The `statuses` sub-mapping (or `undefined`).
 * @param {string} source Charter source name for error messages.
 * @returns {StatusesResolution}
 */
export function parseStatusesAxis(raw, source) {
  // Reuse the axis parser: validates the mapping shape and any aliases/forbidden.
  const axis = parseVocabularyAxis(raw, 'statuses', source);
  for (const term of axis.forbidden) {
    if (CANONICAL_STATUS_SET.has(term)) {
      throw new Error(`${source}: status "${term}" is reserved and cannot be removed`);
    }
  }
  for (const from of Object.keys(axis.aliases)) {
    if (CANONICAL_STATUS_SET.has(from)) {
      throw new Error(`${source}: status "${from}" is reserved and cannot be removed`);
    }
  }
  const added = parseStatusAddList(raw, source);
  const seen = new Set(STATUSES);
  /** @type {string[]} */
  const extra = [];
  for (const status of added) {
    if (!seen.has(status)) {
      seen.add(status);
      extra.push(status);
    }
  }
  extra.sort(compareCodeUnit);
  const legalStatuses = [...STATUSES, ...extra];
  const legalSet = new Set(legalStatuses);
  return {
    legalStatuses,
    resolveStatus: (term) =>
      term !== undefined && legalSet.has(term) ? term : UNKNOWN_STATUS,
  };
}

/**
 * Parse and validate the `statuses.add` list (strings only). `parseVocabularyAxis`
 * ignores the `add` key, so this reads it directly off the already-shape-checked
 * mapping.
 *
 * @param {unknown} raw The `statuses` sub-mapping (or `undefined`).
 * @param {string} source
 * @returns {string[]}
 */
function parseStatusAddList(raw, source) {
  if (raw == null) return [];
  const { add } = /** @type {Record<string, unknown>} */ (raw);
  if (add == null) return [];
  if (!Array.isArray(add)) {
    throw new Error(`${source}: statuses "add" must be a list of status names`);
  }
  /** @type {string[]} */
  const out = [];
  for (const status of add) {
    if (typeof status !== 'string') {
      throw new Error(`${source}: statuses "add" entries must be strings`);
    }
    out.push(status);
  }
  return out;
}

/**
 * The resolved required-field policy (D-04/C-005).
 *
 * @typedef {object} RequiredFieldsPolicy
 * @property {string[]} required The effective required set: {@link CANONICAL_REQUIRED}
 *   minus any relaxed (`required_fields.optional`) field. `title` is never absent.
 * @property {string[]} floor The never-removable floor ({@link REQUIRED_FIELD_FLOOR}).
 */

/**
 * Parse the `required_fields` policy of a charter (D-04/C-005).
 *
 * `required_fields.optional` lists NON-floor fields a consumer may leave absent;
 * they are subtracted from {@link CANONICAL_REQUIRED}. Listing `title` fails
 * closed — it is a floor field and can never be relaxed.
 *
 * @param {unknown} raw The `required_fields` sub-mapping (or `undefined`).
 * @param {string} source
 * @returns {RequiredFieldsPolicy}
 */
export function parseRequiredFields(raw, source) {
  const optional = parseOptionalFieldList(raw, source);
  if (optional.includes('title')) {
    throw new Error(
      `${source}: required field "title" is a floor and cannot be made optional`,
    );
  }
  const optionalSet = new Set(optional);
  const required = CANONICAL_REQUIRED.filter((field) => !optionalSet.has(field));
  return { required, floor: [...REQUIRED_FIELD_FLOOR] };
}

/**
 * Parse and validate `required_fields.optional` (a list of field-name strings).
 *
 * @param {unknown} raw The `required_fields` sub-mapping (or `undefined`).
 * @param {string} source
 * @returns {string[]}
 */
function parseOptionalFieldList(raw, source) {
  if (raw == null) return [];
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(
      `${source}: "required_fields" must be a mapping with an optional "optional" list`,
    );
  }
  const { optional } = /** @type {Record<string, unknown>} */ (raw);
  if (optional == null) return [];
  if (!Array.isArray(optional)) {
    throw new Error(`${source}: "required_fields.optional" must be a list of field names`);
  }
  /** @type {string[]} */
  const out = [];
  for (const field of optional) {
    if (typeof field !== 'string') {
      throw new Error(`${source}: "required_fields.optional" entries must be strings`);
    }
    out.push(field);
  }
  return out;
}

/**
 * The full resolved charter — every governable axis folded into one shape,
 * identical whether it came from `charter.yaml` or (in WP02) the legacy files.
 *
 * @typedef {object} ResolvedCharter
 * @property {(term: string | undefined) => VocabularyResolution} resolveType
 * @property {(term: string | undefined) => VocabularyResolution} resolveKind
 * @property {(term: string | undefined) => string} resolveStatus
 * @property {string[]} legalStatuses
 * @property {Record<string, unknown> | null} sections Parsed section-registry
 *   shape if the charter declares one, else `null` (WP02's loader supplies the
 *   legacy `sections.yaml` fallback and normalizes the entries).
 * @property {RequiredFieldsPolicy} requiredFields
 * @property {{ fromCharter: boolean, legacyPresent: boolean }} sourceMeta The
 *   pure core knows only whether a non-empty charter body was parsed
 *   (`fromCharter`); `legacyPresent` is filled by the fs loader (WP02) and is
 *   `false` here.
 */

/**
 * Resolve a charter body (the raw `_meta/charter.yaml` text) into a
 * {@link ResolvedCharter}. The single fs-free resolver WP02 (loader) and WP03
 * (enforcement / Astro twin) build on.
 *
 * Shape (data-model): `types`/`kinds` live under `vocabulary`, the extend-only
 * `statuses` axis under `statuses`, the required-field policy under
 * `required_fields`, and the section registry under `sections`. Every key is
 * optional; an empty body ≡ identity/defaults (`parseCharter('')` returns the
 * shipped canonical behavior). Uses the same wrap-in-fences gray-matter trick as
 * {@link parseVocabulary} (a pure string transform — no filesystem access) and
 * delegates the `types`/`kinds` axes to the existing {@link parseVocabularyAxis} /
 * {@link makeAxisResolver} machinery (no duplication). Unknown TOP-LEVEL keys are
 * ignored (forward-compat, C-006); a malformed known axis fails closed.
 *
 * @param {string} raw
 * @param {string} [source='charter.yaml']
 * @returns {ResolvedCharter}
 */
export function parseCharter(raw, source = 'charter.yaml') {
  const data = /** @type {Record<string, unknown> | null} */ (
    matter(['---', raw, '---', ''].join('\n')).data
  );
  if (data != null && (typeof data !== 'object' || Array.isArray(data))) {
    throw new Error(`${source}: charter must be a YAML mapping`);
  }
  const rawVocabulary = data?.vocabulary;
  if (
    rawVocabulary != null &&
    (typeof rawVocabulary !== 'object' || Array.isArray(rawVocabulary))
  ) {
    throw new Error(`${source}: "vocabulary" must be a mapping with optional "types"/"kinds"`);
  }
  const vocabulary = /** @type {{ types?: unknown; kinds?: unknown } | undefined} */ (
    rawVocabulary ?? undefined
  );
  const typeAxis = parseVocabularyAxis(vocabulary?.types, 'types', source);
  const kindAxis = parseVocabularyAxis(vocabulary?.kinds, 'kinds', source);
  const { legalStatuses, resolveStatus } = parseStatusesAxis(data?.statuses, source);
  const requiredFields = parseRequiredFields(data?.required_fields, source);
  const rawSections = data?.sections;
  const sections =
    rawSections != null && typeof rawSections === 'object' && !Array.isArray(rawSections)
      ? /** @type {Record<string, unknown>} */ (rawSections)
      : null;
  return {
    resolveType: makeAxisResolver(typeAxis),
    resolveKind: makeAxisResolver(kindAxis),
    resolveStatus,
    legalStatuses,
    sections,
    requiredFields,
    sourceMeta: { fromCharter: raw.trim() !== '', legacyPresent: false },
  };
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
 * Exported so the Gherkin page generator (`gherkin/generate.mjs`) derives its hub
 * basename from the SAME list the detection helpers below use — no second
 * implementation of the index-basename rule.
 *
 * @param {IndexBasenameOption} [indexBasename]
 * @returns {string[]}
 */
export function normalizeIndexBasenames(indexBasename) {
  const list =
    indexBasename === undefined
      ? [DEFAULT_INDEX_BASENAME]
      : Array.isArray(indexBasename)
        ? indexBasename
        : [indexBasename];
  return list.length > 0 ? list : [DEFAULT_INDEX_BASENAME];
}

/**
 * Whether an index name is a plain file name: one path segment, so a page
 * written as `<name>.md` stays inside its folder. No `/` or `\\`, no leading
 * `.`, no surrounding whitespace, no NUL, not empty, and not `log` (any case):
 * the walk excludes `log.md`, so a section index of that name would never
 * publish. The one rule behind the glossary's and
 * Gherkin's checks of the `indexBasename` setting.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isPlainIndexName(name) {
  return !(
    name === '' ||
    name.toLowerCase() === 'log' ||
    /[/\\]/.test(name) ||
    name.startsWith('.') ||
    name !== name.trim() ||
    name.includes('\0')
  );
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
 * One route collision (FR-004): two or more source paths that the site would
 * serve at the same address, compared case-insensitively. There is no winner:
 * the build, the loader and the strict link check all refuse the tree.
 *
 * @typedef {object} RouteCollision
 * @property {string} route The route of the first path in code-unit order (base-less).
 * @property {string[]} paths Every colliding source path, code-unit sorted.
 */

/**
 * Map a file path under the content root to its route slug, applying the
 * configurable index-basename rule (FR-001/FR-002, D-01). Case-insensitive.
 *
 * With the default (`indexBasename` omitted -> `"README"` only):
 *   "README.md"              -> ""              (bundle root)
 *   "architecture/README.md" -> "architecture"
 *   "architecture/overview.md" -> "architecture/overview"
 *
 * With `indexBasename: ['README', 'index']`, `architecture/index.md` ALSO
 * collapses to `"architecture"`. A file whose basename is not in the
 * configured set is never collapsed — a stray `index.md` under the default
 * stays an ordinary page (NFR-003).
 *
 * Sibling-unaware: it maps one path. Whether two paths share a route is the
 * whole-tree question {@link resolveIndexEntries} answers.
 *
 * @param {string} entry
 * @param {IndexBasenameOptions} [options]
 * @returns {string}
 */
export function readmeToIndexId(entry, options = {}) {
  const withoutExt = entry.replace(/\.mdx?$/i, '');
  const pattern = indexBasenamePattern(normalizeIndexBasenames(options.indexBasename));
  const asIndex = withoutExt.replace(pattern, '$1');
  return asIndex.replace(/\/$/, '');
}

/**
 * Group every path by the route it is served at (case-insensitively) and keep
 * the groups with more than one path (FR-004). Keyed by route, not by folder or
 * index name, so `x/README.md` + `x/index.md` on a `README`-only site collide
 * (both are served at `/x/`) and so do `.md`/`.mdx` pairs and case-only pairs.
 * The one grouping loop behind {@link resolveIndexEntries} (the loader's ids)
 * and {@link detectIndexCollisions} (the bare-Node gate).
 *
 * @param {readonly string[]} paths
 * @param {IndexBasenameOption | undefined} indexBasename
 * @returns {RouteCollision[]}
 */
function groupRouteCollisions(paths, indexBasename) {
  /** @type {Map<string, string[]>} */
  const byRoute = new Map();
  for (const p of paths) {
    const key = routeOfSlug(readmeToIndexId(p, { indexBasename })).toLowerCase();
    const list = byRoute.get(key) ?? [];
    list.push(p);
    byRoute.set(key, list);
  }
  /** @type {RouteCollision[]} */
  const collisions = [];
  for (const files of byRoute.values()) {
    if (files.length <= 1) continue;
    const sorted = [...files].sort(compareCodeUnit);
    collisions.push({ route: routeOfSlug(readmeToIndexId(sorted[0], { indexBasename })), paths: sorted });
  }
  return collisions.sort((a, b) => compareCodeUnit(a.route, b.route));
}

/**
 * Whole-tree twin of {@link readmeToIndexId} and the canonical file-to-slug
 * rule: the content loader (`schema.ts`) uses it for entry ids, and every route
 * table is built from it. Given every Markdown path under a content root,
 * resolves each to its route slug id (`readmeToIndexId`, no demotion) and
 * reports in `collisions` every group of paths served at one route (FR-004).
 * Fs-free: the caller supplies the path list (the shared walk, `docs-walk.mjs`).
 *
 * @param {readonly string[]} paths
 * @param {IndexBasenameOptions} [options]
 * @returns {{ ids: Map<string, string>, collisions: RouteCollision[] }}
 */
export function resolveIndexEntries(paths, options = {}) {
  /** @type {Map<string, string>} */
  const ids = new Map();
  for (const p of paths) ids.set(p, readmeToIndexId(p, options));
  return { ids, collisions: groupRouteCollisions(paths, options.indexBasename) };
}

/**
 * The text of a route-collision failure (FR-004, NFR-003): every colliding
 * source path with the docs folder prefix as the author wrote it, the shared
 * route, and a concrete fix. The one formatter behind the integration, the
 * loader and `check-links --strict`, so the wording cannot drift.
 *
 * @param {readonly RouteCollision[]} collisions
 * @param {{ docsDir: string }} options
 * @returns {string}
 */
export function formatRouteCollisions(collisions, { docsDir }) {
  const dir = docsDir.replace(/\/+$/, '');
  /** @param {string} p */
  const shown = (p) => (dir === '' ? p : `${dir}/${p}`);
  const groups = collisions.map((c) => `  ${c.route}\n${c.paths.map((p) => `    ${shown(p)}`).join('\n')}`);
  const first = collisions[0];
  return [
    `[dk-routes] ${collisions.length} route collision(s) in ${docsDir}: two or more files would be served at the same address.`,
    '',
    groups.join('\n\n'),
    '',
    'Each address can hold one page. Rename or remove all but one file in each group',
    `(for example rename ${shown(first.paths[1])} to a different page id), or merge their content.`,
    'Draft files count: a draft that collides is reported whether drafts are published or not.',
  ].join('\n');
}

/**
 * The loader's reserved id for the bundle root. Astro rejects an empty id, so
 * the root's slug `''` is stored under it (`ROOT_ENTRY_ID` in `metadata.ts`,
 * which cannot be imported here), and Starlight serves that id at `/`. A page
 * whose own slug is `index` (a root `index.md` on a site that does not list
 * `index` as an index name) lands on the same id, so it is published at `/` too.
 */
const ROOT_ENTRY_SLUG = 'index';

/**
 * The route a slug is published at: `''` (the bundle root) and the loader's
 * reserved root id `index` are `/`, a slug ending in `/index` is served at its
 * folder (`x/index` at `/x/`), any other slug is `/<slug>/`. This mirrors
 * Starlight's `slugToParam`, which strips a trailing `/index`: a nested
 * `index.md` on a site whose index names are only `README` has the id `x/index`
 * and is served at `/x/`. Two files can therefore share a route, as they do on
 * the site; `resolveIndexEntries` reports that as a collision.
 * No site base; callers add that (`withBase`).
 *
 * @param {string} slug
 * @returns {string}
 */
export function routeOfSlug(slug) {
  if (slug === '' || slug === ROOT_ENTRY_SLUG) return '/';
  return slug.endsWith('/index') ? `/${slug.slice(0, -'/index'.length)}/` : `/${slug}/`;
}

/**
 * The file stem a generator writes for the page that must act as a section
 * index. With no `prefer`, the first configured index name (config order =
 * priority), so the page collapses to its directory route under any setting.
 * With `prefer: 'index'`, `index` when the list holds it (case-insensitive),
 * else the first: the glossary's pages are committed as `index.md`, so it keeps
 * that name wherever the loader accepts it. Blank entries are ignored, as the
 * detection helpers do.
 *
 * @param {IndexBasenameOption | readonly string[] | undefined} indexBasename
 * @param {{ prefer?: string }} [options]
 * @returns {string}
 */
export function generatedIndexBasename(indexBasename, { prefer } = {}) {
  const names = normalizeIndexBasenames(/** @type {IndexBasenameOption | undefined} */ (indexBasename)).filter(
    (b) => typeof b === 'string' && b !== '',
  );
  const list = names.length > 0 ? names : [DEFAULT_INDEX_BASENAME];
  if (prefer !== undefined && list.some((b) => b.toLowerCase() === prefer.toLowerCase())) return prefer;
  return list[0];
}

/**
 * The published route of every docs page: docs-relative POSIX file path ->
 * root-absolute route. Ids and collisions are resolved over ALL paths first (the
 * loader's rule), THEN every path in `unpublishedPaths` (draft FILE paths, not
 * routes) is dropped from `routes`, so drafts count toward collisions whether
 * drafts are published or not (FR-004).
 *
 * Plain JSON only (no `Map`/`Set`/function): the table is a plugin option and
 * takes part in Astro's config digest, which serialises a `Map` as `{}`. Keys
 * are inserted in code-unit order so two builds of one tree give identical bytes.
 *
 * @param {readonly string[]} paths docs-relative POSIX Markdown paths (shared walk)
 * @param {{ indexBasename?: IndexBasenameOption, unpublishedPaths?: readonly string[] }} [options]
 * @returns {{ routes: Record<string, string>, collisions: RouteCollision[] }}
 */
export function buildRouteTable(paths, { indexBasename, unpublishedPaths = [] } = {}) {
  const { ids, collisions } = resolveIndexEntries(paths, { indexBasename });
  const hidden = new Set(unpublishedPaths);
  /** @type {Record<string, string>} */
  const routes = {};
  for (const p of [...paths].sort(compareCodeUnit)) {
    if (hidden.has(p)) continue;
    routes[p] = routeOfSlug(/** @type {string} */ (ids.get(p)));
  }
  return { routes, collisions };
}

/**
 * Per-segment `encodeURI` of a route, also escaping `?` and `#`: loader ids are
 * verbatim paths, so a segment can hold spaces, capitals or either character.
 *
 * @param {string} route
 * @returns {string}
 */
function encodeRoute(route) {
  return route
    .split('/')
    .map((seg) => encodeURI(seg).replace(/\?/g, '%3F').replace(/#/g, '%23'))
    .join('/');
}

/**
 * Resolve a relative `.md`/`.mdx` link written in `sourcePath` to the route of
 * the page it names, or `null` when it is not a link to a published page:
 * absolute, scheme, `#`-only or root-absolute href; no `.md`/`.mdx` before any
 * `?query`/`#fragment`; target outside the docs root; or a file absent from
 * `routes` (not a page, or an unpublished draft). Resolved against the
 * DIRECTORY of the source file, never a route. The path is URL-decoded before
 * the (case-sensitive) lookup; the query and fragment are appended unchanged.
 *
 * @param {Readonly<Record<string, string>>} routes from {@link buildRouteTable}
 * @param {string} sourcePath docs-relative POSIX path of the page holding the link
 * @param {string} href the href as written
 * @returns {string | null}
 */
export function resolveRelativeDocLink(routes, sourcePath, href) {
  if (typeof href !== 'string' || href === '') return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('/') || href.startsWith('#')) return null;
  const split = /^([^?#]*)([?#][\s\S]*)?$/.exec(href);
  if (!split) return null;
  const rawPath = split[1];
  const suffix = split[2] ?? '';
  if (!/\.mdx?$/i.test(rawPath)) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null; // malformed escape: not a path we can look up
  }
  const parts = sourcePath.split('/').slice(0, -1);
  for (const seg of decoded.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) return null; // leaves the docs root
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  const target = parts.join('/');
  if (!Object.hasOwn(routes, target)) return null;
  return `${encodeRoute(routes[target])}${suffix}`;
}

/**
 * A page is a draft when its `doc_status` is `draft` or absent. This is the one
 * predicate: `isPublished` and `isDraftEntry` in `metadata.ts`, the loader, the
 * integration and the gates all call it (the gates through
 * `draft-publication.mjs`, which re-exports it), and the schema default in
 * `schema.ts` (`draft`) is the same rule applied at parse time.
 *
 * @param {unknown} docStatus
 * @returns {boolean}
 */
export function isDraftStatus(docStatus) {
  return (docStatus ?? 'draft') === 'draft';
}

/**
 * Does `relPath` (ext included) name a configured section-index candidate? The
 * bare-Node detection half of the section-index basename rule
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
 * Route collision detection (FR-004) — the flat-list bare-Node twin, the
 * collision half of {@link resolveIndexEntries} (the same grouping loop).
 *
 * @param {readonly string[]} relPaths
 * @param {IndexBasenameOption} [indexBasename=DEFAULT_INDEX_BASENAME]
 * @returns {RouteCollision[]}
 */
export function detectIndexCollisions(relPaths, indexBasename = DEFAULT_INDEX_BASENAME) {
  return groupRouteCollisions(relPaths, indexBasename);
}
