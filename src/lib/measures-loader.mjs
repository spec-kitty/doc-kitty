// @ts-check
/**
 * Filesystem loader for the measures catalog (ADR-0080).
 *
 * The effective catalog of a docs root is `<docsRoot>/_meta/measures.yaml` when
 * that file exists, else the default this package ships (`./measures-default.mjs`,
 * statically imported so it survives bundling into a page route). A
 * consumer file REPLACES the default wholesale; there is no merge (ADR-0080
 * decision 4). No consumer configuration is involved: an absent file means the
 * default, and a tree that never uses `tom_classification` costs one existence
 * check.
 *
 * Bare-Node safe (no Astro), so the `validate-catalog.mjs` gate and the build
 * routes share it. YAML is read with gray-matter's engine by wrapping the file
 * in frontmatter fences, the same way `vocabulary-loader.mjs` does: no new
 * dependency.
 *
 * @module measures-loader
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
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

/** @type {Map<string, MeasuresCatalog>} */
const cache = new Map();

/**
 * Read and validate the effective catalog of a docs root. Never throws on a bad
 * catalog: the gate wants every problem.
 *
 * @param {string} docsRoot
 * @returns {MeasuresCatalogRead}
 */
export function readMeasuresCatalog(docsRoot) {
  const consumer = path.join(docsRoot, MEASURES_REGISTRY_RELPATH);
  if (!existsSync(consumer)) {
    // The default is validated like any catalog, so a bad edit to it fails loudly.
    return { ...parseMeasuresCatalog(DEFAULT_MEASURES, DEFAULT_MEASURES_SOURCE), source: DEFAULT_MEASURES_SOURCE, isDefault: true };
  }
  const isDefault = false;
  const source = path.relative(process.cwd(), consumer) || consumer;
  let data;
  try {
    data = matter(['---', readFileSync(consumer, 'utf8'), '---', ''].join('\n')).data;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { records: [], problems: [`${MEASURES_TAG} ${source}: cannot be parsed (${reason})`], source, isDefault };
  }
  // gray-matter returns `{}` for an empty block; treat that as an empty file.
  const value = data !== null && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0 ? null : data;
  return { ...parseMeasuresCatalog(value, source), source, isDefault };
}

/**
 * The effective catalog of a docs root, parsed once per root per process. Throws
 * when the catalog is malformed, which fails the build that asked for it.
 *
 * @param {string} docsRoot
 * @returns {MeasuresCatalog}
 */
export function loadMeasuresCatalog(docsRoot) {
  const key = path.resolve(docsRoot);
  const hit = cache.get(key);
  if (hit) return hit;
  const { records, problems, source, isDefault } = readMeasuresCatalog(key);
  if (problems.length > 0) throw new Error(problems.join('\n'));
  const catalog = { index: buildMeasuresIndex(records), records, source, isDefault };
  cache.set(key, catalog);
  return catalog;
}

/** Forget every loaded catalog (tests; a dev server that edits the file). */
export function clearMeasuresCatalogCache() {
  cache.clear();
}
