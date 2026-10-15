/**
 * The one owner of DocKitty's internal `process.env` handoffs.
 *
 * `defineDocKittyIntegrations` (the astro.config surface) and the docs loader,
 * routes and CLIs (other surfaces, sometimes other module graphs) cannot share
 * module state, so they talk through these five variables. Every name is defined
 * here once, every write goes through {@link setInternalEnv} /
 * {@link deleteInternalEnv}, and a config definition starts by calling
 * {@link clearInternalEnv}, so a later config never inherits an earlier one's values.
 *
 * | Name                          | Written at | Writer                                   | Readers                                   |
 * | ----------------------------- | ---------- | ---------------------------------------- | ----------------------------------------- |
 * | DK_INDEX_BASENAME             | define     | defineDocKittyIntegrations               | docs loader, site-index-names CLI         |
 * | DK_GHERKIN_RESULTS            | define     | defineDocKittyIntegrations               | docs loader (schema.ts), scenario route   |
 * | DK_DOCS_ROOT                  | define     | defineDocKittyIntegrations               | standalone routes (routes/shared.ts)      |
 * | DK_GHERKIN_ROUTE              | setup      | doc-kitty:gherkin-fence config:setup     | scenario-index route                      |
 * | DK_PUBLISH_DRAFTS_RESOLVED    | setup      | doc-kitty:draft-publication config:setup | publishDraftsInForce (loader, routes)     |
 *
 * Readers read `process.env` at call time. Vite SSR evaluates the content config
 * and routes in a separate module graph, so module state would arrive empty.
 *
 * DocKitty sets these; adopters must never set them by hand.
 */

/** JSON `string[]` of the site's index names. */
export const DK_INDEX_BASENAME_ENV = 'DK_INDEX_BASENAME';
/** The configured Cucumber report, as given to `gherkin.results.report`. */
export const DK_GHERKIN_RESULTS_ENV = 'DK_GHERKIN_RESULTS';
/** Project-root relative path of the site's own scenario-index route. */
export const DK_GHERKIN_ROUTE_ENV = 'DK_GHERKIN_ROUTE';
/** `on` or `off`: the draft-publication setting this build resolved. */
export const DK_PUBLISH_DRAFTS_RESOLVED_ENV = 'DK_PUBLISH_DRAFTS_RESOLVED';
/** Absolute docs root the integration was configured with. */
export const DK_DOCS_ROOT_ENV = 'DK_DOCS_ROOT';

/** Every internal handoff name. */
export const INTERNAL_ENV_NAMES = Object.freeze([
  DK_INDEX_BASENAME_ENV,
  DK_GHERKIN_RESULTS_ENV,
  DK_GHERKIN_ROUTE_ENV,
  DK_PUBLISH_DRAFTS_RESOLVED_ENV,
  DK_DOCS_ROOT_ENV,
]);

/**
 * @param {string} name
 * @returns {void}
 */
function assertInternal(name) {
  if (!INTERNAL_ENV_NAMES.includes(name)) {
    throw new Error(`[dk-config] ${name} is not a DocKitty internal env name (expected one of ${INTERNAL_ENV_NAMES.join(', ')})`);
  }
}

/**
 * Remove every internal handoff.
 * @param {Record<string, string | undefined>} [env]
 * @returns {void}
 */
export function clearInternalEnv(env = process.env) {
  for (const name of INTERNAL_ENV_NAMES) delete env[name];
}

/**
 * Write one internal handoff.
 * @param {string} name One of {@link INTERNAL_ENV_NAMES}.
 * @param {string} value
 * @param {Record<string, string | undefined>} [env]
 * @returns {void}
 */
export function setInternalEnv(name, value, env = process.env) {
  assertInternal(name);
  env[name] = value;
}

/**
 * Remove one internal handoff.
 * @param {string} name One of {@link INTERNAL_ENV_NAMES}.
 * @param {Record<string, string | undefined>} [env]
 * @returns {void}
 */
export function deleteInternalEnv(name, env = process.env) {
  assertInternal(name);
  delete env[name];
}
