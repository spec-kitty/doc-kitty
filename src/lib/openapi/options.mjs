// @ts-check
/**
 * The `openapi` option (mission openapi-reference-pages, FR-001/FR-007; second
 * slice WP02: the full static shape of contracts/config-options.md).
 *
 * `normaliseOpenApiOptions` validates everything that needs no filesystem or
 * network: types, the label and section rules (both route-safe, no dots),
 * `https`-only remote URLs with their pinned
 * sha256, the archive's glob and labelPattern, and the flags. It never reads a
 * file — reading, parsing and the structural check moved to
 * `materialise.mjs` (WP02), which runs it at config time and returns the one
 * materialised list every surface reads. `normaliseOpenApiOptions` also never
 * imports `starlight-openapi`: the adopter imports it and passes it as
 * `renderer`, and the check that it is a function runs LAST, after the specs.
 *
 * `parseDocument` stays here (the build assertions import it): the `yaml`
 * package's parse, with the FR-028 alias limit applied on demand. A marked
 * error (`dkOpenApiAliasLimit`) reports an over-limit document so a caller can
 * tell "too many aliases" from "cannot parse".
 *
 * Every error starts with `[dk-openapi]` and names the entry by index and
 * label; a URL is echoed with its query string redacted.
 *
 * Pure ESM with JSDoc types and no `.d.ts`, like `gherkin/options.mjs`.
 */
import path from 'node:path';
import { isAlias, isMap, isPair, isSeq, parseDocument as parseYamlDocument } from 'yaml';

/** Prefix of every error this module throws. */
export const OPENAPI_LOG_PREFIX = '[dk-openapi]';

/** Where the reference pages are mounted when `section` is not given (research R7). */
export const DEFAULT_OPENAPI_SECTION = 'reference/api';

/** The agent API owns this first segment, so no section may be or sit under it. */
export const RESERVED_OPENAPI_ROOT = 'api';

/**
 * The characters a version label may use — and, the same rule (#259), a
 * `section` segment: a-z, 0-9, `_` and `-` after lower-casing, never a dot.
 * The pinned renderer slugifies page routes and drops dots (`v1.1` routes as
 * `v11`), so a dotted label or section segment would advertise an address the
 * site does not serve; the archive source enforces the same rule on derived
 * labels (maintainer decision 2026-11-08; ADR-0078).
 */
const ROUTE_SAFE_SEGMENT = /^[a-z0-9_-]+$/;

/**
 * A version labelled `index` would be served at `<section>/index/`, which the
 * agent index, content graph and OKF map to the section page itself.
 */
export const RESERVED_LABEL = 'index';

/** File extensions the raw document may have, as published in `openapi.<ext>`. */
const EXTENSIONS = ['yaml', 'yml', 'json'];

/** The shape of a pinned digest. */
const SHA256 = /^[0-9a-f]{64}$/;

/**
 * @typedef {object} ApiVersion
 * @property {string} [path] Local file, `.yaml`/`.yml`/`.json`. Exactly one of
 *   `path` and `url` is required.
 * @property {string} [url] Remote document, `https://` only; requires `sha256`.
 * @property {string} [sha256] 64 lowercase hex: required with `url`, an
 *   optional pin with `path` (verified at materialisation).
 * @property {string} label Lower-cased label; names the version's address.
 * @property {boolean} released Required; an unreleased version carries a badge.
 */

/**
 * @typedef {object} OpenApiArchiveOptions
 * @property {string} glob Site-root-relative; no `..`, never absolute.
 * @property {string} labelPattern Compiles, and has exactly one capturing group.
 * @property {boolean} [released] Defaults to true.
 */

/**
 * @typedef {object} OpenApiOptions
 * @property {(config: any) => any} renderer Required: the `starlight-openapi` default
 *   export, imported by the adopter (`import starlightOpenAPI from 'starlight-openapi'`).
 * @property {string} [section] Mount point; defaults to {@link DEFAULT_OPENAPI_SECTION}.
 * @property {ApiVersion[]} [specs] At least one version unless `archive` is set.
 * @property {OpenApiArchiveOptions} [archive] Scans a folder for versions (WP08).
 * @property {boolean} [llmsOperations] Default false (FR-014).
 * @property {boolean} [offline] Default: `process.env.DOCKITTY_OFFLINE === '1'`.
 */

