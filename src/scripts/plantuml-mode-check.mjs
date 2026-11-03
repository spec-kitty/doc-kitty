/**
 * The declared-mode half of the PlantUML include check (#268): the decision logic for
 * `allowlist` and `internet` opt-ins, the unset-mode profile rule, and every stable
 * message the check prints. No CLI parsing and no `docker` here: the caller
 * (`assert-plantuml-no-remote-include.mjs`) injects `probe(url)` (e.g. `docker exec …
 * curl`), `readEnv(container)` (e.g. `docker inspect`, parsed with
 * {@link parseContainerEnv}), `readArgs(container)` (the container's entrypoint,
 * command and args, parsed with {@link parseContainerArgs}) and `readPorts(container)` (its
 * published ports, parsed with {@link parseContainerPorts}, to tie `--server` to the container).
 *
 * What each mode proves:
 *   - allowlist: with the service container named, the canary's allowed path
 *     (`/dk-canary/allowed/`) and denied path (`/dk-canary/denied/`) are both reachable
 *     from the service; the allowed path is fetched and the denied path refused for every
 *     fixture; the allowed path's redirect to the denied path is not followed (judged from
 *     the canary's request log, never the HTTP status); the canary sees no request outside
 *     its two paths; the service's `PLANTUML_SECURITY_PROFILE` is exactly `ALLOWLIST`; and
 *     its `PLANTUML_ALLOWLIST_URL`, compared as raw strings, has no empty item (other than
 *     one trailing `;`) and as a set equals the declared entries plus the canary entry.
 *   - internet: with the service container named, `PLANTUML_SECURITY_PROFILE` is exactly
 *     `INTERNET`, and the canary sees no request outside its two paths. The canary renders
 *     are printed but informational: a real INTERNET service refuses the private, dotless
 *     canary (spike F1).
 *   - unset, container named ({@link checkUnsetProfile}): the profile is exactly `SANDBOX`.
 *
 * In declared modes the observed class on the verdict line is the profile read from the
 * container; the canary supplies the behavioural half for allowlist mode.
 *
 * What it cannot prove (spec "Limits"): exact entries or the profile without the service
 * container (so both declared modes fail without it); that an internet-mode service really
 * reaches the internet; whether the operator's declared hosts are up (it never requests a
 * declared entry, NFR-001); configuration through Java system properties, in the env, in a
 * PlantUML property file (`PLANTUML_PROPERTY_FILE`) or on the container command line (it
 * fails closed on those instead of reading them); a service it cannot `docker inspect` (Kubernetes, a
 * plain jar, a remote service) cannot pass either declared mode.
 *
 * Node built-ins only; imports only from `./plantuml-include-guard.mjs` (C-006).
 */
import {
  CANARY_ALLOWED_PREFIX,
  CANARY_DENIED_PREFIX,
  encodePlantuml,
  loadFixtures,
  startCanary,
} from './plantuml-include-guard.mjs';

/**
 * @typedef {{ mode: 'sandbox' | 'allowlist' | 'internet', entries: string[], source: 'default' | 'environment' | 'site configuration' }} Resolution
 */

/**
 * The include check's verdict (data-model.md §5).
 *
 * @typedef {{
 *   ok: boolean,
 *   exitCode: 0 | 1 | 2,
 *   declared: Resolution,
 *   observed: 'sandbox' | 'allowlist' | 'internet' | null,
 *   reachability: { allowed: boolean | null, denied: boolean | null },
 *   entries?: { extra: string[], missing: string[] },
 *   warnings: string[],
 *   reasons: string[],
 *   messages: string[],
 * }} Verdict
 */

/** The prefix every line of the include check carries. */
export const CHECK_PREFIX = 'assert-plantuml-no-remote-include';

/** Where a followed redirect lands (`<allowed>redirect/<f>` → `<denied>redirected/<f>`). */
export const CANARY_REDIRECTED_PREFIX = `${CANARY_DENIED_PREFIX}redirected/`;

/**
 * The usual Java option variables. They are watched for duplicate keys; the system-property
 * scan itself runs over every env value, so `_JAVA_OPTIONS`, `JETTY_OPTS` and the like count too.
 */
export const SYSTEM_PROPERTY_VARS = Object.freeze([
  'JAVA_OPTS',
  'JAVA_OPTIONS',
  'JAVA_TOOL_OPTIONS',
  'JDK_JAVA_OPTIONS',
  'CATALINA_OPTS',
]);

