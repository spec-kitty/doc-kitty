/**
 * Filesystem loader layer over {@link module:vocabulary-core} (#49 IC-01).
 *
 * The thin fs half of the two-layer vocabulary core: it reads
 * `<docsRoot>/_meta/vocabulary.yaml` and `<docsRoot>/_meta/sections.yaml` off
 * disk and hands the raw text to the PURE parsers in `./vocabulary-core.mjs`. It
 * MAY use `node:fs`; therefore `metadata.ts` (which must stay fs-free and must
 * never import `sections.ts`) must NOT import this module — it consumes the pure
 * core directly. This layer is safe for `sections.ts` and the bare-Node
 * `validate-frontmatter.mjs` gate (WP02 rewires both onto it), and it loads
 * under plain `node` with no Astro build context (C-001).
 *
 * Extracted behavior-preserving (DISCIPLINED_REFACTORING) from the fs halves of
 * `sections.ts` — `loadVocabulary` (`:410-415`), `loadSectionRegistry`
 * (`:191-202`) + `parseSectionRegistry` (`:99-181`), `sectionTypes`
 * (`:228-234`), `sectionSubtypes` (`:243-251`) — and their bare-Node twins in
 * `validate-frontmatter.mjs` (`loadVocabulary` `:427-432`, `loadSectionTypes`
 * `:263-282`, `loadSectionSubtypes` `:290-311`). No new dependency: the same
 * `gray-matter` wrap-in-fences trick the toolkit already uses.
 *
 * @module vocabulary-loader
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import {
  compareCodeUnit,
  identityVocabulary,
  parseCharter,
  parseVocabulary,
  parseVocabularyAxis,
} from './vocabulary-core.mjs';

/**
 * @typedef {import('./vocabulary-core.mjs').VocabularyResolver} VocabularyResolver
 * @typedef {import('./vocabulary-core.mjs').SectionSubtypeRule} SectionSubtypeRule
 * @typedef {import('./vocabulary-core.mjs').ResolvedCharter} ResolvedCharter
 * @typedef {import('./vocabulary-core.mjs').VocabularyResolution} VocabularyResolution
 * @typedef {import('./vocabulary-core.mjs').RequiredFieldsPolicy} RequiredFieldsPolicy
 */

/** The vocabulary file, relative to a docs root (`<docsRoot>/_meta/vocabulary.yaml`). */
export const VOCABULARY_REGISTRY_RELPATH = path.join('_meta', 'vocabulary.yaml');

/** The section-registry file, relative to a docs root (`<docsRoot>/_meta/sections.yaml`). */
export const SECTIONS_REGISTRY_RELPATH = path.join('_meta', 'sections.yaml');

/** The charter file, relative to a docs root (`<docsRoot>/_meta/charter.yaml`). */
export const CHARTER_REGISTRY_RELPATH = path.join('_meta', 'charter.yaml');

/**
 * One authored section entry from `sections.yaml` (the subset consumed here).
 *
 * @typedef {object} SectionRegistryEntry
 * @property {string} id Section slug — maps 1:1 to a top-level folder.
 * @property {string} label Display name.
 * @property {number} order Integer sort key; lower first.
 * @property {string} [type] The section-default frontmatter `type` (issue #24).
 * @property {SectionSubtypeRule[]} [subtypes] Sub-path → `type` rules (E-02/FR-005).
 */

/** The resolved registry: entries sorted by `order`, tie-broken by `id`. */
/** @typedef {SectionRegistryEntry[]} SectionRegistry */

/**
 * Load and parse `<docsRoot>/_meta/vocabulary.yaml` into a
 * {@link VocabularyResolver}.
 *
 * A MISSING file is graceful: returns the {@link identityVocabulary} resolver so
 * the shipped default applies unchanged and `Feature` stays valid (NFR-002). A
 * present-but-malformed file THROWS (it is authored, and a silent skip would hide
 * the mistake).
 *
 * @param {string} docsRoot
 * @returns {VocabularyResolver}
 */
