/**
 * Raw documents in `astro dev` (mission openapi-second-slice-01M6WXJ4, WP04;
 * FR-016, FR-028, NFR-007).
 *
 * The dev handler is a Connect middleware registered through the WP02
 * `devHandlers` seam. It answers exactly the routes the publisher writes —
 * `/<base><section>/<label>/openapi.<ext>` and its `.sha256` sidecar — with the
 * config-time bytes in memory, so `astro dev` and a build serve the same file
 * (NFR-007). Everything else is left to the dev server:
 *
 *  - GET and HEAD only (405 with `Allow` otherwise, FR-028);
 *  - an exact allowlist after base-aware parsing, so no other file is reachable;
 *  - dot segments, `%2e`, encoded slashes and encoded backslashes are rejected
 *    outright (404), never resolved against the filesystem.
 *
 * The last case drives the real seam (`openApiPlugin`'s `devHandlers` push and
 * the WP01 fixture build), so the bytes are compared with what `astro build`
 * published rather than with a copy of them.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { openApiDevHandler } from '../lib/integrations/openapi-dev.js';
import { normaliseOpenApiOptions } from '../lib/openapi/options.mjs';
import { materialiseOpenApiSpecs } from '../lib/openapi/materialise.mjs';
import { openApiPlugin } from '../lib/openapi/adapters.js';
import type { MaterialisedSpec } from '../lib/openapi/materialise.mjs';
import {
  buildOpenApiFixture,
  readAll,
  removeOpenApiFixtureBuilds,
} from './helpers/openapi-build';

afterAll(() => {
  removeOpenApiFixtureBuilds();
});

const sha = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

/** One materialised version, as the publisher and the dev handler both see it. */
function spec(label: string, ext: string, contents: string | Buffer, released = true): MaterialisedSpec {
  const bytes = Buffer.from(contents);
  return {
    label,
    released,
    origin: 'file',
    ext,
    bytes,
    sha256: sha(bytes),
    renderPath: `/site/openapi/${label}.${ext}`,
    title: 'Parcels API',
    apiVersion: '1.0.0',
    operations: [],
  };
}

const SPEC_V1 = 'openapi: 3.1.0\r\ninfo: {title: Parcels API, version: "1.0.0"}\r\npaths: {}\r\n';
const SPEC_MAIN = '{"openapi":"3.1.0","info":{"title":"Parcels API","version":"2.0.0"},"paths":{}}';

/** What a dev request produced. */
interface Served {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  /** True when the middleware passed the request on instead of answering it. */
  next: boolean;
}

interface FakeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: Buffer | string): void;
}

type Middleware = (request: { method?: string; url?: string }, response: FakeResponse, next: () => void) => void;

/** A fake Vite dev server: captures the one middleware the handler registers. */
function harness(base: string, specs: MaterialisedSpec[] = [spec('v1', 'yaml', SPEC_V1)]) {
  const middlewares: Middleware[] = [];
  const server = {
    config: { base },
    middlewares: {
      use(handler: Middleware) {
        middlewares.push(handler);
      },
    },
  };
  openApiDevHandler({ section: 'reference/api', specs }, base)({ server });
  const middleware = middlewares[0];
  expect(middleware, 'the handler registered one middleware').toBeTypeOf('function');
  return {
    middlewares,
    call(method: string, url: string): Served {
      let next = false;
      const headers: Record<string, string> = {};
      let body: Buffer = Buffer.alloc(0);
      const response: FakeResponse = {
        statusCode: 200,
        setHeader(name: string, value: string | number) {
          headers[name.toLowerCase()] = String(value);
        },
        end(chunk?: Buffer | string) {
          if (chunk !== undefined) body = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        },
      };
      middleware({ method, url }, response, () => {
        next = true;
      });
      return { status: response.statusCode, headers, body, next };
    },
  };
}