// PlantUML's SecurityUtils.getenv(name) prefers System.getProperty(name). On the pinned
// server image `-Dplantuml.allowlist.url=…` reaching the JVM overrides PLANTUML_ALLOWLIST_URL,
// while the servlet re-sets the PLANTUML_SECURITY_PROFILE property from the env at start-up
// (verified 2026-11-03, see plantuml-include-check-halves.test.ts). Only names that change what
// the service may fetch or load fail closed, in any case, with `.` or `_`: the security
// profile, the allowlist, a property file (it can override both) and the include path.
// Harmless tuning (`-DPLANTUML_LIMIT_SIZE=8192`) passes. The name alone is enough, so the
// `-D` prefix, quoting and `sh -c` wrapping do not matter.
const SYSTEM_PROPERTY_RE = /plantuml[._](?:security[._]profile|allowlist[._]url|property[._]file|include[._]path)/i;

// A word starting with `@` is a JVM argfile (`java @args.txt`): its content can hold any
// `-D` property and the check cannot read it, so it fails closed wherever Java options can sit.
const ARGFILE_RE = /(?:^|\s)["']?@\S/;

// A bare `plantuml.*=…` argument (a Jetty start property, not a `-D`) could still reach PlantUML
// through the server's configuration; the check cannot read it, so it fails closed too.
const COMMAND_LINE_PROPERTY_RE = /^["']?plantuml\./i;

// An env variable literally named `plantuml.allowlist.url` (etc.) is read before
// PLANTUML_ALLOWLIST_URL by SecurityUtils.getenv; the check cannot compare it, so it fails closed.
const DOTTED_ENV_KEY_RE = /^plantuml\./i;

/** The service configuration could not be read (docker missing, erroring, or unparsable output). */
export class ServiceConfigError extends Error {
  /** @param {string} reason */
  constructor(reason) {
    super(`could not read the service configuration (${reason})`);
    this.name = 'ServiceConfigError';
    this.reason = reason;
  }
}

/** The canary entry the service's allowlist must hold: `http://<host>:<port>/dk-canary/allowed/`. */
export function canaryEntry(host, port) {
  return `http://${host}:${port}${CANARY_ALLOWED_PREFIX}`;
}

const PROFILE_CLASS = Object.freeze({ SANDBOX: 'sandbox', ALLOWLIST: 'allowlist', INTERNET: 'internet' });

/**
 * The observed class in declared modes: the service's `PLANTUML_SECURITY_PROFILE`, exact
 * and case-sensitive. Any other value, or none, is no class (`null`).
 *
 * @param {Record<string, string> | undefined} env
 * @returns {'sandbox' | 'allowlist' | 'internet' | null}
 */
export function profileClass(env) {
  const value = env?.PLANTUML_SECURITY_PROFILE;
  return typeof value === 'string' && Object.hasOwn(PROFILE_CLASS, value) ? PROFILE_CLASS[value] : null;
}

/**
 * The behavioural class from the canary, per fixture `{ allowed, denied }` (at least one
 * `include/` hit under that prefix). All fixtures must agree; a denied fetch without an
 * allowed fetch, disagreeing fixtures, or no fixtures at all is no class (`null`).
 *
 * @param {{ allowed: boolean, denied: boolean }[]} perFixture
 * @returns {'sandbox' | 'allowlist' | 'internet' | null}
 */
export function classifyObserved(perFixture) {
  if (!Array.isArray(perFixture) || perFixture.length === 0) return null;
  const one = ({ allowed, denied }) => {
    if (!allowed && !denied) return 'sandbox';
    if (allowed && !denied) return 'allowlist';
    if (allowed && denied) return 'internet';
    return null;
  };
  const classes = perFixture.map(one);
  const first = classes[0];
  return first !== null && classes.every((c) => c === first) ? first : null;
}

/**
 * Compare the service's `PLANTUML_ALLOWLIST_URL` with the declared entries plus the canary
 * entry: split on `;`, no trimming, no normalization, set semantics. One trailing empty
 * item (a single trailing `;`) is ignored; any other empty item sets `emptyItems` (it
 * allows every URL on the pinned image, spike F2) and never appears in `extra`/`missing`.
 * An absent value has no items; a value set to `""` counts as an empty item.
 *
 * @param {string | undefined} configuredText
 * @param {string[]} declared
 * @param {string} canary
 * @returns {{ extra: string[], missing: string[], emptyItems: boolean, expected: string }}
 */
export function compareAllowlist(configuredText, declared, canary) {
  const expectedList = [...declared, canary];
  let items = [];
  if (typeof configuredText === 'string') {
    items = configuredText.split(';');
    if (items.length > 1 && items[items.length - 1] === '') items.pop();
  }
  const emptyItems = items.includes('');
  const configured = new Set(items.filter((item) => item !== ''));
  const expectedSet = new Set(expectedList);
  return {
    extra: [...configured].filter((item) => !expectedSet.has(item)),
    missing: [...expectedSet].filter((item) => !configured.has(item)),
    emptyItems,
    expected: expectedList.join(';'),
  };
}

const WATCHED_KEY = (key) =>
  key.startsWith('PLANTUML_') || DOTTED_ENV_KEY_RE.test(key) || SYSTEM_PROPERTY_VARS.includes(key);

/**
 * Parse `docker inspect -f '{{json .Config.Env}}'` output (a JSON array of `KEY=VALUE`)
 * into a map. Keys are looked up by name later; order is irrelevant. A watched key
 * (`PLANTUML_*`, the Java option variables) given twice with different values is
 * ambiguous and fails closed.
 *
 * @param {string} text
 * @returns {Record<string, string>}
 * @throws {ServiceConfigError}
 */
export function parseContainerEnv(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new ServiceConfigError(`not JSON: ${err?.message ?? err}`);
  }
  if (!Array.isArray(parsed)) throw new ServiceConfigError('not a JSON array of KEY=VALUE strings');
  /** @type {Record<string, string>} */
  const env = Object.create(null);
  for (const item of parsed) {
    if (typeof item !== 'string') throw new ServiceConfigError('not a JSON array of KEY=VALUE strings');
    const eq = item.indexOf('=');
    if (eq <= 0) continue;
    const key = item.slice(0, eq);
    const value = item.slice(eq + 1);
    if (Object.hasOwn(env, key) && env[key] !== value && WATCHED_KEY(key)) {
      throw new ServiceConfigError(`${key} is set twice with different values`);
    }
    env[key] = value;
  }
  return env;
}

/**
 * True when PlantUML could be configured behind the two variables the check reads: any env
 * value (not only the usual Java option variables: `_JAVA_OPTIONS`, `JETTY_OPTS` and others
 * reach the JVM too) names a security-relevant PlantUML setting (any case, `.` or `_`:
 * profile, allowlist url, property file, include path; e.g. `-DPLANTUML_SECURITY_PROFILE`,
 * `-Dplantuml.allowlist.url`), carries a `@argfile` word (unreadable, so unprovable), or an env variable is named `plantuml.*` (any case).
 * Such services fail closed.
 *
 * @param {Record<string, string> | undefined} env
 */
export function systemPropertyConfig(env) {
  if (!env) return false;
  return (
    Object.values(env).some(
      (value) => typeof value === 'string' && (SYSTEM_PROPERTY_RE.test(value) || ARGFILE_RE.test(value)),
    ) ||
    Object.keys(env).some((key) => DOTTED_ENV_KEY_RE.test(key))
  );
}

/**
 * True when the service env names a PlantUML property file (`PLANTUML_PROPERTY_FILE`,
 * non-empty). The pinned server loads that file into the Java system properties after it
 * sets the profile from the env, so the file can override both the profile and the
 * allowlist (verified 2026-11-03). The check cannot read the file, so it fails closed.
 *
 * @param {Record<string, string> | undefined} env
 */
export function propertyFileConfig(env) {
  const value = env?.PLANTUML_PROPERTY_FILE;
  return typeof value === 'string' && value !== '';
}

/** Canonical form of an IP or host: lowercase, no trailing dot, IPv6 unbracketed and compressed (`::ffff:127.0.0.1` → `::ffff:7f00:1`). */
const canonicalHost = (host) => {
  const bare = host.replace(/\.$/, '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!bare.includes(':')) return bare;
  try {
    return new URL(`http://[${bare}]`).hostname.slice(1, -1);
  } catch {
    return bare;
  }
};
const isLoopbackIp = (host) =>
  host === '::1' || host === '::ffff:7f00:1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
const WILDCARD_IPS = new Set(['', '0.0.0.0', '::']);
/** True when a `--server` host names this machine (localhost, 0.0.0.0, 127.0.0.0/8, ::1, ::ffff:127.0.0.1; a trailing dot is ignored). */
const isLocalHost = (host) => host === 'localhost' || host === '0.0.0.0' || host === '::' || isLoopbackIp(host);
/**
 * A published binding serves `--server` when it listens on every address, or on exactly the
 * literal `--server` address. `localhost` accepts any loopback binding. A binding on another
 * loopback address (127.0.0.1 for a `--server` of 127.0.0.5) is a decoy.
 */
const bindingServes = (hostIp, serverHost) =>
  WILDCARD_IPS.has(hostIp) ||
  (serverHost === 'localhost' ? isLoopbackIp(canonicalHost(hostIp)) : canonicalHost(hostIp) === serverHost);

/**
 * Parse `docker inspect -f '{{json .NetworkSettings.Ports}}'` output (an object mapping
 * `<port>/<proto>` to `null` or an array of `{ HostIp, HostPort }`; `null` or `{}` when
 * nothing is published) into a flat list of published bindings. Anything else fails closed.
 *
 * @param {string} text
 * @returns {{ containerPort: string, hostIp: string, hostPort: number }[]}
 * @throws {ServiceConfigError}
 */
export function parseContainerPorts(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new ServiceConfigError(`not JSON: ${err?.message ?? err}`);
  }
  if (parsed === null) return [];
  const shape = 'not a JSON map of published ports';
  if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new ServiceConfigError(shape);
  const bindings = [];
  for (const [containerPort, list] of Object.entries(parsed)) {
    if (list === null) continue;
    if (!Array.isArray(list)) throw new ServiceConfigError(shape);
    for (const b of list) {
      if (typeof b?.HostIp !== 'string' || typeof b?.HostPort !== 'string' || !/^\d+$/.test(b.HostPort)) {
        throw new ServiceConfigError(shape);
      }
      bindings.push({ containerPort, hostIp: b.HostIp, hostPort: Number(b.HostPort) });
    }
  }
  return bindings;
}

/**
 * Parse `docker inspect -f '{{json .HostConfig.NetworkMode}}'` output (one JSON string).
 * Anything else fails closed.
 *
 * @param {string} text
 * @returns {string}
 * @throws {ServiceConfigError}
 */
export function parseNetworkMode(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new ServiceConfigError(`not JSON: ${err?.message ?? err}`);
  }
  if (typeof parsed !== 'string') throw new ServiceConfigError('not a JSON string network mode');
  return parsed;
}

