/**
 * The synthetic agent entries (mission openapi-second-slice-01M6WXJ4, WP03):
 * one index record and one page artifact per OpenAPI spec version, appended
 * after the docs records (contracts/synthetic-entry.md).
 *
 * Two kinds of cases:
 *
 *  - Build-based: real `astro build`s of the fixture sites through
 *    `helpers/openapi-build.ts` (tag `'wp03'`, so parallel suites never share a
 *    build root with the seam suite). The two-versions fixture pins the FULL
 *    record and payload objects; a `base: '/sub'` build pins the base-aware
 *    `rawDocumentUrl`; the zero-ops fixture pins the no-operation edge.
 *  - In-process route cases (mocked `astro:content`, like
 *    `agent-links-gating.test.ts`): default-off additivity — a site without the
 *    `openapi` option keeps its docs records byte-identical — plus the
 *    `getStaticPaths` additions and the unknown-label 404.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { restoreInternalEnv } from './helpers/restore-internal-env';
import { buildOpenApiFixture, readAll, removeOpenApiFixtureBuilds } from './helpers/openapi-build';
import { DK_OPENAPI_ENV } from '../lib/internal-env.mjs';
import type { OpenApiPublication } from '../lib/integrations/openapi-publish.js';

const { entries } = vi.hoisted(() => ({
  entries: [
    {
      id: 'index',
      body: 'Home body.',
      data: { title: 'Home', description: 'The home page.', doc_status: 'active', updated: '2026-11-01', kind: 'Guide' },
    },
    {
      id: 'guides',
      body: 'Guides body.',
      data: { title: 'Guides', description: 'The guides section.', doc_status: 'active', updated: '2026-11-01', kind: 'Guide' },
    },
  ] as Array<{ id: string; body: string; data: Record<string, unknown> }>,
}));

vi.mock('astro:content', () => ({
  getCollection: async () => entries,
}));

const { agentIndexRoute } = await import('../lib/routes/agent-index.js');
const { agentPageRoute } = await import('../lib/routes/agent-page.js');

restoreInternalEnv();

const SITE = new URL('https://docs.example.test/');
type Ctx = { site: URL };

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

function text(files: Map<string, Buffer>, key: string): string {
  const bytes = files.get(key);
  expect(bytes, `${key} exists in the built dist`).toBeDefined();
  return (bytes ?? Buffer.alloc(0)).toString('utf8');
}

function json<T>(files: Map<string, Buffer>, key: string): T {
  return JSON.parse(text(files, key)) as T;
}

/** The two-version build request: v1 released, v2 unreleased. */
const TWO_VERSIONS = {
  fixture: 'two-versions',
  openapi: {
    specs: [
      { path: 'openapi/v1.yaml', label: 'v1', released: true },
      { path: 'openapi/v2.yaml', label: 'v2', released: false },
    ],
  },
};