export function loadVocabulary(docsRoot) {
  const file = path.join(docsRoot, VOCABULARY_REGISTRY_RELPATH);
  if (!existsSync(file)) return identityVocabulary();
  const raw = readFileSync(file, 'utf8');
  return parseVocabulary(raw, path.relative(process.cwd(), file));
}

/**
 * Read `<docsRoot>/_meta/sections.yaml` and return the parsed, order-sorted
 * registry, or `null` when no registry file is present (graceful fallback — a
 * registry-less tree still derives expectations from the frozen defaults). Uses
 * the same gray-matter wrap-in-fences trick as the toolkit / `validate-catalog`.
 *
 * Only well-formed entries (a string `id`, `label`, and numeric `order`) are
 * kept; `type` and `subtypes` are carried through when present. Sorted by
 * `order` ascending, ties broken by `id`.
 *
 * @param {string} docsRoot
 * @returns {SectionRegistry | null}
 */
export function loadSectionRegistry(docsRoot) {
  const file = path.join(docsRoot, SECTIONS_REGISTRY_RELPATH);
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, 'utf8');
  const data = /** @type {{ sections?: unknown } | null} */ (
    matter(['---', raw, '---', ''].join('\n')).data
  );
  const rawSections = data && typeof data === 'object' ? data.sections : undefined;
  if (!Array.isArray(rawSections)) return null;

  /** @type {SectionRegistry} */
  const entries = [];
  for (const rec of rawSections) {
    if (rec == null || typeof rec !== 'object') continue;
    const { id, label, order, type, subtypes } = /** @type {Record<string, unknown>} */ (rec);
    if (typeof id !== 'string' || id === '') continue;
    if (typeof label !== 'string' || label === '') continue;
    if (typeof order !== 'number' || !Number.isFinite(order)) continue;
    /** @type {SectionRegistryEntry} */
    const entry = { id, label, order };
    if (typeof type === 'string') entry.type = type;
    if (Array.isArray(subtypes)) {
      entry.subtypes = subtypes.filter(
        /** @returns {r is SectionSubtypeRule} */
        (r) =>
          r != null &&
          typeof r === 'object' &&
          typeof (/** @type {Record<string, unknown>} */ (r).match) === 'string' &&
          typeof (/** @type {Record<string, unknown>} */ (r).type) === 'string',
      );
    }
    entries.push(entry);
  }

  entries.sort((a, b) => a.order - b.order || compareCodeUnit(a.id, b.id));
  return entries;
}

/**
 * The `id → type` map — the section-default `type` authority (issue #24). Only
 * entries that declare a string `type` appear; pass the result as the
 * `typesBySection` argument of `expectedDocType` (`./vocabulary-core.mjs`).
 *
 * @param {SectionRegistry} registry
 * @returns {Record<string, string>}
 */
export function sectionTypes(registry) {
  /** @type {Record<string, string>} */
  const types = {};
  for (const entry of registry) {
    if (typeof entry.type === 'string') types[entry.id] = entry.type;
  }
  return types;
}

/**
 * The `id → subtypes[]` map (E-02, FR-005, D-03). Only entries that declare a
 * `subtypes` list appear; pass the result as the `subtypesBySection` argument of
 * `expectedDocType`, ahead of the built-in sub-path table (E-06).
 *
 * @param {SectionRegistry} registry
 * @returns {Record<string, SectionSubtypeRule[]>}
 */
export function sectionSubtypes(registry) {
  /** @type {Record<string, SectionSubtypeRule[]>} */
  const subtypes = {};
  for (const entry of registry) {
    if (Array.isArray(entry.subtypes)) subtypes[entry.id] = entry.subtypes;
  }
  return subtypes;
}

// ---------------------------------------------------------------------------
// Documentation Charter loader (documentation-charter WP02, IC-02/D-01/D-02).
//
// The thin fs half over WP01's fs-free `parseCharter`: it reads
// `<docsRoot>/_meta/charter.yaml`, resolves it through the pure core, and layers
// **per-axis precedence** over the legacy `_meta/{vocabulary,sections}.yaml`
// loaders above. All filesystem access stays HERE; every axis-resolution rule
// stays delegated to `vocabulary-core.mjs` (NFR-004). NFR-002 is the #1
// invariant: with NO charter present, `resolveGovernance` MUST resolve exactly
// as the legacy loaders do today (see the legacy-only fixture in the WP02 test).
// ---------------------------------------------------------------------------