/**
 * Tie `--server` to `--service-container`. With a local `--server` host the container must
 * publish that host port on a wildcard address or on the literal `--server` address; otherwise the check would read one
 * container and test another service (a decoy). A non-local host (a docker-network name, a
 * remote server) cannot be tied this way: it passes with a note. So does a container on
 * host networking, which publishes no ports at all.
 *
 * @param {string} serverUrl
 * @param {{ hostIp: string, hostPort: number }[]} ports
 * @param {string} [networkMode] the container's `HostConfig.NetworkMode`
 * @returns {{ ok: true, note?: string } | { ok: false, message: string }}
 */
export function checkServiceIdentity(serverUrl, ports, networkMode) {
  const url = new URL(serverUrl);
  const host = canonicalHost(url.hostname);
  if (networkMode === 'host') return { ok: true, note: MESSAGES.identityNotVerifiedHostNetwork() };
  if (!isLocalHost(host)) return { ok: true, note: MESSAGES.identityNotVerified(url.hostname) };
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  if (ports.some((b) => b.hostPort === port && bindingServes(b.hostIp, host))) return { ok: true };
  return { ok: false, message: MESSAGES.identityMismatch(port, ports) };
}

/**
 * Parse `docker inspect -f '[{{json .Config.Entrypoint}},{{json .Config.Cmd}},{{json .Args}}]'`
 * output (a JSON array of exactly three items, each `null` or an array of strings) into one
 * flat list of the container's command-line words. Anything else fails closed.
 *
 * @param {string} text
 * @returns {string[]}
 * @throws {ServiceConfigError}
 */
