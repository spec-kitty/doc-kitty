// @ts-check
/**
 * The `bundle` and `swagger2` spec sources (mission
 * openapi-second-slice-01M6WXJ4, WP09; FR-019, FR-020, FR-022, FR-028, C-006).
 *
 * A multi-file definition — any document with an external `$ref` — is bundled
 * by `@readme/openapi-parser` (the renderer's own parser, pinned exactly in
 * src/package.json) into ONE self-contained document, serialised
 * deterministically and published through the shared cache writer: an entry's
 * name is its digest, so the renderer's input and the published bytes always
 * agree (C-006, plan.md's data flow).
 *
 * The parser runs in a self-invoked child process (`--bundle`), the pattern of
 * `site-config-eval.mjs`: the materialise seam is synchronous, `bundle()` is
 * not. The child answers with one JSON line; anything else fails closed.
 *
 * The `$ref` gate runs BEFORE the parser, synchronously, in the parent: it
 * rejects every scheme-bearing ref (`file://`, `http(s)`, anything), absolute
 * paths, folder escapes (lexical or by symlink, encoded separators decoded
 * first), non-regular files, unresolvable targets, external cycles (naming
 * the chain) and the count/depth limits. What survives is relative,
 * realpath-contained and regular. The child then holds that line on its own
 * (T043): the global `fetch` its rebuilt HTTP resolver calls throws, and its
 * `file` resolver re-checks realpath containment and regularity on every file
 * the parser opens — closing the window between the walk and the bundle.
 *
 * Swagger 2.0 documents are accepted with their ORIGINAL bytes (FR-020): the
 * renderer converts in memory; nothing is rewritten on disk. Operations come
 * from `paths`, which a 2.0 document holds in the same place.
 *
 * Pure ESM with JSDoc types and no `.d.ts`, like `options.mjs`.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpathSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stringify } from 'yaml';
import { writeCacheAtomic } from './cache.mjs';
import { MAX_REF_COUNT, MAX_REF_DEPTH, MAX_SPEC_BYTES, MAX_YAML_ALIASES } from './limits.mjs';
import { OPENAPI_LOG_PREFIX, parseDocument } from './options.mjs';
import { extractOperations } from './operations.mjs';

const sha256 = (/** @type {Buffer} */ bytes) => createHash('sha256').update(bytes).digest('hex');

/** This module's own path: the bundler child re-runs it with `--bundle`. */
const SELF = fileURLToPath(import.meta.url);

/** How long the bundler child may take; a hang must not hang a build. */
const BUNDLE_TIMEOUT_MS = 30_000;

/** The child's answer buffer: a 10 MB document serialises to well under this. */
const CHILD_MAX_BUFFER = 64 * 1024 * 1024;

/** A ref's URL scheme (`file:`, `http:`, `ftp:`, …): anything before a `#`. */
const REF_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/**
 * Whether `target` lies outside `root`: segment-wise, so a sibling named
 * `..shared.yaml` is inside while `../x.yaml` is not.
 * @param {string} root
 * @param {string} target
 * @returns {boolean}
 */
function outside(root, target) {
  const rel = path.relative(root, target);
  return rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
}

/**
 * A path as shown in a message: relative to the site root when inside it.
 * @param {string} siteRoot
 * @param {string} absPath
 * @returns {string}
 */
function shown(siteRoot, absPath) {
  const rel = path.relative(siteRoot, absPath);
  return rel.startsWith('..') ? absPath : rel;
}

/**
 * The bounded tail of the child's stderr, for a fail-closed message.
 * @param {string | undefined} text
 * @returns {string}
 */
function bounded(text) {
  const trimmed = (text ?? '').trim().slice(-512);
  return trimmed || 'the bundler process produced no answer';
}

/**
 * Every `$ref` value of a parsed document, in tree order: the walk counts
 * them (FR-028) and follows the external ones.
 * @param {unknown} node
 * @param {string[]} [refs]
 * @returns {string[]}
 */
function collectRefs(node, refs = []) {
  if (Array.isArray(node)) {
    for (const child of node) collectRefs(child, refs);
  } else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') refs.push(value);
      else collectRefs(value, refs);
    }
  }
  return refs;
}

