#!/usr/bin/env node
/**
 * Assert that the PlantUML render service matches the declared external-include
 * opt-in (#251, #268).
 *
 *   dockitty-assert-plantuml-no-remote-include \
 *     [--server http://localhost:8091/svg/] \
 *     [--canary-host <host the server uses to reach this machine>] \
 *     [--service-container <docker container id or name>] \
 *     [--canary-port <1-65535>] \
 *     [--astro-config <path to the site's astro.config.*>] \
 *     [--print-declared]
 *
 * `--server` defaults to DK_PLANTUML_SERVER_URL, then http://localhost:8091/svg/.
 *
 * The declared opt-in is DK_PLANTUML_ALLOW_EXTERNAL, then (with `--astro-config`, which
 * evaluates the config and needs the site's `astro` installed) the site's
 * `plantumlAllowExternal`, then sandbox. `--print-declared` prints that resolution as one
 * JSON line and exits 0 without checking anything.
 *
 * Unset (sandbox): the server must refuse remote includes. With `--service-container`,
 * the check first runs `curl` INSIDE that container against the canary, so it proves the
 * canary was reachable and the include was refused by the server, not by the network;
 * after a passing check it also reads the container's PLANTUML_SECURITY_PROFILE, which
 * must be SANDBOX, and its command line, which must carry no PlantUML system property; with a
 * local `--server` the container must publish that port (else a decoy could vouch for it). Without it, reachability is not proven and the script says so. The
 * canary port is random unless `--canary-port` is given.
 *
 * Allowlist / internet: see plantuml-mode-check.mjs. Both need `--service-container`;
 * the canary listens on `--canary-port` (default 18091) so the service's allowlist can
 * name it. One stable verdict line is printed:
 * `verdict: declared <mode>, observed <class|no class>`.
 *
 * See plantuml-include-guard.mjs for what the unset check proves.
 * Exits 0 on pass, 1 on a failed check, 2 on a usage or configuration error.
 *
 * Node built-ins only at load time (C-006): site-config-eval.mjs is imported dynamically,
 * and only when `--astro-config` is given.
 */
import { checkRemoteIncludesRefused } from './plantuml-include-guard.mjs';
import {
  PLANTUML_ALLOW_EXTERNAL_ENV,
  PlantumlAllowExternalError,
  describeDeclared,
  resolvePlantumlAllowExternal,
} from '../lib/plantuml-external.mjs';
import {
  MESSAGES,
  ServiceConfigError,
  checkDeclaredMode,
  checkServiceIdentity,
  checkUnsetProfile,
  formatVerdictLine,
  isPortBusy,
} from './plantuml-mode-check.mjs';
import { dockerProbe, readServiceArgs, readServiceEnv, readServicePorts } from './plantuml-service-config.mjs';

const VALUE_FLAGS = ['--server', '--canary-host', '--service-container', '--canary-port', '--astro-config'];
const BOOLEAN_FLAGS = ['--print-declared'];
const DECLARED_CANARY_PORT = 18091;

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (BOOLEAN_FLAGS.includes(flag)) {
      opts[flag.slice(2)] = true;
      continue;
    }
    const value = argv[i + 1];
    if (!VALUE_FLAGS.includes(flag) || value === undefined) {
      throw new Error(`unknown or incomplete argument: ${flag}`);
    }
    opts[flag.slice(2)] = value;
    i += 1;
  }
  if (opts['canary-port'] !== undefined) {
    const text = opts['canary-port'];
    const port = Number(text);
    if (!/^\d+$/.test(text) || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`invalid --canary-port ${text}: expected an integer from 1 to 65535`);
    }
    opts['canary-port'] = port;
  }
  return opts;
}

const NAME = 'assert-plantuml-no-remote-include';
let opts;
try {
  opts = parseArgs(process.argv.slice(2));
} catch (err) {
  console.error(`${NAME}: ${err.message}`);
  process.exit(2);
}

const firstLine = (text) => String(text ?? '').split('\n')[0];

/**
 * The declared opt-in. The environment value is validated first, so an invalid
 * DK_PLANTUML_ALLOW_EXTERNAL is reported as such even when the config would also see it.
 * Never reads the build's internal handoff variable: the check resolves on its own.
 */
