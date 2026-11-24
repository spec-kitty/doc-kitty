// @ts-check
/**
 * The evidence index's generated-section stamp (#401, WP06), per ADR-0087:
 *
 * ```json
 * "generated": { "by": "doc-kitty-tom-annex/<version>", "at": "<instant>|null",
 *                "source_digest": "sha256:<64 hex>", "content_hash": "sha256:<12 hex>" }
 * ```
 *
 * - `source_digest` follows ADR-0087 D2 exactly: one entry per declared input
 *   (each evidence page's source file, a consumer catalog file, and one
 *   `config:doc-kitty-tom-annex` entry), sorted by the UTF-8 bytes of the key,
 *   written `key NUL value`, joined with `\n`, hashed with sha256.
 * - The configuration entry is the RFC 8785 form of `{base, catalog, site}`:
 *   the site and base change every evidence URL, and the shipped default
 *   catalog (sorted by id) is configuration rather than a file. A consumer
 *   catalog is a file entry instead, and `catalog` is then `null`.
 * - `content_hash` is the first 12 hex of the sha256 of the index as
 *   `serializeTomAnnex` writes it without `generated` (D2, "a producer that
 *   writes JSON").
 * - `at` is the latest `updated` or `verified[].at` among the listed evidence,
 *   or `null`. It never comes from the clock, so two builds of the same tree
 *   write the same bytes (D5, #300).
 *
 * Hashing uses `node:crypto`, so this module is build-time only (the route and
 * the CLI); `core.mjs` stays free of it.
 *
 * @module tom-annex/stamp
 */

import { createHash } from 'node:crypto';
import { canonicalJson } from '../packs/canonical-json.mjs';
import { toolkitVersion } from '../generator-stamp.mjs';
import { compareCodeUnit, formatInstant, normaliseInstant } from '../vocabulary-core.mjs';
import { serializeTomAnnex } from './core.mjs';

/** The producer id (ADR-0083), the `by` prefix and the configuration key's suffix. */
export const TOM_ANNEX_PRODUCER = 'doc-kitty-tom-annex';

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** @param {string | Uint8Array} data @returns {string} lowercase hex sha256 */
const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');

