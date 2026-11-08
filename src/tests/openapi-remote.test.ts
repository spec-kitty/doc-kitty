/**
 * WP10: pinned remote OpenAPI definitions, the shared disk cache and offline
 * materialisation. Every request goes to the local HTTPS child server in
 * helpers/https-stub.ts; the suite never contacts a real host.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startHttpsStub, type HttpsStub } from './helpers/https-stub';

vi.mock('../lib/openapi/options.mjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/openapi/options.mjs')>();
  return { ...actual, parseDocument: vi.fn(actual.parseDocument) };
});

const materialise = await import('../lib/openapi/materialise.mjs');
const { normaliseOpenApiOptions, parseDocument } = await import('../lib/openapi/options.mjs');
const { MAX_SPEC_BYTES } = await import('../lib/openapi/limits.mjs');

const YAML = `${[
  'openapi: 3.1.0',
  'info:',
  '  title: Remote Parcels API',
  '  version: 1.0.0',
  'paths:',
  '  /parcels:',
  '    get:',
  '      operationId: listParcels',
  '      summary: List parcels',
  '      responses:',
  "        '200':",
  '          description: The parcels.',
].join('\n')}\n`;
const PIN = createHash('sha256').update(YAML).digest('hex');
const OTHER_PIN = 'e'.repeat(64);
const renderer = () => ({});
const parserSpy = vi.mocked(parseDocument);

let site: string;
let cacheDir: string;
let server: HttpsStub & { directory: string };
let previousCa: string | undefined;
let previousOffline: string | undefined;

beforeAll(async () => {
  site = mkdtempSync(path.join(tmpdir(), 'dk-openapi-remote-'));
  cacheDir = path.join(site, 'node_modules/.cache/doc-kitty/openapi');
  server = await startHttpsStub(YAML);
  previousCa = process.env.NODE_EXTRA_CA_CERTS;
  previousOffline = process.env.DOCKITTY_OFFLINE;
  process.env.NODE_EXTRA_CA_CERTS = server.caFile;
  delete process.env.DOCKITTY_OFFLINE;
}, 60_000);

beforeEach(async () => {
  rmSync(cacheDir, { recursive: true, force: true });
  parserSpy.mockClear();
  delete process.env.DOCKITTY_OFFLINE;
  await server.clearRequests();
});

afterAll(async () => {
  await server.close();
  rmSync(site, { recursive: true, force: true });
  if (previousCa === undefined) delete process.env.NODE_EXTRA_CA_CERTS;
  else process.env.NODE_EXTRA_CA_CERTS = previousCa;
  if (previousOffline === undefined) delete process.env.DOCKITTY_OFFLINE;
  else process.env.DOCKITTY_OFFLINE = previousOffline;
});

function remoteMaterialise(url: string, sha256 = PIN, offline = false) {
  const options = normaliseOpenApiOptions(
    { renderer, offline, specs: [{ url, sha256, label: 'v1', released: true }] },
    { siteRoot: site },
  );
  return materialise.materialiseOpenApiSpecs(options, { siteRoot: site, offline, cacheDir });
}

describe('WP10 pinned remote source (FR-021, FR-028, NFR-008)', () => {
  it('[WP10] fetches final bytes, hashes and caches them through the shared writer, without auth headers', async () => {
    const specs = remoteMaterialise(`${server.origin}/api.yaml`);
    expect(specs).toHaveLength(1);
    const spec = specs[0]!;
    expect(spec.origin).toBe('remote');
    expect(spec.bytes.toString('utf8')).toBe(YAML);
    expect(spec.sha256).toBe(PIN);
    expect(spec.title).toBe('Remote Parcels API');
    expect(spec.apiVersion).toBe('1.0.0');
    expect(spec.operations.map((operation) => operation.slug)).toEqual(['operations/listparcels']);
    expect(spec.renderPath).toBe(path.join(cacheDir, `${PIN}.yaml`));
    expect(readFileSync(spec.renderPath).equals(spec.bytes)).toBe(true);
    const requests = await server.requests();
    expect(requests.map((request) => request.path)).toEqual(['/api.yaml']);
    expect(requests[0]!.authorization).toBeUndefined();
  }, 60_000);

  it('[WP10] rejects a sha256 mismatch before the parser runs and redacts the query', async () => {
    expect.assertions(5);
    const secret = 'token=must-not-leak';
    expect(() => remoteMaterialise(`${server.origin}/api.yaml?${secret}`, OTHER_PIN)).toThrow(
      /sha256 mismatch[\s\S]*e{64}[\s\S]*[0-9a-f]{64}/,
    );
    expect(parserSpy).not.toHaveBeenCalled();
    expect(existsSync(path.join(cacheDir, `${OTHER_PIN}.yaml`))).toBe(false);
    try {
      remoteMaterialise(`${server.origin}/api.yaml?${secret}`, OTHER_PIN);
    } catch (error) {
      expect(String(error)).not.toContain(secret);
      expect(String(error)).toContain('?…');
    }
  }, 60_000);

  it('[WP10] verifies the cached digest before invoking the parser', () => {
    remoteMaterialise(`${server.origin}/api.yaml`);
    expect(parserSpy).toHaveBeenCalled();
    for (const call of parserSpy.mock.calls) {
      expect(createHash('sha256').update(call[0]).digest('hex')).toBe(PIN);
      expect(readFileSync(path.join(cacheDir, `${PIN}.yaml`), 'utf8')).toBe(call[0]);
    }
  }, 60_000);

  it('[WP10] follows five HTTPS redirects but rejects the sixth', () => {
    expect(() => remoteMaterialise(`${server.origin}/redirect/5.yaml`)).not.toThrow();
    rmSync(cacheDir, { recursive: true, force: true });
    expect(() => remoteMaterialise(`${server.origin}/redirect/6.yaml`)).toThrow(/redirects/);
  }, 60_000);

  it('[WP10] rejects an HTTP redirect hop and redacts its query', () => {
    expect.assertions(3);
    const secret = 'redirect-secret=1';
    expect(() => remoteMaterialise(`${server.origin}/http-hop.yaml?${secret}`)).toThrow(/https/);
    try {
      remoteMaterialise(`${server.origin}/http-hop.yaml?${secret}`);
    } catch (error) {
      expect(String(error)).not.toContain(secret);
      expect(String(error)).toContain('http://localhost:');
    }
  }, 60_000);

  it('[WP10] aborts a slow response at the 30 second timeout', () => {
    expect(() => remoteMaterialise(`${server.origin}/slow.yaml`)).toThrow(/timeout/);
    expect(parserSpy).not.toHaveBeenCalled();
  }, 45_000);

  it('[WP10] rejects a response over 10 MB before parsing it', () => {
    expect(MAX_SPEC_BYTES).toBe(10 * 1024 * 1024);
    expect(() => remoteMaterialise(`${server.origin}/oversize.yaml`)).toThrow(/10 MB/);
    expect(parserSpy).not.toHaveBeenCalled();
  }, 60_000);

  it('[WP10] static validation rejects HTTP and userinfo without a request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(() => remoteMaterialise('http://localhost/api.yaml')).toThrow(/https/);
    expect(() => remoteMaterialise('https://user:pass@localhost/api.yaml')).toThrow(/userinfo/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await server.requests()).toEqual([]);
    fetchSpy.mockRestore();
  });

  it('[WP10] offline cold makes zero requests and fails closed with the cache path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(() => remoteMaterialise(`${server.origin}/api.yaml`, PIN, true)).toThrow(
      new RegExp(`offline[\\s\\S]*${cacheDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await server.requests()).toEqual([]);
    expect(parserSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('[WP10] offline warm makes zero requests and returns byte-identical output', async () => {
    const online = remoteMaterialise(`${server.origin}/api.yaml`);
    await server.clearRequests();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    process.env.DOCKITTY_OFFLINE = '1';
    const options = normaliseOpenApiOptions(
      { renderer, specs: [{ url: `${server.origin}/api.yaml`, sha256: PIN, label: 'v1', released: true }] },
      { siteRoot: site },
    );
    const offline = materialise.materialiseOpenApiSpecs(options, { siteRoot: site, offline: options.offline, cacheDir });
    expect(options.offline).toBe(true);
    expect(offline[0]!.bytes.equals(online[0]!.bytes)).toBe(true);
    expect(offline[0]!.sha256).toBe(online[0]!.sha256);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await server.requests()).toEqual([]);
    fetchSpy.mockRestore();
  }, 60_000);

  it('[WP10] resolves a cache hit through a symlinked cache dir to the real entry path', async () => {
    // The write path (writeCacheAtomic) returns the entry's realpath; a cache
    // hit used to return the path as configured, through any symlinked cache
    // dir, so warm and cold runs disagreed on renderPath. No fetch may happen.
    const cold = remoteMaterialise(`${server.origin}/api.yaml`);
    const link = path.join(site, 'cache-link');
    symlinkSync(cacheDir, link);
    try {
      await server.clearRequests();
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const warm = materialise.materialiseOpenApiSpecs(
        normaliseOpenApiOptions(
          { renderer, specs: [{ url: `${server.origin}/api.yaml`, sha256: PIN, label: 'v1', released: true }] },
          { siteRoot: site },
        ),
        { siteRoot: site, offline: false, cacheDir: link },
      );
      expect(warm[0]!.renderPath).toBe(cold[0]!.renderPath);
      expect(warm[0]!.renderPath.startsWith(link)).toBe(false);
      expect(await server.requests()).toEqual([]);
      fetchSpy.mockRestore();
    } finally {
      rmSync(link, { force: true });
    }
  }, 60_000);

  it('[WP10] online refetches a corrupted cache and offline fails closed on it', async () => {
    const online = remoteMaterialise(`${server.origin}/api.yaml`);
    const target = path.join(cacheDir, `${PIN}.yaml`);
    writeFileSync(target, 'tampered');
    await server.clearRequests();
    const repaired = remoteMaterialise(`${server.origin}/api.yaml`);
    expect(repaired[0]!.bytes.equals(online[0]!.bytes)).toBe(true);
    expect(await server.requests()).toHaveLength(1);

    writeFileSync(target, 'tampered-again');
    await server.clearRequests();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(() => remoteMaterialise(`${server.origin}/api.yaml`, PIN, true)).toThrow(/offline/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await server.requests()).toEqual([]);
    fetchSpy.mockRestore();
  }, 60_000);

  it('[WP10] reports HTTP failures without leaking the URL query', () => {
    expect.assertions(4);
    const secret = 'api-key=do-not-print';
    try {
      remoteMaterialise(`${server.origin}/missing.yaml?${secret}`);
      expect.unreachable('the 404 must fail');
    } catch (error) {
      expect(String(error)).toContain('[dk-openapi] specs[0] "v1"');
      expect(String(error)).toContain('404');
      expect(String(error)).toContain('?…');
      expect(String(error)).not.toContain(secret);
    }
  }, 60_000);

  it('[WP10] redacts a query that arrives through a redirect Location header', () => {
    expect.assertions(3);
    const secret = 'redirect-secret=1';
    try {
      remoteMaterialise(`${server.origin}/redirect-query.yaml`);
      expect.unreachable('the redirect target is a 404');
    } catch (error) {
      expect(String(error)).toContain('404');
      expect(String(error)).toContain('?…');
      expect(String(error)).not.toContain(secret);
    }
  }, 60_000);

  it('[WP10] rejects a lying content-length header before reading the body', () => {
    expect(() => remoteMaterialise(`${server.origin}/content-length-lie.yaml`)).toThrow(/10 MB limit/);
    expect(parserSpy).not.toHaveBeenCalled();
  }, 60_000);
});