async function resolveDeclared() {
  const envOnly = resolvePlantumlAllowExternal({ env: process.env[PLANTUML_ALLOW_EXTERNAL_ENV], siteValue: undefined });
  const astroConfig = opts['astro-config'];
  if (astroConfig === undefined) return envOnly;
  const path = await import('node:path');
  let evaluator;
  try {
    // Dynamic on purpose: site-config-eval pulls installed packages, and the unset and env
    // paths must load with Node built-ins only (C-006).
    evaluator = await import('./site-config-eval.mjs');
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    console.error(
      `${NAME}: --astro-config needs the site's dependencies installed (${firstLine(err.message)}). ` +
        'Run the package manager install first, or drop --astro-config to read only DK_PLANTUML_ALLOW_EXTERNAL.',
    );
    process.exit(2);
  }
  const { evaluateSiteConfig, ConfigEvalError, shown } = evaluator;
  let result;
  try {
    result = evaluateSiteConfig({
      siteRoot: path.dirname(path.resolve(astroConfig)),
      astroConfig,
      tool: NAME,
    });
  } catch (err) {
    console.error(
      err instanceof ConfigEvalError
        ? `${NAME}: could not evaluate ${shown(err.configPath)} (${firstLine(err.reason)}). ` +
            "Fix the config, and make sure the site's own dependencies (astro) are installed."
        : String(err?.message ?? err),
    );
    process.exit(2);
  }
  // null: the config never called defineDocKittyIntegrations (or, defensively, no config).
  return result.config?.plantumlAllowExternal ?? envOnly;
}

let declared;
try {
  declared = await resolveDeclared();
} catch (err) {
  if (err instanceof PlantumlAllowExternalError) {
    console.error(`${NAME}: ${err.message}`);
    process.exit(2);
  }
  throw err;
}

if (opts['print-declared']) {
  console.log(JSON.stringify({ mode: declared.mode, entries: declared.entries, source: declared.source }));
  process.exit(0);
}

const serverUrl = opts.server ?? (process.env.DK_PLANTUML_SERVER_URL?.trim() || 'http://localhost:8091/svg/');
const container = opts['service-container'];

if (declared.mode === 'sandbox') await checkUnset();
else await checkDeclared();

/** Unset mode: today's check, byte-identical output, plus the profile read after a pass. */
async function checkUnset() {
  const probe = container ? dockerProbe(container) : undefined;
  const checkOpts = { serverUrl, canaryHost: opts['canary-host'], probe };
  if (opts['canary-port'] !== undefined) checkOpts.canaryPort = opts['canary-port'];
  let result;
  try {
    result = await checkRemoteIncludesRefused(checkOpts);
  } catch (err) {
    const port = opts['canary-port'];
    if (port !== undefined && isPortBusy(err, port)) {
      console.error(`${NAME}: ${MESSAGES.portBusy(port)}`);
      process.exit(2);
    }
    throw err;
  }
  for (const r of result.results) {
    console.log(
      `${NAME}: ${r.fixture}: HTTP ${r.status}, error ${JSON.stringify(r.error)}, canary requests ${r.fetched}`,
    );
  }
  if (!result.ok) {
    for (const m of result.messages) console.error(`${NAME}: FAIL — ${m}`);
    process.exit(1);
  }
  if (container) {
    // Decision 01M6F4XFDPJ6XFBYM5HM65G1AM: a passing check with the container named
    // also needs the service's profile to be SANDBOX. A SANDBOX profile prints nothing new.
    let message;
    try {
      const identity = checkServiceIdentity(serverUrl, await readServicePorts(container));
      const profile = checkUnsetProfile(await readServiceEnv(container), await readServiceArgs(container));
      if (!identity.ok) message = identity.message;
      else if (!profile.ok) message = profile.message;
      else if (identity.note) console.warn(`${NAME}: ${identity.note}`);
    } catch (err) {
      if (!(err instanceof ServiceConfigError)) throw err;
      message = err.message;
    }
    if (message !== undefined) {
      console.error(MESSAGES.failLine(message));
      process.exit(1);
    }
  }
  if (result.reachable === null) {
    console.warn(`${NAME}: note — no --service-container given, so canary reachability from the server was not proven.`);
  }
  console.log(
    `${NAME}: OK — ${result.results.length} remote include(s) refused by ${serverUrl}` +
      (result.reachable ? ', with the canary proven reachable from the server' : ''),
  );
}

/** Allowlist or internet mode: verify the declared opt-in against the service. */
async function checkDeclared() {
  console.log(
    `${NAME}: declared: ${describeDeclared(declared)}` +
      (opts['astro-config'] === undefined ? '; site configuration not read (no --astro-config)' : ''),
  );
  const { verdict, lines } = await checkDeclaredMode({
    declared,
    serverUrl,
    canaryHost: opts['canary-host'],
    canaryPort: opts['canary-port'] ?? DECLARED_CANARY_PORT,
    container,
    probe: container ? dockerProbe(container) : undefined,
    readEnv: readServiceEnv,
    readArgs: readServiceArgs,
    readPorts: readServicePorts,
  });
  for (const line of lines) console.log(`${NAME}: ${line}`);
  console.log(formatVerdictLine(verdict));
  if (!verdict.ok) {
    for (const m of verdict.messages) console.error(MESSAGES.failLine(m));
    process.exit(verdict.exitCode);
  }
  for (const w of verdict.warnings) console.error(`${NAME}: ${w}`);
  console.log(
    `${NAME}: ` + (declared.mode === 'allowlist' ? MESSAGES.allowlistOk(declared.entries) : MESSAGES.internetOk()),
  );
}
