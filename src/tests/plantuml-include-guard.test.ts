/**
 * The remote-include check (#251) against fake PlantUML servers. The real
 * service is exercised in CI (ci.yml build-example: `assert:plantuml-no-remote-include`);
 * here each fake server stands for one behaviour, so the check is shown to pass
 * ONLY for a server that refuses, and to fail for one that fetches, one that is
 * down, and one the canary cannot be reached from.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  checkRemoteIncludesRefused,
  encodePlantuml,
  decodePlantuml,
  loadFixtures,
  CANARY_MARKER,
} from '../scripts/plantuml-include-guard.mjs';

type Behaviour = 'refuse' | 'fetch' | 'broken';

const INCLUDE_RE = /^\s*!include(?:url|_once|_many)?\s+(\S+)/m;

/**
 * A fake PlantUML server. `refuse` acts like SANDBOX (400 + error header on any
 * URL include); `fetch` acts like an open profile and really GETs the include;
 * `broken` answers 500 to everything.
 */
async function fakePlantuml(behaviour: Behaviour): Promise<{ url: string; server: Server }> {
  const server = createServer(async (req, res) => {
    if (behaviour === 'broken') {
      res.writeHead(500).end('down');
      return;
    }
    const source = decodePlantuml((req.url ?? '').replace(/^\/svg\//, ''));
    const include = INCLUDE_RE.exec(source)?.[1];
    let body = source;
    if (include) {
      if (behaviour === 'refuse') {
        res.writeHead(400, { 'x-plantuml-diagram-error': 'Cannot open URL' }).end('<svg>Cannot open URL</svg>');
        return;
      }
      body += await (await fetch(include)).text();
    }
    res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(`<svg>${body}</svg>`);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/svg/`, server };
}

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

async function serve(behaviour: Behaviour): Promise<string> {
  const { url, server } = await fakePlantuml(behaviour);
  servers.push(server);
  return url;
}

/** A probe that fetches the canary from this machine (the fakes share it). */
const localProbe = async (url: string) => {
  await fetch(url);
};

describe('PlantUML URL encoding', () => {
  it('round-trips through the PlantUML alphabet', () => {
    const text = '@startuml\nAlice -> Bob : héllo ✓\n@enduml';
    expect(encodePlantuml(text)).toMatch(/^[0-9A-Za-z_-]+$/);
    expect(decodePlantuml(encodePlantuml(text))).toBe(text);
  });
});

describe('the fixtures', () => {
  it('cover !includeurl and !include of a URL, each with the canary placeholder', () => {
    const fixtures = loadFixtures();
    expect(fixtures.map((f) => f.name)).toEqual(['include-url.puml', 'includeurl.puml']);
    expect(fixtures[0].source).toMatch(/^!include \{\{CANARY_URL\}\}$/m);
    expect(fixtures[1].source).toMatch(/^!includeurl \{\{CANARY_URL\}\}$/m);
  });
});

describe('checkRemoteIncludesRefused', () => {
  it('passes against a server that refuses remote includes, with reachability proven', async () => {
    const result = await checkRemoteIncludesRefused({ serverUrl: await serve('refuse'), probe: localProbe });
    expect(result.messages).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.reachable).toBe(true);
    expect(result.results).toHaveLength(2);
    for (const r of result.results) expect(r).toMatchObject({ status: 400, fetched: 0, refused: true, leaked: false });
  });

  it('fails against a server that fetches the include, naming every fixture', async () => {
    const result = await checkRemoteIncludesRefused({ serverUrl: await serve('fetch'), probe: localProbe });
    expect(result.ok).toBe(false);
    for (const name of ['include-url.puml', 'includeurl.puml']) {
      expect(result.messages).toContain(`${name}: the server FETCHED the remote include (1 request(s))`);
      expect(result.messages).toContain(`${name}: the render contains the included content`);
      expect(result.messages).toContain(`${name}: the render was not an error (HTTP 200)`);
    }
    expect(result.results.every((r) => (r as { leaked: boolean }).leaked)).toBe(true);
    expect(CANARY_MARKER).toBe('DK-CANARY-FETCHED');
  });

  it('fails, rather than passing vacuously, when the server does not render', async () => {
    const result = await checkRemoteIncludesRefused({ serverUrl: await serve('broken') });
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toMatch(/^control: a plain diagram did not render \(HTTP 500\)/);
    expect(result.results).toEqual([]);
  });

  it('fails when no server answers at all', async () => {
    const result = await checkRemoteIncludesRefused({ serverUrl: 'http://127.0.0.1:9/svg/', timeoutMs: 2000 });
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toMatch(/^control: the PlantUML server at .* did not answer/);
  });

  it('fails when the canary cannot be reached from the server side', async () => {
    const result = await checkRemoteIncludesRefused({
      serverUrl: await serve('refuse'),
      probe: async () => {
        throw new Error('connection refused');
      },
    });
    expect(result.ok).toBe(false);
    expect(result.reachable).toBe(false);
    expect(result.messages).toContain('probe failed: connection refused');
    expect(result.messages.at(-1)).toMatch(/is not reachable from the PlantUML server's side/);
  });

  it('reports reachability as unproven when no probe is given', async () => {
    const result = await checkRemoteIncludesRefused({ serverUrl: await serve('refuse') });
    expect(result.ok).toBe(true);
    expect(result.reachable).toBeNull();
  });

  it('fails with no fixtures', async () => {
    const result = await checkRemoteIncludesRefused({ serverUrl: await serve('refuse'), fixtures: [] });
    expect(result).toMatchObject({ ok: false, messages: ['no fixtures found: the check would prove nothing'] });
  });
});