/**
 * Read and parse one file of the walk, under the FR-028 size and alias caps;
 * a target that cannot be read or parsed fails closed like the entry does.
 * @param {string} real A realpath.
 * @param {string} entry
 * @param {string} name The file as shown in a message.
 * @returns {unknown}
 */
function readWalked(real, entry, name) {
  let bytes;
  try {
    // Stat first: an oversized file is refused before it is read into memory.
    const size = statSync(real).size;
    if (size > MAX_SPEC_BYTES) {
      throw Object.assign(new Error('too large'), { dkSize: size });
    }
    bytes = readFileSync(real);
  } catch (error) {
    const size = /** @type {{ dkSize?: number }} */ (error)?.dkSize;
    if (size !== undefined) {
      throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: 10 MB limit exceeded: the file is ${size} bytes (${name})`);
    }
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: cannot read the file (${name})`);
  }
  if (bytes.length > MAX_SPEC_BYTES) {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: 10 MB limit exceeded: the file is ${bytes.length} bytes (${name})`);
  }
  let parsed;
  try {
    parsed = parseDocument(bytes.toString('utf8'), { maxAliasCount: MAX_YAML_ALIASES });
  } catch (error) {
    const failure = /** @type {Error & { dkOpenApiAliasLimit?: boolean }} */ (error);
    if (failure?.dkOpenApiAliasLimit) {
      throw new Error(
        `${OPENAPI_LOG_PREFIX} ${entry}: alias limit exceeded: more than ${MAX_YAML_ALIASES} YAML aliases (${name})`,
      );
    }
    throw new Error(
      `${OPENAPI_LOG_PREFIX} ${entry}: cannot parse as YAML or JSON: ${String(failure?.message ?? failure).split('\n')[0]} (${name})`,
    );
  }
  return parsed;
}

/**
 * Stat a realpath as a regular file; anything else (or a race) is `false`.
 * @param {string} real
 * @returns {boolean}
 */
function isRegularFile(real) {
  try {
    return statSync(real).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve one external `$ref`'s file part to a realpath, fail-closed under
 * the FR-028 containment rules: no URL scheme, no absolute path, the
 * percent-decoded target must stay inside the definition folder both
 * lexically and after realpath (so a symlink or an encoded separator cannot
 * leave it), and it must be a regular file.
 * @param {string} ref The `$ref` value as written.
 * @param {string} currentReal The realpath of the file holding the ref.
 * @param {string} root The definition folder (a realpath).
 * @param {string} entry
 * @returns {string} The target's realpath.
 */
function resolveTarget(ref, currentReal, root, entry) {
  const hash = ref.indexOf('#');
  const file = hash === -1 ? ref : ref.slice(0, hash);
  /** @param {string} cause @returns {never} */
  const fail = (cause) => {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: ${cause}`);
  };
  if (REF_SCHEME.test(file)) {
    // `file`, `http` and `https` are the local-path-shaped schemes the
    // rejected-input matrix groups with absolute paths; any other scheme is a
    // non-file scheme outright. The two messages' shapes are the seam rows'.
    if (/^(file|https?):/i.test(file)) {
      fail(`ref '${ref}' is not a relative file reference: absolute paths and the file, http and https schemes are not allowed`);
    }
    fail(`scheme in the $ref '${ref}' is not allowed: a $ref must be a relative file reference`);
  }
  if (path.isAbsolute(file)) {
    fail(`ref '${ref}' is not a relative file reference: absolute paths and the file, http and https schemes are not allowed`);
  }
  let decoded = '';
  let malformed = false;
  try {
    decoded = decodeURIComponent(file);
  } catch {
    malformed = true;
  }
  if (malformed) fail(`cannot resolve the $ref '${ref}' (malformed percent-encoding)`);
  const lexical = path.resolve(path.dirname(currentReal), decoded);
  if (outside(root, lexical)) {
    fail(`escapes the definition folder: the $ref '${ref}'`);
  }
  let real = '';
  try {
    real = realpathSync(lexical);
  } catch {
    fail(`cannot resolve the $ref '${ref}'`);
  }
  if (outside(root, real)) {
    fail(`escapes the definition folder: the $ref '${ref}'`);
  }
  if (!isRegularFile(real)) fail(`cannot resolve the $ref '${ref}': not a regular file`);
  return real;
}

