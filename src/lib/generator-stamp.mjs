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

/** The producer id of the Gherkin pipeline's stamp (`doc-kitty-gherkin/<version>`). */
export const GHERKIN_PRODUCER = 'doc-kitty-gherkin';

/** The producer id of the glossary codegen's stamp (`doc-kitty-glossary/<version>`). */
export const GLOSSARY_PRODUCER = 'doc-kitty-glossary';

/**
 * The LEGACY `generated.by` stamp (unversioned) of Gherkin pages written before
 * versioned stamps. Still needed: pages not yet regenerated carry it and must stay
 * recognised (exemptions, include scan) until they are. New pages never get it.
 */
export const LEGACY_GENERATED_BY = 'doc-kitty/gherkin';

/**
 * The OWNERSHIP producers: they generate (and so own) the pages they stamp
 * (each stamps `<producer>/<version>`). Only these make a page "generated".
 */
export const PRODUCERS = Object.freeze([GHERKIN_PRODUCER, GLOSSARY_PRODUCER]);

/**
 * The PROVENANCE-ONLY producer: the scaffold stamps the starting point of a page
 * a human then authors. It records where the page came from but never makes it
 * "generated" (exemptions, raw fences, scenario index), so it is not in
 * {@link PRODUCERS}.
 */
export const SCAFFOLD_PRODUCER = 'doc-kitty-scaffold';

/**
 * Stamps written before versioned stamps existed, keyed by the producer that
 * wrote them. Still recognised so pages not yet regenerated keep their
 * generated-page exemptions.
 */
export const LEGACY_STAMP_BY_PRODUCER = Object.freeze({ [GHERKIN_PRODUCER]: LEGACY_GENERATED_BY });

export const LEGACY_STAMPS = Object.freeze(Object.values(LEGACY_STAMP_BY_PRODUCER));

/**
 * The content hash a generated page's `generated` stamp records: `content_hash`,
 * else the legacy `at` when that still holds a `sha256:` hash (stamps written
 * before `at` became an instant). The ONE reader every consumer routes through,
 * so none treats an instant as a hash.
 *
 * @param {{ at?: unknown, content_hash?: unknown } | undefined | null} generated
 * @returns {string | undefined} `sha256:<hex>` (or undefined: no recorded hash)
 */
export function stampContentHash(generated) {
  if (typeof generated?.content_hash === 'string') return generated.content_hash;
  const { at } = generated ?? {};
  return typeof at === 'string' && at.startsWith('sha256:') ? at : undefined;
}

/**
 * The `generated:` block lines, in the stable key order `by`, `at`, `content_hash`
 * (JSON-quoted scalars). The ONE serializer for every generator.
 *
 * @param {{ by: string, at: string, content_hash: string }} stamp
 * @returns {string[]}
 */
export function serializeStamp(stamp) {
  return [
    'generated:',
    `  by: ${JSON.stringify(stamp.by)}`,
    `  at: ${JSON.stringify(stamp.at)}`,
    `  content_hash: ${JSON.stringify(stamp.content_hash)}`,
  ];
}

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
  // A named producer recognises only its own legacy stamp.
  const legacy = producer ? [LEGACY_STAMP_BY_PRODUCER[producer]] : LEGACY_STAMPS;
  return legacy.includes(by);
}
