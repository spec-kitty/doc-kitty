/**
 * The `llms.txt` operation summary (mission openapi-second-slice-01M6WXJ4,
 * WP04; FR-014, FR-028; contracts/llms-operations.md).
 *
 * `openApiLlmsLines` is the one function behind the `## OpenAPI documents`
 * section: one line per version, and — only when `openapi.llmsOperations` is on —
 * one indented line per operation under it. With the option off the lines are
 * byte-identical to the pre-WP04 version list, so a site that does not opt in
 * keeps its `llms.txt` unchanged (NFR-002).
 *
 * The summary falls back to the `operationId`, and an operation with neither
 * ends at the method and path (no colon). Operations order by path, then by
 * uppercase method, bytewise — the order the reference pages and the agent
 * record use (FR-023).
 *
 * Every spec-derived string (label, path, summary, operationId) is flattened to
 * one line and has its Markdown link syntax escaped through the shared
 * `summary.mjs` helpers, so a hostile document cannot inject a line, a heading
 * or a link (FR-028, C-008). The URL itself is toolkit-produced and stays raw.
 *
 * `openapi-publish.ts` re-exports this function as the registered seam
 * (plan.md's parallel-edit registry); the route imports it from there.
 */
import type { Operation } from './operations.mjs';
import type { OpenApiPublication } from '../openapi/publication.js';
import { escapeMdLink, flattenText } from './summary.mjs';

/** Bytewise string order: locale-independent, the order the contract names. */
const byBytes = (a: string, b: string): number => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));

/** Spec-derived text: flattened to one line, then link-escaped. */
const safe = (value: unknown): string => escapeMdLink(flattenText(value));

/** The operation's display name: summary, else operationId, else none. */
function operationName(operation: Operation): string {
  const summary = flattenText(operation.summary ?? '');
  return summary !== '' ? summary : flattenText(operation.operationId ?? '');
}

/** One indented operation line: `  - GET /pets: List pets`, or without the name. */
function operationLine(operation: Operation): string {
  const line = `  - ${operation.method.toUpperCase()} ${safe(operation.path)}`;
  const name = escapeMdLink(operationName(operation));
  return name === '' ? line : `${line}: ${name}`;
}

/**
 * The section's lines: one per version (link, ` (unreleased)` suffix) and, when
 * the publication opted in, the version's operations in FR-023 order.
 * `rawUrl` maps a site route (no base) to an absolute URL.
 */
export function openApiLlmsLines(publication: OpenApiPublication, rawUrl: (route: string) => string): string[] {
  return publication.versions.flatMap(({ label, released, ext, operations }) => {
    const url = rawUrl(`/${publication.section}/${label}/openapi.${ext}`);
    const versionLine = `- [${safe(label)}](${url})${released ? '' : ' (unreleased)'}`;
    if (publication.llmsOperations !== true) return [versionLine];
    const ordered = [...(operations ?? [])].sort(
      (a, b) => byBytes(a.path, b.path) || byBytes(a.method.toUpperCase(), b.method.toUpperCase()),
    );
    return [versionLine, ...ordered.map(operationLine)];
  });
}
