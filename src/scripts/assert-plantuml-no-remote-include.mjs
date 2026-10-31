#!/usr/bin/env node
/**
 * Assert that the PlantUML render service refuses remote includes (#251).
 *
 *   dockitty-assert-plantuml-no-remote-include \
 *     [--server http://localhost:8091/svg/] \
 *     [--canary-host <host the server uses to reach this machine>] \
 *     [--service-container <docker container id or name>]
 *
 * `--server` defaults to DK_PLANTUML_SERVER_URL, then http://localhost:8091/svg/.
 * With `--service-container`, the check first runs `curl` INSIDE that container
 * against the canary, so it proves the canary was reachable and the include was
 * refused by the server, not by the network. Without it, reachability is not
 * proven and the script says so.
 *
 * See plantuml-include-guard.mjs for what is checked. Exits 1 on any failure.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { checkRemoteIncludesRefused } from './plantuml-include-guard.mjs';

const run = promisify(execFile);

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!['--server', '--canary-host', '--service-container'].includes(flag) || value === undefined) {
      throw new Error(`unknown or incomplete argument: ${flag}`);
    }
    opts[flag.slice(2)] = value;
    i += 1;
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

const serverUrl = opts.server ?? (process.env.DK_PLANTUML_SERVER_URL?.trim() || 'http://localhost:8091/svg/');
const container = opts['service-container'];
const probe = container
  ? async (url) => {
      await run('docker', ['exec', container, 'curl', '-sf', '--max-time', '5', '-o', '/dev/null', url]);
    }
  : undefined;

const result = await checkRemoteIncludesRefused({ serverUrl, canaryHost: opts['canary-host'], probe });
for (const r of result.results) {
  console.log(
    `${NAME}: ${r.fixture}: HTTP ${r.status}, error ${JSON.stringify(r.error)}, canary requests ${r.fetched}`,
  );
}
if (!result.ok) {
  for (const m of result.messages) console.error(`${NAME}: FAIL — ${m}`);
  process.exit(1);
}
if (result.reachable === null) {
  console.warn(`${NAME}: note — no --service-container given, so canary reachability from the server was not proven.`);
}
console.log(
  `${NAME}: OK — ${result.results.length} remote include(s) refused by ${serverUrl}` +
    (result.reachable ? ', with the canary proven reachable from the server' : ''),
);