/**
 * @typedef {object} NormalisedSpecInput
 * @property {'file' | 'remote'} kind
 * @property {string} label The lower-cased label.
 * @property {boolean} released
 * @property {string} ext Extension of the document (`yaml`, `yml` or `json`), no dot.
 * @property {string} [path] The path as given (`file`).
 * @property {string} [absPath] The path resolved against the site root (`file`).
 * @property {string} [url] As given (`remote`).
 * @property {string} [sha256] The optional pin (`file`) or the required digest (`remote`).
 */

/**
 * @typedef {object} NormalisedArchiveOptions
 * @property {string} glob
 * @property {string} labelPattern
 * @property {boolean} released
 */

/**
 * @typedef {object} NormalisedOpenApiOptions
 * @property {(config: any) => any} renderer The adopter's renderer factory.
 * @property {string} section Validated, without leading or trailing slash.
 * @property {NormalisedSpecInput[]} specs In the order given (FR-023).
 * @property {NormalisedArchiveOptions | undefined} archive
 * @property {boolean} llmsOperations
 * @property {boolean} offline
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const SPEC_KEYS = ['path', 'url', 'sha256', 'label', 'released'];
const ARCHIVE_KEYS = ['glob', 'labelPattern', 'released'];
const TOP_LEVEL_KEYS = ['renderer', 'section', 'specs', 'archive', 'llmsOperations', 'offline'];

/**
 * Levenshtein distance, for the "did you mean" hint on an unknown key.
 * @param {string} a @param {string} b @returns {number}
 */
function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        /** @type {number} */ (previous[j]) + 1,
        /** @type {number} */ (row[j - 1]) + 1,
        /** @type {number} */ (previous[j - 1]) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = row;
  }
  return /** @type {number} */ (previous[b.length]);
}

/**
 * Warn (never throw: the first slice shipped these options) about each key an
 * option object carries that the contract does not know, so a dropped
 * integrity pin such as `sha` for `sha256` does not vanish unnoticed.
 * @param {Record<string, unknown>} object
 * @param {string[]} known
 * @param {string} where The ref the message starts with.
 */
function warnUnknownKeys(object, known, where) {
  for (const key of Object.keys(object)) {
    if (known.includes(key)) continue;
    let closest;
    let best = 3;
    for (const candidate of known) {
      // A truncated key (`sha` for `sha256`) is a prefix, however long the tail.
      const prefix = key.length >= 3 && candidate.toLowerCase().startsWith(key.toLowerCase());
      const distance = prefix ? 0 : editDistance(key.toLowerCase(), candidate.toLowerCase());
      if (distance < best) {
        best = distance;
        closest = candidate;
      }
    }
    const hint = closest === undefined ? '' : `; did you mean "${closest}"?`;
    console.warn(`${OPENAPI_LOG_PREFIX} ${where}: unknown option "${key}" is ignored${hint}`);
  }
}

/** A URL as quoted in a message: its query string redacted (`?…`). */
const redactUrl = (/** @type {string} */ url) => (url.includes('?') ? `${url.slice(0, url.indexOf('?'))}?…` : url);

/**
 * Count the alias nodes of a parsed document's tree. The `yaml` package's own
 * alias guard catches only exponential bombs, so the FR-028 count is walked
 * here; an alias node counts once and is not resolved.
 * @param {unknown} node
 * @returns {number}
 */
function countAliases(node) {
  if (node === null || typeof node !== 'object') return 0;
  if (isAlias(node)) return 1;
  if (isMap(node)) {
    let total = 0;
    for (const pair of node.items) {
      if (isPair(pair)) total += countAliases(pair.key) + countAliases(pair.value);
    }
    return total;
  }
  if (isSeq(node)) {
    let total = 0;
    for (const item of node.items) total += countAliases(item);
    return total;
  }
  return 0;
}

/** An over-limit document, marked so a caller can tell it from a parse failure. */
function aliasLimitError(/** @type {string} */ message) {
  const error = new Error(message);
  /** @type {Error & { dkOpenApiAliasLimit?: boolean }} */ (error).dkOpenApiAliasLimit = true;
  return error;
}

