// @ts-check
/**
 * Filesystem loader for the sub-processor catalog (ADR-0086).
 *
 * The catalog of a docs root is `<docsRoot>/_meta/subprocessors.yaml`. It is
 * optional: an absent file means `present: false` and nothing else, so a tree that
 * never authors it costs one `stat`. DocKitty ships no default records.
 *
 * {@link checkSubprocessorCatalog} is the one entry point. The build integration
 * and the build-free `validate-catalog.mjs` gate both call it, and neither adds or
 * rewrites a message, so the two report the same problems in the same words.
 *
 * Bare-Node safe (no Astro). YAML is parsed with the `yaml` package, as the
 * measures loader does: a file that opens with the `---` document marker parses,
 * a byte order mark is ignored, a second document is an error, and an unquoted
 * `2025-01-15` stays a string (YAML 1.2 core schema), so no time zone is involved.
 *
 * @module subprocessors-loader
 */

import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parse as parseYaml } from 'yaml';
import { SUBPROCESSORS_TAG, checkSubprocessorData, parseSubprocessorCatalog, resolveSubprocessorRecord } from './subprocessors-core.mjs';
import { buildMeasuresIndex } from './measures-core.mjs';
import { readMeasuresCatalog } from './measures-loader.mjs';

/** @typedef {import('./subprocessors-core.mjs').SubprocessorRecord} SubprocessorRecord */
/** @typedef {import('./subprocessors-core.mjs').ResolvedSubprocessor} ResolvedSubprocessor */
/** @typedef {import('./subprocessors-core.mjs').ChangeEntry} ChangeEntry */
/** @typedef {import('./subprocessors-core.mjs').SubprocessorRefs} SubprocessorRefs */

/** The catalog, relative to a docs root. */
export const SUBPROCESSORS_REGISTRY_RELPATH = path.join('_meta', 'subprocessors.yaml');

/**
 * @typedef {object} SubprocessorCatalogCheck
 * @property {boolean} present whether the file exists
 * @property {string} source the catalog's name in messages
 * @property {SubprocessorRecord[]} records every record as authored
 * @property {ResolvedSubprocessor[]} normalised records with references resolved; empty unless `problems` is
 * @property {ChangeEntry[]} changes empty unless `problems` is
 * @property {string[]} problems
 */

/**
 * @param {string} file
 * @returns {boolean}
 */
function exists(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * @param {string} file
 * @returns {string} the path from the working directory, with `/` separators
 */
function labelOf(file) {
  return (path.relative(process.cwd(), file) || file).split(path.sep).join('/');
}

/**
 * Parse a YAML file, or report why it cannot be parsed.
 *
 * @param {string} file
 * @returns {{ ok: true, data: unknown } | { ok: false, reason: string }}
 */
function readYaml(file) {
  try {
    return { ok: true, data: parseYaml(readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message.split('\n')[0] : String(err) };
  }
}

/**
 * Read the catalog file and check its shape only. Never throws.
 *
 * @param {string} docsRoot
 * @param {string} [sourceLabel] the catalog's name in messages; defaults to its path from the working directory
 * @returns {{ present: boolean, source: string, records: SubprocessorRecord[], problems: string[] }}
 */
export function readSubprocessorCatalog(docsRoot, sourceLabel) {
  const file = path.join(docsRoot, SUBPROCESSORS_REGISTRY_RELPATH);
  const source = sourceLabel ?? labelOf(file);
  if (!exists(file)) return { present: false, source, records: [], problems: [] };
  const read = readYaml(file);
  if (!read.ok) {
    return { present: true, source, records: [], problems: [`${SUBPROCESSORS_TAG} ${source}: could not parse YAML: ${read.reason}`] };
  }
  const { records, problems } = parseSubprocessorCatalog(read.data, source);
  return { present: true, source, records, problems };
}

/**
 * The bibliography and tools catalogs beside the sub-processor catalog, as id
 * maps. Lenient on purpose: a malformed file or record is skipped silently,
 * because the citation checks of `validate-catalog.mjs` and the build already
 * report it, and reporting it twice would only add noise.
 *
 * @param {string} docsRoot
 * @returns {Pick<SubprocessorRefs, 'bibliography' | 'tools'>}
 */
export function readCitationRefs(docsRoot) {
  /**
   * @param {string} name
   * @param {string} titleKey
   */
  const load = (name, titleKey) => {
    /** @type {Map<string, any>} */
    const map = new Map();
    const file = path.join(docsRoot, '_meta', name);
    if (!exists(file)) return map;
    const read = readYaml(file);
    if (!read.ok || !Array.isArray(read.data)) return map;
    for (const raw of read.data) {
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const { id, url } = raw;
      const title = raw[titleKey];
      if (typeof id !== 'string' || id === '' || map.has(id)) continue;
      if (typeof title !== 'string' || typeof url !== 'string') continue;
      map.set(id, { [titleKey]: title, url });
    }
    return map;
  };
  return { bibliography: load('bibliography.yaml', 'title'), tools: load('tools.yaml', 'name') };
}

/**
 * Read, check and resolve the catalog of a docs root: the single verdict both the
 * build and the gate report. Never throws.
 *
 * References resolve against the bibliography and tools catalogs beside it and
 * against the effective measures catalog (the consumer's `measures.yaml`, else the
 * shipped default). Problems inside those catalogs are not repeated here; their
 * own checks report them.
 *
 * @param {string} docsRoot
 * @param {string} [sourceLabel]
 * @returns {SubprocessorCatalogCheck}
 */
export function checkSubprocessorCatalog(docsRoot, sourceLabel) {
  const file = path.join(docsRoot, SUBPROCESSORS_REGISTRY_RELPATH);
  const source = sourceLabel ?? labelOf(file);
  const none = { source, records: [], normalised: [], changes: [] };
  if (!exists(file)) return { present: false, ...none, problems: [] };
  const read = readYaml(file);
  if (!read.ok) {
    return { present: true, ...none, problems: [`${SUBPROCESSORS_TAG} ${source}: could not parse YAML: ${read.reason}`] };
  }
  const measures = readMeasuresCatalog(docsRoot);
  /** @type {SubprocessorRefs} */
  const refs = {
    ...readCitationRefs(docsRoot),
    measures: buildMeasuresIndex(measures.records),
    measuresLabel: measures.source,
  };
  const { records, changes, problems } = checkSubprocessorData(read.data, source, refs);
  const normalised = problems.length === 0 ? records.map((record) => resolveSubprocessorRecord(record, refs)) : [];
  return { present: true, source, records, normalised, changes, problems };
}
