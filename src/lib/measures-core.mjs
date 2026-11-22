// @ts-check
/**
 * Measures catalog and TOM classification core (ADR-0080).
 *
 * Pure: no `node:fs`, no YAML parser and no Astro. The fs half is
 * `./measures-loader.mjs`. The build routes (content graph, agent page) and the
 * build-free `validate-catalog.mjs` gate all import THIS module, so the build and
 * the gate cannot disagree on a verdict or its wording: parity by construction,
 * not by a re-implementation kept in step.
 *
 * A measure id is a closed reference, like a citation key: an id that is not in
 * the effective catalog is an error, never a warning (ADR-0080 decision 2).
 *
 * @module measures-core
 */

/** @typedef {'technical' | 'organisational' | 'legal' | 'physical'} MeasureNature */
/** @typedef {'system' | 'organisation'} MeasureScope */
/** @typedef {{ framework: string, ref: string }} FrameworkRef */
/**
 * One record of the measures catalog.
 *
 * @typedef {object} MeasureRecord
 * @property {string} id
 * @property {string} label
 * @property {MeasureNature} nature
 * @property {FrameworkRef[]} frameworks
 * @property {string} [dpv]
 */
/**
 * One normalised `tom_classification` entry.
 *
 * @typedef {object} ClassificationEntry
 * @property {string} measure
 * @property {MeasureScope} scope
 * @property {string} [note]
 */
/**
 * A classification entry joined with its catalog record.
 *
 * @typedef {object} ResolvedClassification
 * @property {string} measure
 * @property {string} label
 * @property {MeasureNature} nature
 * @property {MeasureScope} scope
 * @property {string} [note]
 * @property {string} [dpv]
 * @property {FrameworkRef[]} frameworks
 */

/** The four measure groups, after W3C DPV. */
export const MEASURE_NATURES = /** @type {const} */ (['technical', 'organisational', 'legal', 'physical']);

/** Where a classified measure applies; `system` is the default. British spelling on purpose (ADR-0080). */
export const MEASURE_SCOPES = /** @type {const} */ (['system', 'organisation']);

/** The prefix every measures message carries, in the build and in the gate. */
export const MEASURES_TAG = '[dk-measures]';

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isMapping = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** @param {unknown} v @returns {v is string} */
const isText = (v) => typeof v === 'string' && v !== '';

/**
 * Validate an already-parsed catalog value (the YAML of `_meta/measures.yaml`).
 * Every problem is collected; a record with a problem is left out. Output records
 * have a fixed key order and no unknown keys, so JSON built from them is stable.
 *
 * @param {unknown} data the parsed YAML value (`null`/`undefined` for an empty file)
 * @param {string} label the catalog's name in messages (a path, or the default's name)
 * @returns {{ records: MeasureRecord[], problems: string[] }}
 */
export function parseMeasuresCatalog(data, label) {
  /** @type {MeasureRecord[]} */
  const records = [];
  /** @type {string[]} */
  const problems = [];
  if (data === null || data === undefined) return { records, problems };
  if (!Array.isArray(data)) {
    return { records, problems: [`${MEASURES_TAG} ${label}: must be a YAML list of measure records`] };
  }
  const seen = new Set();
  data.forEach((raw, index) => {
    if (!isMapping(raw)) {
      problems.push(`${MEASURES_TAG} ${label}: record ${index}: is not a mapping`);
      return;
    }
    const name = isText(raw.id) ? raw.id : `record ${index}`;
    const say = (/** @type {string} */ problem) => problems.push(`${MEASURES_TAG} ${label}: ${name}: ${problem}`);
    const before = problems.length;
    if (!isText(raw.id) || !KEBAB.test(raw.id)) say('"id" must be a kebab-case string');
    if (!isText(raw.label)) say('"label" must be a non-empty string');
    if (!MEASURE_NATURES.includes(/** @type {any} */ (raw.nature))) {
      say(`"nature" must be one of ${MEASURE_NATURES.join(', ')}`);
    }
    const frameworks = raw.frameworks;
    const frameworksOk =
      Array.isArray(frameworks) &&
      frameworks.length > 0 &&
      frameworks.every((f) => isMapping(f) && isText(f.framework) && isText(f.ref));
    if (!frameworksOk) say('"frameworks" must be a non-empty list of { framework, ref }');
    if (raw.dpv !== undefined && !(typeof raw.dpv === 'string' && /^https?:\/\//.test(raw.dpv))) {
      say('"dpv" must be an http(s) IRI');
    }
    if (problems.length === before && seen.has(raw.id)) say('duplicate id');
    if (problems.length > before) return;
    seen.add(raw.id);
    records.push({
      id: /** @type {string} */ (raw.id),
      label: /** @type {string} */ (raw.label),
      nature: /** @type {MeasureNature} */ (raw.nature),
      frameworks: /** @type {Array<Record<string, string>>} */ (frameworks).map((f) => ({
        framework: f.framework,
        ref: f.ref,
      })),
      ...(raw.dpv !== undefined ? { dpv: /** @type {string} */ (raw.dpv) } : {}),
    });
  });
  return { records, problems };
}

/**
 * Key validated records by id. `parseMeasuresCatalog` already dropped duplicates.
 *
 * @param {readonly MeasureRecord[]} records
 * @returns {Map<string, MeasureRecord>}
 */
export function buildMeasuresIndex(records) {
  return new Map(records.map((r) => [r.id, r]));
}

/**
 * Normalise one entry, or `null` when it has no valid shape.
 *
 * @param {unknown} raw
 * @returns {ClassificationEntry | null}
 */
function normaliseEntry(raw) {
  if (isText(raw)) return { measure: raw, scope: 'system' };
  if (!isMapping(raw) || !isText(raw.measure)) return null;
  if (raw.scope !== undefined && !MEASURE_SCOPES.includes(/** @type {any} */ (raw.scope))) return null;
  if (raw.note !== undefined && typeof raw.note !== 'string') return null;
  return {
    measure: raw.measure,
    scope: /** @type {MeasureScope} */ (raw.scope ?? 'system'),
    ...(isText(raw.note) ? { note: raw.note } : {}),
  };
}

/**
 * Normalise a `tom_classification` value: a bare id becomes `{ measure, scope: 'system' }`.
 * Entries without a valid shape are dropped here; {@link classificationProblems} reports them.
 *
 * @param {unknown} value
 * @returns {ClassificationEntry[]}
 */
export function normaliseClassification(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => normaliseEntry(raw) ?? []);
}

