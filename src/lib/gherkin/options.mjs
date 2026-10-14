/**
 * The `gherkin` option contract (ADR-0046, widened by ADR-0051), validated ONCE
 * for both entry points:
 *  - the Astro integration (`config.ts` `defineDocKittyIntegrations({ gherkin })`)
 *    calls {@link normalizeGherkinOptions}, which accepts `true` or the object
 *    form, applies the defaults, and runs the generated-pages rules only when
 *    `sources` is given;
 *  - the bare-Node twin (`src/scripts/generate-feature-pages.mjs`) only ever
 *    generates pages, so it calls {@link validateGherkinPages} directly and keeps
 *    requiring `--sources`.
 * Before this module only the integration validated `section`, so the CLI accepted
 * `--section ../../x` and wrote (and pruned!) outside the docs tree.
 *
 * PURITY CONTRACT: imports only the import-free `./text.mjs`, so it loads in the
 * Astro config and under plain `node` alike.
 *
 * TYPING: JSDoc-typed `.mjs`, no `.d.ts` sidecar (see `../vocabulary-core.mjs`).
 *
 * @module gherkin/options
 */

import { isPlainIndexName } from '../vocabulary-core.mjs';
import { GHERKIN_LOG_PREFIX, isRelativePosixPath } from './text.mjs';

/** Default section id (folder under the docs root) the pages are generated into. */
export const DEFAULT_GHERKIN_SECTION = 'behaviour';

/**
 * Section ids the Gherkin generator may never own: `_meta` (the registry's home)
 * and every OTHER generator's section — today the glossary's `glossary`. It MUST
 * equal `['_meta', ...BUILD_GENERATED_SECTION_IDS]` (`../sections.ts`); `config.ts`
 * passes exactly that list, and a parity test pins this bare-Node default to it
 * (the CLI cannot import the TypeScript constant).
 */
export const RESERVED_GHERKIN_SECTIONS = Object.freeze(['_meta', 'glossary']);

/**
/**
 * The keys of the generated-pages part of the `gherkin` option: what
 * {@link validateGherkinPages} carries through. ONE list, read by the parity test
 * against the CLI's `FLAG` map: a setting without a flag (or the reverse) must
 * fail, not drift (FR-004a).
 */
export const GHERKIN_PAGES_KEYS = Object.freeze(/** @type {const} */ ([
  'sources',
  'section',
  'sourceUrlPrefix',
  'sourceRoot',
  'allowEmpty',
  'titles',
]));

/**
 * Every key the object form of the `gherkin` option accepts, in the order the
 * "unknown option" error lists them: the in-page keys (ADR-0051) plus
 * {@link GHERKIN_PAGES_KEYS}. An unknown key is refused rather than ignored: a typo
 * (`includeRoot`, `fence`) would otherwise switch nothing on and fail silently, and
 * the option is new enough that no caller relies on leniency.
 */
export const GHERKIN_OPTION_KEYS = Object.freeze(/** @type {const} */ ([
  'fences',
  'includeRoots',
  'results',
  ...GHERKIN_PAGES_KEYS,
]));

/** The keys of the object form of `gherkin.results` (ADR-0052). */
export const GHERKIN_RESULTS_KEYS = Object.freeze(/** @type {const} */ (['report', 'root']));

/**
 * The raw object form (structurally the object arm of `DocKittyOptions['gherkin']`).
 *
 * @typedef {object} GherkinOptionsInput
 * @property {unknown} [fences]
 * @property {unknown} [includeRoots]
 * @property {unknown} [results]
 * @property {unknown} [sources]
 * @property {unknown} [section]
 * @property {unknown} [sourceUrlPrefix]
 * @property {unknown} [sourceRoot]
 * @property {unknown} [allowEmpty]
 * @property {unknown} [titles]
 */

/**
 * The validated generated-pages option (ADR-0046), defaults applied.
 *
 * @typedef {object} ValidatedGherkinPages
 * @property {string[]} sources Source directories (non-empty, each non-blank).
 * @property {string} section ONE safe folder name under the docs dir.
 * @property {string} [sourceUrlPrefix]
 * @property {string} sourceRoot Site-root-relative (default `'.'`).
 * @property {true} [allowEmpty] Present only when `true`: remove the generated
 *   pages when the whole source set is empty, instead of stopping.
 * @property {Record<string, string>} [titles] Present only when given: hub
 *   titles by source-relative directory (`{ hr: 'HR' }`, #125).
 */