export function parseContainerArgs(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new ServiceConfigError(`not JSON: ${err?.message ?? err}`);
  }
  const shape = 'not a JSON array of [entrypoint, cmd, args]';
  if (!Array.isArray(parsed) || parsed.length !== 3) throw new ServiceConfigError(shape);
  const words = [];
  for (const part of parsed) {
    if (part === null) continue;
    if (!Array.isArray(part) || part.some((word) => typeof word !== 'string')) throw new ServiceConfigError(shape);
    words.push(...part);
  }
  return words;
}

/**
 * True when the container's entrypoint, command or args name a security-relevant PlantUML
 * setting (see {@link systemPropertyConfig}; any case, also inside a `sh -c` string), or a bare
 * `plantuml.*` argument. Such services fail closed in every mode: the check cannot tell
 * whether the words reach the JVM (on the pinned image they do not, but an image or
 * entrypoint that passes them through would let `-Dplantuml.allowlist.url` override the env).
 *
 * @param {string[] | undefined} args
 */
export function commandLineProperties(args) {
  if (!Array.isArray(args)) return false;
  return args.some((word) => SYSTEM_PROPERTY_RE.test(word) || ARGFILE_RE.test(word) || COMMAND_LINE_PROPERTY_RE.test(word));
}

const observedText = (observed) => `(observed: ${observed ?? 'no class'})`;
const quote = (value) => JSON.stringify(String(value));