/**
 * Walk every file the definition's external `$ref`s reach, enforcing the
 * FR-028 bounds BEFORE the parser runs: containment (lexical and realpath),
 * regular files, the ref-count and chain-depth limits, and external cycles
 * naming the chain. Internal refs are counted but not followed — the parser
 * resolves them in place and keeps internal cycles as pointers.
 * @param {string} absPath The entry file, already validated by the base flow.
 * @param {Record<string, unknown>} document The entry's parsed document.
 * @param {string} entry
 * @param {string} siteRoot
 */
function walkRefs(absPath, document, entry, siteRoot) {
  let entryReal;
  try {
    entryReal = realpathSync(absPath);
  } catch {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: cannot read the file (${shown(siteRoot, absPath)})`);
  }
  const root = path.dirname(entryReal);
  /** Realpaths whose refs were counted: each file counts once. */
  const counted = new Set();
  let total = 0;

  /**
   * @param {string} real The file being walked.
   * @param {unknown} parsed Its parsed document (the entry's is given).
   * @param {string[]} chain The realpaths walked so far, the entry first.
   */
  const visit = (real, parsed, chain) => {
    if (counted.has(real)) return;
    counted.add(real);
    const refs = collectRefs(parsed);
    total += refs.length;
    if (total > MAX_REF_COUNT) {
      throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: ref limit exceeded: more than ${MAX_REF_COUNT} $ref entries`);
    }
    for (const ref of refs) {
      if (ref.startsWith('#')) continue;
      const target = resolveTarget(ref, real, root, entry);
      if (target === real) continue; // a self-reference is an internal cycle
      const at = chain.indexOf(target);
      if (at !== -1) {
        const names = [...chain.slice(at), target].map((step) => path.relative(root, step) || '.');
        throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: cycle of external $refs: ${names.join(' -> ')}`);
      }
      if (chain.length >= MAX_REF_DEPTH) {
        throw new Error(
          `${OPENAPI_LOG_PREFIX} ${entry}: ref limit exceeded: the $ref chain is deeper than ${MAX_REF_DEPTH} files`,
        );
      }
      visit(target, readWalked(target, entry, shown(siteRoot, target)), [...chain, target]);
    }
  };

  visit(entryReal, document, [entryReal]);
}

/**
 * Bundle one definition in a self-invoked child process — the pattern of
 * `site-config-eval.mjs`: the materialise seam is synchronous, the parser's
 * `bundle()` is not. The child answers with one JSON line; a crash, a timeout
 * or a hang fails closed with the bounded reason.
 * @param {string} absPath
 * @param {string} entry
 * @returns {unknown} The bundled document.
 */
function bundleInChild(absPath, entry) {
  const res = spawnSync(process.execPath, [SELF, '--bundle', absPath], {
    encoding: 'utf8',
    timeout: BUNDLE_TIMEOUT_MS,
    maxBuffer: CHILD_MAX_BUFFER,
  });
  const fail = (/** @type {string} */ cause) =>
    new Error(`${OPENAPI_LOG_PREFIX} ${entry}: cannot bundle the definition (${cause})`);
  if (/** @type {Error & { code?: string }} */ (res.error)?.code === 'ETIMEDOUT') throw fail(`timed out after ${BUNDLE_TIMEOUT_MS / 1000} s`);
  if (res.error) throw fail(res.error.message);
  let answer;
  try {
    answer = JSON.parse(res.stdout.trim().split('\n').pop() ?? '');
  } catch {
    answer = { ok: false, message: bounded(res.stderr) };
  }
  if (answer?.ok !== true) {
    throw fail(String(answer?.message ?? 'the bundler process produced no answer').split('\n')[0]);
  }
  return answer.document;
}

/**
 * Serialise the bundled document deterministically (C-006): JSON with a fixed
 * 2-space indent, or YAML after a JSON round-trip — the round-trip breaks the
 * shared object references the parser leaves behind, so no anchors or
 * aliases can appear in the output, and identical input gives identical bytes.
 * @param {unknown} document
 * @param {string} ext
 * @returns {Buffer}
 */
function serialise(document, ext) {
  if (ext === 'json') return Buffer.from(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
  const plain = JSON.parse(JSON.stringify(document));
  return Buffer.from(`${stringify(plain, { lineWidth: 0 })}\n`, 'utf8');
}

/**
 * The title and apiVersion a materialised entry carries, fail-closed: the
 * reference pages and the summary both need them as strings.
 * @param {unknown} document
 * @param {string} entry
 * @returns {{ title: string, apiVersion: string }}
 */
function docInfo(document, entry) {
  const info =
    document !== null && typeof document === 'object'
      ? /** @type {Record<string, unknown>} */ (document).info
      : undefined;
  const record = info !== null && typeof info === 'object' ? /** @type {Record<string, unknown>} */ (info) : undefined;
  if (record === undefined || typeof record.title !== 'string' || typeof record.version !== 'string') {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: "info.title" and "info.version" must be strings (the reference pages need them)`);
  }
  return { title: record.title, apiVersion: record.version };
}

