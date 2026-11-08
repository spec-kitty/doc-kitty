/**
 * The OpenAPI test seam (mission openapi-second-slice-01M6WXJ4, WP01/T003).
 *
 * Two kinds of cases live here:
 *
 *  - Green today, and must stay green: the NFR-001 two-build byte identity of
 *    the surfaces this mission's later work packages change, the version
 *    switcher's already-true overview fallback, and the two rejected-input rows
 *    the current option already enforces (unparsable and missing file).
 *  - `it.fails`, titled `[WPnn] …`: behaviour a later work package lands. The
 *    flip inventory in `src/tests/fixtures/openapi/README.md` maps every title
 *    prefix to the work package that flips its own cases to `it`.
 *
 * Set `DK_SEAM_SHOW_RED=1` to run the red cases as ordinary `it`s and watch
 * each one fail for its stated reason (the red-first evidence); the default run
 * must be green.
 *
 * The builds are real `astro build`s of fixture sites through
 * `helpers/openapi-build.ts` (always rebuilt, removed in `afterAll`). The
 * rejected-input rows run in-process like `openapi-integration.test.ts`: no
 * build, a chdir'd throwaway site, and a renderer spy that must never be called
 * for an input the option rejects.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ops200Yaml } from './fixtures/openapi/ops-200/generate.mjs';
import { restoreInternalEnv } from './helpers/restore-internal-env';
import {
  buildOpenApiFixture,
  FIXTURES,
  readAll,
  removeOpenApiFixtureBuilds,
  twoBuilds,
} from './helpers/openapi-build';
import type { OpenApiOptions } from '../lib/openapi/options.mjs';

vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({
    name: '@astrojs/starlight',
    __starlightConfig: config,
    hooks: {},
  }),
}));

const { defineDocKittyIntegrations } = await import('../lib/config.js');

restoreInternalEnv();

/** The shared two-version build request: v1 released, v2 unreleased. */
const TWO_VERSIONS = {
  fixture: 'two-versions',
  openapi: {
    // Opted in so the [WP04] operation-line cases have something to flip.
    llmsOperations: true,
    specs: [
      { path: 'openapi/v1.yaml', label: 'v1', released: true },
      { path: 'openapi/v2.yaml', label: 'v2', released: false },
    ],
  },
};

/** The built agent index (`api/index.json`), as far as this suite reads it. */
interface AgentIndexDoc {
  pages: Array<{ slug?: string; title?: string; tags?: string[] }>;
}

/** The built page record (`api/pages/<section>/<label>.json`). */
interface AgentPageDoc {
  rawDocumentUrl?: string;
  sha256?: string;
  keywords?: string[];
}

/** The built content graph (`api/content-graph.json`). */
interface ContentGraphDoc {
  nodes: Array<{ id: string; kind?: string }>;
}

function text(files: Map<string, Buffer>, key: string): string {
  const bytes = files.get(key);
  expect(bytes, `${key} exists in the built dist`).toBeDefined();
  return (bytes ?? Buffer.alloc(0)).toString('utf8');
}

function json<T>(files: Map<string, Buffer>, key: string): T {
  return JSON.parse(text(files, key)) as T;
}

function openApiEntries(index: AgentIndexDoc): AgentIndexDoc['pages'] {
  return index.pages.filter((entry) => Array.isArray(entry.tags) && entry.tags.includes('openapi'));
}

/** The rendered `OpenApiVersionNav` fragment of a built reference page. */
function versionNav(html: string): string {
  const start = html.indexOf('<div class="dk-openapi-nav"');
  expect(start, 'the version nav is rendered').toBeGreaterThan(-1);
  return html.slice(start, html.indexOf('</div>', start));
}