/**
 * The fully-canonical charter (empty body ≡ shipped defaults). Used as the
 * fall-back for the axes that have no legacy file (`statuses`, `required_fields`)
 * when the charter is absent or silent on them. `parseCharter` is pure, so this
 * is a cheap module-level constant.
 *
 * @type {ResolvedCharter}
 */
const CANONICAL_DEFAULTS = parseCharter('');

/**
 * Read + resolve `<docsRoot>/_meta/charter.yaml`, returning both the
 * {@link ResolvedCharter} and the raw top-level mapping (needed to tell which
 * axes the charter DECLARES — `parseCharter`'s resolvers alone cannot reveal
 * declaration). Returns `null` when the file is absent. FAILS CLOSED (T008/C6):
 * a malformed charter rethrows with a message naming the file and the offending
 * key — never a swallowed default.
 *
 * @param {string} docsRoot
 * @returns {{ resolved: ResolvedCharter, data: Record<string, unknown>, source: string } | null}
 */
function parseCharterFile(docsRoot) {
  const file = path.join(docsRoot, CHARTER_REGISTRY_RELPATH);
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, 'utf8');
  const source = path.relative(process.cwd(), file);
  try {
    const resolved = parseCharter(raw, source);
    const parsed = matter(['---', raw, '---', ''].join('\n')).data;
    const data =
      parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? /** @type {Record<string, unknown>} */ (parsed)
        : {};
    return { resolved, data, source };
  } catch (/** @type {unknown} */ err) {
    const detail = err instanceof Error ? err.message : String(err);
    // The pure-core validators already prefix `${source}:` and name the offending
    // key; a raw gray-matter YAML-syntax error does not — name the file for it too.
    throw new Error(
      detail.startsWith(`${source}:`) ? detail : `${source}: malformed charter — ${detail}`,
    );
  }
}

/**
 * Load and resolve `<docsRoot>/_meta/charter.yaml` into a {@link ResolvedCharter}.
 *
 * ABSENT file → `null` (the "no charter" signal; callers fall back to the legacy
 * loaders / canonical defaults). PRESENT file → resolved through WP01's
 * `parseCharter`. A present-but-malformed charter THROWS (fail-closed, T008/C6) —
 * mirroring `loadVocabulary`'s posture that an authored-but-broken file is a hard
 * error, never a silent skip.
 *
 * @param {string} docsRoot
 * @returns {ResolvedCharter | null}
 */
export function loadCharter(docsRoot) {
  const parsed = parseCharterFile(docsRoot);
  return parsed === null ? null : parsed.resolved;
}

/**
 * One-shot guard for the legacy-file deprecation notice (idempotent per build).
 * Reset at a build boundary (or between tests) via {@link resetDeprecationNotice}.
 */
let legacyDeprecationNoticeEmitted = false;

/**
 * Reset the one-shot legacy-deprecation-notice guard. Call at a fresh build
 * boundary; the WP02 test uses it to prove the notice fires exactly once.
 *
 * @returns {void}
 */
export function resetDeprecationNotice() {
  legacyDeprecationNoticeEmitted = false;
}

/**
 * Emit the legacy-file deprecation notice AT MOST ONCE per build (T007/C2) — not
 * once per page/file. Points at the migration guide.
 *
 * @returns {void}
 */
function emitLegacyDeprecationNotice() {
  if (legacyDeprecationNoticeEmitted) return;
  legacyDeprecationNoticeEmitted = true;
  console.warn(
    '[doc-kitty] DEPRECATION: legacy _meta/vocabulary.yaml / _meta/sections.yaml are ' +
      'honored but deprecated — consolidate them into _meta/charter.yaml. ' +
      'See the Documentation Charter migration guide.',
  );
}