/**
 * Parse YAML or JSON text into a plain value (JSON is YAML). Throws the
 * parser's first error on a bad document, or a marked alias error when the
 * document carries more than `maxAliasCount` aliases (FR-028).
 * @param {string} text
 * @param {{ maxAliasCount?: number }} [options]
 * @returns {unknown}
 */
export function parseDocument(text, options = {}) {
  const doc = parseYamlDocument(text);
  if (doc.errors.length > 0) {
    const failure = doc.errors[0];
    // The parser flags some alias abuse itself; report it under the alias limit,
    // not as an unparsable document.
    if (/alias/i.test(String(failure.message))) {
      throw aliasLimitError(`the document's YAML aliases are too many: ${failure.message}`);
    }
    throw failure;
  }
  if (options.maxAliasCount !== undefined) {
    const count = countAliases(doc.contents);
    if (count > options.maxAliasCount) {
      throw aliasLimitError(`the document carries ${count} YAML aliases, over the limit of ${options.maxAliasCount}`);
    }
  }
  return doc.toJS();
}

/**
 * Validate the `section` option: `/`-separated segments that each follow the
 * label rule (route-safe, no dots), none of them empty, and not the agent API's
 * reserved root.
 * @param {unknown} raw
 * @returns {string}
 */
function normaliseSection(raw) {
  if (raw === undefined) return DEFAULT_OPENAPI_SECTION;
  const fail = (/** @type {string} */ why) =>
    new Error(`${OPENAPI_LOG_PREFIX} section ${JSON.stringify(raw)}: ${why}`);
  if (typeof raw !== 'string') throw fail('must be a string');
  const segments = raw.split('/');
  if (!segments.every((segment) => ROUTE_SAFE_SEGMENT.test(segment))) {
    throw fail(sectionProblem(segments));
  }
  if (segments[0] === RESERVED_OPENAPI_ROOT) {
    throw fail(`"${RESERVED_OPENAPI_ROOT}/" is reserved for the agent API`);
  }
  return raw;
}

/**
 * The refusal for a section whose segments broke the route-safe rule: a dot is
 * named with the label rule's own fix (a hyphen), anything else gets the
 * character rule itself.
 * @param {string[]} segments
 * @returns {string}
 */
function sectionProblem(segments) {
  if (segments.some((segment) => segment.includes('.'))) {
    return 'a segment may not contain "." (the renderer drops dots from routes); use a hyphen instead, for example "v1-1"';
  }
  return 'each "/"-separated segment must be non-empty and use only a-z, 0-9, "_" and "-"';
}

/**
 * Validate the fields every `specs` entry shares: `label` (non-empty, then the
 * dot-free route-safe rule after lower-casing) and the required `released`
 * flag.
 * @param {Record<string, unknown>} spec
 * @param {string} name The index ref (`specs[i]`), for the first message.
 * @returns {{ label: string; released: boolean; entry: string }} The
 *   lower-cased label, the flag, and the labelled ref the rest of the
 *   entry's messages use.
 */
function normaliseLabel(spec, name) {
  const { label: rawLabel, released } = spec;
  if (typeof rawLabel !== 'string' || rawLabel === '') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${name}: "label" is required`);
  }
  const label = rawLabel.toLowerCase();
  const entry = `${name} "${rawLabel}"`;
  if (label.includes('.')) {
    throw new Error(
      `${OPENAPI_LOG_PREFIX} ${entry}: label may not contain "." (the renderer drops dots from routes); use a hyphen instead, for example "v1-1"`,
    );
  }
  if (!ROUTE_SAFE_SEGMENT.test(label)) {
    throw new Error(
      `${OPENAPI_LOG_PREFIX} ${entry}: label may use only a-z, 0-9, "_" and "-" (after lower-casing)`,
    );
  }
  if (label === RESERVED_LABEL) {
    throw new Error(
      `${OPENAPI_LOG_PREFIX} ${entry}: label "index" is reserved (the renderer serves it at <section>/index/ while the agent index and content graph map it to the section page); choose another label, for example "latest"`,
    );
  }
  if (typeof released !== 'boolean') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: "released" is required and must be true or false`);
  }
  return { label, released, entry };
}

