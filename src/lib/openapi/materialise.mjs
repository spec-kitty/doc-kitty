// @ts-check
/**
 * The materialised spec list and the extension points of the plan's
 * parallel-edit registry (mission openapi-second-slice-01M6WXJ4, WP02;
 * FR-006, FR-007, FR-023, FR-028).
 *
 * `materialiseOpenApiSpecs` runs once, at config time, and returns the ONE
 * ordered list every surface reads. Each entry carries the final bytes and
 * their sha256, computed once (FR-007: the publisher and the dev middleware
 * write these bytes, never a re-read — a source file changed after config time
 * cannot reach the output), the renderer's input path, the document's own title
 * and version, and its operations with the pinned renderer's slugs (C-007).
 *
 * The base flow handles one self-contained local file. Everything else — an
 * archive glob, a multi-file definition, a remote URL, a Swagger 2.0 document —
 * is dispatched to the `specSources` registry; an unregistered kind fails
 * closed with a kind-specific "not supported" message (WP08/WP09/WP10 each
 * register theirs with one import line here). The archive source is registered
 * from `./archive.mjs` below, and reuses {@link materialiseSpec} so a matched
 * file gets the same checks as an explicit one.
 *
 * The hook lists (`buildDoneHooks`, `devHandlers`, `pagePropsHooks`,
 * `sitemapPredicates`) live here, dependency-light; `adapters.ts` re-exports
 * the hook lists, and WP04/WP05/WP06 register through the keyed
 * `register…` helpers (directly from here or via `adapters.ts` — WP05's
 * registration lives in `openApiPlugin`, not `config.ts`), so a dev restart
 * or a second `defineDocKittyIntegrations` call in one process replaces its
 * hooks instead of stacking them. This module never imports `adapters.ts` or
 * `config.ts`, so those cycles stay safe. `composeSitemapPredicates` is the
 * only one `config.ts` uses, imported internally rather than re-exported on
 * its public surface.
 *
 * Every error starts `[dk-openapi]`, names the entry (`specs[i] "label"` or
 * `archive "<glob>"`) and the cause, and names the file for a file problem.
 *
 * Pure ESM with JSDoc types and no `.d.ts`, like `options.mjs`.
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { extractOperations } from './operations.mjs';
import { MAX_SPEC_BYTES, MAX_YAML_ALIASES } from './limits.mjs';
import { OPENAPI_LOG_PREFIX, parseDocument } from './options.mjs';
// WP08: the `archive` spec source (plan.md's registry seam).
import { materialiseArchive } from './archive.mjs';
import { assertRefsUnderLimit, bundleSource, swagger2Source } from './bundle.mjs';
import { materialiseRemote } from './remote.mjs'; registerSpecSource('remote', materialiseRemote);

const sha256 = (/** @type {Buffer} */ bytes) => createHash('sha256').update(bytes).digest('hex');

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @typedef {import('./operations.mjs').Operation} Operation
 */

/**
 * The normalised option's own spec-entry shape (`normaliseOpenApiOptions`):
 * everything `materialiseSpec` reads is already validated and typed.
 * @typedef {import('./options.mjs').NormalisedSpecInput} NormalisedSpecInput
 */

/**
 * @typedef {import('./options.mjs').NormalisedArchiveOptions} NormalisedArchiveOptions
 */

/**
 * One version, materialised (data-model): everything every surface reads, with
 * the bytes and their digest computed once.
 * @typedef {object} MaterialisedSpec
 * @property {string} label Unique key.
 * @property {boolean} released
 * @property {'file' | 'bundle' | 'swagger2' | 'remote' | 'archive'} origin
 * @property {string} ext Published as `openapi.<ext>`.
 * @property {Buffer} bytes The final bytes: original, bundled or fetched.
 * @property {string} sha256 Of `bytes`, lowercase hex.
 * @property {string} renderPath The source file the renderer reads itself
 *   (not a copy of `bytes`): it held exactly `bytes` at config time, and only
 *   stays equal while the source is unchanged after materialisation.
 * @property {string} title `info.title`.
 * @property {string} apiVersion `info.version`.
 * @property {Operation[]} operations FR-023 order, renderer slugs.
 */

