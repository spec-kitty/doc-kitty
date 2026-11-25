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

import { formatInstant, normaliseInstant } from './vocabulary-core.mjs';
import { PRODUCER_REGISTRY } from './producers.mjs';
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
 * Read from the producer registry (`producers.mjs`, #330), which also holds each
 * producer's ownership scope.
 */
export const PRODUCERS = Object.freeze(PRODUCER_REGISTRY.ids('ownership'));

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
const RETIRED_STAMP_BY_PRODUCER = Object.freeze(
  Object.fromEntries(
    PRODUCERS.flatMap((id) => {
      const retiredBy = PRODUCER_REGISTRY.get(id)?.retiredBy;
      return retiredBy === undefined ? [] : [[id, retiredBy]];
    }),
  ),
);
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
const REGENERATE_HINT = Object.freeze(
  Object.fromEntries(PRODUCERS.map((id) => [id, PRODUCER_REGISTRY.get(id)?.regenerateHint ?? 'regenerate the page'])),
);

/**
 * The ownership producer a `generated.by` value names: its retired unversioned
 * form or a `<producer>/<version>` stamp. `undefined` for anything else.
 *
 * @param {unknown} by
 * @returns {string | undefined}
 */
function stampProducer(by) {
  if (typeof by !== 'string') return undefined;
  return PRODUCER_REGISTRY.retiredProducerOf(by) ?? PRODUCERS.find((producer) => by.startsWith(`${producer}/`));
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

/** A SemVer 2.0.0 numeric identifier, and an alphanumeric one (pre-release only). */
const NUM_ID = '0|[1-9]\\d*';
const PRE_ID = `(?:${NUM_ID}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
const BUILD_ID = '[0-9A-Za-z-]+';

/**
 * The SemVer 2.0.0 grammar (semver.org, section 2, 9 and 10): no leading
 * zeros, no empty identifier, a pre-release after `-` and build metadata after
 * `+`, in that order.
 */
const STAMP_VERSION = new RegExp(
  `^(${NUM_ID})\\.(${NUM_ID})\\.(${NUM_ID})(?:-${PRE_ID}(?:\\.${PRE_ID})*)?(?:\\+${BUILD_ID}(?:\\.${BUILD_ID})*)?$`,
);

/** npm semver's bounds: at most 256 characters, and each number a safe integer. */
const STAMP_VERSION_MAX_LENGTH = 256;

/**
 * Is `version` one a stamp may carry over? A SemVer 2.0.0 version within npm
 * semver's bounds (#455 operator ruling, 2026-11-25). So `01.00.00`,
 * `1.0.0+.` and `9007199254740992.0.0` are refused, while
 * `99999999999999.0.0` and `1.0.0--` (`-` is a valid pre-release identifier)
 * are versions.
 *
 * @param {string} version
 * @returns {boolean}
 */
function isStampVersion(version) {
  if (version.length > STAMP_VERSION_MAX_LENGTH) return false;
  const core = STAMP_VERSION.exec(version);
  return core !== null && core.slice(1, 4).every((n) => Number.isSafeInteger(Number(n)));
}

/**
 * Build a stamp. While `previous.content_hash` equals the new hash, the hashed
 * content is unchanged and so is the stamp: `previous` comes back as it is, `by` included,
 * so a version bump alone never rewrites a committed generated page (#398). Once
 * the content changes, `by` names the current toolkit version and `at` is `now`
 * (whole-second UTC). So `by` records the version that last changed the hashed content
 * (for a Gherkin page that is the `.feature` source, not the rendered body).
 *
 * `previous.at` is kept only while it still reads as a date, and `previous.by`
 * only while it is this producer's own stamp with a SemVer version ({@link keepsBy});
 * otherwise that field is written fresh.
 *
 * @param {object} args
 * @param {string} args.producer one of {@link PRODUCERS}
 * @param {string} args.hash hex digest of the generated content
 * @param {{by?: string, at?: string, content_hash?: string}} [args.previous] the page's existing stamp
 * @param {Date} [args.now] injectable clock
 * @returns {{by: string, at: string, content_hash: string}}
 */
export function makeStamp({ producer, hash, previous, now = new Date() }) {
  const content_hash = contentHashOf(hash);
  const unchanged = previous?.content_hash === content_hash;
  // A kept `at` must still read as a date: the gate rejects one that does not (#227).
  const keepAt = unchanged && typeof previous.at === 'string' && normaliseInstant(previous.at) !== null;
  // A kept `by` must be this producer's own stamp with a SemVer version,
  // and moves with `at`; a hand-edited `by` is replaced, as before.
  const keepBy = keepAt && keepsBy(previous.by, producer);
  return {
    by: keepBy ? /** @type {string} */ (previous.by) : `${producer}/${toolkitVersion()}`,
    at: keepAt ? /** @type {string} */ (previous.at) : formatInstant(now),
    content_hash,
  };
}

/**
 * May a previous stamp's `by` be carried over? Only this producer's own stamp
 * whose suffix is a SemVer 2.0.0 version ({@link isStampVersion}); anything
 * else, such as a hand-edited `by`, is written fresh. The one
 * rule shared by {@link makeStamp} and the evidence index's carry-over (#455).
 *
 * @param {unknown} by
 * @param {string} producer one of {@link PRODUCERS}
 * @returns {boolean}
 */
export function keepsBy(by, producer) {
  return typeof by === 'string' && isGeneratedStamp(by, producer) && isStampVersion(by.slice(producer.length + 1));
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

// --- "last changed" per output (#226, ADR-0059 implementation notes) --------
// Two outputs, two questions, so two rules defined side by side, not one:
// RSS dates a page by when its author last said it changed; OKF's generated.at
// is the producing tool's last content change, so only an ownership stamp counts.

/**
 * The RSS rule (#190, #226): the instant a feed item carries. `updated` first,
 * else the stamp's `generated.at`, else null. An `updated` at epoch 0 counts as
 * missing (the `||` of the original `feedDateMillis`), so such a page falls back
 * to `generated.at`. The OKF export uses the other rule, {@link okfGenerated}.
 *
 * @param {{ updated?: unknown, generated?: { at?: unknown } | null }} page raw frontmatter
 * @returns {Date | null}
 */
export function feedInstant(page) {
  const updated = normaliseInstant(page.updated)?.date;
  if (updated && updated.getTime()) return updated;
  return normaliseInstant(page.generated?.at)?.date ?? null;
}

/**
 * The OKF export rule (#226): which stamp the export may use, and the
 * `generated.at` it reports. Only an OWNERSHIP stamp ({@link isGeneratedStamp}:
 * Gherkin, glossary) is the producing tool's own, so only it supplies `by`,
 * `at` and `content_hash`. The scaffold stamp is provenance only (it records
 * where a page started, not who last changed it) and any foreign stamp is not
 * ours to vouch for: both are ignored as a stamp, so a human edit is not
 * attributed to them. `at` is the stamp's, else `updated`, else an ignored
 * stamp's `at`. Instants pass through unchanged (graph nodes carry canonical
 * strings). The RSS rule is {@link feedInstant}.
 *
 * @param {{ updated?: any, generated?: Record<string, any> | null }} page a content-graph node
 * @returns {{ stamp: Record<string, any> | undefined, at: any }}
 */
export function okfGenerated(page) {
  const stamp = isGeneratedStamp(page.generated?.by) ? page.generated : undefined;
  return { stamp, at: stamp?.at ?? page.updated ?? page.generated?.at };
}
