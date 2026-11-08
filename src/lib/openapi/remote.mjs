// @ts-check
/**
 * WP10's pinned HTTPS source (FR-021, FR-028, NFR-008).
 *
 * Materialisation is deliberately synchronous: Astro calls the integration
 * factory synchronously in build, dev, sync and check. The small `--fetch`
 * child below is what lets this source use the global async `fetch` without
 * changing that public config-time contract. The parent waits for the child,
 * hashes its final bytes before parsing, and writes them with WP02's one shared
 * atomic writer. The child has no parser and sends no authentication headers.
 *
 * Offline never spawns the child. A valid cache entry is used online or
 * offline; a missing or corrupted entry is fetched online and fails closed
 * offline. Owner-trusted private and intranet HTTPS hosts are intentionally
 * allowed (C-008). Every URL quoted in an error has its query redacted.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCacheVerified, writeCacheAtomic, cacheEntryPath } from './cache.mjs';
import { FETCH_TIMEOUT_MS, MAX_REDIRECTS, MAX_SPEC_BYTES, MAX_YAML_ALIASES } from './limits.mjs';
import { extractOperations } from './operations.mjs';
import { OPENAPI_LOG_PREFIX, parseDocument } from './options.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Quote a URL without its query string, including in redirect-hop errors. */
function redactUrl(/** @type {string} */ url) {
  const query = url.indexOf('?');
  return query === -1 ? url : `${url.slice(0, query)}?…`;
}

/** A controlled fetch-child failure; never carries stack traces to the parent. */
function fetchFailure(/** @type {string} */ message) {
  return new Error(message);
}

/** Enforce HTTPS and userinfo on the initial URL and every redirect hop. */
function assertFetchUrl(/** @type {URL} */ url) {
  const quoted = redactUrl(url.href);
  if (url.protocol !== 'https:') throw fetchFailure(`https is required for every remote fetch hop (${quoted})`);
  if (url.username !== '' || url.password !== '') {
    throw fetchFailure(`userinfo is not allowed in a remote fetch hop (${quoted})`);
  }
}

/** Read a response with a hard cap, including chunked bodies of unknown size. */
async function readLimitedBody(/** @type {Response} */ response, /** @type {string} */ url) {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_SPEC_BYTES) {
    throw fetchFailure(`10 MB limit exceeded: the response declares ${declared} bytes (${redactUrl(url)})`);
  }
  if (response.body === null) return Buffer.alloc(0);
  /** @type {Buffer[]} */
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_SPEC_BYTES) {
      throw fetchFailure(`10 MB limit exceeded: the response is larger than ${MAX_SPEC_BYTES} bytes (${redactUrl(url)})`);
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, size);
}

/** A redirect response, or undefined for a final response. */
function redirectLocation(/** @type {Response} */ response, /** @type {string} */ url) {
  if (!REDIRECT_STATUSES.has(response.status)) return undefined;
  const location = response.headers.get('location');
  if (location === null) throw fetchFailure(`redirect response has no Location header (${redactUrl(url)})`);
  return location;
}

