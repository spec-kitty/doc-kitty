/**
 * `llms.txt` operation lines (mission openapi-second-slice-01M6WXJ4, WP04;
 * FR-014, FR-028; contracts/llms-operations.md).
 *
 * The opt-in `openapi.llmsOperations` (default false) adds one indented line per
 * operation under each version line: summary, else operationId, else the method
 * and path alone. With the option off the section stays byte-identical to the
 * pre-WP04 version list, which the first case pins by building the same lines
 * through the old formula.
 *
 * Every spec-derived string goes through the shared `flattenText` /
 * `escapeMdLink` helpers (`summary.mjs`), so a hostile summary, operationId,
 * path or label is one line with no Markdown link syntax (FR-028).
 */
import { describe, expect, it, vi } from 'vitest';
import { restoreInternalEnv } from './helpers/restore-internal-env';
import type { OpenApiPublication } from '../lib/openapi/publication.js';
import type { Operation } from '../lib/openapi/operations.mjs';

vi.mock('astro:content', () => ({ getCollection: async () => [], render: async () => ({ headings: [] }) }));

const { openApiLlmsLines } = await import('../lib/integrations/openapi-publish.js');
const { readPublication } = await import('../lib/openapi/publication.js');
const { llmsTxtRoute } = await import('../lib/routes/llms-txt.js');
const { DK_OPENAPI_ENV } = await import('../lib/internal-env.mjs');
const { publicationFile } = await import('./helpers/openapi-publication.js');

restoreInternalEnv();

const SHA = 'a'.repeat(64);

/** One operation, with the pieces the renderer's extractor fills in. */
function operation(method: string, path: string, extra: Partial<Operation> = {}): Operation {
  return { method, path, slug: `operations/${method.toLowerCase()}`, ...extra };
}

/** A publication with one version; overrides win. */
function publication(overrides: Partial<OpenApiPublication> = {}, version: Record<string, unknown> = {}): OpenApiPublication {
  return {
    section: 'reference/api',
    llmsOperations: true,
    ...overrides,
    versions: [
      {
        label: 'v1',
        released: true,
        ext: 'yaml',
        sha256: SHA,
        title: 'Parcels API',
        apiVersion: '1.0.0',
        operations: [operation('GET', '/parcels', { summary: 'List parcels' })],
        rawRoute: '/reference/api/v1/openapi.yaml',
        ...version,
      },
    ],
  };
}

const absolute = (route: string): string => `https://d.example${route}`;

/** The pre-WP04 body: one line per version, no operations. */
function versionLines(body: OpenApiPublication): string[] {
  return body.versions.map(
    ({ label, released, ext }) =>
      `- [${label}](${absolute(`/${body.section}/${label}/openapi.${ext}`)})${released ? '' : ' (unreleased)'}`,
  );
}

describe('llms.txt operation lines (WP04)', () => {
  it('[WP04] off (the default): the version lines are byte-identical to today', () => {
    const body = publication(
      { llmsOperations: false },
      {
        operations: [operation('GET', '/parcels', { summary: 'List parcels' })],
      },
    );
    const lines = openApiLlmsLines(body, absolute);
    expect(lines).toEqual(versionLines(body));
    expect(lines.some((line) => line.startsWith('  - '))).toBe(false);
  });

  it('[WP04] on: each version line lists its operations, indented under it', () => {
    const body = publication(
      {},
      {
        operations: [
          operation('GET', '/parcels', { summary: 'List parcels' }),
          operation('POST', '/parcels', { operationId: 'createPet' }),
          operation('DELETE', '/pets/{id}', { operationId: 'deletePet', summary: undefined }),
        ],
      },
    );
    expect(openApiLlmsLines(body, absolute)).toEqual([
      '- [v1](https://d.example/reference/api/v1/openapi.yaml)',
      '  - GET /parcels: List parcels',
      '  - POST /parcels: createPet',
      '  - DELETE /pets/{id}: deletePet',
    ]);
  });

  it('[WP04] the summary falls back to the operationId, then is omitted entirely (no colon)', () => {
    const body = publication(
      {},
      {
        operations: [
          operation('GET', '/a', { summary: 'A summary', operationId: 'aId' }),
          operation('GET', '/b', { operationId: 'bId' }),
          operation('GET', '/c', {}),
          operation('GET', '/d', { summary: '   ', operationId: '  ' }),
        ],
      },
    );
    expect(openApiLlmsLines(body, absolute)).toEqual([
      '- [v1](https://d.example/reference/api/v1/openapi.yaml)',
      '  - GET /a: A summary',
      '  - GET /b: bId',
      '  - GET /c',
      '  - GET /d',
    ]);
  });

  it('[WP04] zero operations: the version line only', () => {
    const body = publication({}, { operations: [] });
    expect(openApiLlmsLines(body, absolute)).toEqual(versionLines(body));
  });

  it('[WP04] operations order by path, then by uppercase method, bytewise', () => {
    const body = publication(
      {},
      {
        operations: [
          operation('post', '/parcels'),
          operation('DELETE', '/parcels/{id}'),
          operation('GET', '/Zoo'),
          operation('put', '/parcels'),
          operation('GET', '/parcels'),
        ],
      },
    );
    expect(openApiLlmsLines(body, absolute).slice(1)).toEqual([
      '  - GET /Zoo',
      '  - GET /parcels',
      '  - POST /parcels',
      '  - PUT /parcels',
      '  - DELETE /parcels/{id}',
    ]);
  });

  it('[WP04] hostile spec strings are flattened to one line and link syntax escaped', () => {
    const body = publication(
      { section: 'reference/api' },
      {
        label: 'v1',
        operations: [
          operation('GET', '/parcels', { summary: 'List <script>alert(1)</script>\nparcels' }),
          operation('POST', '/parcels', { summary: 'Create a ](javascript:alert(2)) parcel' }),
          operation('GET', '/line\nbreak', { operationId: 'id ](javascript:alert(3))' }),
        ],
      },
    );
    const lines = openApiLlmsLines(body, absolute);
    expect(lines).toEqual([
      '- [v1](https://d.example/reference/api/v1/openapi.yaml)',
      '  - GET /line break: id \\]\\(javascript:alert\\(3\\)\\)',
      '  - GET /parcels: List \\<script\\>alert\\(1\\)\\</script\\> parcels',
      '  - POST /parcels: Create a \\]\\(javascript:alert\\(2\\)\\) parcel',
    ]);
    // Every operation line stays one physical line.
    expect(lines.filter((line) => line.startsWith('  - ')).every((line) => !line.includes('\n'))).toBe(true);
  });

  it('[WP04] through the real route: the handoff turns the lines on and off', async () => {
    const body = publication({}, { operations: [operation('GET', '/parcels', { summary: 'List parcels' })] });
    const render = async (): Promise<string> =>
      (
        await (llmsTxtRoute({ title: 'Docs' }) as (context: { site: URL }) => Promise<Response>)({
          site: new URL('https://d.example/'),
        })
      ).text();

    expect(await render()).not.toContain('openapi');
    process.env[DK_OPENAPI_ENV] = publicationFile(body);
    expect(await render()).toContain('  - GET /parcels: List parcels\n');
    expect(readPublication(process.env[DK_OPENAPI_ENV])?.llmsOperations).toBe(true);
    process.env[DK_OPENAPI_ENV] = publicationFile({ ...body, llmsOperations: false });
    expect(await render()).not.toContain('  - GET /parcels');
    expect(await render()).toContain('- [v1](https://d.example/reference/api/v1/openapi.yaml)');
  });
});
