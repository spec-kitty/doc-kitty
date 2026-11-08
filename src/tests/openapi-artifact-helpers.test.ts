/**
 * Unit tests for the per-check helpers `checkOpenApiArtifacts` was split
 * into (#285; pre-PR review fold F6).
 *
 * `checkOpenApiArtifacts` had grown to a complexity of 72 — one function
 * holding every artifact assertion (pages, names, nav, badge, status,
 * console, sitemap/search, schemas, raw documents, llms.txt lines, agent
 * records and payloads, CSP). Each check is now an independent, exported
 * helper the orchestrator composes; these tests pin each helper's contract
 * directly (synthetic dist trees and strings, no builds), so a helper can be
 * understood — and changed — without the whole gate. The integrated builds
 * still prove the orchestrator end-to-end.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  readSitemapLocs,
  readAgentRecords,
  parseSpecs,
  versionPages,
  pageNameProblems,
  navProblems,
  badgeProblems,
  statusProblems,
  indexingProblems,
  schemaProblems,
  rawDocumentProblems,
  llmsVersionProblems,
  llmsOperationsProblems,
  agentRecordProblems,
  agentPayloadProblems,
  agentCountProblems,
  cspProblems,
} from '../scripts/assert-openapi-artifacts.mjs';

const SPEC_YAML = `openapi: 3.1.0
info:
  title: Helper fixture API
  version: 1.0.0
paths:
  /parcels:
    get:
      operationId: listParcels
      summary: List parcels
      responses:
        '200':
          description: The parcels.
`;

/** A temp dist dir with the given relative files written into it. */
function distWith(files: Record<string, string>): string {
  const dist = mkdtempSync(path.join(tmpdir(), 'dk-openapi-helpers-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dist, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dist;
}

const disposed: string[] = [];
afterAll(() => {
  for (const dir of disposed) rmSync(dir, { recursive: true, force: true });
});
function keep(dir: string): string {
  disposed.push(dir);
  return dir;
}

const sha256Hex = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

const V1 = { label: 'v1', released: true, file: 'openapi/v1.yaml' };
const V2 = { label: 'v2', released: false, file: 'openapi/v2.yaml' };
const CONFIG = { section: 'reference/api', specs: [V1, V2] };

describe('readSitemapLocs', () => {
  it('collects every <loc> of every sitemap xml in dist, in file then document order', async () => {
    const dist = keep(
      distWith({
        'sitemap-0.xml': '<urlset><url><loc>https://s.test/a/</loc></url><url><loc>https://s.test/b/</loc></url></urlset>',
        'sitemap-index.xml': '<url><loc>https://s.test/c/</loc></url>',
        'not-a-sitemap.xml': '<url><loc>https://s.test/skipped/</loc></url>',
      }),
    );
    expect(await readSitemapLocs(dist)).toEqual(['https://s.test/a/', 'https://s.test/b/', 'https://s.test/c/']);
  });
});

describe('readAgentRecords', () => {
  it('reports a missing api/index.json and returns no records', async () => {
    const dist = keep(distWith({ 'other.txt': 'x' }));
    const found = await readAgentRecords(dist);
    expect(found.records).toBeUndefined();
    expect(found.problems).toEqual(['agents: api/index.json is missing']);
  });

  it('reports a pages-less index and an unparsable one', async () => {
    const dist = keep(distWith({ 'api/index.json': '{"pages": "no"}' }));
    expect((await readAgentRecords(dist)).problems).toEqual(['agents: api/index.json has no pages array']);
    const broken = keep(distWith({ 'api/index.json': '{not json' }));
    expect((await readAgentRecords(broken)).problems).toEqual(['agents: api/index.json is not valid JSON']);
  });

  it('returns the pages array of a valid index', async () => {
    const dist = keep(distWith({ 'api/index.json': '{"pages": [{"slug": "a"}]}' }));
    const found = await readAgentRecords(dist);
    expect(found.problems).toEqual([]);
    expect(found.records).toEqual([{ slug: 'a' }]);
  });
});

describe('parseSpecs and versionPages', () => {
  it('reads, parses and describes each configured spec, and derives its pages', () => {
    const siteRoot = keep(distWith({ 'openapi/v1.yaml': SPEC_YAML }));
    const parsed = parseSpecs({ section: 'reference/api', specs: [V1] }, siteRoot);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.spec.label).toBe('v1');
    expect(parsed[0]!.described.operations.map((op: { slug: string }) => op.slug)).toEqual(['operations/listparcels']);
    expect(parsed[0]!.described.operations[0]).toMatchObject({ summary: 'List parcels', label: 'GET /parcels' });

    const pages = versionPages('reference/api', V1, parsed[0]!.described.operations);
    expect(pages.map((page: { rel: string }) => page.rel)).toEqual([
      'reference/api/v1/',
      'reference/api/v1/operations/listparcels/',
    ]);
    expect(pages[1]!.op).toBeDefined();
  });
});

describe('pageNameProblems', () => {
  const page = { rel: 'reference/api/v1/listparcels/', op: { summary: 'List parcels', label: 'GET /parcels' } };

  it('passes when the page shows the operation summary and label', () => {
    expect(pageNameProblems(page, 'List parcels … GET /parcels …')).toEqual([]);
  });

  it('names the missing summary and the missing label separately', () => {
    expect(pageNameProblems(page, 'something else')).toHaveLength(2);
  });

  it('checks nothing on the overview page', () => {
    expect(pageNameProblems({ rel: 'reference/api/v1' }, 'no operation text')).toEqual([]);
  });
});

describe('navProblems', () => {
  const slugs = new Map([
    ['v1', new Set(['listparcels'])],
    ['v2', new Set(['listparcels'])],
  ]);
  const page = { rel: 'reference/api/v1/listparcels/', op: { slug: 'listparcels' } };

  it('passes when the nav links every other version at the same operation', () => {
    const html = `<nav class="dk-openapi-nav"><a href="/reference/api/v2/listparcels/">v2</a></nav>`;
    expect(navProblems('reference/api', [V1, V2], V1, page, html, slugs)).toEqual([]);
  });

  it('reports a missing nav and a missing version link', () => {
    expect(navProblems('reference/api', [V1, V2], V1, page, '<main></main>', slugs)).toEqual([
      'nav: reference/api/v1/listparcels/ has no version navigation',
      'nav: reference/api/v1/listparcels/ does not link to version v2 at the same operation',
    ]);
  });
});

describe('badgeProblems', () => {
  const navWithBadge = `<nav class="dk-openapi-nav"><span class="dk-openapi-nav__current"><span class="dk-openapi-badge">unreleased</span></span></nav>`;
  const page = { rel: 'reference/api/v1/' };

  it('passes for an unreleased version that carries the unreleased badge', () => {
    expect(badgeProblems(V2, page, navWithBadge)).toEqual([]);
  });

  it('flags a released version that carries the badge, and an unreleased one without it', () => {
    expect(badgeProblems(V1, page, navWithBadge)).toEqual([
      'badge: the released version v1 carries the unreleased badge on reference/api/v1/',
    ]);
    expect(badgeProblems(V2, page, '<nav class="dk-openapi-nav"><span class="dk-openapi-nav__current">v2</span></nav>')).toEqual([
      'badge: the unreleased version v2 shows no "unreleased" text on reference/api/v1/',
    ]);
  });
});

describe('statusProblems', () => {
  it('flags the draft notice and the noindex marking', () => {
    const page = { rel: 'reference/api/v1/' };
    expect(statusProblems(page, '<div class="dk-draft-notice">draft</div>')).toEqual([
      'status: reference/api/v1/ carries the draft notice',
    ]);
    expect(statusProblems(page, '<meta name="robots" content="noindex">')).toEqual([
      'status: reference/api/v1/ is marked noindex',
    ]);
    expect(statusProblems(page, '<main>fine</main>')).toEqual([]);
  });
});

describe('indexingProblems', () => {
  const page = { rel: 'reference/api/v1/' };
  const fragments = [{ url: 'https://s.test/reference/api/v1/', text: '' }];

  it('a released page must be listed and indexed', () => {
    expect(indexingProblems(V1, page, '<main>x</main>', [], [])).toEqual([
      'sitemap: no entry for reference/api/v1/',
      'search: reference/api/v1/ is not in the Pagefind index',
    ]);
    expect(indexingProblems(V1, page, '<main>x</main>', ['https://s.test/reference/api/v1/'], fragments)).toEqual([]);
  });

  it('an unreleased page must be held back from both', () => {
    const locs = ['https://s.test/reference/api/v1/'];
    expect(indexingProblems(V2, page, '<main>x</main>', locs, fragments)).toEqual([
      'sitemap: unreleased reference/api/v1/ is listed (FR-015)',
      'search: unreleased reference/api/v1/ is in the Pagefind index (FR-015)',
    ]);
    expect(indexingProblems(V2, page, '<main data-pagefind-body>x</main>', [], [])).toEqual([
      'search: unreleased reference/api/v1/ carries data-pagefind-body (FR-015)',
    ]);
  });
});

describe('schemaProblems', () => {
  it('requires every schema property name in the version\'s page text', () => {
    const schemas = [{ name: 'Parcel', properties: ['id', 'status'] }];
    expect(schemaProblems('reference/api/v1', schemas, ['the id field'])).toEqual([
      'names: property "status" of schema Parcel is not shown in reference/api/v1',
    ]);
    expect(schemaProblems('reference/api/v1', schemas, ['the id and status fields'])).toEqual([]);
  });
});

describe('rawDocumentProblems', () => {
  it('requires the raw document byte for byte and its checksum line', async () => {
    const input = Buffer.from(SPEC_YAML);
    const rawName = 'openapi.yaml';
    const good = keep(
      distWith({
        'reference/api/v1/openapi.yaml': SPEC_YAML,
        [`reference/api/v1/${rawName}.sha256`]: `${sha256Hex(input)}  ${rawName}\n`,
      }),
    );
    expect(await rawDocumentProblems(good, 'reference/api', V1, input)).toEqual([]);

    const drifted = keep(distWith({ 'reference/api/v1/openapi.yaml': 'openapi: 3.1.0\n' }));
    expect(await rawDocumentProblems(drifted, 'reference/api', V1, input)).toContain(
      'raw: reference/api/v1/openapi.yaml differs from openapi/v1.yaml',
    );

    const noSum = keep(distWith({ 'reference/api/v1/openapi.yaml': SPEC_YAML }));
    expect(await rawDocumentProblems(noSum, 'reference/api', V1, input)).toEqual([
      'raw: reference/api/v1/openapi.yaml.sha256 is missing',
    ]);
  });
});

describe('llmsVersionProblems and llmsOperationsProblems', () => {
  const llms = [
    '# llms',
    '',
    '- [v1](https://s.test/reference/api/v1/openapi.yaml)',
    '  - GET /parcels: List parcels',
    '- [v2](https://s.test/reference/api/v2/openapi.yaml) (unreleased)',
  ].join('\n');

  it('requires the version line, released marker included', () => {
    expect(llmsVersionProblems(llms, 'reference/api', V1)).toEqual([]);
    expect(llmsVersionProblems(llms, 'reference/api', V2)).toEqual([]);
    expect(llmsVersionProblems('# nothing', 'reference/api', V1)).toEqual(['llms.txt: no line for v1']);
    expect(llmsVersionProblems(llms.replace(' (unreleased)', ''), 'reference/api', V2)).toEqual([
      'llms.txt: no line for v2 (unreleased)',
    ]);
  });

  it('requires one operation line per operation when opted in, none when not', () => {
    const operations = [{ label: 'GET /parcels', summary: 'List parcels' }];
    const on = { ...CONFIG, llmsOperations: true };
    expect(llmsOperationsProblems(llms, on, V1, operations)).toEqual([]);
    expect(llmsOperationsProblems(llms, on, V2, operations)).toEqual([
      'llms.txt: no operation line "- GET /parcels: List parcels" for reference/api/v2',
    ]);
    expect(llmsOperationsProblems(llms, CONFIG, V1, operations)).toEqual([
      'llms.txt: an operation line for reference/api/v1 is present without llmsOperations on',
    ]);
  });
});

describe('agentRecordProblems and agentPayloadProblems', () => {
  const digest = sha256Hex('spec bytes');

  it('requires the index record to name the raw route and the digest', () => {
    const records = [
      { slug: 'reference/api/v1', rawDocumentUrl: 'https://s.test/reference/api/v1/openapi.yaml', sha256: digest },
    ];
    expect(agentRecordProblems(records, 'reference/api', V1, digest)).toEqual([]);
    expect(agentRecordProblems(undefined, 'reference/api', V1, digest)).toEqual([]);
    expect(agentRecordProblems(records, 'reference/api', V1, '0'.repeat(64))).toEqual([
      `agents: the reference/api/v1 record's sha256 is not the digest of openapi/v1.yaml`,
    ]);
    expect(agentRecordProblems([], 'reference/api', V1, digest)).toEqual([
      'agents: no api/index.json record for reference/api/v1',
    ]);
  });

  it('requires the page payload to name the raw route and the digest', async () => {
    const good = keep(
      distWith({
        'api/pages/reference/api/v1.json': JSON.stringify({
          sha256: digest,
          rawDocumentUrl: 'https://s.test/reference/api/v1/openapi.yaml',
        }),
      }),
    );
    expect(await agentPayloadProblems(good, 'reference/api', V1, digest)).toEqual([]);

    const empty = keep(distWith({ 'other.txt': 'x' }));
    expect(await agentPayloadProblems(empty, 'reference/api', V1, digest)).toEqual([
      'agents: api/pages/reference/api/v1.json is missing',
    ]);
  });
});

describe('agentCountProblems', () => {
  it('holds exactly one record per configured version of the section', () => {
    const two = [
      { slug: 'reference/api/v1' },
      { slug: 'reference/api/v2' },
      { slug: 'guides/other' },
    ];
    expect(agentCountProblems(two, CONFIG)).toEqual([]);
    expect(agentCountProblems(two.slice(0, 1), CONFIG)).toEqual([
      'agents: api/index.json holds 1 reference/api record, expected 2',
    ]);
    expect(agentCountProblems(undefined, CONFIG)).toEqual([]);
  });
});

describe('cspProblems', () => {
  it('flags inline additions beyond the allowlist, prefixed with the check name', async () => {
    const dist = keep(distWith({ 'guides/index.html': '<main>ordinary</main>' }));
    const allow = { pinnedVersion: 'test', scripts: [], styleBlocks: [], styleAttributes: [] };
    const reference = ['<main><script>console.log(1)</script></main>'];
    expect(await cspProblems(dist, CONFIG, reference, allow)).toHaveLength(1);
    expect(await cspProblems(dist, CONFIG, [], allow)).toEqual([]);
  });
});