/**
 * @typedef {object} SpecSourceContext
 * @property {string} siteRoot
 * @property {boolean} offline
 * @property {string} cacheDir
 */

/**
 * What a registered source gets. Local files are read and parsed by the base
 * flow first, so `bytes` and `document` are the entry file's own.
 * @typedef {object} SpecSourceInput
 * @property {string} entry The `[dk-openapi]` ref for messages.
 * @property {string} [label]
 * @property {boolean} [released]
 * @property {string} [ext]
 * @property {string} [path] As given.
 * @property {string} [absPath] Resolved against the site root.
 * @property {Buffer} [bytes] The read source bytes.
 * @property {unknown} [document] The parsed source document.
 * @property {string} [url]
 * @property {string} [sha256] The configured pin (remote: the required digest).
 * @property {string} [glob]
 * @property {string} [labelPattern]
 * @property {string[]} [labels] The archive source's cross-source duplicate
 *   check: the labels the explicit specs already took.
 */

/**
 * Materialises the specs of one kind the base flow cannot handle. Returns the
 * materialised entries (an archive glob is many; a conversion is one).
 * @typedef {(input: SpecSourceInput, context: SpecSourceContext) => MaterialisedSpec[]} SpecSource
 */

/**
 * The registered sources, keyed `archive | remote | bundle | swagger2`. Created
 * lazily behind a function over a `var`, because WP08/WP09/WP10 add import
 * lines HERE that register on load — a cycle in which a top-level `const` would
 * still be in its time-dead zone when their module body runs.
 * @type {Map<string, SpecSource> | undefined}
 */
var specSources;

/** The registry, created on first use. */
function sources() {
  specSources ??= new Map();
  return specSources;
}

/**
 * Register the source for one kind, or unregister it with `undefined`. The
 * WP02-owned unit tests use the unregister to prove the refusal is the
 * registry's, not the kind's.
 * @param {string} kind
 * @param {SpecSource | undefined} source
 */
export function registerSpecSource(kind, source) {
  if (source === undefined) sources().delete(kind);
  else sources().set(kind, source);
}

// WP08's one registration line: an `archive` option is dispatched to the
// scanner instead of refused. (`./archive.mjs`'s import above is the seam.)
registerSpecSource('archive', materialiseArchive);

/**
 * What an unregistered kind says. Each message names the capability that is
 * missing and the workaround, and is worded to match no rejection row a later
 * work package owns (an unregistered kind and a landed limit must never be
 * tellable apart from the message alone — the rows decide that).
 * @type {Record<'archive' | 'bundle' | 'remote' | 'swagger2', string>}
 */
const NOT_SUPPORTED = {
  archive: 'scanning folders for spec versions is not supported yet; list each version in openapi.specs',
  bundle: 'multi-file definitions are not supported yet; use one self-contained document',
  remote: 'fetching remote specs is not supported yet; use a local file path',
  swagger2: 'converting Swagger 2.0 documents is not supported',
};

/**
 * Hand one spec to its kind's source, or refuse it.
 * @param {'archive' | 'bundle' | 'remote' | 'swagger2'} kind
 * @param {SpecSourceInput} input
 * @param {SpecSourceContext} context
 * @returns {MaterialisedSpec[]}
 */
