/**
 * The generated-page stamp (`generated: {by, at, content_hash}`, #177, FR-008,
 * C-004): who produced a page, when its content last changed, and a hash of that
 * content. Owns the stamp shape and its detection; the pure instant/actor rules
 * live in `vocabulary-core.mjs`. This module reads `src/package.json` (the
 * published `@spec-kitty/doc-toolkit` manifest — never the repo root manifest),
 * so it is not part of the fs-free core.
 *
 * @module generator-stamp
 */

import { readFileSync } from 'node:fs';
import { formatInstant } from './vocabulary-core.mjs';
// The legacy unversioned Gherkin stamp, single-sourced where it is written.
import { GENERATED_BY as LEGACY_GHERKIN_STAMP } from './gherkin/feature-core.mjs';

/**
 * The OWNERSHIP producers: they generate (and so own) the pages they stamp
 * (each stamps `<producer>/<version>`). Only these make a page "generated".
 */
export const PRODUCERS = Object.freeze(['doc-kitty-gherkin', 'doc-kitty-glossary']);

/**
 * The PROVENANCE-ONLY producer: the scaffold stamps the starting point of a page
 * a human then authors. It records where the page came from but never makes it
 * "generated" (exemptions, raw fences, scenario index), so it is not in
 * {@link PRODUCERS}.
 */
export const SCAFFOLD_PRODUCER = 'doc-kitty-scaffold';

/**
 * Stamps written before versioned stamps existed. Still recognised so pages not
 * yet regenerated keep their generated-page exemptions.
 */
export const LEGACY_STAMPS = Object.freeze([LEGACY_GHERKIN_STAMP]);

/** @type {string | undefined} */
let cachedVersion;

/**
 * The toolkit version, read once from `src/package.json`.
 *
 * @returns {string}
 */
export function toolkitVersion() {
  cachedVersion ??= JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ).version;
  return /** @type {string} */ (cachedVersion);
}

/**
 * @param {string} hash a hex digest, optionally already `sha256:`-prefixed
 * @returns {string} `sha256:<first 12 hex>`
 */
function contentHashOf(hash) {
  return `sha256:${hash.replace(/^sha256:/, '').slice(0, 12)}`;
}

/**
 * Build a stamp. `at` is stable: it is carried over from `previous` while
 * `previous.content_hash` equals the new hash (even across a version bump) and
 * is `now` (whole-second UTC) once the content changes.
 *
 * @param {object} args
 * @param {string} args.producer one of {@link PRODUCERS}
 * @param {string} args.hash hex digest of the generated content
 * @param {{at?: string, content_hash?: string}} [args.previous] the page's existing stamp
 * @param {Date} [args.now] injectable clock
 * @returns {{by: string, at: string, content_hash: string}}
 */
export function makeStamp({ producer, hash, previous, now = new Date() }) {
  const content_hash = contentHashOf(hash);
  const keep = previous?.content_hash === content_hash && typeof previous.at === 'string';
  return {
    by: `${producer}/${toolkitVersion()}`,
    at: keep ? /** @type {string} */ (previous.at) : formatInstant(now),
    content_hash,
  };
}

/**
 * Is `by` an OWNERSHIP generator stamp? Prefix match on `<producer>/` (any
 * ownership producer when none is given; never the scaffold), plus the legacy
 * exact values.
 *
 * @param {unknown} by
 * @param {string} [producer]
 * @returns {boolean}
 */
export function isGeneratedStamp(by, producer) {
  if (typeof by !== 'string') return false;
  const producers = producer ? [producer] : PRODUCERS;
  if (producers.some((p) => by.startsWith(`${p}/`) && by.length > p.length + 1)) return true;
  // The legacy stamp is the Gherkin pipeline's: a named other producer never owns it.
  return (!producer || producer === 'doc-kitty-gherkin') && LEGACY_STAMPS.includes(by);
}
