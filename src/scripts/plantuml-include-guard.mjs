/**
 * The remote-include half of the PlantUML hardening (#251). The no-plantuml.com
 * guard (`plantuml-guard.mjs`, C-001) makes sure diagram source only goes to a
 * self-hosted server. This module checks the other direction: that the server
 * itself refuses to fetch a remote `!include`/`!includeurl`, so a diagram cannot
 * make the build reach the network.
 *
 * How it proves it, against a LIVE PlantUML server:
 *   1. A canary HTTP server starts on this machine and counts every request.
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

/** Start the canary on all interfaces; resolves once it listens. */
function startCanary() {
  const hits = [];
  const server = createServer((req, res) => {
    hits.push(req.url ?? '');
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`@startuml\nAlice -> Bob : ${CANARY_MARKER}\n@enduml\n`);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '0.0.0.0', () => {
      const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
      resolve({ hits, port, close: () => new Promise((r) => server.close(() => r(undefined))) });
    });
  });
}

/**
 * @param {object} opts
 * @param {string} opts.serverUrl the PlantUML SVG endpoint, with its trailing `/svg/`
 * @param {string} [opts.canaryHost] the canary's host as the PlantUML server sees it
 * @param {(url: string) => Promise<void>} [opts.probe] fetches `url` from the server's side
 * @param {{ name: string, source: string }[]} [opts.fixtures]
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{ ok: boolean, messages: string[], reachable: boolean | null, results: object[] }>}
 */
export async function checkRemoteIncludesRefused({
  serverUrl,
  canaryHost = '127.0.0.1',
  probe,
  fixtures = loadFixtures(),
  fetchImpl = fetch,
  timeoutMs = 20_000,
}) {
  const messages = [];
  const results = [];
  let reachable = null;
  const canary = await startCanary();
  const base = `http://${canaryHost}:${canary.port}`;
  const render = async (source) => {
    const res = await fetchImpl(`${serverUrl}${encodePlantuml(source)}`, { signal: AbortSignal.timeout(timeoutMs) });
    return { status: res.status, error: res.headers.get('x-plantuml-diagram-error'), body: await res.text() };
  };

  try {
    if (fixtures.length === 0) {
      messages.push('no fixtures found: the check would prove nothing');
      return { ok: false, messages, reachable, results };
    }

    // Control 1: the server renders a plain diagram.
    let control;
    try {
      control = await render('@startuml\nAlice -> Bob : dk-control\n@enduml');
    } catch (err) {
      messages.push(`control: the PlantUML server at ${serverUrl} did not answer (${err?.message ?? err})`);
      return { ok: false, messages, reachable, results };
    }
    if (control.status !== 200 || !control.body.includes('dk-control')) {
      messages.push(`control: a plain diagram did not render (HTTP ${control.status}): the check would prove nothing`);
      return { ok: false, messages, reachable, results };
    }

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
        return { ok: false, messages, reachable, results };
      }
    }

    for (const fixture of fixtures) {
      const includePath = `/include/${encodeURIComponent(fixture.name)}`;
      const source = fixture.source.replaceAll('{{CANARY_URL}}', `${base}${includePath}`);
      if (source === fixture.source) {
        messages.push(`${fixture.name}: has no {{CANARY_URL}} placeholder`);
        continue;
      }
      const res = await render(source);
      const fetched = canary.hits.filter((h) => h.startsWith(includePath)).length;
      const refused = res.status === 400 || (res.error !== null && res.error !== '');
      const leaked = res.body.includes(CANARY_MARKER);
      results.push({ fixture: fixture.name, status: res.status, error: res.error, fetched, refused, leaked });
      if (fetched > 0) messages.push(`${fixture.name}: the server FETCHED the remote include (${fetched} request(s))`);
      if (leaked) messages.push(`${fixture.name}: the render contains the included content`);
      if (!refused) messages.push(`${fixture.name}: the render was not an error (HTTP ${res.status})`);
    }
  } finally {
    await canary.close();
  }

  return { ok: messages.length === 0, messages, reachable, results };
}