/** Every stable message of the declared-mode and unset-profile checks (contracts/include-check-cli.md). */
export const MESSAGES = Object.freeze({
  // Container required (FR-004 US1 AS3, FR-006 i).
  needsContainer: (mode) =>
    mode === 'internet'
      ? `declared internet needs --service-container to read the service's security profile ${observedText(null)}`
      : `declared allowlist needs --service-container to prove the denied path was reachable and the entries match ${observedText(null)}`,
  // FR-004 (a).
  allowedRefused: (observed) =>
    `declared allowlist, but the allowed path was refused: no include request reached ${CANARY_ALLOWED_PREFIX}include/ ${observedText(observed)}`,
  deniedFetched: (observed) =>
    `declared allowlist, but the denied path was fetched: the service requested ${CANARY_DENIED_PREFIX}include/ ${observedText(observed)}`,
  // Edge case 7; FR-004 (b) for the denied path.
  notReachable: (mode, which, observed) =>
    `declared ${mode}, but the canary's ${which} path is not reachable from the service, so its ${which === 'allowed' ? 'fetch' : 'refusal'} proves nothing ${observedText(observed)}`,
  // Edge case 8.
  redirectFollowed: (observed, paths) =>
    `declared allowlist, but the allowed path's redirect to the denied path was followed (${paths.join(', ')}) ${observedText(observed)}`,
  // NFR-001.
  strayRequest: (mode, observed, path) =>
    `declared ${mode}, but the canary received a request outside its two paths: ${path} ${observedText(observed)}`,
  inconsistentFetches: (perFixture) =>
    `declared allowlist, but inconsistent fetches: ${perFixture
      .map((r) => `${r.fixture} allowed ${r.allowed ? 'fetched' : 'refused'}, denied ${r.denied ? 'fetched' : 'refused'}`)
      .join('; ')} ${observedText(null)}`,
  // FR-004 (c).
  emptyEntry: (observed) =>
    `declared allowlist, but the service's PLANTUML_ALLOWLIST_URL has an empty entry, which allows every URL ${observedText(observed)}`,
  entriesDiffer: (observed, { extra, missing, expected }) =>
    [
      `declared allowlist, but the service's allowlist differs ${observedText(observed)}`,
      extra.length > 0 ? `extra: ${extra.join(', ')}` : null,
      missing.length > 0 ? `missing: ${missing.join(', ')}` : null,
      `expected PLANTUML_ALLOWLIST_URL=${expected}`,
    ]
      .filter((part) => part !== null)
      .join('; '),
  profileMismatch: (mode, value, observed) =>
    `declared ${mode}, but the service's PLANTUML_SECURITY_PROFILE is ${
      value === undefined ? 'not set (the image default is INTERNET)' : quote(value)
    } ${observedText(observed)}`,
  // Unset mode with a container (decision 01M6F4XFDPJ6XFBYM5HM65G1AM).
  unsetProfile: (value) =>
    `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is ${
      value === undefined ? 'not set (the image default is INTERNET)' : quote(value)
    }`,
  systemProperties: () =>
    'configured through Java system properties; the check reads only PLANTUML_SECURITY_PROFILE and PLANTUML_ALLOWLIST_URL',
  // Container identity (pre-PR fold): --server must be served by --service-container.
  identityMismatch: (port, ports) =>
    `the service container does not publish the --server port ${port} (published: ${
      ports.length === 0 ? 'none' : ports.map((b) => `${b.hostIp || '*'}:${b.hostPort}->${b.containerPort}`).join(', ')
    }), so the check would read one container and test another service`,
  identityNotVerified: (host) =>
    `note — the --server host ${host} is not local, so the check cannot tie it to --service-container: service identity was not verified`,
  identityNotVerifiedHostNetwork: () =>
    'note — the service container uses host networking and publishes no ports, so the check cannot tie --server to --service-container: service identity was not verified',
  propertyFile: () =>
    'configured through a PlantUML property file (PLANTUML_PROPERTY_FILE); the check reads only PLANTUML_SECURITY_PROFILE and PLANTUML_ALLOWLIST_URL',
  commandLineProperties: () =>
    'configured through Java system properties on the container command line (entrypoint, command or args); the check reads only PLANTUML_SECURITY_PROFILE and PLANTUML_ALLOWLIST_URL',
  configUnreadable: (reason) => new ServiceConfigError(reason).message,
  portBusy: (port) => `cannot listen on canary port ${port}: in use`,
  controlNoAnswer: (serverUrl, reason) => `control: the PlantUML server at ${serverUrl} did not answer (${reason})`,
  controlNotRendered: (status) =>
    `control: a plain diagram did not render (HTTP ${status}): the check would prove nothing`,
  noFixtures: () => 'no fixtures found: the check would prove nothing',
  noPlaceholder: (fixture) => `${fixture}: has no {{CANARY_URL}} placeholder`,
  renderFailed: (fixture, path, reason) => `${fixture} → ${path}: the render did not answer (${reason})`,
  // Wraps a mode-neutral message so it still names the declared mode and observed class.
  inMode: (mode, observed, text) => `declared ${mode}: ${text} ${observedText(observed)}`,
  // Pass and warning texts.
  allowlistOk: (entries) =>
    `OK — declared allowlist matches the service: ${entries.join(', ')} (plus the canary entry); allowed path fetched, denied path refused, profile ALLOWLIST`,
  internetOk: () => 'OK — declared internet matches the service',
  internetWarning: () =>
    'warning — declared internet: the service may fetch any URL, including internal networks and cloud metadata endpoints',
  // Line formats.
  failLine: (message) => `${CHECK_PREFIX}: FAIL — ${message}`,
  pathLine: (fixture, path, status, requests) => `${fixture} → ${path}: HTTP ${status}, canary requests ${requests}`,
  probeLine: (which, reachable) =>
    `probe → ${which}: ${reachable ? 'reachable' : 'not reachable'} from the service`,
});

