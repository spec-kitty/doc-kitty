// @ts-check
/**
 * The `openapi` option (mission openapi-reference-pages, FR-001/FR-007).
 *
 * `normaliseOpenApiOptions` validates the option eagerly and returns the shape the
 * integration publishes from. It is pure apart from reading the spec files, and it
 * never imports `starlight-openapi`: the adopter imports it and passes it as
 * `renderer`, and only a structural check runs here (the version
 * marker, the top-level objects, no reference to another file). Deep schema
 * validation stays with the renderer.
 *
 * Every error starts with `[dk-openapi]` and names the entry by index and label.
 * Errors about a file also name the file.
 *
 * Pure ESM with JSDoc types and no `.d.ts`, like `gherkin/options.mjs`.
 */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

/** Prefix of every error this module throws. */
export const OPENAPI_LOG_PREFIX = '[dk-openapi]';

/** Where the reference pages are mounted when `section` is not given (research R7). */
export const DEFAULT_OPENAPI_SECTION = 'reference/api';

/** The agent API owns this first segment, so no section may be or sit under it. */
export const RESERVED_OPENAPI_ROOT = 'api';

/** The characters a label (or a section segment) may use, after lower-casing (research R6). */
const SAFE_SEGMENT = /^[a-z0-9._-]+$/;

/** File extensions the raw document may have, as published in `openapi.<ext>`. */
const EXTENSIONS = ['yaml', 'yml', 'json'];

/**
 * @typedef {object} ApiVersion
 * @property {string} path Path relative to the site root.
 * @property {string} label Lower-cased label; names the version's address.
 * @property {boolean} released Required; an unreleased version carries a badge.
 */

/**
 * @typedef {object} OpenApiOptions
 * @property {(config: any) => any} renderer Required: the `starlight-openapi` default
 *   export, imported by the adopter (`import starlightOpenAPI from 'starlight-openapi'`).
 * @property {string} [section] Mount point; defaults to {@link DEFAULT_OPENAPI_SECTION}.
 * @property {ApiVersion[]} specs At least one version.
 */

/**
 * @typedef {object} NormalisedApiVersion
 * @property {string} path The path as given.
 * @property {string} absPath The path resolved against the site root.
 * @property {string} label The lower-cased label.
 * @property {boolean} released
 * @property {string} ext Extension of the file (`yaml`, `yml` or `json`), no dot.
 */

/**
 * @typedef {object} NormalisedOpenApiOptions
 * @property {(config: any) => any} renderer The adopter's renderer factory.
 * @property {string} section Validated, without leading or trailing slash.
 * @property {NormalisedApiVersion[]} specs In the order given.
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate the `section` option: `/`-separated segments that each follow the label
 * rule, none of them empty, and not the agent API's reserved root.
 * @param {unknown} raw
 * @returns {string}
 */
function normaliseSection(raw) {
  if (raw === undefined) return DEFAULT_OPENAPI_SECTION;
  const fail = (/** @type {string} */ why) =>
    new Error(`${OPENAPI_LOG_PREFIX} section ${JSON.stringify(raw)}: ${why}`);
  if (typeof raw !== 'string') throw fail('must be a string');
  const segments = raw.split('/');
  if (!segments.every((s) => SAFE_SEGMENT.test(s) && s !== '.' && s !== '..')) {
    throw fail('each "/"-separated segment must be non-empty and use only a-z, 0-9, ".", "_" or "-"');
  }
  if (segments[0] === RESERVED_OPENAPI_ROOT) {
    throw fail(`"${RESERVED_OPENAPI_ROOT}/" is reserved for the agent API`);
  }
  return raw;
}

/**
 * The first `$ref` that points at another file, as a JSON pointer-ish path.
 * @param {unknown} node
 * @param {string} where
 * @returns {string | undefined}
 */
function findExternalRef(node, where = '') {
  if (Array.isArray(node)) {
    for (const [i, child] of node.entries()) {
      const hit = findExternalRef(child, `${where}/${i}`);
      if (hit) return hit;
    }
  } else if (isRecord(node)) {
    for (const [key, child] of Object.entries(node)) {
      if (key === '$ref' && typeof child === 'string' && !child.startsWith('#')) {
        return `${where}/$ref -> ${child}`;
      }
      const hit = findExternalRef(child, `${where}/${key}`);
      if (hit) return hit;
    }
  }
  return undefined;
}

/**
 * Parse YAML or JSON text. gray-matter (js-yaml) is already a dependency; wrapping
 * the text in a collision-proof frontmatter delimiter parses bare YAML (and JSON,
 * which YAML includes).
 * @param {string} text
 * @returns {unknown}
 */
export function parseDocument(text) {
  const delimiter = '~~~DK-OPENAPI-YAML~~~';
  return matter(`${delimiter}\n${text}\n${delimiter}`, { delimiters: delimiter }).data;
}

/**
 * Structural check of a parsed document; throws a reason (no prefix) on failure.
 * @param {unknown} doc
 */
