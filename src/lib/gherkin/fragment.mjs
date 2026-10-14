/**
 * PURE parse of a Gherkin FRAGMENT: the body of a ```` ```gherkin ```` fence,
 * which may omit the `Feature:` line, or the `Scenario:` line as well
 * (ADR-0051 decision 3, rendering contract §1.3).
 *
 * THE RULE IS DRIVEN BY THE PARSER, not by scanning for keywords. A line scan
 * ("does any line start with `Feature:`?") is fooled by a `Feature:` line inside
 * a doc string; the parser is not. So:
 *
 * 1. **Parse as written.** A complete feature (or an empty / comment-only body)
 *    is returned untouched, with `lineShift: 0`.
 * 2. **Missing Feature line.** Only when the parser's FIRST error is an
 *    unexpected token (not end of file) that it wanted to be a `#FeatureLine`,
 *    the body is parsed again with a synthetic, untitled `Feature:` line
 *    inserted before its first non-blank, non-comment line. The parser expects a
 *    `#FeatureLine` only while it is still in the document header (blank lines,
 *    comments, the `# language:` line, tags) — a document has one Feature — so
 *    that error necessarily sits on the first content line past the header: the
 *    contract's "first error at the first content line" condition, read from the
 *    parser rather than re-derived by a second line scan. Any other first error
 *    (a bad `# language:`, a tag with a space, a dangling tag at end of file, an
 *    error after a real `Feature:` line) is a real error and nothing is wrapped.
 * 3. **Missing Scenario line.** Steps directly under a `Feature:` line are not an
 *    error to the parser: its grammar reads them as the Feature's free-text
 *    description and parses without complaint, so a second parse cannot signal
 *    "steps with no Scenario" (so no such intermediate parse is run). The
 *    decision instead reads the ONE line the parser would put at the start of
 *    that description — the first content line — and classifies it exactly as
 *    `GherkinClassicTokenMatcher` classifies a `#StepLine`: its left-trimmed
 *    text starts with one of the dialect's step keywords (`Given `, `* `, `Gegeven `, …). If it does, a
 *    synthetic, untitled `Scenario:` line is inserted after the synthetic
 *    `Feature:` line. Only that first content line is read, and it can never sit
 *    inside a doc string (a doc string needs an opening line before it).
 *    The same classification is the decision 3 wrap's ONLY line reading: the
 *    "is a Feature line missing?" question is answered by the parser alone.
 * 4. **Steps under a REAL `Feature:` line** (no `Scenario:` line) are what the
 *    author wrote, so nothing is wrapped, but the parser reads them as the
 *    Feature's description: they would render as prose, not as steps. When the
 *    Feature has NO children (no Background, Scenario or Rule) and its first
 *    content line past any user-story narrative (`splitNarrative`) is a step
 *    line (classified as in rule 3, except that a `* ` line is taken for a
 *    Markdown bullet, the likelier reading in a description), its line is
 *    returned as `descriptionStepLine` and the stage warns. A Feature with
 *    children is never flagged: its description is prose that merely opens with
 *    a step keyword, as the Dutch narrative `Als verlader wil ik …` (`Als ` is a
 *    step keyword) or an English `When a shipper books …` does.
 *
 * The synthetic keywords are localised: when the header carries
 * `# language: <code>` the first `feature` / `scenario` keyword of that
 * `@cucumber/gherkin` dialect is used, and the header — including the language
 * line — stays above the inserted lines, so the dialect still applies.
 *
 * LINES. Every error is mapped back to the fragment's own lines (an error after
 * the insertion point moves up by `lineShift`; the header above it does not
 * move), then the host offsets are applied, so an error is always reported at
 * the line the author wrote. `lineShift` is returned for AST consumers: every
 * Feature / Rule / Background / Scenario / step / tag / Examples location in the
 * returned `document` is in WRAPPED coordinates and maps back with
 * `line - lineShift`. (Only `document.comments` above the insertion point keep
 * their line; the renderer never shows comments.)
 *
 * SYNTHETIC LEVELS are identified by the returned `synthetic` flags, not by the
 * empty name (a real `Feature:` may be untitled too): `synthetic.feature` means
 * `document.feature` is synthetic; `synthetic.scenario` means
 * `document.feature.children[0].scenario` is. The emitter renders no heading for
 * either (contract §1.3, Output).
 *
 * PURITY CONTRACT: imports only `@cucumber/gherkin` (for its `dialects` table)
 * and the pure `./parse.mjs` and `./text.mjs`. NO fs, path or `astro`/`@astrojs/*` (enforced by
 * the import-scan table in `gherkin-feature-core.test.ts`).
 *
 * TYPING: JSDoc only — the repo forbids `.d.ts` sidecars.
 *
 * @module gherkin/fragment
 */

import { dialects } from '@cucumber/gherkin';
import { formatParseProblem, parseGherkin } from './parse.mjs';
import { splitNarrative } from './text.mjs';

/**
 * The `# language:` header, exactly as `GherkinClassicTokenMatcher` matches it
 * (the pattern is not exported by `@cucumber/gherkin`). The parser honours only
 * the FIRST such line, so only the first is read here.
 */
const LANGUAGE_PATTERN = /^\s*#\s*language\s*:\s*([a-zA-Z\-_]+)\s*$/;

/**
 * Left-trim as `GherkinLine` does (`trimmedLineText`), so blank / comment / step
 * classification agrees with the parser's own.
 *
 * @param {string} line
 * @returns {string}
 */
const ltrim = (line) => line.replace(/^\s+/, '');

/**
 * @typedef {object} SyntheticLevels
 * @property {boolean} feature `document.feature` was inserted by the wrap.
 * @property {boolean} scenario `document.feature.children[0].scenario` was inserted.
 */

