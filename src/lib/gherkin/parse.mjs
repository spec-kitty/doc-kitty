/**
 * PURE parse of one Gherkin STRING (ADR-0046, ADR-0051 decision 8).
 *
 * The one place a `Parser` is built. `load.mjs` (a `.feature` file read from
 * disk), `fragment.mjs` (a ```` ```gherkin ```` fence in a page) and the include
 * directive all parse through {@link parseGherkin}, so every caller gets the same
 * AST shape and the same error text for the same input.
 *
 * DETERMINISM: every call builds a FRESH `IdGenerator.incrementing()`, so AST ids
 * depend only on this one source string — parsing another file or fence first
 * never renumbers this one.
 *
 * ERRORS are returned, never thrown: the caller decides whether they are fatal
 * (the loader aggregates and throws; the fence stage records them in the error
 * sink, ADR-0051 decision 5). Each is formatted as
 * `[dk-gherkin] <display>:<line>:<col> <parser message>`. `lineOffset` and
 * `columnOffset` move a location inside an embedded source (a fence body, whose
 * line 1 is not line 1 of the page) to the host file's coordinates; both default
 * to 0, which is the `.feature`-file case and reproduces the slice C text exactly.
 * The same errors are also returned as structured {@link ParseProblem}s in the
 * SOURCE's own coordinates (no offset), which `fragment.mjs` reads to decide
 * whether to wrap.
 *
 * PURITY CONTRACT: imports only `@cucumber/gherkin`, `@cucumber/messages` and the
 * import-free `./text.mjs`. NO fs, path or `astro`/`@astrojs/*`, so it loads under
 * plain `node` (enforced by the import-scan table in `gherkin-feature-core.test.ts`).
 *
 * TYPING: JSDoc only — the repo forbids `.d.ts` sidecars.
 *
 * @module gherkin/parse
 */

import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import { GHERKIN_LOG_PREFIX } from './text.mjs';

/** The `(line:col): ` prefix the parser puts on every error message. */
const LOCATION_PREFIX = /^\((\d+):(\d+)\):\s*/;

/**
 * The token list in an `UnexpectedTokenException` / `UnexpectedEOFException`
 * message (`expected: #EOF, #Language, …, got 'x'` / `unexpected end of file,
 * expected: …`). Those classes are not exported by `@cucumber/gherkin`, and a
 * bundler may rename them, so the message — whose shape is shared by every
 * Gherkin implementation — is the stable thing to read.
 */
const EXPECTED_TOKENS = /^(unexpected end of file, )?expected: (.*?)(?:, got '.*')?$/s;

/**
 * One parse error in the parsed source's own coordinates.
 *
 * @typedef {object} ParseProblem
 * @property {number | undefined} line 1-based line, when the parser knows it.
 * @property {number | undefined} column 1-based column; `0` or absent at end of file.
 * @property {string} message The parser message without its `(line:col): ` prefix.
 * @property {string[]} expected Token types the parser expected (`#FeatureLine`, …);
 *   empty for any other kind of error (an AST builder or language error).
 * @property {boolean} eof The parser ran out of input (`unexpected end of file`).
 */

/**
 * @typedef {object} ParseOffsets
 * @property {number} [lineOffset] Added to every reported line (default 0).
 * @property {number} [columnOffset] Added to every known, non-zero column (default 0).
 */

/**
 * @typedef {object} ParseResult
 * @property {import('@cucumber/messages').GherkinDocument | undefined} document
 *   The AST, or `undefined` when the source has errors (the parser builds no
 *   partial document).
 * @property {string[]} errors Formatted lines, host-file coordinates, in parser order.
 * @property {ParseProblem[]} problems The same errors, structured, source coordinates.
 */

/**
 * Read the location, message and expected-token list out of one parser error.
 * The location comes from `err.location`, else from the message's own
 * `(line:col): ` prefix; the message is returned without that prefix.
 *
 * @param {unknown} err
 * @returns {ParseProblem}
 */
export function describeParseError(err) {
  const e = /** @type {{ message?: unknown, location?: { line?: number, column?: number } }} */ (
    err ?? {}
  );
  const raw = typeof e.message === 'string' ? e.message : String(err);
  const m = LOCATION_PREFIX.exec(raw);
  const message = m ? raw.slice(m[0].length) : raw;
  const line = e.location?.line ?? (m ? Number(m[1]) : undefined);
  const column = e.location?.column ?? (m ? Number(m[2]) : undefined);
  const x = EXPECTED_TOKENS.exec(message);
  return {
    line,
    column,
    message,
    expected: x ? x[2].split(', ') : [],
    eof: Boolean(x?.[1]),
  };
}

/**
 * Format one {@link ParseProblem} as `<display>:<line>:<col> <message>`, shifted
 * by the offsets, WITHOUT the log prefix: the form an include error quotes
 * after its own `<page>:<L> ::gherkin src="x" — ` lead. When the line is unknown
 * the location is just `<display>`. A missing column prints as `0` (as an
 * end-of-file error does) and is not shifted: there is no character to point at.
 *
 * @param {string} display
 * @param {ParseProblem} problem
 * @param {ParseOffsets} [offsets]
 * @returns {string}
 */
export function formatProblem(display, { line, column, message }, offsets = {}) {
  const { lineOffset = 0, columnOffset = 0 } = offsets;
  const col = column ? column + columnOffset : (column ?? 0);
  const where = line === undefined ? display : `${display}:${line + lineOffset}:${col}`;
  return `${where} ${message}`;
}

/**
 * {@link formatProblem} as a log line: `[dk-gherkin] <display>:<line>:<col> <message>`.
 *
 * @param {string} display
 * @param {ParseProblem} problem
 * @param {ParseOffsets} [offsets]
 * @returns {string}
 */
export function formatParseProblem(display, problem, offsets) {
  return `${GHERKIN_LOG_PREFIX} ${formatProblem(display, problem, offsets)}`;
}

/**
 * Parse one Gherkin source string. Never throws for bad Gherkin: a
 * `CompositeParserException` is unpacked into one entry per error, any other
 * exception becomes a single entry.
 *
 * @param {string} source
 * @param {{ display: string } & ParseOffsets} options `display` names the source
 *   in error lines (a project-relative path or a page path).
 * @returns {ParseResult}
 */
export function parseGherkin(source, { display, lineOffset = 0, columnOffset = 0 }) {
  const parser = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  );
  try {
    return { document: parser.parse(source), errors: [], problems: [] };
  } catch (err) {
    const nested = /** @type {{ errors?: unknown }} */ (err ?? {}).errors;
    const list = Array.isArray(nested) && nested.length > 0 ? nested : [err];
    const problems = list.map(describeParseError);
    const offsets = { lineOffset, columnOffset };
    const errors = problems.map((p) => formatParseProblem(display, p, offsets));
    return { document: undefined, errors, problems };
  }
}