describe('openapi agent entries (mission openapi-second-slice-01M6WXJ4, WP03)', () => {
  describe('the built two-versions site', () => {
    let files: Map<string, Buffer>;
    let v1Sha: string;
    let v2Sha: string;

    beforeAll(() => {
      const built = buildOpenApiFixture(TWO_VERSIONS, 'wp03');
      expect(built.status, `astro build output:\n${built.output}`).toBe(0);
      files = readAll(built.dist);
      v1Sha = sha256(files.get('reference/api/v1/openapi.yaml')!);
      v2Sha = sha256(files.get('reference/api/v2/openapi.yaml')!);
    }, 600_000);

    afterAll(() => {
      removeOpenApiFixtureBuilds();
    });

    it('[WP03] appends one synthetic entry per version after the docs records', () => {
      const index = json<{ count: number; pages: Array<{ slug: string; tags?: string[] }> }>(files, 'api/index.json');
      // The fixture site's docs corpus is the root page and the guides section.
      expect(index.pages.map((entry) => entry.slug)).toEqual(['', 'guides', 'reference/api/v1', 'reference/api/v2']);
      expect(index.count).toBe(4);
    });

    it('[WP03] the v1 index record equals the full contract record', () => {
      const index = json<{ pages: Array<Record<string, unknown>> }>(files, 'api/index.json');
      expect(index.pages[2]).toEqual({
        slug: 'reference/api/v1',
        route: '/reference/api/v1/',
        section: 'reference',
        title: 'Parcels API v1',
        description: 'OpenAPI 1.0.0 contract, 2 operations',
        type: 'reference',
        doc_status: 'active',
        kind: 'Reference',
        tags: ['openapi'],
        related: [],
        priority: 0.5,
        updated: null,
        released: true,
        rawDocumentUrl: '/reference/api/v1/openapi.yaml',
        sha256: v1Sha,
        audience: [],
        url: 'https://docs.example.test/reference/api/v1/',
        source: 'https://docs.example.test/api/pages/reference/api/v1.json',
        _links: {
          self: { href: 'https://docs.example.test/api/pages/reference/api/v1.json' },
          html: { href: 'https://docs.example.test/reference/api/v1/' },
          related: [],
        },
      });
    });

    it('[WP03] the v2 index record equals the full contract record (unreleased)', () => {
      const index = json<{ pages: Array<Record<string, unknown>> }>(files, 'api/index.json');
      expect(index.pages[3]).toEqual({
        slug: 'reference/api/v2',
        route: '/reference/api/v2/',
        section: 'reference',
        title: 'Parcels API v2 (unreleased)',
        description: 'OpenAPI 2.0.0-dev contract, 2 operations',
        type: 'reference',
        doc_status: 'active',
        kind: 'Reference',
        tags: ['openapi'],
        related: [],
        priority: 0.5,
        updated: null,
        released: false,
        rawDocumentUrl: '/reference/api/v2/openapi.yaml',
        sha256: v2Sha,
        audience: [],
        url: 'https://docs.example.test/reference/api/v2/',
        source: 'https://docs.example.test/api/pages/reference/api/v2.json',
        _links: {
          self: { href: 'https://docs.example.test/api/pages/reference/api/v2.json' },
          html: { href: 'https://docs.example.test/reference/api/v2/' },
          related: [],
        },
      });
    });

    it('[WP03] the v1 page payload equals the full contract payload', () => {
      const index = json<{ buildId: string }>(files, 'api/index.json');
      const page = json<Record<string, unknown>>(files, 'api/pages/reference/api/v1.json');
      expect(page).toEqual({
        slug: 'reference/api/v1',
        route: '/reference/api/v1/',
        section: 'reference',
        title: 'Parcels API v1',
        description: 'OpenAPI 1.0.0 contract, 2 operations',
        type: 'reference',
        doc_status: 'active',
        kind: 'Reference',
        tags: ['openapi'],
        related: [],
        priority: 0.5,
        updated: null,
        released: true,
        rawDocumentUrl: '/reference/api/v1/openapi.yaml',
        sha256: v1Sha,
        source: 'https://docs.example.test/api/pages/reference/api/v1.json',
        audience: [],
        url: 'https://docs.example.test/reference/api/v1/',
        authors: [],
        keywords: ['Delete a parcel', 'List parcels'],
        markdown:
          `# Parcels API v1\n` +
          `\n` +
          `- Released: yes\n` +
          `- API version: 1.0.0\n` +
          `- Raw document: /reference/api/v1/openapi.yaml\n` +
          `- sha256: ${v1Sha}\n` +
          `\n` +
          `## Operations\n` +
          `\n` +
          `- GET /parcels: List parcels\n` +
          `- DELETE /parcels/{parcelId}: Delete a parcel\n`,
        buildId: index.buildId,
        _links: {
          self: { href: 'https://docs.example.test/api/pages/reference/api/v1.json' },
          up: { href: 'https://docs.example.test/api/index.json' },
          html: { href: 'https://docs.example.test/reference/api/v1/' },
          related: [],
          describedby: { href: '/reference/api/v1/openapi.yaml' },
        },
      });
    });

    it('[WP03] the v2 page payload: unreleased, its own operations, the same buildId', () => {
      const index = json<{ buildId: string }>(files, 'api/index.json');
      const page = json<{
        title: string;
        released: boolean;
        keywords: string[];
        markdown: string;
        buildId: string;
        rawDocumentUrl: string;
      }>(files, 'api/pages/reference/api/v2.json');
      expect(page.title).toBe('Parcels API v2 (unreleased)');
      expect(page.released).toBe(false);
      expect(page.keywords).toEqual(['Get a parcel', 'List parcels']);
      expect(page.markdown).toContain('- Released: no\n');
      expect(page.markdown).toContain('- GET /parcels/{parcelId}: Get a parcel\n');
      expect(page.rawDocumentUrl).toBe('/reference/api/v2/openapi.yaml');
      expect(page.buildId).toBe(index.buildId);
    });

    it('[WP03] the records describe the served raw bytes, not just the sidecar', () => {
      for (const label of ['v1', 'v2']) {
        const page = json<{ sha256: string }>(files, `api/pages/reference/api/${label}.json`);
        const sidecar = text(files, `reference/api/${label}/openapi.yaml.sha256`);
        expect(page.sha256).toBe(sidecar.slice(0, 64));
        expect(page.sha256).toBe(sha256(files.get(`reference/api/${label}/openapi.yaml`)!));
        expect(page.sha256).toMatch(/^[0-9a-f]{64}$/);
      }
    });
  });

  describe('a based site', () => {
    let files: Map<string, Buffer>;

    beforeAll(() => {
      const built = buildOpenApiFixture({ ...TWO_VERSIONS, options: { base: '/sub' } }, 'wp03');
      expect(built.status, `astro build output:\n${built.output}`).toBe(0);
      files = readAll(built.dist);
    }, 600_000);

    it('[WP03] rawDocumentUrl, url and source carry the base', () => {
      const index = json<{ pages: Array<{ slug: string; rawDocumentUrl: string; url: string; source: string }> }>(
        files,
        'api/index.json',
      );
      const v1 = index.pages.find((entry) => entry.slug === 'reference/api/v1')!;
      expect(v1, 'the v1 record exists').toBeDefined();
      expect(v1.rawDocumentUrl).toBe('/sub/reference/api/v1/openapi.yaml');
      expect(v1.url).toBe('https://docs.example.test/sub/reference/api/v1/');
      expect(v1.source).toBe('https://docs.example.test/sub/api/pages/reference/api/v1.json');
      const page = json<{ rawDocumentUrl: string; markdown: string; _links: { describedby: { href: string } } }>(
        files,
        'api/pages/reference/api/v1.json',
      );
      expect(page.rawDocumentUrl).toBe('/sub/reference/api/v1/openapi.yaml');
      expect(page._links.describedby.href).toBe('/sub/reference/api/v1/openapi.yaml');
      expect(page.markdown).toContain('- Raw document: /sub/reference/api/v1/openapi.yaml\n');
    });
  });

  describe('a zero-operation version', () => {
    let files: Map<string, Buffer>;

    beforeAll(() => {
      const built = buildOpenApiFixture({
        fixture: 'zero-ops',
        openapi: { specs: [{ path: 'openapi/api.yaml', label: 'v1', released: true }] },
      }, 'wp03');
      expect(built.status, `astro build output:\n${built.output}`).toBe(0);
      files = readAll(built.dist);
    }, 600_000);

    it('[WP03] still one entry, zero operations in the description, empty keywords', () => {
      const index = json<{ count: number; pages: Array<{ slug: string; tags?: string[]; description: string }> }>(
        files,
        'api/index.json',
      );
      const openApi = index.pages.filter((entry) => entry.tags?.includes('openapi'));
      expect(openApi.map((entry) => entry.slug)).toEqual(['reference/api/v1']);
      expect(openApi[0]!.description).toBe('OpenAPI 1.0.0 contract, 0 operations');
      expect(index.count).toBe(3);
      const page = json<{ title: string; keywords: string[]; markdown: string }>(
        files,
        'api/pages/reference/api/v1.json',
      );
      expect(page.title).toBe('Zero-operation API v1');
      expect(page.keywords).toEqual([]);
      expect(page.markdown.endsWith('## Operations\n')).toBe(true);
    });
  });

  describe('the routes in process', () => {
    /** A hand-shaped publication of the two fixture versions (values pre-digested). */
    const publication: OpenApiPublication = {
      section: 'reference/api',
      llmsOperations: false,
      versions: [
        {
          label: 'v1',
          released: true,
          ext: 'yaml',
          sha256: 'a'.repeat(64),
          title: 'Parcels API',
          apiVersion: '1.0.0',
          operations: [
            { method: 'GET', path: '/parcels', summary: 'List parcels', slug: 'listparcels' },
            { method: 'DELETE', path: '/parcels/{parcelId}', summary: 'Delete a parcel', slug: 'deleteparcel' },
          ],
          rawRoute: '/reference/api/v1/openapi.yaml',
        },
        {
          label: 'v2',
          released: false,
          ext: 'yaml',
          sha256: 'b'.repeat(64),
          title: 'Parcels API',
          apiVersion: '2.0.0-dev',
          operations: [
            { method: 'GET', path: '/parcels', summary: 'List parcels', slug: 'listparcels' },
            { method: 'GET', path: '/parcels/{parcelId}', summary: 'Get a parcel', slug: 'getparcel' },
          ],
          rawRoute: '/reference/api/v2/openapi.yaml',
        },
      ],
    };

    const indexDoc = async () =>
      JSON.parse(await (await (agentIndexRoute({ title: 'Docs' }) as (c: Ctx) => Promise<Response>)({ site: SITE })).text());

    it('[WP03] without the option, the index keeps exactly its docs records', async () => {
      delete process.env[DK_OPENAPI_ENV];
      const index = await indexDoc();
      expect(index.pages).toHaveLength(2);
      expect(JSON.stringify(index.pages)).not.toContain('openapi');
    });

    it('[WP03] with the option, the docs records are unchanged and the synthetic ones are appended', async () => {
      delete process.env[DK_OPENAPI_ENV];
      const docsRecords = (await indexDoc()).pages;
      process.env[DK_OPENAPI_ENV] = JSON.stringify(publication);
      const index = await indexDoc();
      expect(index.pages).toHaveLength(4);
      expect(index.pages.slice(0, 2)).toEqual(docsRecords);
      expect(index.count).toBe(4);
    });

    it('[WP03] the index record is exactly the contract record', async () => {
      process.env[DK_OPENAPI_ENV] = JSON.stringify(publication);
      const index = await indexDoc();
      expect(index.pages[2]).toEqual({
        slug: 'reference/api/v1',
        route: '/reference/api/v1/',
        section: 'reference',
        title: 'Parcels API v1',
        description: 'OpenAPI 1.0.0 contract, 2 operations',
        type: 'reference',
        doc_status: 'active',
        kind: 'Reference',
        tags: ['openapi'],
        related: [],
        priority: 0.5,
        updated: null,
        released: true,
        rawDocumentUrl: '/reference/api/v1/openapi.yaml',
        sha256: 'a'.repeat(64),
        audience: [],
        url: 'https://docs.example.test/reference/api/v1/',
        source: 'https://docs.example.test/api/pages/reference/api/v1.json',
        _links: {
          self: { href: 'https://docs.example.test/api/pages/reference/api/v1.json' },
          html: { href: 'https://docs.example.test/reference/api/v1/' },
          related: [],
        },
      });
    });

    it('[WP03] the page payload is exactly the contract payload', async () => {
      process.env[DK_OPENAPI_ENV] = JSON.stringify(publication);
      const index = await indexDoc();
      const { GET } = agentPageRoute();
      const res = await (GET as unknown as (c: { props: unknown; site: URL }) => Promise<Response>)({
        props: { openApi: 'v1' },
        site: SITE,
      });
      const page = JSON.parse(await res.text());
      expect(page).toEqual({
        slug: 'reference/api/v1',
        route: '/reference/api/v1/',
        section: 'reference',
        title: 'Parcels API v1',
        description: 'OpenAPI 1.0.0 contract, 2 operations',
        type: 'reference',
        doc_status: 'active',
        kind: 'Reference',
        tags: ['openapi'],
        related: [],
        priority: 0.5,
        updated: null,
        released: true,
        rawDocumentUrl: '/reference/api/v1/openapi.yaml',
        sha256: 'a'.repeat(64),
        source: 'https://docs.example.test/api/pages/reference/api/v1.json',
        audience: [],
        url: 'https://docs.example.test/reference/api/v1/',
        authors: [],
        keywords: ['Delete a parcel', 'List parcels'],
        markdown:
          `# Parcels API v1\n` +
          `\n` +
          `- Released: yes\n` +
          `- API version: 1.0.0\n` +
          `- Raw document: /reference/api/v1/openapi.yaml\n` +
          `- sha256: ${'a'.repeat(64)}\n` +
          `\n` +
          `## Operations\n` +
          `\n` +
          `- GET /parcels: List parcels\n` +
          `- DELETE /parcels/{parcelId}: Delete a parcel\n`,
        buildId: index.buildId,
        _links: {
          self: { href: 'https://docs.example.test/api/pages/reference/api/v1.json' },
          up: { href: 'https://docs.example.test/api/index.json' },
          html: { href: 'https://docs.example.test/reference/api/v1/' },
          related: [],
          describedby: { href: '/reference/api/v1/openapi.yaml' },
        },
      });
    });

    it('[WP03] getStaticPaths adds one path per version after the docs paths', async () => {
      process.env[DK_OPENAPI_ENV] = JSON.stringify(publication);
      const { getStaticPaths } = agentPageRoute();
      const getPaths = getStaticPaths as unknown as () => Promise<
        Array<{ params: { slug: string }; props: Record<string, unknown> }>
      >;
      const paths = await getPaths();
      expect(paths.map((entry) => entry.params.slug)).toEqual([
        'home',
        'guides',
        'reference/api/v1',
        'reference/api/v2',
      ]);
      expect(paths[2]).toEqual({
        params: { slug: 'reference/api/v1' },
        props: { id: '', body: '', openApi: 'v1' },
      });
    });

    it('[WP03] an unknown label is a 404', async () => {
      process.env[DK_OPENAPI_ENV] = JSON.stringify(publication);
      const { GET } = agentPageRoute();
      const res = await (GET as unknown as (c: { props: unknown; site: URL }) => Promise<Response>)({
        props: { openApi: 'nope' },
        site: SITE,
      });
      expect(res.status).toBe(404);
      expect(JSON.parse(await res.text())).toEqual({ error: 'not found' });
    });
  });
});