/**
 * @typedef {object} FragmentResult
 * @property {import('@cucumber/messages').GherkinDocument | undefined} document
 *   The AST (wrapped coordinates, see the module header), or `undefined` when
 *   there are errors.
 * @property {string[]} errors Formatted `[dk-gherkin] <display>:<line>:<col> <message>`
 *   lines at the AUTHOR's lines plus the host offsets.
 * @property {import('./parse.mjs').ParseProblem[]} problems The same errors,
 *   structured, at the fragment's own (unwrapped, un-offset) lines.
 * @property {number} lineShift Lines the wrap inserted: 0, 1 (Feature) or 2
 *   (Feature and Scenario).
 * @property {SyntheticLevels} synthetic
 * @property {number} descriptionStepLine The fragment's own (1-based) line of a
 *   step line that the parser read as a REAL Feature's description (module doc,
 *   rule 4); `0` when there is none.
 */

/**
 * Parse a fence body, wrapping it in a synthetic Feature (and Scenario) when the
 * parser shows it is a fragment.
 *
 * @param {string} source The fence body.
 * @param {{ display: string } & import('./parse.mjs').ParseOffsets} options
 *   `display` names the host page in error lines; `lineOffset` is the page line
 *   of the fence opening (so content line `n` reports as `lineOffset + n`);
 *   `columnOffset` is the fence's indentation.
 * @returns {FragmentResult}
 */
export function parseFragment(source, { display, lineOffset = 0, columnOffset = 0 }) {
  const asWritten = parseGherkin(source, { display, lineOffset, columnOffset });
  // Split exactly as the parser's TokenScanner does, so indices are its lines.
  const lines = source.split(/\r?\n/);
  /** @type {FragmentResult} */
  const unwrapped = {
    ...asWritten,
    lineShift: 0,
    synthetic: { feature: false, scenario: false },
    descriptionStepLine: descriptionStepLine(asWritten.document, lines),
  };

  const first = asWritten.problems[0];
  if (!first || first.eof || !first.expected.includes('#FeatureLine')) return unwrapped;

  // The synthetic Feature goes before the first non-blank, non-comment line:
  // below the `# language:` line (a comment), so the dialect still applies, and
  // above any tag lines, so tags written above a Scenario stay on that Scenario.
  const insertAt = lines.findIndex((l) => ltrim(l) !== '' && !ltrim(l).startsWith('#'));
  if (insertAt < 0) return unwrapped; // unreachable: a non-EOF token error has a line

  const languageLine = lines.slice(0, insertAt).find((l) => LANGUAGE_PATTERN.test(l));
  const dialect = dialects[languageLine ? String(LANGUAGE_PATTERN.exec(languageLine)?.[1]) : 'en'];
  if (!dialect) return unwrapped; // unreachable: the parser's first error would be the language

  const inserted = [`${dialect.feature[0]}:`];
  if (isStepLine(lines[insertAt], dialect)) inserted.push(`${dialect.scenario[0]}:`);
  const lineShift = inserted.length;
  const wrapped = [...lines.slice(0, insertAt), ...inserted, ...lines.slice(insertAt)].join('\n');

  const result = parseGherkin(wrapped, { display });
  // After a wrap only lines past the insertion point can carry an error: the
  // header above it is blank lines and comments, and a bad `# language:` would
  // have been the first error and stopped the wrap. The synthetic lines are
  // well-formed by construction.
  /** @param {number | undefined} line */
  const unshift = (line) => (line === undefined ? line : line - lineShift);
  const problems = result.problems.map((p) => ({ ...p, line: unshift(p.line) }));
  return {
    document: result.document,
    errors: problems.map((p) => formatParseProblem(display, p, { lineOffset, columnOffset })),
    problems,
    lineShift,
    synthetic: { feature: true, scenario: lineShift === 2 },
    descriptionStepLine: 0,
  };
}

/**
 * The line of a step written under a real `Feature:` line with no `Scenario:`
 * (module doc, rule 4), or `0`. Only a Feature with no children is read. The
 * first non-blank, non-comment line after the `Feature:` line is the one the
 * parser starts the description with; the user-story narrative lines that
 * `splitNarrative` takes from the description's start are skipped, and a `* `
 * line past them is taken for a Markdown bullet.
 *
 * @param {import('@cucumber/messages').GherkinDocument | undefined} document
 *   The as-written parse (unwrapped, so its lines are `lines`' indices + 1).
 * @param {readonly string[]} lines
 * @returns {number}
 */
function descriptionStepLine(document, lines) {
  const feature = document?.feature;
  const dialect = feature ? dialects[feature.language] : undefined;
  if (!feature || !dialect || feature.children.length > 0 || !feature.description.trim()) return 0;
  // The narrative is the description's first lines, consecutive and non-blank.
  let narrative = splitNarrative(feature.description).narrative.length;
  for (let i = feature.location.line; i < lines.length; i += 1) {
    const t = ltrim(lines[i]);
    if (t === '' || t.startsWith('#')) continue;
    if (narrative > 0) {
      narrative -= 1;
      continue;
    }
    return isStepLine(t, dialect) && !t.startsWith('* ') ? i + 1 : 0;
  }
  return 0;
}

/**
 * Does `line` open a step in `dialect`? Mirrors
 * `GherkinClassicTokenMatcher.match_StepLine`: the left-trimmed text starts with
 * a step keyword, each of which carries its own trailing space (`Given `, `* `).
 *
 * @param {string} line
 * @param {import('@cucumber/gherkin').Dialect} dialect
 * @returns {boolean}
 */
function isStepLine(line, dialect) {
  const t = ltrim(line);
  return [dialect.given, dialect.when, dialect.then, dialect.and, dialect.but].some((keywords) =>
    keywords.some((k) => t.startsWith(k)),
  );
}