describe('openapi seam (mission openapi-second-slice-01M6WXJ4, WP01)', () => {
  let pair: ReturnType<typeof twoBuilds>;

  beforeAll(() => {
    pair = twoBuilds(TWO_VERSIONS);
    for (const build of [pair.first, pair.second]) {
      expect(build.status, `astro build output:\n${build.output}`).toBe(0);
    }
  }, 600_000);

  afterAll(() => {
    removeOpenApiFixtureBuilds();
  });

  describe('two-build byte identity of today\'s outputs (NFR-001)', () => {
    // The surfaces this mission changes. Everything else in a dist (the
    // sitemap's lastmod, pagefind, hashed assets) may legitimately differ
    // between two builds; these must not.
    const SURFACES = /^(reference\/api\/|okf\/|llms\.txt$|api\/.*\.json$)/;

    it('builds more than ten surface files (positive control)', () => {
      const matched = [...pair.a.keys()].filter((key) => SURFACES.test(key));
      expect(matched.length).toBeGreaterThan(10);
    });

    it('every surface is byte-identical across two cold builds', () => {
      for (const [key, bytes] of pair.a) {
        if (!SURFACES.test(key)) continue;
        expect(pair.b.has(key), `${key} exists in the second build`).toBe(true);
        expect(pair.b.get(key)!.equals(bytes), `${key} is byte-identical`).toBe(true);
      }
    });
  });

  describe('agent index and page records', () => {
    it('[WP03] one synthetic agent-index entry per version, appended after the docs records', () => {
      const index = json<AgentIndexDoc>(pair.a, 'api/index.json');
      expect(openApiEntries(index).map((entry) => entry.slug)).toEqual(['reference/api/v1', 'reference/api/v2']);
      expect(openApiEntries(index).map((entry) => entry.title)).toEqual([
        'Parcels API v1',
        'Parcels API v2 (unreleased)',
      ]);
    });

    it('[WP03] a page record per version, with rawDocumentUrl and the served bytes\' sha256', () => {
      const page = json<AgentPageDoc>(pair.a, 'api/pages/reference/api/v1.json');
      expect(page.rawDocumentUrl).toBe('/reference/api/v1/openapi.yaml');
      const sidecar = text(pair.a, 'reference/api/v1/openapi.yaml.sha256');
      expect(page.sha256).toBe(sidecar.slice(0, 64));
      expect(page.sha256).toBe(createHash('sha256').update(pair.a.get('reference/api/v1/openapi.yaml')!).digest('hex'));
    });
  });

  describe('llms.txt operation lines', () => {
    it('[WP04] each version line lists its operations', () => {
      const llms = text(pair.a, 'llms.txt');
      expect(llms).toContain('  - GET /parcels: List parcels');
      expect(llms).toContain('  - DELETE /parcels/{parcelId}: Delete a parcel');
      expect(llms).toContain('  - GET /parcels/{parcelId}: Get a parcel');
    });
  });

  describe('the unreleased version stays unindexed', () => {
    it('[WP05] absent from the sitemap', () => {
      const urls = [...pair.a.keys()]
        .filter((key) => /^sitemap-.*\.xml$/.test(key))
        .map((key) => text(pair.a, key))
        .join('\n');
      expect(urls).not.toContain('/reference/api/v2/');
    });

    it('[WP05] absent from the pagefind search index', () => {
      expect(text(pair.a, 'reference/api/v2/index.html')).not.toContain('data-pagefind-body');
    });
  });

  describe('version switcher links', () => {
    it('an operation missing in the target version links its overview (already true today)', () => {
      const page = text(pair.a, 'reference/api/v1/operations/deleteparcel/index.html');
      expect(versionNav(page)).toContain('href="/reference/api/v2/"');
    });

    it('[WP07] an operation present in both versions deep-links the same operation', () => {
      const page = text(pair.a, 'reference/api/v1/operations/listparcels/index.html');
      expect(versionNav(page)).toContain('href="/reference/api/v2/operations/listparcels/"');
    });
  });

  describe('index growth equals versions, not operations', () => {
    let ops1: Map<string, Buffer>;
    let ops200: Map<string, Buffer>;

    beforeAll(() => {
      const openapi = { specs: [{ path: 'openapi/api.yaml', label: 'v1', released: true }] };
      const one = buildOpenApiFixture({ fixture: 'ops-1', openapi });
      expect(one.status, `ops-1 build output:\n${one.output}`).toBe(0);
      ops1 = readAll(one.dist);
      const many = buildOpenApiFixture({ fixture: 'ops-200', openapi, files: { 'openapi/api.yaml': ops200Yaml() } });
      expect(many.status, `ops-200 build output:\n${many.output}`).toBe(0);
      ops200 = readAll(many.dist);
    }, 600_000);

    it('[WP03] ops-1 grows the agent index by exactly one entry', () => {
      expect(openApiEntries(json<AgentIndexDoc>(ops1, 'api/index.json'))).toHaveLength(1);
    });

    it('[WP03] ops-200 grows the agent index by exactly one entry, not one per operation', () => {
      expect(openApiEntries(json<AgentIndexDoc>(ops200, 'api/index.json'))).toHaveLength(1);
    });
  });

  describe('hostile spec strings are flattened and escaped (FR-028)', () => {
    let hostile: Map<string, Buffer>;

    beforeAll(() => {
      const built = buildOpenApiFixture({
        fixture: 'hostile',
        openapi: {
          llmsOperations: true,
          specs: [{ path: 'openapi/api.yaml', label: 'v1', released: true }],
        },
      });
      expect(built.status, `hostile build output:\n${built.output}`).toBe(0);
      hostile = readAll(built.dist);
    }, 300_000);

    it('[WP03] one agent record, its spec strings flattened and its keywords raw', () => {
      const index = json<AgentIndexDoc>(hostile, 'api/index.json');
      expect(openApiEntries(index).map((entry) => entry.title)).toEqual([
        'Hostile <script>alert(1)</script> ](javascript:alert(1)) API v1',
      ]);
      const page = json<AgentPageDoc>(hostile, 'api/pages/reference/api/v1.json');
      // `keywords` is a JSON string array, not Markdown: the summaries stay
      // flattened but UNescaped. Backslash link-escaping belongs to the
      // Markdown surfaces (llms.txt, above); a machine-readable field must
      // carry the spec's own text.
      expect(page.keywords).toContain('List <script>alert(1)</script> ](javascript:alert(1)) parcels');
      expect(JSON.stringify(page.keywords)).not.toContain('\\]');
    });

    it('[WP04] the hostile operation line is flattened and its link syntax escaped', () => {
      const llms = text(hostile, 'llms.txt');
      // The escaping is WP02's shared `escapeMdLink`, which escapes every
      // `[`, `]`, `(` and `)` (contracts/llms-operations.md); WP01's red
      // expectation left the `alert(1)` parens raw, which contradict
      // contracts/ and openapi-summary.test.ts, so flipping it corrects them.
      expect(llms).toContain(
        '  - GET /parcels: List <script>alert\\(1\\)</script> \\]\\(javascript:alert\\(1\\)\\) parcels',
      );
      expect(llms).toContain('  - POST /parcels: Create a \\]\\(javascript:alert\\(2\\)\\) parcel');
    });

    it('[WP12] a content-graph node per spec version', () => {
      const graph = json<ContentGraphDoc>(hostile, 'api/content-graph.json');
      const node = graph.nodes.find((candidate) => candidate.id === 'openapi:v1');
      expect(node, 'the openapi:v1 node').toBeDefined();
      expect(node?.kind).toBe('resource');
    });

    it('[WP12] an OKF file per spec version', () => {
      expect(hostile.has('okf/reference/api/v1.md'), 'okf/reference/api/v1.md').toBe(true);
    });
  });

  describe('rejected inputs (FR-022, NFR-003)', () => {
    /** Runs a red row as `it.fails`, or as `it` under DK_SEAM_SHOW_RED=1. */
    const red = (title: string, fn: () => void) => (process.env.DK_SEAM_SHOW_RED ? it : it.fails)(title, fn);

    interface RejectRow {
      /** Directory under `src/tests/fixtures/openapi/rejected/`. */
      case: string;
      /** The work package that lands this row; titles the red case `[WPnn]`. */
      owner?: string;
      /** The `<spec ref>` the `[dk-openapi]` message must name. */
      ref: string;
      /** The cause text after the colon (a RegExp, matched as a substring). */
      cause: RegExp;
      /** The `openapi` option minus `renderer`. */
      option: Record<string, unknown>;
      /** Site-relative artifacts to write before the call (defaults: none). */
      setup?: (site: string) => void;
      /** WP10's child-process fetch stub; restored before the next row. */
      env?: Record<string, string>;
    }

    /** A valid minimal spec for rows whose fixture directory carries no spec file. */
    const MINIMAL_SPEC = `${[
      'openapi: 3.1.0',
      'info:',
      '  title: Generated fixture API',
      '  version: 1.0.0',
      'paths:',
      '  /things:',
      '    get:',
      '      operationId: listThings',
      '      summary: List things',
      '      responses:',
      "        '200':",
      '          description: The things.',
    ].join('\n')}\n`;

    /** A well-formed pin for the remote rows; the fetched bytes are WP10's business. */
    const PINNED = 'e'.repeat(64);

    const writeApiSpec = (site: string) => writeFileSync(path.join(site, 'openapi', 'api.yaml'), MINIMAL_SPEC);

    const v1Spec = (file: string) => ({ specs: [{ path: file, label: 'v1', released: true }] });

    const remote = (url: string, extra: Record<string, unknown> = {}) => ({
      specs: [{ url, label: 'v1', released: true, ...extra }],
    });

    /** A stubbed global fetch inside WP10's child, never a real network request. */
    const remoteFetchStub = (scenario: 'match' | 'redirects' | 'timeout') => ({
      NODE_OPTIONS: `--import=${new URL('./helpers/https-stub.ts', import.meta.url).href}`,
      DK_TEST_FETCH_STUB: scenario,
      DK_TEST_OPENAPI_YAML: MINIMAL_SPEC,
    });

    const ROWS: RejectRow[] = [
      // WP02 — static and single-file rows.
      {
        case: 'unknown-version',
        ref: 'specs[0] "v1"',
        cause: /not OpenAPI 3\.0, 3\.1 or Swagger 2\.0/,
        option: v1Spec('openapi/api.yaml'),
      },
      {
        case: 'http-url',
        ref: 'specs[0] "v1"',
        cause: /https/,
        option: remote('http://specs.example.test/api.yaml', { sha256: PINNED }),
      },
      {
        case: 'remote-without-sha256',
        ref: 'specs[0] "v1"',
        cause: /sha256 is required/,
        option: remote('https://specs.example.test/api.yaml'),
      },
      {
        case: 'url-userinfo',
        ref: 'specs[0] "v1"',
        cause: /userinfo/,
        option: remote('https://user:pass@specs.example.test/api.yaml', { sha256: PINNED }),
      },
      {
        case: 'label-pattern-invalid',
        ref: 'archive "openapi/releases/*.yaml"',
        cause: /labelPattern/,
        option: {
          specs: [{ path: 'openapi/api.yaml', label: 'v1', released: true }],
          archive: { glob: 'openapi/releases/*.yaml', labelPattern: '(' },
        },
        setup: writeApiSpec,
      },
      {
        case: 'label-pattern-no-group',
        ref: 'archive "openapi/releases/*.yaml"',
        cause: /labelPattern/,
        option: {
          specs: [{ path: 'openapi/api.yaml', label: 'v1', released: true }],
          archive: { glob: 'openapi/releases/*.yaml', labelPattern: 'api-v' },
        },
        setup: writeApiSpec,
      },
      {
        case: 'archive-glob-static',
        ref: 'archive "/etc/*.yaml"',
        cause: /archive glob/,
        option: {
          specs: [{ path: 'openapi/api.yaml', label: 'v1', released: true }],
          archive: { glob: '/etc/*.yaml', labelPattern: 'x-(.+)' },
        },
        setup: writeApiSpec,
      },
      {
        case: 'size-over-10mb',
        ref: 'specs[0] "v1"',
        cause: /10 MB/,
        option: v1Spec('openapi/huge.yaml'),
        setup: (site) => {
          // 11 MB of otherwise-valid YAML: over the FR-028 file-size bound.
          writeFileSync(
            path.join(site, 'openapi', 'huge.yaml'),
            `openapi: 3.1.0\ninfo:\n  title: Big\n  version: 1.0.0\n  description: ${'x'.repeat(11 * 1024 * 1024)}\npaths: {}\n`,
          );
        },
      },
      {
        case: 'yaml-aliases',
        ref: 'specs[0] "v1"',
        cause: /alias/,
        option: v1Spec('openapi/aliases.yaml'),
      },
      // WP08 — archive rows.
      {
        case: 'archive-zero-matches',
        ref: 'archive "openapi/none/*.yaml"',
        cause: /no files match/,
        option: {
          specs: [{ path: 'openapi/api.yaml', label: 'v1', released: true }],
          archive: { glob: 'openapi/none/*.yaml', labelPattern: 'api-v-(.+)', released: true },
        },
        setup: writeApiSpec,
      },
      {
        case: 'empty-derived-label',
        ref: 'archive "openapi/api-v*.yaml"',
        cause: /empty label/,
        option: { specs: [], archive: { glob: 'openapi/api-v*.yaml', labelPattern: 'api-v-(\\d*)', released: true } },
      },
      {
        case: 'duplicate-label',
        ref: 'archive "openapi/api-v*.yaml"',
        cause: /duplicate label/,
        option: {
          specs: [{ path: 'openapi/api.yaml', label: 'v1', released: true }],
          archive: { glob: 'openapi/api-v*.yaml', labelPattern: 'api-(v\\d+)', released: true },
        },
      },
      {
        case: 'archive-over-200',
        ref: 'archive "openapi/releases/*.yaml"',
        cause: /archive/,
        option: { specs: [], archive: { glob: 'openapi/releases/*.yaml', labelPattern: 'api-v-(\\d+)', released: true } },
        setup: (site) => {
          mkdirSync(path.join(site, 'openapi', 'releases'), { recursive: true });
          for (let i = 0; i <= 200; i += 1) {
            writeFileSync(path.join(site, 'openapi', 'releases', `api-v-${i}.yaml`), MINIMAL_SPEC);
          }
        },
      },
      // WP09 — every $ref row.
      { case: 'ref-escapes-folder', ref: 'specs[0] "v1"', cause: /escapes/, option: v1Spec('openapi/api.yaml') },
      { case: 'ref-non-file-scheme', ref: 'specs[0] "v1"', cause: /scheme/, option: v1Spec('openapi/api.yaml') },
      { case: 'ref-unresolvable', ref: 'specs[0] "v1"', cause: /cannot resolve/, option: v1Spec('openapi/api.yaml') },
      {
        case: 'ref-cycle-external',
        ref: 'specs[0] "v1"',
        cause: /cycle[\s\S]*a\.yaml -> b\.yaml -> a\.yaml/,
        option: v1Spec('openapi/a.yaml'),
      },
      { case: 'ref-absolute-file', ref: 'specs[0] "v1"', cause: /ref[\s\S]*scheme/, option: v1Spec('openapi/api.yaml') },
      {
        case: 'ref-symlink-escape',
        ref: 'specs[0] "v1"',
        cause: /escapes/,
        option: v1Spec('openapi/api.yaml'),
        setup: (site) => {
          // A symlink target outside the site root, plus the encoded-separator
          // ref already in the fixture's api.yaml.
          const outside = `${site}-outside.yaml`;
          writeFileSync(outside, MINIMAL_SPEC);
          symlinkSync(outside, path.join(site, 'openapi', 'link.yaml'));
        },
      },
      {
        case: 'ref-limit',
        ref: 'specs[0] "v1"',
        cause: /ref limit/,
        option: v1Spec('openapi/bomb.yaml'),
        setup: (site) => {
          const lines = [
            'openapi: 3.1.0',
            'info:',
            '  title: Ref bomb',
            '  version: 1.0.0',
            'paths: {}',
            'components:',
            '  schemas:',
            '    Base: { type: object }',
          ];
          for (let i = 0; i < 10_001; i += 1) lines.push(`    S${i}: { $ref: '#/components/schemas/Base' }`);
          writeFileSync(path.join(site, 'openapi', 'bomb.yaml'), `${lines.join('\n')}\n`);
        },
      },
      // WP10 — remote rows.
      {
        case: 'sha256-mismatch',
        owner: 'WP10',
        ref: 'specs[0] "v1"',
        cause: /sha256 mismatch/,
        option: remote('https://specs.example.test/api.yaml', { sha256: PINNED }),
        env: remoteFetchStub('match'),
      },
      {
        case: 'redirects-over-5',
        owner: 'WP10',
        ref: 'specs[0] "v1"',
        cause: /redirects/,
        option: remote('https://specs.example.test/redirects.yaml', { sha256: PINNED }),
        env: remoteFetchStub('redirects'),
      },
      {
        case: 'offline-no-cache',
        owner: 'WP10',
        ref: 'specs[0] "v1"',
        cause: /offline/,
        option: { offline: true, ...remote('https://specs.example.test/api.yaml', { sha256: PINNED }) },
      },
      {
        case: 'fetch-timeout-30s',
        owner: 'WP10',
        ref: 'specs[0] "v1"',
        cause: /timeout/,
        option: remote('https://specs.example.test/slow.yaml', { sha256: PINNED }),
        env: remoteFetchStub('timeout'),
      },
      // The two rows the current option already enforces: green guards.
      {
        case: 'unparsable',
        ref: 'specs[0] "v1"',
        cause: /cannot parse/,
        option: v1Spec('openapi/api.yaml'),
      },
      {
        case: 'missing-file',
        ref: 'specs[0] "v1"',
        cause: /cannot read the file/,
        option: v1Spec('openapi/absent.yaml'),
      },
    ];

    const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    function reject(row: RejectRow): void {
      const cwd = process.cwd();
      const site = mkdtempSync(path.join(tmpdir(), 'dk-openapi-reject-'));
      mkdirSync(path.join(site, 'docs'), { recursive: true });
      cpSync(path.join(FIXTURES, 'rejected', row.case), path.join(site, 'openapi'), { recursive: true });
      row.setup?.(site);
      const previousEnv = Object.fromEntries(Object.keys(row.env ?? {}).map((name) => [name, process.env[name]]));
      Object.assign(process.env, row.env);
      process.chdir(site);
      try {
        const renderer = vi.fn(() => ({ name: 'starlight-openapi-plugin', hooks: {} }));
        const expected = new RegExp(`^\\[dk-openapi\\] ${escapeRegExp(row.ref)}: ${row.cause.source}`);
        expect(() =>
          defineDocKittyIntegrations({
            title: 'T',
            openapi: { renderer, ...row.option } as unknown as OpenApiOptions,
          }),
        ).toThrow(expected);
        expect(renderer, `${row.case}: the renderer must not be called for a rejected input`).not.toHaveBeenCalled();
      } finally {
        for (const [name, value] of Object.entries(previousEnv)) {
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        }
        process.chdir(cwd);
        rmSync(site, { recursive: true, force: true });
      }
    }

    for (const row of ROWS) {
      const title = row.owner
        ? `[${row.owner}] ${row.case} is rejected, naming the entry and the cause`
        : `${row.case} is rejected, naming the entry and the cause (already enforced)`;
      (row.owner && row.owner !== 'WP10' ? red : it)(title, () => reject(row), 60_000);
    }
  });
});