describe('raw documents in astro dev (WP04)', () => {
  it('[WP04] serves the published raw document and its sha256 sidecar, byte for byte', () => {
    const dev = harness('/');
    const raw = dev.call('GET', '/reference/api/v1/openapi.yaml');
    expect(raw.next).toBe(false);
    expect(raw.status).toBe(200);
    expect(raw.body.equals(Buffer.from(SPEC_V1))).toBe(true);
    expect(raw.headers['content-type']).toBe('text/yaml; charset=utf-8');

    const sidecar = dev.call('GET', '/reference/api/v1/openapi.yaml.sha256');
    expect(sidecar.status).toBe(200);
    expect(sidecar.body.toString('utf8')).toBe(`${sha(Buffer.from(SPEC_V1))}  openapi.yaml\n`);
    expect(sidecar.headers['content-type']).toBe('text/plain; charset=utf-8');
  });

  it('[WP04] HEAD carries the headers and the length but no body', () => {
    const dev = harness('/');
    const head = dev.call('HEAD', '/reference/api/v1/openapi.yaml');
    expect(head.status).toBe(200);
    expect(head.body).toHaveLength(0);
    expect(head.headers['content-length']).toBe(String(Buffer.byteLength(SPEC_V1)));
    expect(head.headers['content-type']).toBe('text/yaml; charset=utf-8');
  });

  it('[WP04] GET and HEAD only: anything else on an allowed route is 405 with Allow', () => {
    const dev = harness('/');
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
      const answer = dev.call(method, '/reference/api/v1/openapi.yaml');
      expect(answer.status, method).toBe(405);
      expect(answer.headers.allow, method).toBe('GET, HEAD');
      expect(answer.next, method).toBe(false);
    }
    expect(dev.call('get', '/reference/api/v1/openapi.yaml').status).toBe(200);
  });

  it('[WP04] parses the base both ways: prefixed and already stripped by the dev server', () => {
    const dev = harness('/consumer-fixture/');
    for (const url of [
      '/consumer-fixture/reference/api/v1/openapi.yaml',
      '/reference/api/v1/openapi.yaml',
    ]) {
      const answer = dev.call('GET', url);
      expect(answer.status, url).toBe(200);
      expect(answer.body.equals(Buffer.from(SPEC_V1)), url).toBe(true);
    }
    // Another base is not this site's route.
    expect(dev.call('GET', '/other/reference/api/v1/openapi.yaml').next).toBe(true);
    expect(dev.call('GET', '/consumer-fixtures/reference/api/v1/openapi.yaml').next).toBe(true);
  });

  it('[WP04] is an exact allowlist: no other path under the section is served', () => {
    const dev = harness('/', [spec('v1', 'yaml', SPEC_V1), spec('main', 'json', SPEC_MAIN, false)]);
    expect(dev.call('GET', '/reference/api/v1/openapi.json').next).toBe(true);
    expect(dev.call('GET', '/reference/api/v1/other.yaml').next).toBe(true);
    expect(dev.call('GET', '/reference/api/v1/openapi.yaml.bak').next).toBe(true);
    expect(dev.call('GET', '/reference/api/v9/openapi.yaml').next).toBe(true);
    expect(dev.call('GET', '/guides/').next).toBe(true);
    const main = dev.call('GET', '/reference/api/main/openapi.json');
    expect(main.status).toBe(200);
    expect(main.body.toString('utf8')).toBe(SPEC_MAIN);
    expect(main.headers['content-type']).toBe('application/json; charset=utf-8');
  });

  it('[WP04] rejects dot segments, %2e, encoded slashes and encoded backslashes', () => {
    const dev = harness('/consumer-fixture/');
    const attempts = [
      '/reference/api/v1/../v1/openapi.yaml',
      '/reference/api/v1/./openapi.yaml',
      '/consumer-fixture/reference/api/../api/v1/openapi.yaml',
      '/reference/api/v1/%2e%2e/v1/openapi.yaml',
      '/reference/api/v1/%2E%2E/openapi.yaml',
      '/reference/api/v1/openapi.yaml%2f..%2fsecret',
      '/reference/api/v1%5c..%5csecret',
      '/reference/api/v1/openapi.yaml%00',
      '/reference/api/v1/%252e%252e/openapi.yaml',
      '/reference/api/v1/%zz',
    ];
    for (const url of attempts) {
      const answer = dev.call('GET', url);
      expect(answer.status, url).toBe(404);
      expect(answer.next, url).toBe(false);
      expect(answer.body.length, url).toBe(0);
    }
    // Malformed encoding outside this middleware's namespace is passed on.
    expect(dev.call('GET', '/guides/%zz').next).toBe(true);
    // A traversal-looking request outside the namespace is not this middleware's to refuse.
    for (const url of ['/guides/a%2Fb/', '/guides/../x/', '/consumer-fixture/guides/a%5Cb/']) {
      expect(dev.call('GET', url).next, url).toBe(true);
    }
    // A traversal attempt is refused on any method, not answered as 405.
    expect(dev.call('POST', '/reference/api/v1/%2e%2e/openapi.yaml').status).toBe(404);
  });

  it('[WP04] the WP02 seam registers it for dev only, with the Astro base', () => {
    const specs = [spec('v1', 'yaml', SPEC_V1)];
    const option = {
      renderer: () => ({ name: 'starlight-openapi-plugin', hooks: {} }),
      section: 'reference/api',
      specs: [],
      archive: undefined,
      llmsOperations: false,
      offline: true,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugin = openApiPlugin(option as any, specs) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const integrations: any[] = [];
    plugin.hooks['config:setup']({
      command: 'dev',
      addIntegration: (integration: unknown) => integrations.push(integration),
      addRouteMiddleware: () => {},
    });
    const hooks = integrations[0].hooks;

    const buildMiddlewares: Middleware[] = [];
    hooks['astro:config:setup']({
      command: 'build',
      config: { base: '/consumer-fixture/' },
      updateConfig: vi.fn(),
    });
    hooks['astro:server:setup']({
      server: { middlewares: { use: (handler: Middleware) => buildMiddlewares.push(handler) } },
    });
    expect(buildMiddlewares, 'a build registers no dev middleware').toEqual([]);

    const devMiddlewares: Middleware[] = [];
    hooks['astro:config:setup']({
      command: 'dev',
      config: { base: '/consumer-fixture/' },
      updateConfig: vi.fn(),
    });
    hooks['astro:server:setup']({
      server: { middlewares: { use: (handler: Middleware) => devMiddlewares.push(handler) } },
    });
    expect(devMiddlewares).toHaveLength(1);
    let next = false;
    const headers: Record<string, string> = {};
    let body: Buffer = Buffer.alloc(0);
    const response = {
      statusCode: 200,
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
      end: (chunk?: Buffer) => {
        if (chunk !== undefined) body = chunk;
      },
    };
    devMiddlewares[0]({ method: 'GET', url: '/consumer-fixture/reference/api/v1/openapi.yaml' }, response, () => {
      next = true;
    });
    expect(next).toBe(false);
    expect(response.statusCode).toBe(200);
    expect(body.equals(Buffer.from(SPEC_V1))).toBe(true);
  });
});

