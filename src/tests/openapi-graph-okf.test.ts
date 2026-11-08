/**
 * WP12: one content-graph resource and one OKF summary per OpenAPI version.
 * These are real cold Astro builds so the graph route and the OKF build hook are
 * tested through their public artifacts, including two-build byte identity.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { checkOkfBundle } from '../lib/okf-export/conformance.mjs';
import { exportOkfBundle } from '../lib/okf-export/core.mjs';
import {
  buildOpenApiFixture,
  readAll,
  removeOpenApiFixtureBuilds,
  twoBuilds,
} from './helpers/openapi-build';

const TWO_VERSIONS = {
  fixture: 'two-versions',
  options: { description: 'WP12 graph and OKF fixture' },
  openapi: {
    specs: [
      { path: 'openapi/v1.yaml', label: 'v1', released: true },
      { path: 'openapi/v2.yaml', label: 'v2', released: false },
    ],
  },
};

interface GraphNode {
  id: string;
  kind?: string;
  title?: string;
  url?: string;
  resource?: { sha256?: string; released?: boolean; overview?: string };
}

interface ContentGraphDoc {
  schema: string;
  nodes: GraphNode[];
}

function text(files: Map<string, Buffer>, key: string): string {
  const bytes = files.get(key);
  expect(bytes, `${key} exists in the built dist`).toBeDefined();
  return (bytes ?? Buffer.alloc(0)).toString('utf8');
}

function json<T>(files: Map<string, Buffer>, key: string): T {
  return JSON.parse(text(files, key)) as T;
}

function okfFiles(files: Map<string, Buffer>): Map<string, Buffer> {
  return new Map(
    [...files]
      .filter(([key]) => key.startsWith('okf/'))
      .map(([key, bytes]) => [key.slice('okf/'.length), bytes]),
  );
}

function bodyOf(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/, '');
}

afterAll(() => {
  removeOpenApiFixtureBuilds();
});

describe('[WP12] content graph and OKF synthetic entries', () => {
  let pair: ReturnType<typeof twoBuilds>;

  beforeAll(() => {
    pair = twoBuilds(TWO_VERSIONS);
    for (const build of [pair.first, pair.second]) {
      expect(build.status, `astro build output:\n${build.output}`).toBe(0);
    }
  }, 600_000);

  it('[WP12] one resource graph node per version and no per-operation nodes', () => {
    const graph = json<ContentGraphDoc>(pair.a, 'api/content-graph.json');
    const nodes = graph.nodes.filter((node) => node.id.startsWith('openapi:'));
    expect(nodes.map((node) => node.id)).toEqual(['openapi:v1', 'openapi:v2']);
    expect(graph.schema).toBe('dockitty.content-graph/1');

    for (const [index, label] of ['v1', 'v2'].entries()) {
      const node = nodes[index];
      const digest = text(pair.a, `reference/api/${label}/openapi.yaml.sha256`).slice(0, 64);
      expect(digest).toBe(
        createHash('sha256').update(pair.a.get(`reference/api/${label}/openapi.yaml`)!).digest('hex'),
      );
      expect(node).toEqual({
        id: `openapi:${label}`,
        kind: 'resource',
        title: 'Parcels API',
        url: `https://docs.example.test/reference/api/${label}/openapi.yaml`,
        resource: {
          sha256: digest,
          released: label === 'v1',
          overview: `https://docs.example.test/reference/api/${label}/`,
        },
      });
    }
  });

  it('[WP12] one conformant OKF file per version, listed in the root index with the graph sha256', () => {
    const graph = json<ContentGraphDoc>(pair.a, 'api/content-graph.json');
    const bundle = okfFiles(pair.a);
    expect(checkOkfBundle(bundle)).toEqual([]);

    for (const label of ['v1', 'v2']) {
      const key = `reference/api/${label}.md`;
      expect(bundle.has(key), key).toBe(true);
      const graphNode = graph.nodes.find((node) => node.id === `openapi:${label}`);
      const body = bodyOf(text(pair.a, `okf/${key}`));
      expect(body).toContain(`# Parcels API ${label}\n`);
      expect(body).toContain(`- Raw document: ${graphNode?.url}\n`);
      expect(body).toContain(`- sha256: ${graphNode?.resource?.sha256}\n`);
      expect(body).toContain('## Operations\n');
      const title = `Parcels API ${label}${label === 'v1' ? '' : ' (unreleased)'}`;
      expect(text(pair.a, 'okf/index.md')).toContain(`[${title}](/${key})`);
    }
  });

  it('[WP12] graph and OKF output is byte-identical across two cold builds', () => {
    const a = new Map([...pair.a].filter(([key]) => key === 'api/content-graph.json' || key.startsWith('okf/')));
    const b = new Map([...pair.b].filter(([key]) => key === 'api/content-graph.json' || key.startsWith('okf/')));
    expect([...b.keys()]).toEqual([...a.keys()]);
    for (const [key, bytes] of a) {
      expect(b.get(key)?.equals(bytes), `${key} is byte-identical`).toBe(true);
    }
  });
});

describe('[WP12] based graph and OKF URLs', () => {
  let files: Map<string, Buffer>;

  beforeAll(() => {
    const built = buildOpenApiFixture({
      ...TWO_VERSIONS,
      options: { ...TWO_VERSIONS.options, base: '/handbook' },
    });
    expect(built.status, `based build output:\n${built.output}`).toBe(0);
    files = readAll(built.dist);
  }, 300_000);

  it('[WP12] prefixes the graph raw and overview URLs with a non-root base', () => {
    const graph = json<ContentGraphDoc>(files, 'api/content-graph.json');
    expect(graph.nodes.find((node) => node.id === 'openapi:v1')).toMatchObject({
      url: 'https://docs.example.test/handbook/reference/api/v1/openapi.yaml',
      resource: { overview: 'https://docs.example.test/handbook/reference/api/v1/' },
    });
    expect(bodyOf(text(files, 'okf/reference/api/v1.md'))).toContain(
      '- Raw document: https://docs.example.test/handbook/reference/api/v1/openapi.yaml\n',
    );
  });

  it('[WP12] keeps the OKF raw URL based when no site URL is configured', () => {
    const bundle = exportOkfBundle({ nodes: [], edges: [] }, new Map(), {
      base: '/handbook',
      openapi: {
        section: 'reference/api',
        llmsOperations: false,
        versions: [
          {
            label: 'v1',
            ext: 'yaml',
            title: 'Parcels API',
            apiVersion: '1.0.0',
            released: true,
            rawRoute: '/reference/api/v1/openapi.yaml',
            sha256: '0'.repeat(64),
            operations: [],
          },
        ],
      },
    }) as Map<string, string>;
    expect(bodyOf(bundle.get('reference/api/v1.md') ?? '')).toContain(
      '- Raw document: /handbook/reference/api/v1/openapi.yaml\n',
    );
  });
});

describe('[WP12] hostile spec strings in graph and OKF', () => {
  let files: Map<string, Buffer>;

  beforeAll(() => {
    const built = buildOpenApiFixture({
      fixture: 'hostile',
      options: { description: 'WP12 hostile graph and OKF fixture' },
      openapi: { specs: [{ path: 'openapi/api.yaml', label: 'v1', released: true }] },
    });
    expect(built.status, `hostile build output:\n${built.output}`).toBe(0);
    files = readAll(built.dist);
  }, 300_000);

  it('[WP12] flattens graph text and escapes the OKF summary links', () => {
    const graph = json<ContentGraphDoc>(files, 'api/content-graph.json');
    expect(graph.nodes.find((node) => node.id === 'openapi:v1')?.title).toBe(
      'Hostile <script>alert(1)</script> ](javascript:alert(1)) API',
    );
    const body = bodyOf(text(files, 'okf/reference/api/v1.md'));
    expect(body).toContain('- GET /parcels: List <script>alert\\(1\\)</script> \\]\\(javascript:alert\\(1\\)\\) parcels\n');
    expect(body).toContain('- POST /parcels: Create a \\]\\(javascript:alert\\(2\\)\\) parcel\n');
    expect(body).not.toContain('](javascript:');
  });
});
