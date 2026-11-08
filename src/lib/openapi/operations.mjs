// @ts-check
/**
 * The operations of a document, with the pinned renderer's slug rules
 * (mission openapi-second-slice-01M6WXJ4, WP02; FR-023, C-007).
 *
 * `extractOperations` mirrors what `starlight-openapi` 0.27.0 builds routes
 * from, operation for operation, so every surface that lists operations (the
 * summary Markdown, the version switcher's same-operation mapping) names a
 * page exactly as the renderer routes it. The mirror is pinned the same way the
 * `getPageProps` splice is: the slug rules follow the renderer's own source
 * (`libs/operation.ts`), and the ops-200 test compares the result against the
 * routes of a real build rather than against a copy of the logic.
 *
 * Ordering (FR-023, data-model): path bytewise, then uppercase method
 * bytewise — the order the pages appear in, independent of locale.
 *
 * Pure ESM with JSDoc types and no `.d.ts`, like `options.mjs`.
 */
import { slug } from 'github-slugger';

/** The renderer's HTTP methods, in its own order. */
const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

/**
 * @typedef {object} Operation
 * @property {string} method Uppercase HTTP method.
 * @property {string} path The path as written in the document.
 * @property {string} [summary] The operation's summary, when it is a string.
 * @property {string} [operationId] The operation's id, when it is a string.
 * @property {string} slug The renderer's route slug under the version's base,
 *   with the duplicate-operationId suffix (`<id>/<method>`) applied.
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isObjectLike = (value) => typeof value === 'object' && value !== null;

/** Bytewise comparison, the renderer-agnostic order FR-023 names. */
const byBytes = (/** @type {string} */ a, /** @type {string} */ b) =>
  Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));

/**
 * Every operation of `document.paths`, in FR-023 order, with the pinned
 * renderer's slugs — including the same-path duplicate suffix and the
 * path-as-operationId fallback. Webhooks are not operations; the renderer
 * routes them under `webhooks/`, which no current surface lists.
 * @param {unknown} document A parsed OpenAPI document.
 * @returns {import('./operations.mjs').Operation[]}
 */
export function extractOperations(document) {
  /** @type {import('./operations.mjs').Operation[]} */
  const operations = [];
  const paths = isObjectLike(document) && isObjectLike(document.paths) ? document.paths : {};
  for (const [pathItemPath, pathItem] of Object.entries(paths)) {
    // The renderer's own `isPathItem` is `isObjectLike`, arrays included.
    if (!isObjectLike(pathItem)) continue;
    // The renderer computes every id first, so a duplicate is two operations of
    // the SAME path sharing one id (a repeated operationId across paths is no
    // duplicate: both route to the one slug, and the second overwrites nothing).
    const allOperationIds = METHODS.map((method) => {
      if (!Object.hasOwn(pathItem, method)) return undefined;
      const id = (isObjectLike(pathItem[method]) ? pathItem[method].operationId : undefined) ?? pathItemPath;
      return typeof id === 'string' ? id : undefined;
    });
    for (const [index, method] of METHODS.entries()) {
      const operationId = allOperationIds[index];
      // The renderer skips a falsy id too (an operationId of '').
      if (!operationId || !Object.hasOwn(pathItem, method)) continue;
      const operation = pathItem[method];
      const duplicate = allOperationIds.filter((id) => id === operationId).length > 1;
      const operationIdSlug = slug(operationId);
      operations.push({
        method: method.toUpperCase(),
        path: pathItemPath,
        summary: isObjectLike(operation) && typeof operation.summary === 'string' ? operation.summary : undefined,
        operationId:
          isObjectLike(operation) && typeof operation.operationId === 'string' ? operation.operationId : undefined,
        slug: duplicate ? `operations/${operationIdSlug}/${slug(method)}` : `operations/${operationIdSlug}`,
      });
    }
  }
  operations.sort((a, b) => byBytes(a.path, b.path) || byBytes(a.method, b.method));
  return operations;
}
