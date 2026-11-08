// @ts-check
/**
 * The OpenAPI input-safety limits (mission openapi-second-slice-01M6WXJ4, WP02;
 * FR-028, trust model C-008).
 *
 * A spec document is owner-trusted, not attacker-hostile — but the toolkit
 * parses it before the owner has looked at it, so every parser input is bounded
 * here and enforced where it is read: the file size and the YAML alias count in
 * `materialise.mjs` (WP02), the reference-walk bounds by the bundler (WP09),
 * the archive match count by the scanner (WP08) and the timeout plus redirect
 * count by the fetcher (WP10). Every limit is a named constant so a rejection
 * message and its test quote the same number.
 *
 * Pure ESM with JSDoc types and no `.d.ts`, like `options.mjs`.
 */

/** The largest spec file (or fetch response) accepted: 10 MB. */
export const MAX_SPEC_BYTES = 10 * 1024 * 1024;

/** The longest a remote fetch may take: 30 seconds. */
export const FETCH_TIMEOUT_MS = 30_000;

/** The most YAML aliases one document may carry: 100. */
export const MAX_YAML_ALIASES = 100;

/** The most `$ref` entries one bundled document may hold: 10 000. */
export const MAX_REF_COUNT = 10_000;

/** The deepest `$ref` chain the bundler follows: 100. */
export const MAX_REF_DEPTH = 100;

/** The most files one archive glob may match: 200. */
export const MAX_ARCHIVE_MATCHES = 200;

/** The most redirects one remote fetch follows: 5. */
export const MAX_REDIRECTS = 5;