/**
 * The normalised `gherkin` option (ADR-0051), defaults applied.
 *
 * @typedef {object} NormalizedGherkinOptions
 * @property {boolean} fences Whether the in-page stage (```gherkin fences and
 *   `::gherkin{…}` includes) runs. Default `true` in both forms.
 * @property {string[]} includeRoots Project-root-relative directories an include
 *   may read from. Default: `sources` when given, else `[]` (every include is then
 *   refused, naming this option).
 * @property {string} sourceRoot Site-root-relative (default `'.'`); shared by
 *   generated pages and include source lines.
 * @property {string} [sourceUrlPrefix] Shared like `sourceRoot`.
 * @property {NormalizedGherkinResults} [results] Present exactly when
 *   `gherkin.results` was given (ADR-0052): the Cucumber report whose results
 *   are shown next to the scenarios rendered from `.feature` files.
 * @property {ValidatedGherkinPages} [pages] Present exactly when `sources` was
 *   given: the generated-pages seam (codegen, `behaviour` sidebar section,
 *   index-basename check) hangs off this, so `gherkin: true` adds none of it.
 */

/**
 * The normalised `gherkin.results` option (ADR-0052).
 *
 * @typedef {object} NormalizedGherkinResults
 * @property {string} report The Cucumber report (Messages NDJSON or JSON),
 *   project-root relative, POSIX.
 * @property {string} root The directory Cucumber ran in, project-root relative
 *   (default `'.'`): relative URIs in the report resolve against it.
 */

/**
 * @typedef {typeof GHERKIN_PAGES_KEYS[number]} GherkinPagesKey
 */

/**
 * Normalise `gherkin.results` (ADR-0052 decision 1): a report path, or
 * `{ report, root? }`. Both paths follow the include rule (`isRelativePosixPath`):
 * non-blank, relative to the project root, `/` separators. `root` may be `.`
 * and may climb out (`..`): it names where Cucumber ran, not a file to read.
 * Throws a `[dk-gherkin]` Error naming `optionName` otherwise.
 *
 * Shared by the integration and `scenarioIndexRoute({ results })`, so both read
 * the report the same way.
 *
 * @param {unknown} raw
 * @param {string} [optionName] How errors name the option.
 * @returns {NormalizedGherkinResults}
 */