/** Follow at most five manual HTTPS redirects and return only the final bytes. */
async function fetchFinalBytes(/** @type {string} */ initialUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let current = new URL(initialUrl);
  let redirects = 0;
  try {
    for (;;) {
      assertFetchUrl(current);
      const response = await fetch(current, { redirect: 'manual', signal: controller.signal });
      const location = redirectLocation(response, current.href);
      if (location !== undefined) {
        await response.body?.cancel();
        if (redirects >= MAX_REDIRECTS) {
          throw fetchFailure(`redirects: more than ${MAX_REDIRECTS} while fetching ${redactUrl(current.href)}`);
        }
        current = new URL(location, current);
        redirects += 1;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw fetchFailure(`remote fetch failed with HTTP ${response.status} (${redactUrl(current.href)})`);
      }
      return await readLimitedBody(response, current.href);
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw fetchFailure(`timeout: remote fetch exceeded ${FETCH_TIMEOUT_MS / 1000} seconds (${redactUrl(current.href)})`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** The fetch child's CLI: binary stdout, one controlled JSON error on stderr. */
async function fetchChild() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  let url = '';
  try {
    const parsed = JSON.parse(input);
    if (!isRecord(parsed) || typeof parsed.url !== 'string') throw fetchFailure('invalid remote fetch request');
    url = parsed.url;
    const bytes = await fetchFinalBytes(url);
    process.stdout.write(bytes);
  } catch (error) {
    // Fetch's own errors can contain the full URL. Only my controlled messages
    // cross the process boundary; an unexpected failure is intentionally vague.
    const controlled = error instanceof Error ? error.message : '';
    const safe = /^(https is required|userinfo is not allowed|redirects:|timeout:|remote fetch|10 MB limit)/.test(controlled)
      ? controlled
      : `remote fetch failed${url ? ` (${redactUrl(url)})` : ''}`;
    process.stderr.write(JSON.stringify({ message: safe }));
    process.exitCode = 1;
  }
}

/** Spawn the async fetch child and return the final, still-unparsed bytes. */
function fetchBytes(/** @type {string} */ url) {
  const result = spawnSync(process.execPath, [MODULE_PATH, '--fetch'], {
    input: JSON.stringify({ url }),
    maxBuffer: MAX_SPEC_BYTES + 1024,
    timeout: FETCH_TIMEOUT_MS + 2_000,
  });
  if (result.status === 0 && Buffer.isBuffer(result.stdout) && result.stdout.length <= MAX_SPEC_BYTES) {
    return result.stdout;
  }
  if (result.error && /** @type {NodeJS.ErrnoException} */ (result.error).code === 'ETIMEDOUT') {
    throw new Error(`timeout: remote fetch exceeded ${FETCH_TIMEOUT_MS / 1000} seconds (${redactUrl(url)})`);
  }
  try {
    const payload = JSON.parse(result.stderr.toString('utf8'));
    if (isRecord(payload) && typeof payload.message === 'string') throw new Error(payload.message);
  } catch (error) {
    if (error instanceof SyntaxError) {
      // Fall through to the redacted protocol failure below.
    } else {
      throw error;
    }
  }
  throw new Error(`remote fetch failed (${redactUrl(url)})`);
}

/** Validate the parsed remote document using the same structural contract. */
function checkRemoteDocument(/** @type {unknown} */ document) {
  if (!isRecord(document)) throw new Error('the document is not an OpenAPI document (expected a mapping)');
  const openapi = document.openapi;
  const swagger = document.swagger;
  const versionOk =
    (typeof openapi === 'string' && /^3\.[01](\.|$)/.test(openapi)) ||
    (typeof swagger === 'string' && /^2\.0(\.|$)/.test(swagger));
  if (!versionOk) throw new Error('not OpenAPI 3.0, 3.1 or Swagger 2.0');
  if (!isRecord(document.info)) throw new Error('"info" must be an object');
  if (typeof document.info.title !== 'string') throw new Error('"info.title" must be a string');
  if (typeof document.info.version !== 'string') throw new Error('"info.version" must be a string');
  if (!['paths', 'webhooks', 'components'].some((key) => isRecord(document[key]))) {
    throw new Error('one of "paths", "webhooks" or "components" must be an object');
  }
  return document;
}

/** Parse only after the content pin has been verified and cached. @param {Buffer} bytes @param {string} url */
function parseRemote(bytes, url) {
  /** @type {unknown} */
  let document;
  try {
    document = parseDocument(bytes.toString('utf8'), { maxAliasCount: MAX_YAML_ALIASES });
  } catch (error) {
    const failure = /** @type {Error & { dkOpenApiAliasLimit?: boolean }} */ (error);
    const cause = failure?.dkOpenApiAliasLimit
      ? `alias limit exceeded: more than ${MAX_YAML_ALIASES} YAML aliases`
      : `cannot parse as YAML or JSON: ${String(failure?.message ?? failure).split('\n')[0]}`;
    throw new Error(`${cause} (${redactUrl(url)})`);
  }
  try {
    return checkRemoteDocument(document);
  } catch (error) {
    throw new Error(`${/** @type {Error} */ (error).message} (${redactUrl(url)})`);
  }
}

/** Wrap one source failure with its spec ref; never expose child stderr raw. @param {string} entry @param {unknown} error */
function sourceError(entry, error) {
  const message = error instanceof Error ? error.message : 'unknown remote-source failure';
  return new Error(`${OPENAPI_LOG_PREFIX} ${entry}: ${message}`, { cause: error });
}

/**
 * The registered `remote` spec source.
 * @type {import('./materialise.mjs').SpecSource}
 */
export function materialiseRemote(input, context) {
  const { entry } = input;
  try {
    if (!input.url || !input.sha256 || !input.ext || !input.label || input.released === undefined) {
      throw new Error('a remote spec requires url, sha256, ext, label and released');
    }
    // The realpath entry location, shared by the hit and write paths so a
    // symlinked cache dir cannot make them disagree on renderPath.
    const cachePath = cacheEntryPath(context.cacheDir, input.sha256, input.ext);
    let bytes = readCacheVerified(context.cacheDir, input.sha256, input.ext);
    let renderPath = cachePath;
    if (bytes === undefined) {
      if (context.offline) {
        throw new Error(`offline mode: no valid cached remote spec at ${cachePath} (${redactUrl(input.url)})`);
      }
      bytes = fetchBytes(input.url);
      const actual = createHash('sha256').update(bytes).digest('hex');
      if (actual !== input.sha256) {
        throw new Error(
          `sha256 mismatch: expected ${input.sha256}, the final response hashes to ${actual} (${redactUrl(input.url)})`,
        );
      }
      renderPath = writeCacheAtomic(context.cacheDir, input.sha256, input.ext, bytes);
    }
    const document = parseRemote(bytes, input.url);
    const info = /** @type {Record<string, string>} */ (document.info);
    return [{
      label: input.label,
      released: input.released,
      origin: 'remote',
      ext: input.ext,
      bytes,
      sha256: input.sha256,
      renderPath,
      title: info.title,
      apiVersion: info.version,
      operations: extractOperations(document),
    }];
  } catch (error) {
    throw sourceError(entry, error);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH && process.argv.includes('--fetch')) {
  await fetchChild();
}
