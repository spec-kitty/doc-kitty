/**
 * Shared, PURE text helpers for Gherkin descriptions (ADR-0046). Both the
 * metadata core (`feature-core.mjs`, which derives `description` and
 * `audience.guidance_text`) and the renderer (`render.mjs`, which prints the
 * narrative with hard line breaks) need the SAME answer to "where does the
 * narrative block end?" — so the rule lives once, here. A second narrative or
 * dedent implementation is a review finding (drift risk).
 *
 * PURITY CONTRACT: no imports at all (no fs, no path, no Astro), so it loads in
 * the Astro build and in the bare-Node `generate-feature-pages.mjs --check` gate.
 *
 * @module gherkin/text
 */

/**
 * THE prefix on every warning/error line the Gherkin pipeline emits (contract
 * §7). Defined once, here in the import-free module, so every `gherkin/*`
 * module (and `config.ts`, via `load.mjs`'s re-export) shares it.
 */
export const GHERKIN_LOG_PREFIX = '[dk-gherkin]';

/**
 * THE reserved metadata-tag namespace (`@dk:context=…`, `@dk:status=…`, ADR-0046
 * contract §2). `feature-core.mjs` reads these tags into frontmatter; the in-page
 * emitter (`mdast.mjs`, ADR-0051) drops them, because an embed has no
 * frontmatter for them to feed (03 §1.5).
 */
export const DK_TAG_PREFIX = '@dk:';

/**
 * A `.feature` file name (case-sensitive, as the Cucumber runners match it).
 * THE one rule: slice C's source walk (`load.mjs`), an include's `src`
 * (`include.mjs`) and the content loader's include scan (`include-scan.mjs`)
 * all apply it, so an include never reads (or prints, in a parse error) a file
 * that is not Gherkin.
 */
export const FEATURE_FILE = /\.feature$/;

/**
 * A path that is NOT relative with POSIX separators: absolute (`/…`), a Windows
 * drive letter or URL scheme (`C:`, `file:`, `https:`), or holding a backslash
 * or a NUL anywhere. THE one path-syntax rule of the Gherkin options and
 * includes (ADR-0051 trust boundary): `gherkin.includeRoots` (`options.mjs`), an
 * include's `src` (`include.mjs`) and the content loader's include scan
 * (`include-scan.mjs`) all refuse such a path instead of resolving it somewhere
 * the author did not mean. It lives here, in the import-free module, because
 * `options.mjs` must stay pure; it is a regex rather than `node:path` for the
 * same reason.
 */
const NOT_RELATIVE_POSIX = /^(?:\/|[A-Za-z][A-Za-z0-9+.-]*:)|[\\\0]/;

/**
 * True for a non-blank path that is relative with POSIX separators (see
 * {@link NOT_RELATIVE_POSIX}). `..` segments pass: containment is the caller's
 * job, after symlinks are resolved.
 *
 * @param {unknown} value
 * @returns {value is string}
 */
export function isRelativePosixPath(value) {
  return typeof value === 'string' && value.trim() !== '' && !NOT_RELATIVE_POSIX.test(value);
}

/**
 * The display title of a Feature: its trimmed name, or — for an unnamed
 * `Feature:` — its trimmed keyword as written (`Feature`, `Functionaliteit`, …),
 * or `Feature` when even that is missing. The ONE fallback shared by the page
 * `title`/`description` (`feature-core.mjs`) and the body H1 (`render.mjs`), so
 * the hub link, the frontmatter and the heading never disagree.
 *
 * @param {string | undefined} name The Feature name as parsed.
 * @param {string | undefined} keyword The Feature keyword as parsed.
 * @returns {string}
 */
export function featureTitle(name, keyword) {
  return String(name ?? '').trim() || String(keyword ?? '').trim() || 'Feature';
}

/**
 * A line that opens or continues a user-story narrative (English only; the i18n
 * gap is documented in ADR-0046). Case-insensitive, matched after trimming.
 */
const NARRATIVE_LINE = /^(as an?|i want|so that|in order to)\b/i;

/**
 * Remove the common leading indentation of the non-blank lines, normalise CRLF,
 * strip trailing whitespace per line, and drop leading/trailing blank lines.
 *
 * The parser keeps source indentation in `description` (a Feature's description
 * typically comes back indented by two spaces); four or more would otherwise make
 * Markdown read it as an indented code block.
 *
 * @param {string | undefined} text
 * @returns {string} The dedented text, or `''` when there is none.
 */
export function dedent(text) {
  if (!text) return '';
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, ''));
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0) return '';
  let indent = Infinity;
  for (const line of lines) {
    if (line === '') continue;
    const lead = /^[ \t]*/.exec(line)?.[0].length ?? 0;
    if (lead < indent) indent = lead;
  }
  return lines.map((l) => l.slice(Math.min(indent, l.length))).join('\n');
}

/**
 * Split a (raw or dedented) description into its leading narrative block and the
 * remainder. The narrative is the run of consecutive lines at the very start of
 * the description that each match `As a|an …`, `I want …`, `So that …` or
 * `In order to …`; it ends at the first blank or non-matching line. The remainder
 * is everything after it, with leading blank lines removed.
 *
 * @param {string | undefined} description
 * @returns {{ narrative: string[], rest: string }} `narrative` holds the trimmed
 *   narrative lines (empty when the description does not open with one).
 */
export function splitNarrative(description) {
  const lines = dedent(description).split('\n');
  const narrative = [];
  let i = 0;
  while (i < lines.length && NARRATIVE_LINE.test(lines[i].trim())) {
    narrative.push(lines[i].trim());
    i += 1;
  }
  while (i < lines.length && lines[i].trim() === '') i += 1;
  return { narrative, rest: lines.slice(i).join('\n') };
}
