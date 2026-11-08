/**
 * The version switcher (mission openapi-second-slice-01M6WXJ4, WP07; FR-017,
 * SC-003; renderer slug coupling C-007).
 *
 * Red-first: every case is titled `[WP07] …` and was written before the
 * implementation. Against the overview-only nav of WP03 they fail because the
 * nav links overviews only — the stated red reason — and the red output is
 * recorded in the first commit's message.
 *
 * Two levels:
 *
 *  - unit: `switcherEntries`/`switcherPublication` over constructed navs and
 *    publications — the mapping table (deep link, fallback, the renderer's
 *    duplicate-operationId suffix, the dotted-label slug rule, the base prefix);
 *  - build: real `astro build`s through `helpers/openapi-build.ts`, pinning that
 *    the BUILT pages carry those hrefs and that every href target exists in the
 *    dist. A mapping that names a page the renderer never built is a broken
 *    switcher, not a switcher, so each deep-link case also reads the target.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DK_OPENAPI_ENV } from '../lib/internal-env.mjs';
import type { OpenApiNav, OpenApiNavVersion } from '../lib/openapi/adapters.js';
import type { Operation } from '../lib/openapi/operations.mjs';
import type { OpenApiPublication, OpenApiPublicationVersion } from '../lib/openapi/publication.js';
import { switcherEntries, switcherPublication } from '../lib/openapi/switcher.js';
import { buildOpenApiFixture, readAll, removeOpenApiFixtureBuilds } from './helpers/openapi-build';

/** One operation, as the publication handoff carries it (the renderer's slug). */
const op = (slug: string): Operation => ({ method: 'GET', path: '/parcels', summary: 'List parcels', operationId: 'listParcels', slug });

/** A publication of `reference/api/<label>` versions over the given operations. */
function publicationOf(versions: Array<{ label: string; released?: boolean; operations?: Operation[] }>): OpenApiPublication {
  const version = ({ label, released = true, operations = [] }: { label: string; released?: boolean; operations?: Operation[] }): OpenApiPublicationVersion => ({
    label,
    released,
    ext: 'yaml',
    sha256: '0'.repeat(64),
    title: 'Parcels API',
    apiVersion: '1.0.0',
    operations,
    rawRoute: `/reference/api/${label}/openapi.yaml`,
  });
  return { section: 'reference/api', llmsOperations: false, versions: versions.map(version) };
}

/** The nav the route middleware hands the page chrome. */
function navOf(current: string, operationSlug?: string, labels: string[] = ['v1', 'v2']): OpenApiNav {
  const versions: OpenApiNavVersion[] = labels.map((label) => ({ label, released: label !== 'v2', route: `/reference/api/${label}/` }));
  const now = versions.find((version) => version.label === current) ?? versions[0]!;
  return { current: operationSlug === undefined ? now : { ...now, operationSlug }, versions };
}

/**
 * The rendered `OpenApiVersionNav` fragment of a built reference page. The page's
 * SIDEBAR also links other versions' operation pages, so a switcher assertion
 * must read this fragment, never the whole page (a vacuous pass otherwise).
 */
function versionNavOf(files: Map<string, Buffer>, key: string): string {
  const bytes = files.get(key);
  expect(bytes, `${key} exists in the built dist`).toBeDefined();
  const html = (bytes ?? Buffer.alloc(0)).toString('utf8');
  const start = html.indexOf('<div class="dk-openapi-nav"');
  expect(start, `the version nav is rendered in ${key}`).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf('</div>', start));
}

