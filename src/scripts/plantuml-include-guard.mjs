/**
 * The remote-include half of the PlantUML hardening (#251). The no-plantuml.com
 * guard (`plantuml-guard.mjs`, C-001) makes sure diagram source only goes to a
 * self-hosted server. This module checks the other direction: that the server
 * itself refuses to fetch a remote `!include`/`!includeurl`, so a diagram cannot
 * make the build reach the network.
 *
 * How it proves it, against a LIVE PlantUML server:
 *   1. A canary HTTP server starts on this machine and logs every request. It serves
 *      two path prefixes: allowed (`/dk-canary/allowed/`) and denied
 *      (`/dk-canary/denied/`), plus a 302 from the allowed to the denied prefix.
 *   2. Control: a plain diagram must render (HTTP 200). Otherwise the server is
 *      down, and a refusal would prove nothing.
 *   3. Control (when a `probe` is given): the canary must be reachable FROM the
 *      server's side, e.g. `docker exec <service> curl <canary>`. Otherwise a
 *      refused include could just be a network that cannot reach the canary.
 *   4. Each fixture under `fixtures/plantuml-remote-include/` (next to this file) is
 *      rendered with `{{CANARY_URL}}` pointing at the canary. Each must come back
 *      as a PlantUML error (HTTP 400 or an `X-PlantUML-Diagram-Error` header),
 *      must not contain the canary's marker, and the canary must see ZERO
 *      requests on its include path.
 *
 * Returns a result object instead of exiting; the CLI is
 * `assert-plantuml-no-remote-include.mjs`.
 */
import { createServer } from 'node:http';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

/** The fixtures the check renders, one diagram per `.puml` file. */
export const FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/plantuml-remote-include',
);

/** The text the canary serves. Seeing it in a render means the include was fetched. */
export const CANARY_MARKER = 'DK-CANARY-FETCHED';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

/** Encode PlantUML source for a server URL (raw deflate + PlantUML's base64 alphabet). */
export function encodePlantuml(text) {
  const data = zlib.deflateRawSync(Buffer.from(text, 'utf8'), { level: 9 });
  let out = '';
  let acc = 0;
  let bits = 0;
  for (const byte of data) {
    acc = ((acc << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += ALPHABET[(acc >> bits) & 0x3f];
    }
  }
  if (bits > 0) out += ALPHABET[(acc << (6 - bits)) & 0x3f];
  return out;
}

/** The inverse of {@link encodePlantuml} (used by the tests' fake servers). */
export function decodePlantuml(encoded) {
  const bytes = [];
  let acc = 0;
  let bits = 0;
  for (const ch of encoded) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new Error(`not PlantUML-encoded: ${JSON.stringify(ch)}`);
    acc = ((acc << 6) | v) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return zlib.inflateRawSync(Buffer.from(bytes)).toString('utf8');
}

/** Read every `.puml` fixture, sorted by name. */
export function loadFixtures(dir = FIXTURE_DIR) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.puml'))
    .sort()
    .map((name) => ({ name, source: readFileSync(path.join(dir, name), 'utf8') }));
}

export const CANARY_ALLOWED_PREFIX = '/dk-canary/allowed/';
export const CANARY_DENIED_PREFIX = '/dk-canary/denied/';
/** Served under the denied prefix; deliberately not containing {@link CANARY_MARKER}. */
export const CANARY_DENIED_MARKER = 'DK-CANARY-DENIED-FETCHED';

const canaryBody = (marker) => `@startuml\nAlice -> Bob : ${marker}\n@enduml\n`;

/**
 * Start the canary on all interfaces; resolves once it listens. It serves the allowed
 * prefix (`/dk-canary/allowed/`, marker {@link CANARY_MARKER}), the denied prefix
 * (`/dk-canary/denied/`, marker {@link CANARY_DENIED_MARKER}), a 302 from
 * `<allowed>redirect/<rest>` to `<denied>redirected/<rest>`, and `/reachability`.
 * Anything else is a 404. Every request path is appended to `log` (the real image
 * requests each include twice, so consumers must classify on "at least one hit").
 *
 * @param {{ port?: number, redirectBase?: string }} [opts] `redirectBase` is the canary's
 *   base URL as the PlantUML service sees it (default `http://127.0.0.1:<port>`)
 * @returns {Promise<{ port: number, log: string[], hits: string[], close: () => Promise<void> }>}
 */