/** @param {string} p a path with either separator @returns {string} POSIX, no leading `./` */
const posix = (p) => p.split('\\').join('/').replace(/^\.\//, '');

/**
 * ADR-0087 D2: the source digest of a set of entries.
 *
 * @param {ReadonlyArray<{ key: string, sha256: string }>} entries
 * @returns {string} `sha256:<64 hex>`
 */
export function sourceDigest(entries) {
  const seen = new Set();
  for (const { key, sha256 } of entries) {
    if (seen.has(key)) throw new Error(`[dk-tom-annex] source digest: the input ${key} is listed twice`);
    seen.add(key);
    if (!SHA256_HEX.test(sha256)) throw new Error(`[dk-tom-annex] source digest: ${key} has ${JSON.stringify(sha256)}, not a lowercase 64-hex sha256`);
  }
  // UTF-8 byte order (= code-point order), not UTF-16 code units: D2 step 2.
  const sorted = [...entries].sort((a, b) => Buffer.compare(Buffer.from(a.key, 'utf8'), Buffer.from(b.key, 'utf8')));
  return `sha256:${sha256Hex(Buffer.from(sorted.map((e) => `${e.key}\0${e.sha256}`).join('\n'), 'utf8'))}`;
}

/**
 * @typedef {object} AnnexConfig
 * @property {string} base
 * @property {Array<Record<string, unknown>> | null} catalog the default catalog's records sorted by id, or null for a consumer catalog
 * @property {string} site
 */

/**
 * The options that change the rendered index (D2, configuration entry).
 *
 * @param {{ site: URL | string | undefined, base: string, catalog: { records: ReadonlyArray<Record<string, any>>, isDefault: boolean } }} args
 * @returns {AnnexConfig}
 */
export function annexConfig({ site, base, catalog }) {
  return {
    base,
    catalog: catalog.isDefault ? [...catalog.records].sort((a, b) => compareCodeUnit(a.id, b.id)) : null,
    site: site === undefined ? '' : String(site),
  };
}

/**
 * The declared inputs of the index, as D2 entries.
 *
 * @param {object} args
 * @param {ReadonlyArray<{ path: string, bytes: string | Uint8Array }>} args.evidencePages each evidence page's project-relative source path and bytes (a page may repeat)
 * @param {{ path: string, bytes: string | Uint8Array }} [args.catalogFile] the consumer catalog, required when `config.catalog` is null
 * @param {AnnexConfig} args.config
 * @returns {Array<{ key: string, sha256: string }>}
 */
export function annexInputs({ evidencePages, catalogFile, config }) {
  /** @type {Map<string, string>} */
  const files = new Map();
  for (const { path, bytes } of evidencePages) files.set(posix(path), sha256Hex(bytes));
  if (config.catalog === null) {
    if (catalogFile === undefined) throw new Error('[dk-tom-annex] source digest: a consumer catalog needs its catalog file as an input');
    files.set(posix(catalogFile.path), sha256Hex(catalogFile.bytes));
  }
  return [
    ...[...files].map(([key, sha256]) => ({ key, sha256 })),
    { key: `config:${TOM_ANNEX_PRODUCER}`, sha256: sha256Hex(Buffer.from(canonicalJson(config), 'utf8')) },
  ];
}

/**
 * The source files (relative to the docs root) of the pages a `classified-as`
 * edge starts from: the index's evidence pages, each once, sorted.
 *
 * @param {{ edges: ReadonlyArray<{ rel: string, source: string }> }} graph
 * @param {Readonly<Record<string, { file?: string }>>} locations by graph node id
 * @returns {string[]}
 */
export function evidenceSourceFiles(graph, locations) {
  const files = new Set();
  for (const edge of graph.edges) {
    if (edge.rel !== 'classified-as') continue;
    const file = locations[edge.source]?.file;
    if (typeof file !== 'string') throw new Error(`[dk-tom-annex] source digest: the evidence page ${edge.source} has no source file`);
    files.add(posix(file));
  }
  return [...files].sort(compareCodeUnit);
}

/**
 * @param {import('./core.mjs').TomAnnex} annex with or without `generated`
 * @returns {string} `sha256:<12 hex>`
 */
export function contentHash(annex) {
  const { generated: _generated, ...body } = /** @type {any} */ (annex);
  void _generated;
  return `sha256:${sha256Hex(serializeTomAnnex(body)).slice(0, 12)}`;
}

/**
 * The latest `updated` or `verified[].at` of the evidence the index lists.
 *
 * @param {import('./core.mjs').TomAnnex} annex
 * @returns {string | null}
 */
export function annexInstant(annex) {
  let latest = /** @type {Date | null} */ (null);
  /** @param {unknown} value */
  const consider = (value) => {
    const instant = normaliseInstant(value)?.date;
    if (instant && (latest === null || instant.getTime() > latest.getTime())) latest = instant;
  };
  for (const scope of Object.values(annex.scopes)) {
    for (const entry of scope) {
      for (const ref of entry.evidence) {
        consider(ref.updated);
        for (const v of ref.verified ?? []) consider(v.at);
      }
    }
  }
  return latest === null ? null : formatInstant(latest);
}

/**
 * The index with its `generated` stamp, in schema position (after `notice`).
 *
 * @param {import('./core.mjs').TomAnnex} annex
 * @param {{ inputs: ReadonlyArray<{ key: string, sha256: string }> }} args
 */
export function stampAnnex(annex, { inputs }) {
  const { format, format_version, label, notice, catalog, scopes, uncovered, counsel } = annex;
  return {
    format,
    format_version,
    label,
    notice,
    generated: {
      by: `${TOM_ANNEX_PRODUCER}/${toolkitVersion()}`,
      at: annexInstant(annex),
      source_digest: sourceDigest(inputs),
      content_hash: contentHash(annex),
    },
    catalog,
    scopes,
    uncovered,
    counsel,
  };
}