/**
 * Validate a digest's shape: 64 lowercase hex characters.
 * @param {string} entry
 * @param {unknown} sha256
 * @param {string} suffix The message's trailing context (empty for a file pin).
 */
function normaliseSha256(entry, sha256, suffix) {
  if (typeof sha256 !== 'string' || !SHA256.test(sha256)) {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: "sha256" must be 64 lowercase hex characters${suffix}`);
  }
}

/**
 * Validate a remote spec entry (static only: nothing is fetched). The url must
 * be `https` without userinfo and end in a known extension, and carry a
 * well-formed required sha256.
 * @param {string} entry
 * @param {unknown} url
 * @param {unknown} sha256
 * @param {{ label: string; released: boolean }} shared
 * @returns {NormalisedSpecInput}
 */
function normaliseRemoteSpec(entry, url, sha256, { label, released }) {
  if (typeof url !== 'string' || url === '') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: "url" must be a string`);
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: "url" must be a valid URL (${redactUrl(url)})`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: https is required for a remote spec (${redactUrl(url)})`);
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: userinfo is not allowed in a remote spec url (${redactUrl(url)})`);
  }
  const ext = path.extname(parsed.pathname).slice(1).toLowerCase();
  if (!EXTENSIONS.includes(ext)) {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: the url must end in .yaml, .yml or .json (${redactUrl(url)})`);
  }
  if (typeof sha256 !== 'string' || sha256 === '') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: sha256 is required for a remote spec (${redactUrl(url)})`);
  }
  normaliseSha256(entry, sha256, ` (${redactUrl(url)})`);
  return { kind: 'remote', label, released, ext, url, sha256 };
}

/**
 * Validate a local file spec entry (static only: no file is read). The path
 * must end in a known extension and may carry an optional sha256 pin, checked
 * at materialisation.
 * @param {string} entry
 * @param {unknown} specPath
 * @param {unknown} sha256
 * @param {string} siteRoot
 * @param {{ label: string; released: boolean }} shared
 * @returns {NormalisedSpecInput}
 */
function normaliseFileSpec(entry, specPath, sha256, siteRoot, { label, released }) {
  if (typeof specPath !== 'string' || specPath === '') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: "path" is required`);
  }
  const ext = path.extname(specPath).slice(1).toLowerCase();
  if (!EXTENSIONS.includes(ext)) {
    throw new Error(
      `${OPENAPI_LOG_PREFIX} ${entry}: the file must end in .yaml, .yml or .json (${specPath})`,
    );
  }
  if (sha256 !== undefined) {
    normaliseSha256(entry, sha256, '');
  }
  return {
    kind: 'file',
    path: specPath,
    absPath: path.resolve(siteRoot, specPath),
    label,
    released,
    ext,
    ...(sha256 === undefined ? {} : { sha256 }),
  };
}

/**
 * Validate one `specs` entry's own fields (static only: no file is read): the
 * shared shape, then exactly one of the `path` and `url` forms, each validated
 * by its own helper.
 * @param {unknown} spec
 * @param {number} index
 * @param {string} siteRoot
 * @returns {NormalisedSpecInput}
 */