/**
 * Read the raw top-level mapping of the legacy `_meta/vocabulary.yaml` (or `null`
 * when absent). Used only to (a) tell whether the legacy file declares the
 * `types`/`kinds` axis and (b) project its axis definition; the RESOLVER itself
 * comes from {@link loadVocabulary} so there is one resolver code path.
 *
 * @param {string} docsRoot
 * @returns {Record<string, unknown> | null}
 */
function readVocabularyData(docsRoot) {
  const file = path.join(docsRoot, VOCABULARY_REGISTRY_RELPATH);
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, 'utf8');
  const parsed = matter(['---', raw, '---', ''].join('\n')).data;
  return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? /** @type {Record<string, unknown>} */ (parsed)
    : {};
}

/**
 * Serializable projection of one vocabulary axis (`{ aliases, forbidden }`),
 * normalized through the pure {@link parseVocabularyAxis}. `forbidden` is a
 * code-unit-sorted array so the projection is deterministic (order-independent).
 * The raw config was already validated by the winning source's parse, so this
 * re-parse never throws.
 *
 * @param {unknown} rawAxis
 * @param {string} axisName
 * @param {string} source
 * @returns {{ aliases: Record<string, string>, forbidden: string[] }}
 */
function projectAxis(rawAxis, axisName, source) {
  const axis = parseVocabularyAxis(rawAxis, axisName, source);
  return {
    aliases: { ...axis.aliases },
    forbidden: [...axis.forbidden].sort(compareCodeUnit),
  };
}

/**
 * @typedef {'charter' | 'legacy' | 'default'} AxisProvenance
 */

/**
 * The resolved governance surface — every axis resolved through **per-axis
 * precedence** (T007/C2/D-02): an axis DECLARED in `charter.yaml` resolves
 * solely from the charter; an axis the charter omits falls back to the legacy
 * file for that axis (if present) else the canonical shipped default. The SAME
 * axis is NEVER partial-merged across charter + legacy.
 *
 * @typedef {object} ResolvedGovernance
 * @property {(term: string | undefined) => VocabularyResolution} resolveType
 * @property {(term: string | undefined) => VocabularyResolution} resolveKind
 * @property {(term: string | undefined) => string} resolveStatus
 * @property {string[]} legalStatuses Canonical ∪ charter-added (deterministic).
 * @property {Record<string, unknown> | import('./vocabulary-loader.mjs').SectionRegistry | null} sections
 *   Charter's raw `sections` mapping when declared, else the legacy
 *   {@link loadSectionRegistry} result (order-sorted array), else `null`.
 * @property {RequiredFieldsPolicy} requiredFields
 * @property {{ types: { aliases: Record<string, string>, forbidden: string[] }, kinds: { aliases: Record<string, string>, forbidden: string[] } }} vocabulary
 *   Serializable `type`/`kind` axis definitions from the winning source.
 * @property {{ types: AxisProvenance, kinds: AxisProvenance, statuses: AxisProvenance, sections: AxisProvenance, requiredFields: AxisProvenance }} sources
 *   Per-axis provenance — which source won each axis.
 * @property {{ fromCharter: boolean, legacyPresent: boolean }} sourceMeta
 */

/**
 * Resolve the effective governance for a docs root (T007). Applies per-axis
 * precedence of `charter.yaml` over the legacy loaders, emits exactly one
 * deprecation notice when any legacy file is present, and fails closed on a
 * malformed charter (via {@link loadCharter}/{@link parseCharterFile}).
 *
 * With NO charter present every axis resolves from the legacy loaders /
 * canonical defaults exactly as today (NFR-002).
 *
 * @param {string} docsRoot
 * @param {{ emitDeprecation?: boolean }} [options] `emitDeprecation` (default
 *   `true`) — pass `false` for a side-effect-free projection (see
 *   `computeEffectiveCharter`).
 * @returns {ResolvedGovernance}
 */