function dispatch(kind, input, context) {
  const source = sources().get(kind);
  if (source === undefined) {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${input.entry}: ${NOT_SUPPORTED[kind]}`);
  }
  return source(input, context);
}

/** @type {Array<(params: any) => void>} */
export const buildDoneHooks = [];
/** @type {Array<(params: any) => void>} */
export const devHandlers = [];
/** @type {Array<{ key: string; moduleUrl: string; exportName: string }>} */
export const pagePropsHooks = [];
/** @type {Array<(page: any) => boolean>} */
export const sitemapPredicates = [];

/**
 * Register `value` in `list` under `key`, replacing any entry the same key
 * registered before. The hook lists are module-level, but their registrations
 * re-run per `defineDocKittyIntegrations` call and per `config:setup` — a dev
 * restart re-evaluates the config in the SAME process, with this module's
 * state intact. Keyed replacement keeps a re-run from stacking a second copy
 * of the same hook (a stacked link check would run twice per build; a stacked
 * sitemap predicate would test the same URL twice).
 * @template T
 * @param {T[]} list One of the hook lists above.
 * @param {string} key The registration's stable identity.
 * @param {T} value
 */
function registerKeyed(list, key, value) {
  Object.assign(value, { dkOpenApiSeamKey: key });
  for (let index = 0; index < list.length; index += 1) {
    if (list[index]?.dkOpenApiSeamKey === key) {
      list[index] = value;
      return;
    }
  }
  list.push(value);
}

/**
 * Register a `buildDoneHooks` entry under `key` (idempotent across re-runs).
 * @param {string} key
 * @param {(params: any) => void} hook
 */
export function registerBuildDoneHook(key, hook) {
  registerKeyed(buildDoneHooks, key, hook);
}

/**
 * Register a `devHandlers` entry under `key` (idempotent across re-runs).
 * @param {string} key
 * @param {(params: any) => void} handler
 */
export function registerDevHandler(key, handler) {
  registerKeyed(devHandlers, key, handler);
}

/**
 * Register a `sitemapPredicates` entry under `key` (idempotent across re-runs).
 * @param {string} key
 * @param {(page: any) => boolean} predicate
 */
export function registerSitemapPredicate(key, predicate) {
  registerKeyed(sitemapPredicates, key, predicate);
}

/**
 * Remove `list`'s entry registered under `key` (a no-op when absent). The
 * mirror of {@link registerKeyed} for seams whose registration is conditional:
 * `openApiPlugin` registers the unreleased-versions sitemap predicate only
 * when some version is unreleased, so a re-evaluation of the config in the
 * same process (a dev restart) whose versions are all released — or that has
 * no openapi option at all — must DROP the predicate the earlier evaluation
 * registered. The hook lists are module-level and survive the re-evaluation,
 * so leaving it would keep filtering sitemap URLs for a config that no
 * longer wants it.
 * @template T
 * @param {T[]} list One of the hook lists above.
 * @param {string} key The registration's stable identity.
 */
function unregisterKeyed(list, key) {
  for (let index = 0; index < list.length; index += 1) {
    if (list[index]?.dkOpenApiSeamKey === key) {
      list.splice(index, 1);
      return;
    }
  }
}

/**
 * Drop the `sitemapPredicates` entry registered under `key` (a no-op when
 * absent) — see {@link unregisterKeyed}.
 * @param {string} key
 */
export function unregisterSitemapPredicate(key) {
  unregisterKeyed(sitemapPredicates, key);
}

/**
 * The sitemap filter: the draft filter, AND every registered predicate. With
 * none registered, the draft filter itself is returned, so a site without the
 * seams behaves byte-identically (NFR-001).
 * @param {(page: any) => boolean} draft
 * @returns {(page: any) => boolean}
 */
export function composeSitemapPredicates(draft) {
  if (sitemapPredicates.length === 0) return draft;
  const predicates = [...sitemapPredicates];
  return (page) => draft(page) && predicates.every((predicate) => predicate(page));
}

/**
 * The first `$ref` that points at another file, as a JSON pointer-ish path.
 * Moved from `options.mjs` with the rest of the document checks: an external
 * `$ref` is no longer rejected, it classifies the spec for the bundler (WP09).
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
 * Structural check of a parsed document; throws a reason (no prefix) on
 * failure. OpenAPI 3.0/3.1 and Swagger 2.0 pass (the latter on to the
 * converter, WP09); `info.title` and `info.version` must be strings because the
 * renderer and the summary both need them.
 * @param {unknown} doc
 */
function checkDocument(doc) {
  if (!isRecord(doc)) throw new Error('the file is not an OpenAPI document (expected a mapping)');
  if (typeof doc.swagger === 'string') {
    if (!/^2\.0(\.|$)/.test(doc.swagger)) {
      throw new Error(`not OpenAPI 3.0, 3.1 or Swagger 2.0 (found swagger: ${JSON.stringify(doc.swagger)})`);
    }
  } else {
    const version = doc.openapi;
    if (typeof version !== 'string' || !/^3\.[01](\.|$)/.test(version)) {
      throw new Error(`not OpenAPI 3.0, 3.1 or Swagger 2.0 (found openapi: ${JSON.stringify(version)})`);
    }
  }
  if (!isRecord(doc.info)) throw new Error('"info" must be an object');
  if (typeof doc.info.title !== 'string') throw new Error('"info.title" must be a string (the reference pages need it)');
  if (typeof doc.info.version !== 'string') {
    throw new Error('"info.version" must be a string (the reference pages need it)');
  }
  if (!['paths', 'webhooks', 'components'].some((key) => isRecord(doc[key]))) {
    throw new Error('one of "paths", "webhooks" or "components" must be an object');
  }
}

/**
 * Read one spec file: a file, under the size cap, not empty.
 * @param {{ path?: string; absPath?: string }} spec
 * @param {string} entry
 * @returns {Buffer}
 */
function readSpecFile(spec, entry) {
  const failRead = () =>
    new Error(`${OPENAPI_LOG_PREFIX} ${entry}: cannot read the file (${spec.path})`);
  const failSize = (/** @type {number} */ size) =>
    new Error(`${OPENAPI_LOG_PREFIX} ${entry}: 10 MB limit exceeded: the file is ${size} bytes (${spec.path})`);
  // A file spec resolves its absolute path at normalisation; fail closed on one
  // that did not (narrowing, and the same "cannot read" the caller would get).
  if (typeof spec.absPath !== 'string') throw failRead();
  let stats;
  try {
    stats = statSync(spec.absPath);
  } catch {
    throw failRead();
  }
  if (!stats.isFile()) throw failRead();
  if (stats.size > MAX_SPEC_BYTES) throw failSize(stats.size);
  let bytes;
  try {
    bytes = readFileSync(spec.absPath);
  } catch {
    throw failRead();
  }
  if (bytes.length > MAX_SPEC_BYTES) throw failSize(bytes.length);
  if (bytes.toString('utf8').trim() === '') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: the file is empty (${spec.path})`);
  }
  return bytes;
}