export function normalizeResultsOption(raw, optionName = 'gherkin.results') {
  const shape =
    `${optionName} must be a report path or { report, root? }, each relative to the project root ` +
    `(non-blank, / separators; no leading '/', drive letter, URL scheme or '\\')`;
  if (typeof raw === 'string') {
    if (!isRelativePosixPath(raw)) throw new Error(`${GHERKIN_LOG_PREFIX} ${shape}; got ${JSON.stringify(raw)}`);
    return { report: raw, root: '.' };
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${GHERKIN_LOG_PREFIX} ${shape}; got ${JSON.stringify(raw)}`);
  }
  const unknown = Object.keys(raw).filter((key) => !(/** @type {readonly string[]} */ (GHERKIN_RESULTS_KEYS)).includes(key));
  if (unknown.length > 0) {
    throw new Error(
      `${GHERKIN_LOG_PREFIX} unknown option ${unknown.map((k) => `${optionName}.${k}`).join(', ')}; ` +
        `expected one of ${GHERKIN_RESULTS_KEYS.join(', ')}`,
    );
  }
  const { report, root = '.' } = /** @type {{ report?: unknown, root?: unknown }} */ (raw);
  if (!isRelativePosixPath(report) || !isRelativePosixPath(root)) {
    throw new Error(`${GHERKIN_LOG_PREFIX} ${shape}; got ${JSON.stringify(raw)}`);
  }
  return { report: /** @type {string} */ (report), root: /** @type {string} */ (root) };
}

/**
 * @typedef {object} ValidateGherkinOptionsConfig
 * @property {readonly string[]} [reservedSections] Section ids to refuse.
 *   Default {@link RESERVED_GHERKIN_SECTIONS}.
 * @property {(key: GherkinPagesKey) => string} [optionName]
 *   How errors name an option: `gherkin.<key>` (default, the astro.config
 *   spelling) or e.g. the CLI flag (`--section`).
 */

/** @param {GherkinPagesKey} key */
const astroOptionName = (key) => `gherkin.${key}`;

/**
 * The two source-link keys are shared by generated pages and include source
 * lines (ADR-0051), so both validators check them through this one helper.
 *
 * @param {unknown} sourceUrlPrefix
 * @param {unknown} sourceRoot
 * @param {(key: GherkinPagesKey) => string} optionName
 * @returns {void}
 */
function checkSourceLink(sourceUrlPrefix, sourceRoot, optionName) {
  if (sourceUrlPrefix !== undefined && typeof sourceUrlPrefix !== 'string') {
    throw new Error(`${GHERKIN_LOG_PREFIX} ${optionName('sourceUrlPrefix')} must be a string`);
  }
  if (typeof sourceRoot !== 'string' || sourceRoot === '') {
    throw new Error(`${GHERKIN_LOG_PREFIX} ${optionName('sourceRoot')} must be a non-empty path string`);
  }
}

/**
 * Validate + default the generated-pages part of the `gherkin` option (ADR-0046).
 * Throws a `[dk-gherkin]` Error for:
 *  - `sources` that is not a non-empty array of non-blank strings;
 *  - a `section` that is not ONE safe path segment (empty, `.`/`..`, a
 *    dot-folder, or containing `/` or `\`), since it becomes
 *    `<docsDir>/<section>` and the generator prunes inside it;
 *  - a `section` in `reservedSections` (`_meta`, or ANOTHER generator's
 *    section): a generated section has a single owner. A collision with an
 *    AUTHORED folder is caught later by the generator itself (it refuses to
 *    write into a directory holding non-generated files);
 *  - a non-string `sourceUrlPrefix`, or a `sourceRoot` that is not a non-empty string;
 *  - an `allowEmpty` that is not a boolean;
 *  - a `titles` that is not a plain object of source-relative directory paths
 *    (no empty, `.` or `..` segment; see {@link isRelativeDirKey}) to non-blank
 *    strings.
 *
 * The integration reaches it through {@link normalizeGherkinOptions} (only when
 * `sources` is given); the CLI calls it directly, so `--sources` stays required.
 *
 * @param {GherkinOptionsInput} raw
 * @param {ValidateGherkinOptionsConfig} [config]
 * @returns {ValidatedGherkinPages}
 */
export function validateGherkinPages(
  raw,
  { reservedSections = RESERVED_GHERKIN_SECTIONS, optionName = astroOptionName } = {},
) {
  const {
    sources,
    section = DEFAULT_GHERKIN_SECTION,
    sourceUrlPrefix,
    sourceRoot = '.',
    allowEmpty,
    titles,
  } = raw ?? {};
  if (
    !Array.isArray(sources) ||
    sources.length === 0 ||
    sources.some((s) => typeof s !== 'string' || s.trim() === '')
  ) {
    throw new Error(
      `${GHERKIN_LOG_PREFIX} ${optionName('sources')} must be a non-empty array of directory paths ` +
        `(relative to the site root); got ${JSON.stringify(sources)}`,
    );
  }
  if (
    typeof section !== 'string' ||
    section.trim() === '' ||
    section.startsWith('.') ||
    /[/\\]/.test(section)
  ) {
    throw new Error(
      `${GHERKIN_LOG_PREFIX} ${optionName('section')} must be a single folder name under the docs dir ` +
        `(no '/', '\\', '..' or leading '.'); got ${JSON.stringify(section)}`,
    );
  }
  if (reservedSections.includes(section)) {
    throw new Error(
      `${GHERKIN_LOG_PREFIX} ${optionName('section')} ${JSON.stringify(section)} is reserved ` +
        `(owned by another generator or the section registry); choose another section id`,
    );
  }
  checkSourceLink(sourceUrlPrefix, sourceRoot, optionName);
  if (allowEmpty !== undefined && typeof allowEmpty !== 'boolean') {
    throw new Error(
      `${GHERKIN_LOG_PREFIX} ${optionName('allowEmpty')} must be true or false; got ${JSON.stringify(allowEmpty)}`,
    );
  }
  const checkedTitles = titles === undefined ? undefined : checkTitles(titles, optionName);
  return {
    sources: /** @type {string[]} */ ([...sources]),
    section,
    ...(sourceUrlPrefix !== undefined ? { sourceUrlPrefix: /** @type {string} */ (sourceUrlPrefix) } : {}),
    sourceRoot: /** @type {string} */ (sourceRoot),
    ...(allowEmpty === true ? { allowEmpty: /** @type {true} */ (true) } : {}),
    ...(checkedTitles ? { titles: checkedTitles } : {}),
  };
}

/**
 * True for a `titles` key: a directory path relative to a source root, written
 * with `/`, every segment a real name (no empty, `.` or `..` segment, so no
 * leading or trailing `/`), and no drive letter, URL scheme or `\`
 * ({@link isRelativePosixPath}). It is compared with the directory as found on
 * disk, so `hr/` or `./hr` would silently match nothing.
 *
 * @param {string} key
 * @returns {boolean}
 */
function isRelativeDirKey(key) {
  return (
    isRelativePosixPath(key) &&
    key.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  );
}

/**
 * Validate `titles` (#125) and return a fresh plain copy.
 *
 * @param {unknown} titles
 * @param {(key: GherkinPagesKey) => string} optionName
 * @returns {Record<string, string>}
 */
function checkTitles(titles, optionName) {
  const name = optionName('titles');
  if (titles === null || typeof titles !== 'object' || Array.isArray(titles)) {
    throw new Error(
      `${GHERKIN_LOG_PREFIX} ${name} must be an object mapping a source-relative directory to a title ` +
        `(e.g. { hr: 'HR' }); got ${JSON.stringify(titles)}`,
    );
  }
  /** @type {Record<string, string>} */
  const copy = {};
  for (const [key, title] of Object.entries(titles)) {
    if (!isRelativeDirKey(key)) {
      throw new Error(
        `${GHERKIN_LOG_PREFIX} ${name} key ${JSON.stringify(key)} must be a directory path relative to a source ` +
          `(/ separators; no '.', '..' or empty segment, leading '/', drive letter, URL scheme or '\\')`,
      );
    }
    if (typeof title !== 'string' || title.trim() === '') {
      throw new Error(
        `${GHERKIN_LOG_PREFIX} ${name}[${JSON.stringify(key)}] must be a non-blank string; got ${JSON.stringify(title)}`,
      );
    }
    // defineProperty, not assignment: `copy['__proto__'] = …` sets the prototype and drops the key.
    Object.defineProperty(copy, key, { value: title, enumerable: true, writable: true, configurable: true });
  }
  return copy;
}

/**
 * Normalise the `gherkin` option of `defineDocKittyIntegrations` (ADR-0051):
 * `true` or an object of {@link GHERKIN_OPTION_KEYS}.
 *
 *  - `true` is fences and includes with every default: `{ fences: true,
 *    includeRoots: [], sourceRoot: '.' }` and no generated pages.
 *  - The object form defaults `fences` to `true` (turning Gherkin on turns
 *    Gherkin on; `fences: false` keeps a slice C site's fences as code blocks)
 *    and `includeRoots` to `sources ?? []`.
 *  - `sources` present ⇒ {@link validateGherkinPages} runs and its result is
 *    `pages`. A `section`, `allowEmpty` or `titles` without `sources` is
 *    refused: each steers pages that would never be generated.
 *
 * Throws a `[dk-gherkin]` Error for any other value (including `false`: omit the
 * option to turn the preset off), an unknown key, a non-boolean `fences`, an
 * `includeRoots` that is not an array of non-blank relative paths, and anything
 * {@link validateGherkinPages} refuses.
 *
 * @param {unknown} raw
 * @param {Pick<ValidateGherkinOptionsConfig, 'reservedSections'>} [config]
 * @returns {NormalizedGherkinOptions}
 */
export function normalizeGherkinOptions(raw, { reservedSections } = {}) {
  if (raw === true) return { fences: true, includeRoots: [], sourceRoot: '.' };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(
      `${GHERKIN_LOG_PREFIX} gherkin must be true or an options object ` +
        `(omit it to turn the preset off); got ${JSON.stringify(raw)}`,
    );
  }
  const unknown = Object.keys(raw).filter((key) => !(/** @type {readonly string[]} */ (GHERKIN_OPTION_KEYS)).includes(key));
  if (unknown.length > 0) {
    throw new Error(
      `${GHERKIN_LOG_PREFIX} unknown option ${unknown.map((k) => `gherkin.${k}`).join(', ')}; ` +
        `expected one of ${GHERKIN_OPTION_KEYS.join(', ')}`,
    );
  }
  const input = /** @type {GherkinOptionsInput} */ (raw);
  const { fences = true, includeRoots, results, sources, section, sourceUrlPrefix, sourceRoot = '.', allowEmpty, titles } = input;
  if (typeof fences !== 'boolean') {
    throw new Error(`${GHERKIN_LOG_PREFIX} gherkin.fences must be a boolean; got ${JSON.stringify(fences)}`);
  }
  let pages;
  if (sources !== undefined) {
    pages = validateGherkinPages(input, reservedSections ? { reservedSections } : {});
  } else if (section !== undefined || allowEmpty !== undefined || titles !== undefined) {
    const key = section !== undefined ? 'section' : allowEmpty !== undefined ? 'allowEmpty' : 'titles';
    throw new Error(
      `${GHERKIN_LOG_PREFIX} gherkin.${key} only applies to generated pages; ` +
        `set gherkin.sources as well, or drop gherkin.${key}`,
    );
  } else {
    checkSourceLink(sourceUrlPrefix, sourceRoot, astroOptionName);
  }
  if (
    includeRoots !== undefined &&
    (!Array.isArray(includeRoots) ||
      // Include roots are project-root-relative POSIX paths by contract (ADR-0051
      // trust boundary): the same rule as an include's `src` (`text.mjs`).
      !includeRoots.every(isRelativePosixPath))
  ) {
    throw new Error(
      `${GHERKIN_LOG_PREFIX} gherkin.includeRoots must be an array of directory paths relative to the ` +
        `project root (non-blank, / separators; no leading '/', drive letter, URL scheme or '\\'); ` +
        `got ${JSON.stringify(includeRoots)}`,
    );
  }
  return {
    fences,
    // A fresh array either way, so a caller mutating the result never reaches the
    // consumer's config (or `pages.sources`).
    includeRoots: /** @type {string[]} */ ([...(includeRoots ?? pages?.sources ?? [])]),
    sourceRoot: /** @type {string} */ (sourceRoot),
    ...(sourceUrlPrefix !== undefined ? { sourceUrlPrefix: /** @type {string} */ (sourceUrlPrefix) } : {}),
    ...(results !== undefined ? { results: normalizeResultsOption(results) } : {}),
    ...(pages ? { pages } : {}),
  };
}

/**
 * Validate the site's index basename(s) as the generator will use them: each
 * becomes a file name INSIDE the generated section (`<first>.md`), so an entry
 * with a path separator or a leading `.` could name a file outside it. Throws a
 * `[dk-config]` Error for such an entry. Blank entries are ignored (the
 * generator drops them too).
 *
 * @param {string | readonly string[] | undefined} indexBasename
 * @param {string} [optionName] How the error names the option.
 * @returns {void}
 */
export function validateIndexBasenames(indexBasename, optionName = 'indexBasename') {
  const list = indexBasename === undefined ? [] : [indexBasename].flat();
  for (const entry of list) {
    if (typeof entry !== 'string' || entry.trim() === '') continue;
    if (!isPlainIndexName(entry)) {
      throw new Error(
        `[dk-config] ${optionName} must be a plain file name (no '/', '\\', leading '.' or surrounding whitespace): ` +
          `a generated page is written as <name>.md inside the section; got ${JSON.stringify(entry)}`,
      );
    }
  }
}