export function resolveGovernance(docsRoot, { emitDeprecation = true } = {}) {
  const charter = parseCharterFile(docsRoot);
  const charterResolved = charter?.resolved ?? null;
  const charterData = charter?.data ?? null;
  const source = charter?.source ?? CHARTER_REGISTRY_RELPATH;

  const legacyVocabPresent = existsSync(path.join(docsRoot, VOCABULARY_REGISTRY_RELPATH));
  const legacySectionsPresent = existsSync(path.join(docsRoot, SECTIONS_REGISTRY_RELPATH));
  const legacyPresent = legacyVocabPresent || legacySectionsPresent;

  if (legacyPresent && emitDeprecation) emitLegacyDeprecationNotice();

  const vocab =
    charterData != null &&
    typeof charterData.vocabulary === 'object' &&
    charterData.vocabulary !== null &&
    !Array.isArray(charterData.vocabulary)
      ? /** @type {Record<string, unknown>} */ (charterData.vocabulary)
      : {};
  const declared = {
    types: charterData != null && vocab.types != null,
    kinds: charterData != null && vocab.kinds != null,
    statuses: charterData != null && charterData.statuses != null,
    sections: charterData != null && charterData.sections != null,
    requiredFields: charterData != null && charterData.required_fields != null,
  };

  // --- types / kinds: per-axis precedence over legacy vocabulary.yaml ---------
  const legacyVocab = loadVocabulary(docsRoot); // identity resolver when absent
  const legacyVocabData = readVocabularyData(docsRoot);
  const legacyHasTypes = legacyVocabData != null && legacyVocabData.types != null;
  const legacyHasKinds = legacyVocabData != null && legacyVocabData.kinds != null;

  const resolveType =
    declared.types && charterResolved ? charterResolved.resolveType : legacyVocab.resolveType;
  const resolveKind =
    declared.kinds && charterResolved ? charterResolved.resolveKind : legacyVocab.resolveKind;

  /** @type {AxisProvenance} */
  const typesSource = declared.types ? 'charter' : legacyHasTypes ? 'legacy' : 'default';
  /** @type {AxisProvenance} */
  const kindsSource = declared.kinds ? 'charter' : legacyHasKinds ? 'legacy' : 'default';

  const typesRaw = declared.types ? vocab.types : legacyHasTypes ? legacyVocabData.types : undefined;
  const kindsRaw = declared.kinds ? vocab.kinds : legacyHasKinds ? legacyVocabData.kinds : undefined;

  // --- statuses: charter or canonical default (no legacy status file) --------
  const statuses =
    declared.statuses && charterResolved
      ? { legalStatuses: charterResolved.legalStatuses, resolveStatus: charterResolved.resolveStatus }
      : {
          legalStatuses: CANONICAL_DEFAULTS.legalStatuses,
          resolveStatus: CANONICAL_DEFAULTS.resolveStatus,
        };

  // --- required_fields: charter or canonical default -------------------------
  const requiredFields =
    declared.requiredFields && charterResolved
      ? charterResolved.requiredFields
      : CANONICAL_DEFAULTS.requiredFields;

  // --- sections: charter's mapping, else legacy sections.yaml, else null -----
  const sections =
    declared.sections && charterResolved
      ? charterResolved.sections
      : legacySectionsPresent
        ? loadSectionRegistry(docsRoot)
        : null;
  /** @type {AxisProvenance} */
  const sectionsSource = declared.sections ? 'charter' : legacySectionsPresent ? 'legacy' : 'default';

  return {
    resolveType,
    resolveKind,
    resolveStatus: statuses.resolveStatus,
    legalStatuses: [...statuses.legalStatuses],
    sections,
    requiredFields: { required: [...requiredFields.required], floor: [...requiredFields.floor] },
    vocabulary: {
      types: projectAxis(typesRaw, 'types', source),
      kinds: projectAxis(kindsRaw, 'kinds', source),
    },
    sources: {
      types: typesSource,
      kinds: kindsSource,
      statuses: declared.statuses ? 'charter' : 'default',
      sections: sectionsSource,
      requiredFields: declared.requiredFields ? 'charter' : 'default',
    },
    sourceMeta: {
      fromCharter: charterResolved !== null && charterResolved.sourceMeta.fromCharter,
      legacyPresent,
    },
  };
}
