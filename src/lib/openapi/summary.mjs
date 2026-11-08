// @ts-check
/**
 * The OpenAPI summary Markdown and the shared escaping helpers (mission
 * openapi-second-slice-01M6WXJ4, WP02; FR-028 via contracts/synthetic-entry.md).
 *
 * `openApiSummaryMarkdown` is the ONE function behind both the agent page's
 * `markdown` field and the OKF file body (WP03/WP12 read it), so the two cannot
 * drift. `flattenText` and `escapeMdLink` are the helpers every DocKitty-owned
 * output of spec-derived text uses (WP04/WP07 included): a hostile spec can put
 * newlines and Markdown link syntax into a title, a path or a summary, and every
 * derived surface must flatten the one and escape the other.
 *
 * Pure ESM with JSDoc types and no `.d.ts`, like `options.mjs`.
 */

/**
 * @typedef {object} OpenApiSummaryOperation
 * @property {string} method Uppercase HTTP method.
 * @property {string} path The path as written in the document.
 * @property {string} [summary]
 * @property {string} [operationId]
 */

/**
 * @typedef {object} OpenApiSummaryVersion
 * @property {string} label
 * @property {boolean} released
 * @property {string} sha256
 * @property {string} title
 * @property {string} apiVersion
 * @property {OpenApiSummaryOperation[]} operations
 */

/**
 * Collapse every whitespace run to one space and trim: no field spans lines.
 * @param {unknown} value
 * @returns {string}
 */
export function flattenText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Backslash-escape the Markdown link syntax characters: no link can be injected.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeMdLink(value) {
  return String(value ?? '').replace(/[[\]()]/g, (character) => `\\${character}`);
}

/** Spec-derived text: flattened, then link-escaped. */
const safe = (/** @type {unknown} */ value) => escapeMdLink(flattenText(value));

/**
 * The summary Markdown of one version (contracts/synthetic-entry.md): a heading
 * of title and label, the four meta lines, an `## Operations` header and one
 * line per operation. With zero operations the output ends at the header. The
 * label, the sha256 and the raw document URL are toolkit-produced, never
 * spec-derived, and stay raw.
 * @param {OpenApiSummaryVersion} version
 * @param {string} rawDocumentUrl The version's raw document route.
 * @returns {string}
 */
export function openApiSummaryMarkdown(version, rawDocumentUrl) {
  const lines = [
    `# ${safe(version.title)} ${version.label}`,
    '',
    `- Released: ${version.released ? 'yes' : 'no'}`,
    `- API version: ${safe(version.apiVersion)}`,
    `- Raw document: ${rawDocumentUrl}`,
    `- sha256: ${version.sha256}`,
    '',
    '## Operations',
  ];
  if (version.operations.length > 0) {
    lines.push('');
    for (const operation of version.operations) {
      const line = `- ${operation.method} ${safe(operation.path)}`;
      const name = flattenText(operation.summary ?? operation.operationId ?? '');
      lines.push(name === '' ? line : `${line}: ${escapeMdLink(name)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
