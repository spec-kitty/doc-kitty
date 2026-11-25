// @ts-check
/**
 * Sub-processor catalog core (ADR-0086).
 *
 * Pure: no `node:fs`, no YAML parser, no Astro and no clock. The fs half is
 * `./subprocessors-loader.mjs`. The build integration and the build-free
 * `validate-catalog.mjs` gate both reach these checks through that loader, so
 * the two cannot disagree on a verdict or its wording.
 *
 * Reference data (the bibliography, tools and measures catalogs) is passed in,
 * never read here, so a test can build it by hand.
 *
 * Messages have the form `[dk-subprocessors] <source>: <subject>: <problem>`.
 * The subject is `subprocessor "<id>"`, or `subprocessor #<n>` (1-based) while the
 * id is missing or invalid. Classification problems keep the measures core's own
 * `[dk-measures]` message.
 *
 * @module subprocessors-core
 */

import { compareCodeUnit } from './vocabulary-core.mjs';
import { classificationProblems, normaliseClassification } from './measures-core.mjs';
import { ISO3166_ALPHA2 } from './subprocessors-iso3166.mjs';

/** @typedef {import('./measures-core.mjs').MeasureRecord} MeasureRecord */
/** @typedef {import('./measures-core.mjs').ClassificationEntry} ClassificationEntry */

/**
 * A record as authored, keyed in {@link SUBPROCESSOR_FIELDS} order. Values are
 * kept as written; only a record with no problems is safe to publish.
 *
 * @typedef {object} SubprocessorRecord
 * @property {string} id
 * @property {string} name
 * @property {string} [address]
 * @property {string} [contact]
 * @property {string} processing
 * @property {string[]} location
 * @property {string} [location_note]
 * @property {string} responsibilities
 * @property {string} since
 * @property {string} [until]
 * @property {unknown[]} [external_references]
 * @property {unknown[]} [tom_classification]
 */

/**
 * A reference as published: a resolved catalog key, or an inline link.
 *
 * @typedef {{ type: 'biblio' | 'tool', id: string, title: string, url: string }
 *   | { url: string, title: string, note?: string }} ResolvedReference
 */

/**
 * A record with its references resolved, ready for the API and the feed.
 *
 * @typedef {Omit<SubprocessorRecord, 'external_references' | 'tom_classification'> & {
 *   external_references?: ResolvedReference[],
 *   tom_classification?: ClassificationEntry[],
 * }} ResolvedSubprocessor
 */

/**
 * One dated change derived from a record.
 *
 * @typedef {object} ChangeEntry
 * @property {string} date `YYYY-MM-DD`
 * @property {'added' | 'removed'} kind
 * @property {string} id
 * @property {string} name
 */

/**
 * The catalogs a record's references resolve against.
 *
 * @typedef {object} SubprocessorRefs
 * @property {ReadonlyMap<string, { title: string, url: string }>} bibliography
 * @property {ReadonlyMap<string, { name: string, url: string }>} tools
 * @property {ReadonlyMap<string, MeasureRecord>} measures
 * @property {string} measuresLabel the measures catalog's name in messages
 */

/** The prefix every sub-processor message carries, in the build and in the gate. */
export const SUBPROCESSORS_TAG = '[dk-subprocessors]';

/** Every field a record may carry, in output order. */
export const SUBPROCESSOR_FIELDS = Object.freeze([
  'id',
  'name',
  'address',
  'contact',
  'processing',
  'location',
  'location_note',
  'responsibilities',
  'since',
  'until',
  'external_references',
  'tom_classification',
]);

/** The fields every record must carry. */
export const REQUIRED_FIELDS = Object.freeze(['id', 'name', 'processing', 'location', 'responsibilities', 'since']);

const TEXT_FIELDS = Object.freeze(['name', 'address', 'contact', 'processing', 'location_note', 'responsibilities']);
const KNOWN = new Set(SUBPROCESSOR_FIELDS);
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isMapping = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** @param {unknown} v @returns {v is string} */
const isText = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * Whether a value is a real calendar day written `YYYY-MM-DD`. Checked by round
 * trip through UTC, so no local time zone is involved.
 *
 * @param {unknown} v
 * @returns {v is string}
 */
function isCalendarDate(v) {
  if (typeof v !== 'string') return false;
  const m = DATE.exec(v);
  if (!m) return false;
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return day.toISOString().slice(0, 10) === v;
}

/**
 * The subject of a record's messages.
 *
 * @param {Record<string, unknown>} raw
 * @param {number} position 1-based
 */