/**
 * True when `err` is the canary's "port in use" refusal for `port`: `startCanary` throws
 * it with `code: 'EADDRINUSE'` and the `port` it tried, so this never matches on text.
 *
 * @param {unknown} err
 * @param {number} port
 */
export function isPortBusy(err, port) {
  const e = /** @type {{ code?: unknown, port?: unknown } | null | undefined} */ (err);
  return e?.code === 'EADDRINUSE' && e?.port === port;
}

/**
 * The one verdict line CI greps.
 *
 * @param {{ declared: Resolution | string, observed: string | null }} verdict
 */
export function formatVerdictLine({ declared, observed }) {
  const mode = typeof declared === 'string' ? declared : declared.mode;
  return `${CHECK_PREFIX}: verdict: declared ${mode}, observed ${observed ?? 'no class'}`;
}

/**
 * The unset-mode rule with a named container: system-property configuration first, in the
 * env, through a PlantUML property file, or on the command line (all fail closed even with
 * `SANDBOX`), then the profile must be exactly `SANDBOX`.
 *
 * @param {Record<string, string>} env
 * @param {string[]} args the container's command-line words ({@link parseContainerArgs})
 * @returns {{ ok: true } | { ok: false, reason: string, message: string }}
 */
export function checkUnsetProfile(env, args) {
  if (systemPropertyConfig(env)) {
    return { ok: false, reason: 'system-properties', message: MESSAGES.systemProperties() };
  }
  if (propertyFileConfig(env)) {
    return { ok: false, reason: 'property-file', message: MESSAGES.propertyFile() };
  }
  if (commandLineProperties(args)) {
    return { ok: false, reason: 'command-line-properties', message: MESSAGES.commandLineProperties() };
  }
  const value = env?.PLANTUML_SECURITY_PROFILE;
  if (value === 'SANDBOX') return { ok: true };
  return { ok: false, reason: 'profile-mismatch', message: MESSAGES.unsetProfile(value) };
}

/**
 * Verify a declared `allowlist` or `internet` opt-in against a live PlantUML service and
 * the canary. Never spawns anything itself and never requests a declared entry (NFR-001).
 *
 * @param {object} opts
 * @param {Resolution} opts.declared the resolution; `mode` must be `allowlist` or `internet`
 * @param {string} opts.serverUrl the PlantUML SVG endpoint, with its trailing `/svg/`
 * @param {string} [opts.canaryHost] the canary's host as the service sees it
 * @param {number} [opts.canaryPort] the canary's fixed port (1–65535)
 * @param {string} [opts.container] the service container; both modes fail without it
 * @param {(url: string) => Promise<unknown>} [opts.probe] fetches `url` from the service's side
 * @param {(container: string) => Promise<Record<string, string>> | Record<string, string>} [opts.readEnv]
 *   the container's env map; throws {@link ServiceConfigError} when it cannot be read
 * @param {(container: string) => Promise<{ containerPort: string, hostIp: string, hostPort: number }[]>} [opts.readPorts]
 *   the container's published ports; throws {@link ServiceConfigError} when they cannot be read
 * @param {(container: string) => Promise<string>} [opts.readNetworkMode]
 *   the container's network mode; optional (absent means not host networking)
 * @param {(container: string) => Promise<string[]> | string[]} [opts.readArgs]
 *   the container's entrypoint, command and args as one list; throws {@link ServiceConfigError}
 *   when they cannot be read
 * @param {{ name: string, source: string }[]} [opts.fixtures]
 * @param {{ name: string, source: string }[]} [opts.extraFixtures]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{ verdict: Verdict, lines: string[] }>}
 */