describe('dev bytes equal the build\'s published bytes (WP04, NFR-007)', () => {
  /** Materialise the same fixture the build read, through the real config-time path. */
  function materialised(root: string, openapi: Record<string, unknown>): MaterialisedSpec[] {
    const normalised = normaliseOpenApiOptions(
      { renderer: () => ({}), ...openapi },
      { siteRoot: root },
    );
    return materialiseOpenApiSpecs(normalised, {
      siteRoot: root,
      offline: true,
      cacheDir: path.join(root, 'node_modules/.cache/doc-kitty/openapi'),
    });
  }

  const OPENAPI = {
    llmsOperations: true,
    specs: [
      { path: 'openapi/v1.yaml', label: 'v1', released: true },
      { path: 'openapi/v2.yaml', label: 'v2', released: false },
    ],
  };

  for (const base of ['/', '/consumer-fixture']) {
    it(`[WP04] dev on ${base === '/' ? 'the root' : `the base ${base}`} serves exactly what the build wrote`, () => {
      const build = buildOpenApiFixture(
        { fixture: 'two-versions', openapi: OPENAPI, options: base === '/' ? {} : { base } },
        `dev-bytes-${base.replaceAll('/', '-')}`,
      );
      expect(build.status, `astro build output:\n${build.output}`).toBe(0);
      const files = readAll(build.dist);
      const specs = materialised(build.root, OPENAPI);
      const dev = harness(base, specs);
      for (const label of ['v1', 'v2']) {
        const raw = files.get(`reference/api/${label}/openapi.yaml`);
        const sidecar = files.get(`reference/api/${label}/openapi.yaml.sha256`);
        expect(raw, `${label} raw document in the build`).toBeDefined();
        expect(sidecar, `${label} sidecar in the build`).toBeDefined();
        const servedRaw = dev.call('GET', `${base === '/' ? '' : base}/reference/api/${label}/openapi.yaml`);
        const servedSidecar = dev.call('GET', `${base === '/' ? '' : base}/reference/api/${label}/openapi.yaml.sha256`);
        expect(servedRaw.status).toBe(200);
        expect(servedRaw.body.equals(raw!)).toBe(true);
        expect(servedSidecar.status).toBe(200);
        expect(servedSidecar.body.equals(sidecar!)).toBe(true);
      }
    }, 600_000);
  }
});