function subjectOf(raw, position) {
  return typeof raw.id === 'string' && KEBAB.test(raw.id) ? `subprocessor "${raw.id}"` : `subprocessor #${position}`;
}

/**
 * Keep the known fields, in output order.
 *
 * @param {Record<string, unknown>} raw
 * @returns {SubprocessorRecord}
 */
function pickKnown(raw) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const field of SUBPROCESSOR_FIELDS) if (field in raw) out[field] = raw[field];
  return /** @type {SubprocessorRecord} */ (out);
}

/**
 * Problems with a record's `location`.
 *
 * @param {unknown} location
 * @param {(problem: string) => void} say
 */
function checkLocation(location, say) {
  if (!Array.isArray(location) || location.length === 0) {
    say('"location" must list at least one country code');
    return;
  }
  const seen = new Set();
  const reported = new Set();
  for (const raw of location) {
    const code = String(raw);
    if (typeof raw === 'string' && ISO3166_ALPHA2.has(raw)) {
      if (seen.has(raw) && !reported.has(raw)) {
        reported.add(raw);
        say(`"location" lists "${raw}" twice`);
      }
      seen.add(raw);
    } else if (typeof raw === 'string' && raw !== raw.toUpperCase() && ISO3166_ALPHA2.has(raw.toUpperCase())) {
      say(`"location" has "${raw}"; write country codes in upper case ("${raw.toUpperCase()}")`);
    } else {
      say(`"location" has "${code}", which is not an assigned ISO 3166-1 alpha-2 code`);
    }
  }
}

/**
 * Validate an already-parsed catalog (the YAML of `_meta/subprocessors.yaml`).
 * Without `refs` only the shape is checked; with them, each record's references
 * are checked right after its shape, so problems follow file order.
 *
 * Every mapping entry comes back in `records`, keyed in field order with unknown
 * keys dropped, whether or not it has problems.
 *
 * @param {unknown} data the parsed YAML (`null` or `undefined` for an empty file)
 * @param {string} source the catalog's name in messages
 * @param {SubprocessorRefs} [refs] the reference catalogs; omit for a shape-only check
 * @returns {{ records: SubprocessorRecord[], problems: string[] }}
 */
export function parseSubprocessorCatalog(data, source, refs) {
  /** @type {SubprocessorRecord[]} */
  const records = [];
  /** @type {string[]} */
  const problems = [];
  if (data === null || data === undefined) return { records, problems };
  if (!Array.isArray(data)) {
    return { records, problems: [`${SUBPROCESSORS_TAG} ${source}: the catalog must be a list of records`] };
  }
  const ids = new Set();
  data.forEach((raw, index) => {
    const position = index + 1;
    if (!isMapping(raw)) {
      problems.push(`${SUBPROCESSORS_TAG} ${source}: subprocessor #${position}: must be a mapping`);
      return;
    }
    const subject = subjectOf(raw, position);
    const say = (/** @type {string} */ problem) => problems.push(`${SUBPROCESSORS_TAG} ${source}: ${subject}: ${problem}`);

    for (const key of Object.keys(raw)) if (!KNOWN.has(key)) say(`unknown field "${key}"`);

    for (const field of REQUIRED_FIELDS) if (!(field in raw)) say(`missing required field "${field}"`);

    if ('id' in raw) {
      if (typeof raw.id !== 'string' || !KEBAB.test(raw.id)) say('id must be kebab-case');
      else if (ids.has(raw.id)) say(`duplicate id "${raw.id}"`);
      else ids.add(raw.id);
    }

    for (const field of TEXT_FIELDS) {
      if (field in raw && !isText(raw[field])) say(`"${field}" must be a non-empty string`);
    }

    if ('location' in raw) checkLocation(raw.location, say);

    const sinceOk = isCalendarDate(raw.since);
    if ('since' in raw && !sinceOk) say('"since" must be a calendar date (YYYY-MM-DD)');
    if ('until' in raw) {
      if (!isCalendarDate(raw.until)) say('"until" must be a calendar date (YYYY-MM-DD)');
      else if (sinceOk && raw.until < /** @type {string} */ (raw.since)) {
        say(`"until" (${raw.until}) is before "since" (${raw.since})`);
      }
    }

    const record = pickKnown(raw);
    if (refs) problems.push(...subprocessorReferenceProblems(record, subject, refs, source));
    records.push(record);
  });
  return { records, problems };
}

/**
 * Whether an `external_references` entry is an inline link.
 *
 * @param {Record<string, unknown>} entry
 */
const isInline = (entry) => isText(entry.url) && isText(entry.title) && !('type' in entry && 'id' in entry);