/**
 * The local-file fields both sources read, narrowed fail-closed: the base
 * flow always sends them, and a caller that does not gets a refusal, not a
 * crash.
 * @param {import('./materialise.mjs').SpecSourceInput} input
 * @returns {{ entry: string, absPath: string, label: string, released: boolean, ext: string,
 *   bytes: Buffer, document: Record<string, unknown> }}
 */
function localInput(input) {
  const { entry, absPath, label, released, ext, bytes, document } = input;
  const shape =
    typeof absPath === 'string' &&
    typeof label === 'string' &&
    typeof released === 'boolean' &&
    typeof ext === 'string' &&
    Buffer.isBuffer(bytes) &&
    document !== null &&
    typeof document === 'object';
  if (!shape) {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: the source needs the base flow's local file input`);
  }
  return {
    entry,
    absPath,
    label,
    released,
    ext,
    bytes,
    document: /** @type {Record<string, unknown>} */ (document),
  };
}

/**
 * The `bundle` source (FR-019): gate the refs, bundle in the child, serialise
 * deterministically, and publish through the shared cache writer — the
 * entry's name is the digest, so the renderer's input and the published
 * bytes always agree.
 * @type {import('./materialise.mjs').SpecSource}
 */
function bundleSource(input, context) {
  const { entry, absPath, label, released, ext, document } = localInput(input);
  walkRefs(absPath, document, entry, context.siteRoot);
  const bundled = bundleInChild(absPath, entry);
  const bytes = serialise(bundled, ext);
  const digest = sha256(bytes);
  const info = docInfo(bundled, entry);
  return [
    {
      label,
      released,
      origin: 'bundle',
      ext,
      bytes,
      sha256: digest,
      renderPath: writeCacheAtomic(context.cacheDir, digest, ext, bytes),
      title: info.title,
      apiVersion: info.apiVersion,
      operations: extractOperations(bundled),
    },
  ];
}

/**
 * The `swagger2` source (FR-020): publish the ORIGINAL bytes — the renderer
 * converts in memory — and extract the operations from `paths`, which a 2.0
 * document holds in the same place.
 * @type {import('./materialise.mjs').SpecSource}
 */
function swagger2Source(input) {
  const { entry, absPath, label, released, ext, bytes, document } = localInput(input);
  assertSelfContained(document, entry);
  const info = docInfo(document, entry);
  return [
    {
      label,
      released,
      origin: 'swagger2',
      ext,
      bytes,
      sha256: sha256(bytes),
      renderPath: absPath,
      title: info.title,
      apiVersion: info.apiVersion,
      operations: extractOperations(document),
    },
  ];
}

/**
 * The FR-028 ref-count bound for EVERY document (WP09): a self-contained ref
 * bomb must fail closed on the base flow too, not only a multi-file definition
 * whose walk counts the whole tree. materialise.mjs calls this where every
 * parsed document passes, before classification; the walk re-checks the same
 * bound over the files it follows.
 * @param {unknown} document
 * @param {string} entry
 */
export function assertRefsUnderLimit(document, entry) {
  if (collectRefs(document).length > MAX_REF_COUNT) {
    throw new Error(`${OPENAPI_LOG_PREFIX} ${entry}: ref limit exceeded: more than ${MAX_REF_COUNT} $ref entries`);
  }
}