export async function checkDeclaredMode({
  declared,
  serverUrl,
  canaryHost = '127.0.0.1',
  canaryPort = 18091,
  container,
  probe,
  readEnv,
  readArgs,
  readPorts,
  readNetworkMode,
  fixtures = loadFixtures(),
  extraFixtures = [],
  fetchImpl = fetch,
  timeoutMs = 20_000,
}) {
  const mode = declared?.mode;
  if (mode !== 'allowlist' && mode !== 'internet') {
    throw new TypeError(`checkDeclaredMode: declared mode must be allowlist or internet, got ${mode}`);
  }
  if (!Number.isInteger(canaryPort) || canaryPort < 1 || canaryPort > 65535) {
    throw new TypeError(`checkDeclaredMode: canaryPort must be a fixed port (1-65535), got ${canaryPort}`);
  }
  const isAllowlist = mode === 'allowlist';
  const lines = [];
  /** @type {{ reason: string, text: (observed: string | null) => string }[]} */
  const failures = [];
  const fail = (reason, text) => failures.push({ reason, text });
  /** @type {Verdict} */
  const verdict = {
    ok: false,
    exitCode: 1,
    declared,
    observed: null,
    reachability: { allowed: null, denied: null },
    warnings: [],
    reasons: [],
    messages: [],
  };
  const finish = (exitCode) => {
    verdict.reasons = failures.map((f) => f.reason);
    verdict.messages = failures.map((f) => f.text(verdict.observed));
    verdict.ok = failures.length === 0 && exitCode === 0;
    verdict.exitCode = verdict.ok ? 0 : exitCode === 0 ? 1 : exitCode;
    if (verdict.ok && !isAllowlist) verdict.warnings.push(MESSAGES.internetWarning());
    return { verdict, lines };
  };

  // FR-006 (i) / US1 AS3: no container, no proof. Fails before the canary starts.
  if (!container) {
    fail('needs-container', () => MESSAGES.needsContainer(mode));
    return finish(1);
  }
  if (
    typeof probe !== 'function' ||
    typeof readEnv !== 'function' ||
    typeof readArgs !== 'function' ||
    typeof readPorts !== 'function'
  ) {
    throw new TypeError('checkDeclaredMode: a container needs probe, readEnv, readArgs and readPorts');
  }

  let canary;
  try {
    canary = await startCanary({ port: canaryPort, redirectBase: `http://${canaryHost}:${canaryPort}` });
  } catch (err) {
    if (isPortBusy(err, canaryPort)) {
      fail('port-busy', (o) => MESSAGES.inMode(mode, o, MESSAGES.portBusy(canaryPort)));
      return finish(2);
    }
    throw err;
  }
  const base = `http://${canaryHost}:${canary.port}`;
  const log = canary.log;
  // Exact path (optionally with a query): a fixture whose name prefixes another's must not
  // count the other's fetches.
  const hit = (exactPath) => log.some((entry) => entry === exactPath || entry.startsWith(`${exactPath}?`));
  const render = async (source) => {
    const res = await fetchImpl(`${serverUrl}${encodePlantuml(source)}`, { signal: AbortSignal.timeout(timeoutMs) });
    return { status: res.status, body: await res.text() };
  };

  try {
    const allFixtures = [...fixtures, ...extraFixtures];
    if (allFixtures.length === 0) {
      fail('no-fixtures', (o) => MESSAGES.inMode(mode, o, MESSAGES.noFixtures()));
      return finish(1);
    }

    // Control: the server renders a plain diagram.
    let control;
    try {
      control = await render('@startuml\nAlice -> Bob : dk-control\n@enduml');
    } catch (err) {
      fail('control-failed', (o) => MESSAGES.inMode(mode, o, MESSAGES.controlNoAnswer(serverUrl, err?.message ?? err)));
      return finish(1);
    }
    if (control.status !== 200 || !control.body.includes('dk-control')) {
      fail('control-failed', (o) => MESSAGES.inMode(mode, o, MESSAGES.controlNotRendered(control.status)));
      return finish(1);
    }

    // Probes: both paths reachable from the service (edge case 7; informational in internet mode).
    for (const [which, prefix] of [
      ['allowed', CANARY_ALLOWED_PREFIX],
      ['denied', CANARY_DENIED_PREFIX],
    ]) {
      try {
        await probe(`${base}${prefix}probe`);
      } catch {
        // Judged from the canary's log below, not from the probe's own outcome.
      }
      const reachable = hit(`${prefix}probe`);
      verdict.reachability[which] = reachable;
      lines.push(MESSAGES.probeLine(which, reachable));
      if (isAllowlist && !reachable) {
        fail(`not-reachable-${which}`, (o) => MESSAGES.notReachable(mode, which, o));
      }
    }

    // Renders: each fixture against the allowed, denied and redirect paths.
    const perFixture = [];
    let renderFailed = false;
    for (const fixture of allFixtures) {
      const name = encodeURIComponent(fixture.name);
      const paths = {
        allowed: `${CANARY_ALLOWED_PREFIX}include/${name}`,
        denied: `${CANARY_DENIED_PREFIX}include/${name}`,
        redirect: `${CANARY_ALLOWED_PREFIX}redirect/${name}`,
      };
      if (!fixture.source.includes('{{CANARY_URL}}')) {
        fail('no-placeholder', (o) => MESSAGES.inMode(mode, o, MESSAGES.noPlaceholder(fixture.name)));
        continue;
      }
      for (const [which, path] of Object.entries(paths)) {
        const before = log.length;
        let status;
        try {
          ({ status } = await render(fixture.source.replaceAll('{{CANARY_URL}}', `${base}${path}`)));
        } catch (err) {
          status = 'error';
          renderFailed = true;
          if (isAllowlist) {
            fail('render-failed', (o) =>
              MESSAGES.inMode(mode, o, MESSAGES.renderFailed(fixture.name, which, err?.message ?? err)),
            );
          }
        }
        lines.push(MESSAGES.pathLine(fixture.name, which, status, log.length - before));
      }
      // At least one hit = fetched (the real image requests twice, F4); a hit counts even if the render errored.
      perFixture.push({ fixture: fixture.name, allowed: hit(paths.allowed), denied: hit(paths.denied) });
    }

    // Redirect followed: judged only from the request log (F3).
    const redirected = [...new Set(log.filter((entry) => entry.startsWith(CANARY_REDIRECTED_PREFIX)))];
    if (isAllowlist && redirected.length > 0) {
      fail('redirect-followed', (o) => MESSAGES.redirectFollowed(o, redirected));
    }

    // NFR-001: nothing outside the two prefixes, in either declared mode.
    const strays = [
      ...new Set(log.filter((e) => !e.startsWith(CANARY_ALLOWED_PREFIX) && !e.startsWith(CANARY_DENIED_PREFIX))),
    ];
    for (const stray of strays) fail('stray-request', (o) => MESSAGES.strayRequest(mode, o, stray));

    // Behavioural half (allowlist only; informational in internet mode, F1).
    const behaviour = classifyObserved(perFixture);
    let inconsistent = false;
    if (isAllowlist && perFixture.length > 0 && !renderFailed) {
      if (behaviour === null) {
        inconsistent = true;
        fail('inconsistent fetches', () => MESSAGES.inconsistentFetches(perFixture));
      } else {
        // FR-004 (a): skipped when the allowed probe already failed (that message says why).
        if (behaviour === 'sandbox' && verdict.reachability.allowed) {
          fail('allowed-refused', (o) => MESSAGES.allowedRefused(o));
        }
        if (behaviour === 'internet') fail('denied-fetched', (o) => MESSAGES.deniedFetched(o));
      }
    }

    // Configuration half: the profile read is the observed class (F1, decision 01M6F4BRKQ4E9H9Z41BYZH37MC).
    let env;
    let args;
    let ports;
    let networkMode;
    try {
      env = await readEnv(container);
      args = await readArgs(container);
      ports = await readPorts(container);
      networkMode = readNetworkMode ? await readNetworkMode(container) : undefined;
    } catch (err) {
      const reason = err instanceof ServiceConfigError ? err.reason : (err?.message ?? String(err));
      fail('config-unreadable', (o) => MESSAGES.inMode(mode, o, MESSAGES.configUnreadable(reason)));
      return finish(1);
    }
    const identity = checkServiceIdentity(serverUrl, ports, networkMode);
    if (!identity.ok) fail('service-identity', (o) => MESSAGES.inMode(mode, o, identity.message));
    else if (identity.note) lines.push(identity.note);
    if (systemPropertyConfig(env)) {
      fail('system-properties', (o) => MESSAGES.inMode(mode, o, MESSAGES.systemProperties()));
    }
    if (propertyFileConfig(env)) {
      fail('property-file', (o) => MESSAGES.inMode(mode, o, MESSAGES.propertyFile()));
    }
    if (commandLineProperties(args)) {
      fail('command-line-properties', (o) => MESSAGES.inMode(mode, o, MESSAGES.commandLineProperties()));
    }
    verdict.observed = inconsistent ? null : profileClass(env);
    const profile = env?.PLANTUML_SECURITY_PROFILE;

    if (isAllowlist) {
      // FR-004 (c1): profile.
      if (profile !== 'ALLOWLIST') fail('profile-mismatch', (o) => MESSAGES.profileMismatch(mode, profile, o));
      // FR-004 (c2, c3, c4): entries.
      const diff = compareAllowlist(env?.PLANTUML_ALLOWLIST_URL, declared.entries ?? [], canaryEntry(canaryHost, canary.port));
      verdict.entries = { extra: diff.extra, missing: diff.missing };
      if (diff.emptyItems) fail('empty-entry', (o) => MESSAGES.emptyEntry(o));
      if (diff.extra.length > 0 || diff.missing.length > 0) {
        fail('entries-differ', (o) => MESSAGES.entriesDiffer(o, diff));
      }
    } else if (profile !== 'INTERNET') {
      // FR-006 (ii).
      fail('profile-mismatch', (o) => MESSAGES.profileMismatch(mode, profile, o));
    }
    return finish(0);
  } finally {
    await canary.close();
  }
}
