/**
 * The generated-page stamp (`generated: {by, at, content_hash}`, #177, FR-008,
 * C-004): who produced a page, when its content last changed, and a hash of that
 * content. Owns the stamp shape and its detection; the pure instant/actor rules
 * live in `vocabulary-core.mjs`. This module imports `src/package.json` (the
 * published `@spec-kitty/doc-toolkit` manifest — never the repo root manifest),
 * so it is not part of the fs-free core.
 *
 * @module generator-stamp
 */

import { formatInstant } from './vocabulary-core.mjs';
// A JSON module, not a path read from `import.meta.url`: Vite inlines it, so the
// version still resolves once a route that stamps is bundled (#182).
import toolkitManifest from '../package.json' with { type: 'json' };

/** The producer id of the Gherkin pipeline's stamp (`doc-kitty-gherkin/<version>`). */
export const GHERKIN_PRODUCER = 'doc-kitty-gherkin';

/** The producer id of the glossary codegen's stamp (`doc-kitty-glossary/<version>`). */
export const GLOSSARY_PRODUCER = 'doc-kitty-glossary';

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
 * The unversioned `generated.by` values written before versioned stamps (#181).
 * Retired in 0.4.0 (#210): never recognised as generated, only detected so
 * {@link retiredStampProblem} can tell the author to regenerate.
 */
const RETIRED_STAMP_BY_PRODUCER = Object.freeze({
  [GHERKIN_PRODUCER]: 'doc-kitty/gherkin',
  [GLOSSARY_PRODUCER]: 'doc-kitty/glossary',
});
const RETIRED_STAMP_BY = Object.freeze(Object.values(RETIRED_STAMP_BY_PRODUCER));

/**
 * May `producer`'s generator OVERWRITE a page stamped `by`? Its own current stamp,
 * or its own retired unversioned stamp. Used ONLY for section ownership, so the
 * regeneration {@link retiredStampProblem} prescribes can replace a legacy page
 * instead of refusing it as authored. Nothing else recognises a retired stamp:
 * such a page is not "generated" ({@link isGeneratedStamp}) and fails the gate.
 *
 * @param {unknown} by
 * @param {string} producer one of {@link PRODUCERS}
 * @returns {boolean}
 */
export function isRegenerableStamp(by, producer) {
  return isGeneratedStamp(by, producer) || (typeof by === 'string' && by === RETIRED_STAMP_BY_PRODUCER[producer]);
}

/**
 * The content hash a generated page's `generated` stamp records: its
 * `content_hash`. The ONE reader every consumer routes through. A `sha256:`
 * hash in `at` (the stamp form before `content_hash`) is no longer read (0.4.0,
 * #210); such a page fails the frontmatter gate until it is regenerated.
 *
 * @param {{ at?: unknown, content_hash?: unknown } | undefined | null} generated
 * @returns {string | undefined} `sha256:<hex>` (or undefined: no recorded hash)
 */
export function stampContentHash(generated) {
  return typeof generated?.content_hash === 'string' ? generated.content_hash : undefined;
}

/**
 * Why a `generated` block is a retired (pre-0.4.0) stamp, or `undefined` when it
 * is not: an unversioned `by` (`doc-kitty/gherkin`, `doc-kitty/glossary`), or a
 * `sha256:` hash in `at` with no `content_hash`. The message tells the author to
 * regenerate the page, since the generated-page exemptions no longer apply.
 *
 * @param {unknown} generated the page's `generated` frontmatter value
 * @returns {string | undefined}
 */
export function retiredStampProblem(generated) {
  if (generated === null || typeof generated !== 'object') return undefined;
  const { by, at, content_hash } = /** @type {{ by?: unknown, at?: unknown, content_hash?: unknown }} */ (generated);
  const unversioned = typeof by === 'string' && RETIRED_STAMP_BY.includes(by);
  const hashInAt = typeof at === 'string' && at.startsWith('sha256:') && typeof content_hash !== 'string';
  if (!unversioned && !hashInAt) return undefined;
  const form = unversioned ? `the unversioned \`generated.by: ${by}\`` : `a content hash in \`generated.at: ${at}\``;
  return (
    `\`generated\` is a legacy stamp (${form}), no longer supported since 0.4.0 (#210); ` +
    `regenerate the page with the current toolkit (${regenerateHint(stampProducer(by))}) ` +
    'to write the versioned `<producer>/<version>` stamp with `content_hash`'
  );
}

/** How to regenerate a page each ownership producer writes. */
const REGENERATE_HINT = Object.freeze({
  [GHERKIN_PRODUCER]: 'run `dockitty-generate-feature-pages`',
  [GLOSSARY_PRODUCER]: 'run `astro build` or `astro dev`, which rewrites the glossary pages',
});

/**
 * The ownership producer a `generated.by` value names: its retired unversioned
 * form or a `<producer>/<version>` stamp. `undefined` for anything else.
 *
 * @param {unknown} by
 * @returns {string | undefined}
 */
function stampProducer(by) {
  if (typeof by !== 'string') return undefined;
  const retired = PRODUCERS.find((producer) => RETIRED_STAMP_BY_PRODUCER[producer] === by);
  return retired ?? PRODUCERS.find((producer) => by.startsWith(`${producer}/`));
}

/**
 * @param {string | undefined} producer
 * @returns {string}
 */
function regenerateHint(producer) {
  if (producer !== undefined) return REGENERATE_HINT[producer];
  return `Gherkin pages: ${REGENERATE_HINT[GHERKIN_PRODUCER]}; glossary pages: ${REGENERATE_HINT[GLOSSARY_PRODUCER]}`;
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

/**
 * The toolkit version, from `src/package.json`.
 *
 * @returns {string}
 */
export function toolkitVersion() {
  return toolkitManifest.version;
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
 * ownership producer when none is given; never the scaffold). The unversioned
 * pre-0.3 stamps are not recognised (0.4.0, #210).
 *
 * @param {unknown} by
 * @param {string} [producer]
 * @returns {boolean}
 */
export function isGeneratedStamp(by, producer) {
  if (typeof by !== 'string') return false;
  const producers = producer ? [producer] : PRODUCERS;
  return producers.some((p) => by.startsWith(`${p}/`) && by.length > p.length + 1);
}