/**
 * Parse one spec file's bytes and check the document, with the alias limit
 * (FR-028) applied while parsing.
 * @param {Buffer} bytes
 * @param {{ path?: string }} spec
 * @param {string} entry
 * @returns {Record<string, unknown>}
 */
function parseSpec(bytes, spec, entry) {
  let document;
  try {
    document = parseDocument(bytes.toString('utf8'), { maxAliasCount: MAX_YAML_ALIASES });
  } catch (error) {
    const failure = /** @type {Error & { dkOpenApiAliasLimit?: boolean }} */ (error);
    if (failure?.dkOpenApiAliasLimit) {
      throw new Error(
        `${OPENAPI_LOG_PREFIX} ${entry}: alias limit exceeded: more than ${MAX_YAML_ALIASES} YAML aliases (${spec.path})`,
      );
    }
    throw new Error(
      `${OPENAPI_LOG_PREFIX} ${entry}: cannot parse as YAML or JSON: ${String(failure?.message ?? failure).split('\n')[0]} (${spec.path})`,
    );
  }
  try {
    checkDocument(document);
  } catch (error) {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: ${/** @type {Error} */ (error).message} (${spec.path})`);
  }
  return /** @type {Record<string, unknown>} */ (document);
}

/**
 * Which source kind a checked local document needs: a Swagger marker makes the
 * converter's, an external `$ref` the bundler's, anything else the base flow's.
 * @param {Record<string, unknown>} document
 * @returns {'file' | 'bundle' | 'swagger2'}
 */
function classify(document) {
  if (typeof document.swagger === 'string') return 'swagger2';
  return findExternalRef(document) === undefined ? 'file' : 'bundle';
}

/**
 * Materialise one explicit spec entry (or, from `archive.mjs`, one matched
 * file). The archive passes a normalised file entry, so an archive match gets
 * the identical size, parse, structural and classification treatment.
 * @param {NormalisedSpecInput} spec A normalised spec input.
 * @param {string} entry
 * @param {SpecSourceContext} context
 * @returns {MaterialisedSpec[]}
 */
export function materialiseSpec(spec, entry, context) {
  if (typeof spec.url === 'string') {
    return dispatch(
      'remote',
      { entry, label: spec.label, released: spec.released, ext: spec.ext, url: spec.url, sha256: spec.sha256 },
      context,
    );
  }
  // Unreachable in practice: a normalised file spec always carries its resolved
  // path. Fail closed rather than read an undefined one.
  if (typeof spec.path !== 'string' || typeof spec.absPath !== 'string') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: "path" is required`);
  }
  const bytes = readSpecFile(spec, entry);
  const digest = sha256(bytes);
  if (spec.sha256 !== undefined && spec.sha256 !== digest) {
    throw new Error(
      `${OPENAPI_LOG_PREFIX} ${entry}: sha256 mismatch: the pin is ${spec.sha256}, the file hashes to ${digest} (${spec.path})`,
    );
  }
  const document = parseSpec(bytes, spec, entry);
  // WP09's FR-028 ref-count bound: every document is bounded, self-contained
  // ones included — the base flow has no kind of its own to dispatch to. This
  // call is WP09's one line beyond the registration import the registry names.
  assertRefsUnderLimit(document, entry);
  const kind = classify(document);
  if (kind !== 'file') {
    return dispatch(
      kind,
      {
        entry,
        label: spec.label,
        released: spec.released,
        ext: spec.ext,
        path: spec.path,
        absPath: spec.absPath,
        bytes,
        document,
        sha256: spec.sha256,
      },
      context,
    );
  }
  const info = /** @type {Record<string, string>} */ (document.info);
  return [
    {
      label: spec.label,
      released: spec.released,
      origin: 'file',
      ext: spec.ext,
      bytes,
      sha256: digest,
      renderPath: spec.absPath,
      title: info.title,
      apiVersion: info.version,
      operations: extractOperations(document),
    },
  ];
}