/**
 * Check a page's classification and resolve it. Shared by the gate (which wants
 * every problem) and the build (which throws on the first set).
 *
 * Duplicates collapse to the first occurrence, keeping its position and note: the
 * graph keeps one edge per (page, measure) pair, so a later note on the same
 * measure would have nowhere to go. One measure under both scopes is an error.
 *
 * @param {unknown} value the raw `tom_classification` value
 * @param {ReadonlyMap<string, MeasureRecord>} index the effective catalog
 * @param {string} page the page's path, for messages
 * @param {string} catalogLabel the catalog's name, for messages
 * @returns {{ resolved: ResolvedClassification[], problems: string[] }}
 */
function check(value, index, page, catalogLabel) {
  /** @type {ResolvedClassification[]} */
  const resolved = [];
  /** @type {string[]} */
  const problems = [];
  if (value === undefined) return { resolved, problems };
  if (!Array.isArray(value)) {
    return { resolved, problems: [`${MEASURES_TAG} ${page}: tom_classification must be a list`] };
  }
  /** @type {Map<string, MeasureScope>} */
  const scopes = new Map();
  /** @type {Set<string>} */
  const conflicting = new Set();
  value.forEach((raw, i) => {
    const entry = normaliseEntry(raw);
    if (entry === null) {
      problems.push(`${MEASURES_TAG} ${page}: tom_classification entry ${i} is not a measure id or { measure, scope?, note? }`);
      return;
    }
    const prior = scopes.get(entry.measure);
    if (prior !== undefined) {
      if (prior !== entry.scope && !conflicting.has(entry.measure)) {
        conflicting.add(entry.measure);
        problems.push(`${MEASURES_TAG} ${page}: measure "${entry.measure}" is listed with both scopes`);
      }
      return;
    }
    scopes.set(entry.measure, entry.scope);
    const record = index.get(entry.measure);
    if (!record) {
      problems.push(`${MEASURES_TAG} ${page}: unknown measure id "${entry.measure}" (not in ${catalogLabel})`);
      return;
    }
    resolved.push({
      measure: entry.measure,
      label: record.label,
      nature: record.nature,
      scope: entry.scope,
      ...(entry.note !== undefined ? { note: entry.note } : {}),
      ...(record.dpv !== undefined ? { dpv: record.dpv } : {}),
      frameworks: record.frameworks,
    });
  });
  return { resolved, problems };
}

/**
 * Every problem with a page's classification, as messages. `[]` when it resolves
 * (or when the page has no `tom_classification`).
 *
 * @param {unknown} value
 * @param {ReadonlyMap<string, MeasureRecord>} index
 * @param {string} page
 * @param {string} catalogLabel
 * @returns {string[]}
 */
export function classificationProblems(value, index, page, catalogLabel) {
  return check(value, index, page, catalogLabel).problems;
}

/**
 * Resolve a page's classification in authored order, or throw an Error whose
 * message lists every problem (each naming the page and, for a miss, the id).
 *
 * @param {unknown} value
 * @param {ReadonlyMap<string, MeasureRecord>} index
 * @param {string} page
 * @param {string} catalogLabel
 * @returns {ResolvedClassification[]}
 */
export function resolveClassification(value, index, page, catalogLabel) {
  const { resolved, problems } = check(value, index, page, catalogLabel);
  if (problems.length > 0) throw new Error(problems.join('\n'));
  return resolved;
}
