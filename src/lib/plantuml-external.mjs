// @ts-check
/**
 * PlantUML external-include opt-in setting (#268, ADR-0074).
 *
 * This module owns the setting's rules: names, accepted shapes, validation and
 * precedence. Do not duplicate them. The build integration (`config.ts`) and the
 * include check (`assert-plantuml-no-remote-include.mjs`) both import it, so they
 * resolve the identical value and source.
 *
 * It has no imports at all: the include check runs before `pnpm install`, so it
 * must load with nothing but the Node runtime (`URL` is global).
 */

/** The setting's name in the process environment. */
export const PLANTUML_ALLOW_EXTERNAL_ENV = 'DK_PLANTUML_ALLOW_EXTERNAL';

/**
 * @typedef {'environment' | 'site configuration'} SettingSource
 * @typedef {{
 *   mode: 'sandbox' | 'allowlist' | 'internet',
 *   entries: string[],
 *   source: 'default' | SettingSource,
 * }} Resolution
 */

const LABELS = {
  environment: `${PLANTUML_ALLOW_EXTERNAL_ENV} (environment)`,
  'site configuration': 'plantumlAllowExternal (site configuration)',
};

/** Thrown for any invalid value of the setting. */
export class PlantumlAllowExternalError extends Error {
  /**
   * @param {SettingSource} source
   * @param {string} reason
   */
  constructor(source, reason) {
    super(
      `invalid ${LABELS[source]}: ${reason}. accepted: leave unset for sandbox, "internet", ` +
        'or a list of http(s) URL prefixes ending in "/" (environment: joined by ";").',
    );
    this.name = 'PlantumlAllowExternalError';
    this.source = source;
    this.reason = reason;
  }
}

/**
 * @param {SettingSource} source
 * @param {string} reason
 * @returns {never}
 */
function fail(source, reason) {
  throw new PlantumlAllowExternalError(source, reason);
}

const EMPTY_ALLOWLIST = 'an empty allowlist is not sandbox';
const LOWERCASE_HINT = 'use lowercase "internet"';

/**
 * @param {unknown} entry
 * @param {SettingSource} source
 * @returns {string}
 */
function validateEntry(entry, source) {
  const shown = typeof entry === 'string' ? entry : JSON.stringify(entry);
  const notUrl = () => fail(source, `"${shown}" is not an http(s) URL`);
  if (typeof entry !== 'string' || /\s/.test(entry)) return notUrl();
  if (entry.includes(';')) fail(source, `"${entry}" contains ";"`);
  if (entry.includes('@')) {
    fail(source, `"${entry}" contains "@"; PlantUML never matches an allowlist entry containing "@"`);
  }
  if (entry.includes('?') || entry.includes('#')) return notUrl();
  if (/:(?:80|443)\//.test(entry)) {
    fail(
      source,
      `"${entry}": drop the default port: PlantUML strips ':80/' and ':443/' including the slash, which turns the entry into a bare-host prefix`,
    );
  }
  /** @type {URL} */
  let url;
  try {
    url = new URL(entry);
  } catch {
    return notUrl();
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return notUrl();
  }
  const authority = /^https?:\/\/[^/]+/i.exec(entry);
  if (!authority) return notUrl();
  const rest = entry.slice(authority[0].length);
  if (!rest.startsWith('/') || !entry.endsWith('/')) {
    fail(
      source,
      `"${entry}" must end with "/". PlantUML matches raw prefixes, so "http://host" also allows "http://host.evil.com"`,
    );
  }
  return entry;
}

/**
 * @param {string} text
 * @param {SettingSource} source
 * @returns {'internet' | undefined}
 */
function keyword(text, source) {
  if (text === 'internet') return 'internet';
  if (text.toLowerCase() === 'internet') fail(source, LOWERCASE_HINT);
  return undefined;
}

/**
 * Parse the raw environment value.
 * @param {string | undefined} text
 * @returns {'internet' | string[] | undefined} `undefined` when unset or blank.
 */
export function parseAllowExternalEnv(text) {
  if (text === undefined || text.trim() === '') return undefined;
  const trimmed = text.trim();
  if (keyword(trimmed, 'environment')) return 'internet';
  if (!trimmed.includes('://') && !trimmed.includes(';')) fail('environment', `unknown value "${trimmed}"`);
  const items = trimmed
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length === 0) fail('environment', EMPTY_ALLOWLIST);
  return items.map((e) => validateEntry(e, 'environment'));
}

/**
 * Validate the site configuration value.
 * @param {unknown} siteValue
 * @returns {'internet' | string[] | undefined}
 */
export function validateAllowExternal(siteValue) {
  if (siteValue === undefined) return undefined;
  if (typeof siteValue === 'string' && keyword(siteValue, 'site configuration')) return 'internet';
  if (Array.isArray(siteValue)) {
    if (siteValue.length === 0) fail('site configuration', EMPTY_ALLOWLIST);
    return siteValue.map((e) => validateEntry(e, 'site configuration'));
  }
  return fail('site configuration', `unknown value ${JSON.stringify(siteValue)}`);
}

/**
 * Resolve the setting: environment wins over site configuration, which wins over
 * the sandbox default. The site value is validated even when the environment
 * overrides it, so a broken configuration cannot hide behind an env var.
 * @param {{ env?: string, siteValue?: unknown }} input `env` is the raw value of
 *   `DK_PLANTUML_ALLOW_EXTERNAL`, not `process.env`.
 * @returns {Readonly<Resolution>}
 */
export function resolvePlantumlAllowExternal({ env, siteValue } = {}) {
  const fromEnv = parseAllowExternalEnv(env);
  const fromSite = validateAllowExternal(siteValue);
  /** @type {(v: 'internet' | string[], s: SettingSource) => Resolution} */
  const make = (v, s) =>
    v === 'internet'
      ? { mode: 'internet', entries: [], source: s }
      : { mode: 'allowlist', entries: [...v], source: s };
  if (fromEnv !== undefined) return Object.freeze(make(fromEnv, 'environment'));
  if (fromSite !== undefined) return Object.freeze(make(fromSite, 'site configuration'));
  return Object.freeze({ mode: 'sandbox', entries: [], source: 'default' });
}

/** The fixed port the include check's canary listens on, which a service's allowlist must name. */
export const PLANTUML_CANARY_PORT = 18091;

/**
 * One-line description, reused by the build notice and the check's `declared:` line.
 * @param {Readonly<Resolution>} resolution
 * @param {{ notice?: boolean }} [options] `notice`: phrase it for the build notice,
 *   `declared PlantUML <mode> mode (from …)`, instead of `<mode> (from …)`.
 * @returns {string}
 */
export function describeDeclared(resolution, { notice = false } = {}) {
  if (resolution.mode === 'sandbox') return 'sandbox (default)';
  const lead = notice ? `declared PlantUML ${resolution.mode} mode` : resolution.mode;
  const where =
    resolution.source === 'environment'
      ? `environment ${PLANTUML_ALLOW_EXTERNAL_ENV}`
      : resolution.source;
  if (resolution.mode === 'internet') return `${lead} (from ${where})`;
  return `${lead} (from ${where}): ${resolution.entries.join(', ')}`;
}
