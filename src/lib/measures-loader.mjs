// @ts-check
/**
 * Filesystem loader for the measures catalog (ADR-0080).
 *
 * The effective catalog of a docs root is `<docsRoot>/_meta/measures.yaml` when
 * that file exists, else the default this package ships (`./measures-default.mjs`,
 * statically imported so it survives bundling into a page route). A
 * consumer file REPLACES the default wholesale; there is no merge (ADR-0080
 * decision 4). No consumer configuration is involved: an absent file means the
 * default, and a tree that never uses `tom_classification` costs one `stat`.
 *
 * Bare-Node safe (no Astro), so the `validate-catalog.mjs` gate and the build
 * routes share it. YAML is parsed with the `yaml` package the toolkit already
 * depends on, directly rather than through a frontmatter wrapper: a file that
 * opens with the `---` document marker parses, a byte order mark is ignored, and
 * a second document is an error instead of silently dropped records.
 *
 * @module measures-loader
 */

import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parse as parseYaml } from 'yaml';
import { MEASURES_TAG, buildMeasuresIndex, parseMeasuresCatalog } from './measures-core.mjs';
import { DEFAULT_MEASURES } from './measures-default.mjs';

/** @typedef {import('./measures-core.mjs').MeasureRecord} MeasureRecord */

/** The consumer catalog, relative to a docs root. */
export const MEASURES_REGISTRY_RELPATH = path.join('_meta', 'measures.yaml');

/** How messages name the shipped default. */
export const DEFAULT_MEASURES_SOURCE = 'the shipped default catalog';

/**
 * @typedef {object} MeasuresCatalogRead
 * @property {MeasureRecord[]} records
 * @property {string[]} problems
 * @property {string} source the catalog's name in messages
 * @property {boolean} isDefault
 */

/**
 * @typedef {object} MeasuresCatalog
 * @property {Map<string, MeasureRecord>} index
 * @property {MeasureRecord[]} records
 * @property {string} source
 * @property {boolean} isDefault
 */

/** @type {Map<string, { stamp: string, catalog: MeasuresCatalog }>} */
const cache = new Map();

/**
 * Whether the consumer file exists and, if so, its modification time. The cache
 * is keyed on it, so an edit under `astro dev` is picked up without a restart.
 *
 * @param {string} consumer
 * @returns {string}
 */
function stampOf(consumer) {
  try {
    return `file:${statSync(consumer).mtimeMs}`;
  } catch {
    return 'default';
  }
}

/**
 * Read and validate the effective catalog of a docs root. Never throws on a bad
 * catalog: the gate wants every problem.
 *
 * @param {string} docsRoot
 * @returns {MeasuresCatalogRead}
 */
export function readMeasuresCatalog(docsRoot) {
  const consumer = path.join(docsRoot, MEASURES_REGISTRY_RELPATH);
  if (stampOf(consumer) === 'default') {
    // The default is validated like any catalog, so a bad edit to it fails loudly.
    return { ...parseMeasuresCatalog(DEFAULT_MEASURES, DEFAULT_MEASURES_SOURCE), source: DEFAULT_MEASURES_SOURCE, isDefault: true };
  }
  const isDefault = false;
  const source = (path.relative(process.cwd(), consumer) || consumer).split(path.sep).join('/');
  let data;
  try {
    data = parseYaml(readFileSync(consumer, 'utf8').replace(/^\uFEFF/, ''));
  } catch (err) {
    const reason = err instanceof Error ? err.message.split('\n')[0] : String(err);
    return { records: [], problems: [`${MEASURES_TAG} ${source}: cannot be parsed (${reason})`], source, isDefault };
  }
  return { ...parseMeasuresCatalog(data, source), source, isDefault };
}

/**
 * The effective catalog of a docs root, parsed once per root until the consumer
 * file appears, changes or disappears. Throws when the catalog is malformed,
 * which fails the build that asked for it.
 *
 * @param {string} docsRoot
 * @returns {MeasuresCatalog}
 */
export function loadMeasuresCatalog(docsRoot) {
  const key = path.resolve(docsRoot);
  const stamp = stampOf(path.join(key, MEASURES_REGISTRY_RELPATH));
  const hit = cache.get(key);
  if (hit && hit.stamp === stamp) return hit.catalog;
  const { records, problems, source, isDefault } = readMeasuresCatalog(key);
  if (problems.length > 0) throw new Error(problems.join('\n'));
  const catalog = { index: buildMeasuresIndex(records), records, source, isDefault };
  cache.set(key, { stamp, catalog });
  return catalog;
}

/** Forget every loaded catalog (tests). */
export function clearMeasuresCatalogCache() {
  cache.clear();
}