function checkDocument(doc) {
  if (!isRecord(doc)) throw new Error('the file is not an OpenAPI document (expected a mapping)');
  if (typeof doc.swagger === 'string') {
    throw new Error(`Swagger ${doc.swagger} is not supported: OpenAPI 3.x required (3.0 or 3.1)`);
  }
  const version = doc.openapi;
  if (typeof version !== 'string' || !/^3\.[01](\.|$)/.test(version)) {
    throw new Error(
      `not OpenAPI 3.0 or 3.1 (found openapi: ${JSON.stringify(version)}); 3.x required`,
    );
  }
  if (!isRecord(doc.info)) throw new Error('"info" must be an object');
  if (!['paths', 'webhooks', 'components'].some((k) => isRecord(doc[k]))) {
    throw new Error('one of "paths", "webhooks" or "components" must be an object');
  }
  const external = findExternalRef(doc);
  if (external) {
    throw new Error(
      `references another file (${external}); a single self-contained document is required`,
    );
  }
}

/**
 * Read and check one spec file; returns nothing, throws `[dk-openapi]` errors.
 * @param {string} entry `specs[i] "label"`
 * @param {string} specPath As given, for messages.
 * @param {string} absPath
 */
function checkSpecFile(entry, specPath, absPath) {
  const fail = (/** @type {string} */ why) =>
    new Error(`${OPENAPI_LOG_PREFIX} ${entry}: ${why} (${specPath})`);
  let text;
  try {
    if (!statSync(absPath).isFile()) throw new Error('not a file');
    text = readFileSync(absPath, 'utf8');
  } catch {
    throw fail('cannot read the file');
  }
  if (text.trim() === '') throw fail('the file is empty');
  let doc;
  try {
    doc = parseDocument(text);
  } catch (error) {
    throw fail(`cannot parse as YAML or JSON: ${/** @type {Error} */ (error).message.split('\n')[0]}`);
  }
  try {
    checkDocument(doc);
  } catch (error) {
    throw fail(/** @type {Error} */ (error).message);
  }
}

/**
 * Validate one `specs` entry's own fields (not the file).
 * @param {unknown} spec
 * @param {number} index
 * @param {string} siteRoot
 * @returns {NormalisedApiVersion}
 */
function normaliseSpec(spec, index, siteRoot) {
  const name = `specs[${index}]`;
  if (!isRecord(spec)) throw new Error(`${OPENAPI_LOG_PREFIX} ${name}: must be an object`);
  const { path: specPath, label: rawLabel, released } = spec;
  if (typeof rawLabel !== 'string' || rawLabel === '') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${name}: "label" is required`);
  }
  const label = rawLabel.toLowerCase();
  const entry = `${name} "${rawLabel}"`;
  if (!SAFE_SEGMENT.test(label) || label === '.' || label === '..') {
    throw new Error(
      `${OPENAPI_LOG_PREFIX} ${entry}: label may use only a-z, 0-9, ".", "_" and "-" (after lower-casing)`,
    );
  }
  if (typeof released !== 'boolean') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: "released" is required and must be true or false`);
  }
  if (typeof specPath !== 'string' || specPath === '') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: "path" is required`);
  }
  const ext = path.extname(specPath).slice(1).toLowerCase();
  if (!EXTENSIONS.includes(ext)) {
    throw new Error(
      `${OPENAPI_LOG_PREFIX} ${entry}: the file must end in .yaml, .yml or .json (${specPath})`,
    );
  }
  const absPath = path.resolve(siteRoot, specPath);
  checkSpecFile(entry, specPath, absPath);
  return { path: specPath, absPath, label, released, ext };
}

/**
 * Validate and normalise the `openapi` option. Throws `[dk-openapi] …` on the first
 * problem; returns the section and the checked versions otherwise.
 * @param {unknown} raw The option as the adopter wrote it.
 * @param {{ siteRoot: string }} context `path` entries resolve against `siteRoot`.
 * @returns {NormalisedOpenApiOptions}
 */
export function normaliseOpenApiOptions(raw, { siteRoot }) {
  if (!isRecord(raw)) throw new Error(`${OPENAPI_LOG_PREFIX} the openapi option must be an object`);
  const section = normaliseSection(raw.section);
  const { renderer } = raw;
  if (!Array.isArray(raw.specs) || raw.specs.length === 0) {
    throw new Error(`${OPENAPI_LOG_PREFIX} "specs" must list at least one version`);
  }
  /** @type {Map<string, number>} */
  const seen = new Map();
  const specs = raw.specs.map((spec, index) => {
    const normalised = normaliseSpec(spec, index, siteRoot);
    const first = seen.get(normalised.label);
    if (first !== undefined) {
      throw new Error(
        `${OPENAPI_LOG_PREFIX} specs[${index}] "${normalised.label}": duplicate label (same as specs[${first}], case-insensitive)`,
      );
    }
    seen.set(normalised.label, index);
    return normalised;
  });
  if (typeof renderer !== 'function') {
    throw new Error(
      `${OPENAPI_LOG_PREFIX} "renderer" is required: add import starlightOpenAPI from 'starlight-openapi' to astro.config and pass renderer: starlightOpenAPI`,
    );
  }
  return { renderer: /** @type {(config: any) => any} */ (renderer), section, specs };
}