/**
 * Problems with one record's references: catalog keys that do not resolve, and
 * classifications the measures core rejects (in its own words).
 *
 * @param {SubprocessorRecord} record
 * @param {string} subject the record's name in messages
 * @param {SubprocessorRefs} refs
 * @param {string} source
 * @returns {string[]}
 */
export function subprocessorReferenceProblems(record, subject, refs, source) {
  /** @type {string[]} */
  const problems = [];
  const say = (/** @type {string} */ problem) => problems.push(`${SUBPROCESSORS_TAG} ${source}: ${subject}: ${problem}`);
  const references = record.external_references;
  if (references !== undefined) {
    if (!Array.isArray(references)) {
      say('"external_references" must be a list');
    } else {
      references.forEach((entry, j) => {
        if (isMapping(entry) && 'type' in entry && 'id' in entry) {
          const { type, id } = entry;
          if (type === 'biblio' || type === 'tool') {
            const catalog = type === 'biblio' ? refs.bibliography : refs.tools;
            if (typeof id !== 'string' || !catalog.has(id)) {
              say(`external_references cites ${type} "${String(id)}", which is not in the catalog`);
            }
          } else {
            say(`external_references has unknown type "${String(type)}"`);
          }
        } else if (!(isMapping(entry) && isInline(entry))) {
          say(`external_references entry ${j + 1} must be { url, title } or { type, id }`);
        }
      });
    }
  }
  if (record.tom_classification !== undefined) {
    problems.push(...classificationProblems(record.tom_classification, refs.measures, `${source}: ${subject}`, refs.measuresLabel));
  }
  return problems;
}

/**
 * The dated changes a catalog implies: one `added` entry per `since`, one
 * `removed` entry per `until`. Newest first, then by id, then added before
 * removed, so the order is total and does not depend on file order.
 *
 * @param {SubprocessorRecord[]} records
 * @returns {ChangeEntry[]}
 */
export function deriveChanges(records) {
  /** @type {ChangeEntry[]} */
  const changes = [];
  for (const record of records) {
    changes.push({ date: record.since, kind: 'added', id: record.id, name: record.name });
    if (record.until !== undefined) changes.push({ date: record.until, kind: 'removed', id: record.id, name: record.name });
  }
  return changes.sort(
    (a, b) =>
      compareCodeUnit(b.date, a.date) ||
      compareCodeUnit(a.id, b.id) ||
      (a.kind === b.kind ? 0 : a.kind === 'added' ? -1 : 1),
  );
}

/**
 * A valid record with its references resolved for publishing: catalog keys become
 * `{ type, id, title, url }` (a tool's name is its title), inline links keep
 * `{ url, title, note? }`, and classifications are normalised.
 *
 * @param {SubprocessorRecord} record a record from a catalog with no problems
 * @param {SubprocessorRefs} refs
 * @returns {ResolvedSubprocessor}
 */
export function resolveSubprocessorRecord(record, refs) {
  /** @type {Record<string, unknown>} */
  const out = { ...record };
  if (Array.isArray(record.external_references)) {
    out.external_references = record.external_references.map((raw) => {
      const entry = /** @type {Record<string, unknown>} */ (raw);
      if (entry.type === 'biblio') {
        const hit = /** @type {{ title: string, url: string }} */ (refs.bibliography.get(String(entry.id)));
        return { type: 'biblio', id: entry.id, title: hit.title, url: hit.url };
      }
      if (entry.type === 'tool') {
        const hit = /** @type {{ name: string, url: string }} */ (refs.tools.get(String(entry.id)));
        return { type: 'tool', id: entry.id, title: hit.name, url: hit.url };
      }
      return { url: entry.url, title: entry.title, ...(entry.note !== undefined ? { note: entry.note } : {}) };
    });
  }
  if (record.tom_classification !== undefined) out.tom_classification = normaliseClassification(record.tom_classification);
  return /** @type {ResolvedSubprocessor} */ (out);
}

/**
 * Check a parsed catalog against its reference data: the single verdict both the
 * build and the gate report. `changes` is filled only when there are no problems.
 *
 * @param {unknown} data the parsed YAML
 * @param {string} source
 * @param {SubprocessorRefs} refs
 * @returns {{ records: SubprocessorRecord[], changes: ChangeEntry[], problems: string[] }}
 */
export function checkSubprocessorData(data, source, refs) {
  const { records, problems } = parseSubprocessorCatalog(data, source, refs);
  return { records, changes: problems.length === 0 ? deriveChanges(records) : [], problems };
}