function normaliseSpec(spec, index, siteRoot) {
  const name = `specs[${index}]`;
  if (!isRecord(spec)) throw new Error(`${OPENAPI_LOG_PREFIX} ${name}: must be an object`);
  const { path: specPath, url, sha256 } = spec;
  const { label, released, entry } = normaliseLabel(spec, name);
  warnUnknownKeys(spec, SPEC_KEYS, entry);
  const hasPath = specPath !== undefined;
  const hasUrl = url !== undefined;
  if (hasPath === hasUrl) {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: exactly one of "path" and "url" is required`);
  }
  if (hasUrl) {
    return normaliseRemoteSpec(entry, url, sha256, { label, released });
  }
  return normaliseFileSpec(entry, specPath, sha256, siteRoot, { label, released });
}

/**
 * Validate the `archive` option's own fields (static only: no folder is scanned).
 * @param {unknown} raw
 * @returns {NormalisedArchiveOptions}
 */
function normaliseArchive(raw) {
  if (!isRecord(raw)) throw new Error(`${OPENAPI_LOG_PREFIX} "archive" must be an object`);
  warnUnknownKeys(raw, ARCHIVE_KEYS, 'archive');
  const { glob, labelPattern, released = true } = raw;
  if (typeof glob !== 'string' || glob === '') {
    throw new Error(`${OPENAPI_LOG_PREFIX} "archive".glob is required`);
  }
  const ref = `archive ${JSON.stringify(glob)}`;
  if (path.isAbsolute(glob) || glob.split(/[\\/]/).includes('..')) {
    throw new Error(
      `${OPENAPI_LOG_PREFIX} ${ref}: archive glob must be relative to the site root and stay inside it (${glob})`,
    );
  }
  if (typeof labelPattern !== 'string' || labelPattern === '') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${ref}: "archive".labelPattern is required`);
  }
  try {
    new RegExp(labelPattern);
  } catch {
    throw new Error(
      `${OPENAPI_LOG_PREFIX} ${ref}: labelPattern must compile as a regular expression (${labelPattern})`,
    );
  }
  // `pattern|` also matches the empty string through the added empty branch, so
  // a successful match's array length is 1 + the pattern's capturing-group count.
  if (new RegExp(`${labelPattern}|`).exec('')?.length !== 2) {
    throw new Error(
      `${OPENAPI_LOG_PREFIX} ${ref}: labelPattern must have exactly one capturing group (${labelPattern})`,
    );
  }
  if (typeof released !== 'boolean') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${ref}: "archive"."released" must be true or false`);
  }
  return { glob, labelPattern, released };
}

/**
 * Validate and normalise the `openapi` option — every check that needs no
 * filesystem or network. Throws `[dk-openapi] …` on the first problem; the
 * renderer check runs last. Reading and checking the documents themselves is
 * `materialiseOpenApiSpecs`'s (materialise.mjs), which config.ts runs right
 * after this, before any plugin is built.
 * @param {unknown} raw The option as the adopter wrote it.
 * @param {{ siteRoot: string }} context `path` entries resolve against `siteRoot`.
 * @returns {NormalisedOpenApiOptions}
 */
export function normaliseOpenApiOptions(raw, { siteRoot }) {
  if (!isRecord(raw)) throw new Error(`${OPENAPI_LOG_PREFIX} the openapi option must be an object`);
  warnUnknownKeys(raw, TOP_LEVEL_KEYS, 'openapi');
  const section = normaliseSection(raw.section);
  const { renderer, specs, archive } = raw;
  // At least one version must result from specs plus archive (contracts/config-options.md).
  if (archive === undefined) {
    if (!Array.isArray(specs) || specs.length === 0) {
      throw new Error(`${OPENAPI_LOG_PREFIX} "specs" must list at least one version (or set "archive")`);
    }
  } else if (specs !== undefined && !Array.isArray(specs)) {
    throw new Error(`${OPENAPI_LOG_PREFIX} "specs" must be an array`);
  }
  /** @type {Map<string, number>} */
  const seen = new Map();
  const normalisedSpecs = (specs ?? []).map((spec, index) => {
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
  if (raw.llmsOperations !== undefined && typeof raw.llmsOperations !== 'boolean') {
    throw new Error(`${OPENAPI_LOG_PREFIX} "llmsOperations" must be true or false`);
  }
  if (raw.offline !== undefined && typeof raw.offline !== 'boolean') {
    throw new Error(`${OPENAPI_LOG_PREFIX} "offline" must be true or false`);
  }
  if (typeof renderer !== 'function') {
    throw new Error(
      `${OPENAPI_LOG_PREFIX} "renderer" is required: add import starlightOpenAPI from 'starlight-openapi' to astro.config and pass renderer: starlightOpenAPI`,
    );
  }
  return {
    renderer: /** @type {(config: any) => any} */ (renderer),
    section,
    specs: normalisedSpecs,
    archive: archive === undefined ? undefined : normaliseArchive(archive),
    llmsOperations: raw.llmsOperations === true,
    offline: raw.offline === undefined ? process.env.DOCKITTY_OFFLINE === '1' : raw.offline,
  };
}