/**
 * Materialise every configured version, in config order (FR-023): the explicit
 * `specs` first, exactly as given, then the archive's, sorted by POSIX relative
 * path in code-point order (`archive.mjs`). Runs once at config time;
 * synchronous.
 * @param {{ specs: NormalisedSpecInput[]; archive?: NormalisedArchiveOptions }} options
 *   The normalised option (`normaliseOpenApiOptions`).
 * @param {SpecSourceContext} context
 * @returns {MaterialisedSpec[]}
 */
export function materialiseOpenApiSpecs(options, context) {
  /** @type {MaterialisedSpec[]} */
  const specs = [];
  for (const [index, spec] of options.specs.entries()) {
    specs.push(...materialiseSpec(spec, `specs[${index}] "${spec.label}"`, context));
  }
  if (options.archive !== undefined) {
    specs.push(
      ...dispatch(
        'archive',
        {
          entry: `archive "${options.archive.glob}"`,
          ...options.archive,
          labels: specs.map((spec) => spec.label),
        },
        context,
      ),
    );
  }
  return specs;
}

// WP09 registers its bundler and Swagger 2 source here (plan.md's
// parallel-edit registry) and contributes the FR-028 ref-count bound in
// `materialiseSpec` above — the same static-import seam WP08's archive source
// uses. bundle.mjs never imports this module back, so the import cannot
// cycle, and no top-level await sits on a site's `config.ts` load chain.
registerSpecSource('bundle', bundleSource);
registerSpecSource('swagger2', swagger2Source);