export function startCanary({ port = 0, redirectBase } = {}) {
  const log = [];
  let boundPort = port;
  const server = createServer((req, res) => {
    const url = req.url ?? '';
    log.push(url);
    const plain = { 'content-type': 'text/plain; charset=utf-8' };
    if (url.startsWith(`${CANARY_ALLOWED_PREFIX}redirect/`)) {
      const rest = url.slice(`${CANARY_ALLOWED_PREFIX}redirect/`.length);
      const base = redirectBase ?? `http://127.0.0.1:${boundPort}`;
      res.writeHead(302, { location: `${base}${CANARY_DENIED_PREFIX}redirected/${rest}` });
      res.end();
    } else if (url.startsWith(CANARY_ALLOWED_PREFIX) || url.startsWith('/reachability')) {
      res.writeHead(200, plain);
      res.end(canaryBody(CANARY_MARKER));
    } else if (url.startsWith(CANARY_DENIED_PREFIX)) {
      res.writeHead(200, plain);
      res.end(canaryBody(CANARY_DENIED_MARKER));
    } else {
      res.writeHead(404, plain);
      res.end('not found\n');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      reject(
        err?.code === 'EADDRINUSE'
          ? Object.assign(new Error(`cannot listen on canary port ${port}: in use`), { code: 'EADDRINUSE', port })
          : err,
      );
    });
    server.listen(port, '0.0.0.0', () => {
      boundPort = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
      resolve({ log, hits: log, port: boundPort, close: () => new Promise((r) => server.close(() => r(undefined))) });
    });
  });
}

/** The messages of the checks every include check shares (start-up controls and fixture sanity). */
export const PREFLIGHT_MESSAGES = Object.freeze({
  noFixtures: () => 'no fixtures found: the check would prove nothing',
  controlNoAnswer: (serverUrl, reason) => `control: the PlantUML server at ${serverUrl} did not answer (${reason})`,
  controlNotRendered: (status) => `control: a plain diagram did not render (HTTP ${status}): the check would prove nothing`,
  noPlaceholder: (fixture) => `${fixture}: has no {{CANARY_URL}} placeholder`,
});

/** True when the fixture can be pointed at the canary. */
export const hasPlaceholder = (fixture) => fixture.source.includes('{{CANARY_URL}}');

/**
 * The start-up every include check shares: start the canary, require fixtures, and require
 * the server to render a plain diagram (control). Runs `run({ canary, base, render })` once
 * those hold and always closes the canary. A failed control resolves to `{ refusal }`
 * (`reason` is `no-fixtures` or `control-failed`) and `run` never starts; otherwise to
 * `{ value }`. `startCanary` errors (a busy port) propagate.
 *
 * @param {object} opts
 * @param {string} opts.serverUrl the PlantUML SVG endpoint, with its trailing `/svg/`
 * @param {string} opts.canaryHost the canary's host as the PlantUML server sees it
 * @param {number} opts.canaryPort fixed canary port (0: random)
 * @param {string} [opts.redirectBase] the canary's base URL for its redirect (see {@link startCanary})
 * @param {{ name: string, source: string }[]} opts.fixtures
 * @param {typeof fetch} opts.fetchImpl
 * @param {number} opts.timeoutMs
 * @param {(ctx: { canary: Awaited<ReturnType<typeof startCanary>>, base: string, render: (source: string) => Promise<{ status: number, error: string | null, body: string }> }) => Promise<unknown>} run
 * @returns {Promise<{ refusal: { reason: string, message: string } } | { value: unknown }>}
 */