describe('openapi version switcher (mission openapi-second-slice-01M6WXJ4, WP07)', () => {
  describe('switcherEntries: the same-operation mapping (FR-017, SC-003)', () => {
    it('[WP07] maps the current operation onto the target version that has it', () => {
      const entries = switcherEntries(
        navOf('v1', 'listparcels'),
        publicationOf([{ label: 'v1', operations: [op('operations/listparcels')] }, { label: 'v2', released: false, operations: [op('operations/listparcels')] }]),
      );
      expect(entries).toHaveLength(2);
      expect(entries[1]).toMatchObject({ label: 'v2', released: false, current: false });
      expect(entries[1]!.href).toBe('/reference/api/v2/operations/listparcels/');
    });

    it('[WP07] falls back to the target version\'s overview when the operation is missing there', () => {
      const entries = switcherEntries(
        navOf('v1', 'deleteparcel'),
        publicationOf([{ label: 'v1', operations: [op('operations/deleteparcel')] }, { label: 'v2', released: false, operations: [op('operations/listparcels')] }]),
      );
      expect(entries[1]!.href).toBe('/reference/api/v2/');
    });

    it('[WP07] matches the renderer\'s duplicate-operationId suffix exactly', () => {
      const publication = publicationOf([
        { label: 'v1', operations: [op('operations/parcel/get'), op('operations/parcel/post')] },
        { label: 'v2', released: false, operations: [op('operations/parcel/get'), op('operations/parcel/post')] },
      ]);
      // The suffixed slug deep-links…
      expect(switcherEntries(navOf('v1', 'parcel/get'), publication)[1]!.href).toBe('/reference/api/v2/operations/parcel/get/');
      // …and never matches the bare id the renderer did not route.
      expect(switcherEntries(navOf('v1', 'parcel'), publication)[1]!.href).toBe('/reference/api/v2/');
    });

    it('[WP07] slugifies each base segment like the renderer, dots included (C-007)', () => {
      const entries = switcherEntries(
        navOf('v1', 'listparcels', ['v1', 'v1.1']),
        publicationOf([{ label: 'v1', operations: [op('operations/listparcels')] }, { label: 'v1.1', released: false, operations: [op('operations/listparcels')] }]),
      );
      expect(entries[1]!.href).toBe('/reference/api/v11/operations/listparcels/');
    });

    it('[WP07] links every version\'s overview from a version overview (no operation slug)', () => {
      const entries = switcherEntries(
        navOf('v1'),
        publicationOf([{ label: 'v1', operations: [op('operations/listparcels')] }, { label: 'v2', released: false, operations: [op('operations/listparcels')] }]),
      );
      expect(entries.map((entry) => entry.href)).toEqual(['/reference/api/v1/', '/reference/api/v2/']);
    });

    it('[WP07] marks the current version and flattens its label (FR-028)', () => {
      const entries = switcherEntries(
        navOf('v1\nbeta', undefined, ['v1\nbeta', 'v2']),
        publicationOf([{ label: 'v1\nbeta', operations: [] }, { label: 'v2', released: false, operations: [] }]),
      );
      expect(entries[0]).toMatchObject({ label: 'v1 beta', current: true, released: true });
      expect(entries[1]).toMatchObject({ label: 'v2', current: false, released: false });
    });

    it('[WP07] throws [dk-openapi] naming the version the publication does not list', () => {
      expect(() => switcherEntries(navOf('v1', undefined, ['v1', 'v3']), publicationOf([{ label: 'v1' }, { label: 'v2' }]))).toThrow(
        /\[dk-openapi\].*v3/s,
      );
    });
  });

  describe('switcherPublication: the DK_OPENAPI handoff', () => {
    const previous = process.env[DK_OPENAPI_ENV];

    afterEach(() => {
      if (previous === undefined) delete process.env[DK_OPENAPI_ENV];
      else process.env[DK_OPENAPI_ENV] = previous;
    });

    it('[WP07] throws [dk-openapi] when the handoff is absent', () => {
      delete process.env[DK_OPENAPI_ENV];
      expect(() => switcherPublication()).toThrow(/\[dk-openapi\]/);
    });

    it('[WP07] throws [dk-openapi] when the handoff is malformed', () => {
      process.env[DK_OPENAPI_ENV] = 'not json';
      expect(() => switcherPublication()).toThrow(/\[dk-openapi\]/);
    });

    it('[WP07] returns the parsed publication when the handoff is present', () => {
      process.env[DK_OPENAPI_ENV] = JSON.stringify(publicationOf([{ label: 'v1' }, { label: 'v2', released: false }]));
      expect(switcherPublication().versions.map((version) => version.label)).toEqual(['v1', 'v2']);
    });
  });

  describe('built pages: two versions (FR-017, SC-003)', () => {
    let files: Map<string, Buffer>;

    beforeAll(() => {
      const built = buildOpenApiFixture(
        {
          fixture: 'two-versions',
          openapi: {
            specs: [
              { path: 'openapi/v1.yaml', label: 'v1', released: true },
              { path: 'openapi/v2.yaml', label: 'v2', released: false },
            ],
          },
        },
        'switcher',
      );
      expect(built.status, `astro build output:\n${built.output}`).toBe(0);
      files = readAll(built.dist);
    }, 600_000);

    /** The rendered `OpenApiVersionNav` fragment of a built reference page. */
    const versionNav = (key: string): string => versionNavOf(files, key);

    it('[WP07] an operation present in both versions deep-links the same operation', () => {
      expect(versionNav('reference/api/v1/operations/listparcels/index.html')).toContain('href="/reference/api/v2/operations/listparcels/"');
      expect(files.has('reference/api/v2/operations/listparcels/index.html'), 'the deep link names a page the renderer built').toBe(true);
    });

    it('[WP07] an operation missing in the target version links its overview', () => {
      const nav = versionNav('reference/api/v1/operations/deleteparcel/index.html');
      expect(nav).toContain('href="/reference/api/v2/"');
      expect(nav).not.toContain('href="/reference/api/v2/operations/deleteparcel/"');
    });

    it('[WP07] the switcher is a native, closed disclosure of plain links', () => {
      const nav = versionNav('reference/api/v1/operations/listparcels/index.html');
      // The native control: a <details> that starts closed, with a <summary>…
      expect(nav).toMatch(/<details id="[^"]+"/);
      expect(nav).not.toContain(' open');
      expect(nav).toContain('<summary>API versions (2)</summary>');
      // …plain links inside a nav list…
      expect(nav).toContain('<a href="/reference/api/v2/operations/listparcels/">v2</a>');
      // …the current version marked in text, not linked…
      expect(nav).toContain('<span aria-current="true">v1</span>');
      expect(nav).not.toContain('">v1</a>');
      // …the unreleased version badged in text next to its link…
      expect(nav).toContain('unreleased');
      // …and no script of its own (no new CSP hash).
      expect(nav).not.toContain('<script');
    });

    it('[WP07] the unreleased version\'s own page keeps the text badge on the current version', () => {
      const nav = versionNav('reference/api/v2/index.html');
      expect(nav).toMatch(/dk-openapi-nav__current[\s\S]*?unreleased/);
      expect(nav).toContain('href="/reference/api/v1/"');
    });
  });

  describe('built pages: the duplicate-operationId suffix (C-007)', () => {
    let files: Map<string, Buffer>;

    beforeAll(() => {
      // One path, two methods sharing one operationId: the renderer routes both
      // under `operations/<id>/<method>`, and so must the switcher.
      const duplicate = `openapi: 3.1.0
info:
  title: Parcels API
  version: 1.0.0
paths:
  /parcels:
    get:
      operationId: parcel
      summary: Read or write the parcel set
      responses:
        '200':
          description: The parcels.
    post:
      operationId: parcel
      summary: Read or write the parcel set
      responses:
        '201':
          description: The parcel was created.
`;
      const built = buildOpenApiFixture(
        {
          fixture: 'two-versions',
          openapi: {
            specs: [
              { path: 'openapi/v1.yaml', label: 'v1', released: true },
              { path: 'openapi/v2.yaml', label: 'v2', released: false },
            ],
          },
          files: { 'openapi/v1.yaml': duplicate, 'openapi/v2.yaml': duplicate },
        },
        'switcher-duplicates',
      );
      expect(built.status, `astro build output:\n${built.output}`).toBe(0);
      files = readAll(built.dist);
    }, 600_000);

    it('[WP07] the suffixed slug deep-links the same method', () => {
      const nav = versionNavOf(files, 'reference/api/v1/operations/parcel/get/index.html');
      expect(nav).toContain('href="/reference/api/v2/operations/parcel/get/"');
      expect(files.has('reference/api/v2/operations/parcel/get/index.html'), 'the deep link names a page the renderer built').toBe(true);
    });
  });

  describe('built pages: two versions and a site base (#61, C-002)', () => {
    let files: Map<string, Buffer>;

    beforeAll(() => {
      // A dotted label is refused at the option gate (ADR-0078), so the dot
      // slugification this build used to exercise is covered by the unit case
      // above; this build keeps the based-site coverage: every href goes
      // through `withBase` (#61, C-002).
      const built = buildOpenApiFixture(
        {
          fixture: 'two-versions',
          openapi: {
            specs: [
              { path: 'openapi/v1.yaml', label: 'v1', released: true },
              { path: 'openapi/v2.yaml', label: 'v2', released: false },
            ],
          },
          options: { base: '/site' },
        },
        'switcher-based',
      );
      expect(built.status, `astro build output:\n${built.output}`).toBe(0);
      files = readAll(built.dist);
    }, 600_000);

    it('[WP07] a based build deep-links the same operation through the base', () => {
      const nav = versionNavOf(files, 'reference/api/v1/operations/listparcels/index.html');
      expect(nav).toContain('href="/site/reference/api/v2/operations/listparcels/"');
      expect(files.has('reference/api/v2/operations/listparcels/index.html'), 'the deep link names a page the renderer built').toBe(true);
    });

    it('[WP07] a based build links the other overview through the base', () => {
      const nav = versionNavOf(files, 'reference/api/v1/index.html');
      expect(nav).toContain('href="/site/reference/api/v2/"');
      expect(files.has('reference/api/v2/index.html'), 'the other version\'s overview is built').toBe(true);
    });
  });

  afterAll(() => {
    removeOpenApiFixtureBuilds();
  });
});