/**
 * Swagger 2.0 and pinned remote documents are never bundled here, yet the
 * renderer's own `bundle()` would follow any external `$ref` with its default
 * resolvers. Fail closed: such a document must be self-contained, so every
 * `$ref` must be an internal pointer. Also applies the ref-count bound.
 * @param {unknown} document
 * @param {string} entry
 */
export function assertSelfContained(document, entry) {
  assertRefsUnderLimit(document, entry);
  const external = collectRefs(document).find((ref) => !ref.startsWith('#'));
  if (external !== undefined) {
    throw new Error(
      `${OPENAPI_LOG_PREFIX} ${entry}: the $ref '${external}' is external: Swagger 2.0 / remote specs must be self-contained; inline the ref or bundle the document locally`,
    );
  }
}

// materialise.mjs's one registration seam (plan.md's parallel-edit registry):
// it statically imports this module and calls `registerSpecSource` on what it
// exports. This module never imports materialise.mjs at runtime, so the seam
// cannot cycle; the JSDoc type references to it above are type-only and
// erased when the module runs.
export { bundleSource, swagger2Source };

/**
 * The child's `resolve.file` resolver (T043): the parser's own file resolver
 * reads any path it is handed, so this one re-checks, for every file the
 * parser opens, the same FR-028 bounds the parent's walk enforced — realpath
 * containment in the definition folder and regularity — closing the window
 * between the walk and the bundle. The parser wraps what this throws in its
 * own resolver error, naming the refused file.
 * @param {string} root The definition folder (a realpath).
 */
function containedFileResolver(root) {
  return {
    order: 100,
    /**
     * The same file-system URLs the parser's default file resolver takes:
     * no scheme, or the `file` scheme.
     * @param {{ url: string }} file
     */
    canRead(file) {
      return !REF_SCHEME.test(file.url) || file.url.startsWith('file:');
    },
    /**
     * @param {{ url: string }} file
     * @returns {Buffer}
     */
    read(file) {
      const target = file.url.startsWith('file:') ? fileURLToPath(file.url) : file.url;
      const real = realpathSync(target);
      if (outside(root, real)) {
        throw new Error(`${OPENAPI_LOG_PREFIX} the bundler child refused '${target}': it escapes the definition folder`);
      }
      if (!isRegularFile(real)) {
        throw new Error(`${OPENAPI_LOG_PREFIX} the bundler child refused '${target}': it is not a regular file`);
      }
      return readFileSync(real);
    },
  };
}

/**
 * Child-process side of {@link bundleInChild}: bundle `absPath` and print one
 * JSON answer line. The pre-walk has already rejected every scheme-bearing
 * ref; the defences below keep the child fail-closed if one ever slipped
 * through: the global `fetch` the parser's HTTP resolver calls is replaced by
 * one that throws (the parser's options builder always rebuilds that
 * resolver, so this is the only way to switch the network off), and every
 * file the parser opens goes through {@link containedFileResolver}.
 * @param {string} absPath
 */
async function runAsChild(absPath) {
  try {
    // Dynamically: only the bundler child pays for the parser's weight.
    const { bundle } = await import('@readme/openapi-parser');
    // T043: the network stays off in the child, whatever the options builder
    // rebuilds — its HTTP resolver calls the global `fetch`.
    globalThis.fetch = () => {
      throw new Error('network access is disabled in the bundler child');
    };
    const root = path.dirname(realpathSync(absPath));
    const document = await bundle(absPath, {
      resolve: {
        external: true,
        // The parser's public types call `resolve.file` a boolean toggle, but
        // its options builder passes the value straight through to
        // json-schema-ref-parser, which takes a resolver object — this one.
        file: /** @type {any} */ (containedFileResolver(root)),
      },
      // Internal cycles stay `#/…` pointers; external refs are inlined.
      dereference: { circular: true },
    });
    console.log(JSON.stringify({ ok: true, document }));
  } catch (err) {
    console.log(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }));
  }
}

/** Is this process the `--bundle` child? The check `site-config-eval.mjs` uses. */
function isMain() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (isMain() && process.argv[2] === '--bundle') {
  await runAsChild(/** @type {string} */ (process.argv[3]));
  // The parser can leave handles open; the answer is already out.
  process.exit(0);
}