export async function withControlledCanary({ serverUrl, canaryHost, canaryPort, redirectBase, fixtures, fetchImpl, timeoutMs }, run) {
  const canary = await startCanary({ port: canaryPort, redirectBase });
  const base = `http://${canaryHost}:${canary.port}`;
  const render = async (source) => {
    const res = await fetchImpl(`${serverUrl}${encodePlantuml(source)}`, { signal: AbortSignal.timeout(timeoutMs) });
    return { status: res.status, error: res.headers.get('x-plantuml-diagram-error'), body: await res.text() };
  };
  const refuse = (reason, message) => ({ refusal: { reason, message } });
  try {
    if (fixtures.length === 0) return refuse('no-fixtures', PREFLIGHT_MESSAGES.noFixtures());
    let control;
    try {
      control = await render('@startuml\nAlice -> Bob : dk-control\n@enduml');
    } catch (err) {
      return refuse('control-failed', PREFLIGHT_MESSAGES.controlNoAnswer(serverUrl, err?.message ?? err));
    }
    if (control.status !== 200 || !control.body.includes('dk-control')) {
      return refuse('control-failed', PREFLIGHT_MESSAGES.controlNotRendered(control.status));
    }
    return { value: await run({ canary, base, render }) };
  } finally {
    await canary.close();
  }
}

/**
 * @param {object} opts
 * @param {string} opts.serverUrl the PlantUML SVG endpoint, with its trailing `/svg/`
 * @param {string} [opts.canaryHost] the canary's host as the PlantUML server sees it
 * @param {(url: string) => Promise<void>} [opts.probe] fetches `url` from the server's side
 * @param {{ name: string, source: string }[]} [opts.fixtures]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.canaryPort] fixed canary port (default 0: random)
 * @returns {Promise<{ ok: boolean, messages: string[], reachable: boolean | null, results: object[] }>}
 */
export async function checkRemoteIncludesRefused({
  serverUrl,
  canaryHost = '127.0.0.1',
  probe,
  fixtures = loadFixtures(),
  fetchImpl = fetch,
  timeoutMs = 20_000,
  canaryPort = 0,
}) {
  const messages = [];
  const results = [];
  let reachable = null;
  const outcome = await withControlledCanary(
    { serverUrl, canaryHost, canaryPort, fixtures, fetchImpl, timeoutMs },
    async ({ canary, base, render }) => {
      // Control 2: the canary is reachable from the server's side.
      if (probe) {
        try {
          await probe(`${base}/reachability`);
        } catch (err) {
          messages.push(`probe failed: ${err?.message ?? err}`);
        }
        reachable = canary.hits.some((h) => h.startsWith('/reachability'));
        if (!reachable) {
          messages.push(
            `control: the canary at ${base} is not reachable from the PlantUML server's side, ` +
              'so a refused include would prove nothing. Check --canary-host.',
          );
          return;
        }
      }

      for (const fixture of fixtures) {
        const includePath = `${CANARY_ALLOWED_PREFIX}include/${encodeURIComponent(fixture.name)}`;
        if (!hasPlaceholder(fixture)) {
          messages.push(PREFLIGHT_MESSAGES.noPlaceholder(fixture.name));
          continue;
        }
        const res = await render(fixture.source.replaceAll('{{CANARY_URL}}', `${base}${includePath}`));
        const fetched = canary.hits.filter((h) => h.startsWith(includePath)).length;
        const refused = res.status === 400 || (res.error !== null && res.error !== '');
        const leaked = res.body.includes(CANARY_MARKER);
        results.push({ fixture: fixture.name, status: res.status, error: res.error, fetched, refused, leaked });
        if (fetched > 0) messages.push(`${fixture.name}: the server FETCHED the remote include (${fetched} request(s))`);
        if (leaked) messages.push(`${fixture.name}: the render contains the included content`);
        if (!refused) messages.push(`${fixture.name}: the render was not an error (HTTP ${res.status})`);
      }
    },
  );
  if ('refusal' in outcome) messages.push(outcome.refusal.message);
  return { ok: messages.length === 0, messages, reachable, results };
}
