/**
 * The raw OpenAPI documents and their checksums (mission openapi-reference-pages,
 * WP04; FR-006, FR-008, FR-012; NFR-001), the `llms.txt` lines, and the build
 * assertions that prove them (`assert-openapi-artifacts.mjs`).
 *
 * The publisher runs against real files in a temp dir, through the same hook Astro
 * calls (`astro:build:done`), and the `llms.txt` lines through the real route.
 * Each assertion fails when its behaviour is removed: the bytes are compared with
 * `Buffer.compare`, and the build assertions get a negative control per check.
 *
 * WP02 (mission openapi-second-slice-01M6WXJ4): the publisher takes the
 * config-time BYTES from the materialised list (FR-007) — it never reads a file —
 * so a spec is `{ label, ext, released, bytes, sha256 }` here, and the one input
 * check left is the bytes/digest invariant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import type { OpenApiPublication } from '../lib/openapi/publication.js';

vi.mock('astro:content', () => ({ getCollection: async () => [], render: async () => ({ headings: [] }) }));

const publish = await import('../lib/integrations/openapi-publish.js');
const { readPublication } = await import('../lib/openapi/publication.js');
const { llmsTxtRoute } = await import('../lib/routes/llms-txt.js');
const assertions = await import('../scripts/assert-openapi-artifacts.mjs');
const { DK_OPENAPI_ENV } = await import('../lib/internal-env.mjs');
const { publicationFile } = await import('./helpers/openapi-publication.js');

let dir: string;
let outDir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'dk-openapi-raw-'));
  outDir = path.join(dir, 'dist');
  mkdirSync(outDir, { recursive: true });
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env[DK_OPENAPI_ENV];
});

const SPEC_V1 = '﻿openapi: 3.1.0\r\ninfo: {title: T, version: "1"}\r\npaths: {}\r\n\t# no trailing newline, CRLF and a BOM must survive';
const SPEC_MAIN = '{"openapi":"3.0.3","info":{"title":"T","version":"2"},"paths":{}}';

function spec(label: string, ext: string, content: string | Buffer, released = true) {
  const bytes = Buffer.from(content);
  return { label, ext, released, bytes, sha256: sha(bytes) };
}

const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

function publishBoth() {
  const options = {
    section: 'reference/api',
    specs: [spec('v1', 'yaml', SPEC_V1), spec('main', 'json', SPEC_MAIN, false)],
  };
  return { options, written: publish.publishOpenApiDocuments(outDir, options) };
}

function treeOf(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(root)) return out;
  for (const e of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) out[path.relative(root, path.join(e.parentPath, e.name))] = readFileSync(path.join(e.parentPath, e.name)).toString('base64');
  }
  return out;
}

describe('the raw document and its checksum (FR-006)', () => {
  it('is byte-identical to the input, whatever its bytes, and keeps the extension', () => {
    publishBoth();
    const v1 = readFileSync(path.join(outDir, 'reference/api/v1/openapi.yaml'));
    const main = readFileSync(path.join(outDir, 'reference/api/main/openapi.json'));
    expect(Buffer.compare(v1, Buffer.from(SPEC_V1))).toBe(0);
    expect(Buffer.compare(main, Buffer.from(SPEC_MAIN))).toBe(0);
  });

  it('writes the sha256sum format, and `sha256sum -c` accepts it', () => {
    publishBoth();
    const dirV1 = path.join(outDir, 'reference/api/v1');
    expect(readFileSync(path.join(dirV1, 'openapi.yaml.sha256'), 'utf8')).toBe(`${sha(SPEC_V1)}  openapi.yaml\n`);
    expect(publish.checksumLine('ab', 'openapi.json')).toBe('ab  openapi.json\n');
    let checked = true;
    try {
      execFileSync('sha256sum', ['-c', 'openapi.yaml.sha256'], { cwd: dirV1, stdio: 'pipe' });
    } catch (error) {
      checked = (error as NodeJS.ErrnoException).code === 'ENOENT'; // no sha256sum on this machine
    }
    expect(checked).toBe(true);
  });

  it('through the build hook: reads the output directory Astro hands over', () => {
    const { options } = publishBoth();
    rmSync(outDir, { recursive: true });
    mkdirSync(outDir);
    publish.openApiPublishHooks(options)['astro:build:done']({ dir: pathToFileURL(`${outDir}/`) });
    expect(existsSync(path.join(outDir, 'reference/api/main/openapi.json.sha256'))).toBe(true);
  });

  it('is repeatable: a second publish over its own output changes nothing (NFR-001)', () => {
    publishBoth();
    const first = treeOf(outDir);
    publishBoth();
    expect(treeOf(outDir)).toEqual(first);
  });
});

describe('generated-page rules (FR-012, ADR-0049 section 3)', () => {
  it('writes nothing when a spec\'s bytes no longer hash to their recorded sha256 (the FR-007 invariant)', () => {
    const options = {
      section: 'reference/api',
      specs: [
        spec('v1', 'yaml', SPEC_V1),
        { label: 'main', ext: 'json', released: false, bytes: Buffer.from(SPEC_MAIN), sha256: 'f'.repeat(64) },
      ],
    };
    expect(() => publish.publishOpenApiDocuments(outDir, options)).toThrow(
      /\[dk-openapi\] specs\[1\] "main": sha256 mismatch/,
    );
    expect(treeOf(outDir)).toEqual({});
  });

  it('stops on an authored file at an output path, names it, and writes nothing', () => {
    const authored = path.join(outDir, 'reference/api/main/openapi.json');
    mkdirSync(path.dirname(authored), { recursive: true });
    writeFileSync(authored, 'hand-written');
    const options = {
      section: 'reference/api',
      specs: [spec('v1', 'yaml', SPEC_V1), spec('main', 'json', SPEC_MAIN, false)],
    };
    expect(() => publish.publishOpenApiDocuments(outDir, options)).toThrow(new RegExp(authored.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    expect(existsSync(path.join(outDir, 'reference/api/v1'))).toBe(false);
    expect(readFileSync(authored, 'utf8')).toBe('hand-written');
  });

  it('prunes the output of a removed version and of a changed extension, and only generated files', () => {
    publishBoth();
    const stray = path.join(outDir, 'reference/api/main/openapi.txt');
    writeFileSync(stray, 'authored, no checksum beside it');
    // main is gone, v1 is now JSON.
    const reported: string[] = [];
    publish.publishOpenApiDocuments(outDir, { section: 'reference/api', specs: [spec('v1', 'json', SPEC_MAIN)] }, (f) =>
      reported.push(f),
    );
    publish.removeEmptyDirs(outDir, 'reference/api');
    // Every removal is reported, so the build can warn about it; the stray file is not.
    expect(reported.sort()).toEqual(
      [path.join(outDir, 'reference/api/main/openapi.json'), path.join(outDir, 'reference/api/v1/openapi.yaml')].sort(),
    );
    expect(existsSync(path.join(outDir, 'reference/api/main/openapi.json'))).toBe(false);
    expect(existsSync(path.join(outDir, 'reference/api/main/openapi.json.sha256'))).toBe(false);
    expect(existsSync(path.join(outDir, 'reference/api/v1/openapi.yaml'))).toBe(false);
    expect(existsSync(path.join(outDir, 'reference/api/v1/openapi.json'))).toBe(true);
    expect(readFileSync(stray, 'utf8')).toBe('authored, no checksum beside it');
  });

  it('does not take a raw document whose checksum disagrees for its own', () => {
    publishBoth();
    writeFileSync(path.join(outDir, 'reference/api/v1/openapi.yaml'), 'edited after the build');
    expect(() =>
      publish.publishOpenApiDocuments(outDir, { section: 'reference/api', specs: [spec('v1', 'yaml', SPEC_V1)] }),
    ).toThrow(/authored file/);
  });
});

describe('llms.txt (FR-008)', () => {
  const publication: OpenApiPublication = {
    section: 'reference/api',
    llmsOperations: false,
    versions: [
      {
        label: 'v1',
        released: true,
        ext: 'yaml',
        sha256: sha(SPEC_V1),
        title: 'T',
        apiVersion: '1',
        operations: [],
        rawRoute: '/reference/api/v1/openapi.yaml',
      },
      {
        label: 'main',
        released: false,
        ext: 'json',
        sha256: sha(SPEC_MAIN),
        title: 'T',
        apiVersion: '2',
        operations: [],
        rawRoute: '/reference/api/main/openapi.json',
      },
    ],
  };

  it('has one line per version, with unreleased marked after the link', () => {
    expect(publish.openApiLlmsLines(publication, (r) => `https://d.example${r}`)).toEqual([
      '- [v1](https://d.example/reference/api/v1/openapi.yaml)',
      '- [main](https://d.example/reference/api/main/openapi.json) (unreleased)',
    ]);
  });

  it('the route lists them with the site base and nothing without the option', async () => {
    const render = async () =>
      (await (llmsTxtRoute({ title: 'Docs' }) as (c: { site: URL }) => Promise<Response>)({ site: new URL('https://d.example/') })).text();
    expect(await render()).not.toContain('openapi');
    process.env[DK_OPENAPI_ENV] = publicationFile(publication);
    const text = await render();
    expect(text).toContain('- [v1](https://d.example/reference/api/v1/openapi.yaml)\n');
    expect(text).toContain('- [main](https://d.example/reference/api/main/openapi.json) (unreleased)');
  });

  it('ignores a malformed handoff rather than failing the route', () => {
    process.env[DK_OPENAPI_ENV] = '/nonexistent/publication.json';
    expect(readPublication(process.env[DK_OPENAPI_ENV])).toBeUndefined();
    expect(readPublication(undefined)).toBeUndefined();
  });
});

describe('the build assertions bite (T013)', () => {
  const doc = `openapi: 3.1.0
info: {title: T, version: "1"}
paths:
  /things:
    get: {operationId: listThings, summary: List things}
components:
  schemas:
    Thing: {type: object, properties: {colour: {type: string}}}
`;
  const config = { section: 'reference/api', specs: [{ label: 'v1', released: true, file: 'openapi/v1.yaml' }, { label: 'next', released: false, file: 'openapi/next.yaml' }] };
  const picker = 'customElements.define("starlight-openapi-content-picker", class extends HTMLElement {});';
  const allow = { pinnedVersion: 'test', scripts: [`sha256-${createHash('sha256').update(picker).digest('base64')}`], styleAttributes: [], styleBlocks: [] };

  /** One reference page. Both versions route `listThings`, so an operation
   * page's version link targets the other version's page for the SAME
   * operation (WP07's same-operation mapping); an overview page links the
   * other version's overview. */
  function page(label: string, released: boolean, rel: string, op = false, extra = '') {
    const other = label === 'v1' ? 'next' : 'v1';
    const badge = released ? '' : '<span class="dk-openapi-badge">unreleased</span>';
    const href = op ? `/reference/api/${other}/operations/listthings/` : `/reference/api/${other}/`;
    return `<html><head><meta name="robots" content="index"></head><body><nav class="dk-openapi-nav"><ul><li class="dk-openapi-nav__current">${label} ${badge}</li><li><a href="${href}">${other}</a></li></ul></nav><main>${
      op ? 'List things GET /things' : 'Overview'
    } colour ${extra}</main></body></html>`;
  }

  function fragment(url: string) {
    return gzipSync(Buffer.from(`pagefind_dcd{"url":"${url}"}`));
  }

  /** A complete minimal site for the two-version config. `llmsOperations`
   * also writes the indented operation lines llms.txt carries when a site
   * opts in (WP04, FR-014); the agent records mirror WP03's projection. */
  function site(llmsOperations = false): string {
    const root = path.join(dir, 'site');
    const dist = path.join(root, 'dist');
    mkdirSync(path.join(root, 'openapi'), { recursive: true });
    mkdirSync(path.join(dist, 'pagefind/fragment'), { recursive: true });
    mkdirSync(path.join(dist, 'guides'));
    mkdirSync(path.join(dist, 'api/pages/reference/api'), { recursive: true });
    writeFileSync(path.join(dist, 'guides/index.html'), '<html><body><main>ordinary</main></body></html>');
    const locs: string[] = [];
    const records: Record<string, unknown>[] = [];
    const llmsLines: string[] = ['# D', '', '## OpenAPI documents', ''];
    let n = 0;
    for (const v of config.specs) {
      writeFileSync(path.join(root, v.file), doc);
      const base = path.join(dist, 'reference/api', v.label);
      mkdirSync(path.join(base, 'operations/listthings'), { recursive: true });
      writeFileSync(path.join(base, 'index.html'), page(v.label, v.released, 'x'));
      writeFileSync(path.join(base, 'operations/listthings/index.html'), page(v.label, v.released, 'x', true, `<script type="module">${picker}</script>`));
      writeFileSync(path.join(base, 'openapi.yaml'), doc);
      writeFileSync(path.join(base, 'openapi.yaml.sha256'), `${sha(doc)}  openapi.yaml\n`);
      // WP03's synthetic agent records: one index entry and one page payload
      // per version, both naming the raw document and its digest.
      const record = {
        slug: `reference/api/${v.label}`,
        rawDocumentUrl: `/reference/api/${v.label}/openapi.yaml`,
        sha256: sha(doc),
      };
      records.push(record);
      writeFileSync(
        path.join(dist, 'api/pages/reference/api', `${v.label}.json`),
        JSON.stringify({ ...record, _links: { describedby: { href: record.rawDocumentUrl } } }, null, 2),
      );
      llmsLines.push(`- [${v.label}](https://d.example/reference/api/${v.label}/openapi.yaml)${v.released ? '' : ' (unreleased)'}`);
      if (llmsOperations) llmsLines.push('  - GET /things: List things');
      for (const rel of [`reference/api/${v.label}/`, `reference/api/${v.label}/operations/listthings/`]) {
        // FR-015 (WP05): an unreleased version's pages are built and served but held
        // back from the sitemap and the search index, so the complete site lists and
        // indexes only the released versions.
        if (!v.released) continue;
        locs.push(`<url><loc>https://d.example/${rel}</loc></url>`);
        writeFileSync(path.join(dist, 'pagefind/fragment', `${n++}.pf_fragment`), fragment(`/${rel}`));
      }
    }
    writeFileSync(path.join(dist, 'sitemap-0.xml'), `<urlset>${locs.join('')}</urlset>`);
    writeFileSync(path.join(dist, 'api/index.json'), JSON.stringify({ count: records.length, pages: records }, null, 2));
    writeFileSync(path.join(dist, 'llms.txt'), `${llmsLines.join('\n')}\n`);
    return dist;
  }

  const check = (dist: string, allowlist: Record<string, unknown> = allow) =>
    assertions.checkOpenApiArtifacts(dist, { config, allow: allowlist } as never);
  const checkAs = (dist: string, configOverride: Record<string, unknown>) =>
    assertions.checkOpenApiArtifacts(dist, { config: { ...config, ...configOverride }, allow } as never);
  const edit = (file: string, fn: (s: string) => string) => writeFileSync(file, fn(readFileSync(file, 'utf8')));

  it('passes on a complete site', async () => {
    expect(await check(site())).toEqual([]);
  });

  it('fails on one changed byte of a raw document, and on a wrong checksum line', async () => {
    const dist = site();
    edit(path.join(dist, 'reference/api/v1/openapi.yaml'), (s) => s.replace('List things', 'List thingz'));
    expect(await check(dist)).toEqual([expect.stringContaining('raw: reference/api/v1/openapi.yaml differs from openapi/v1.yaml')]);
    writeFileSync(path.join(dist, 'reference/api/next/openapi.yaml.sha256'), `${sha(doc)} openapi.yaml\n`);
    expect(await check(dist)).toContainEqual(expect.stringContaining('next/openapi.yaml.sha256 is not'));
  });

  it('fails when an llms.txt line, a sitemap entry or a search entry is dropped', async () => {
    const dist = site();
    edit(path.join(dist, 'llms.txt'), (s) => s.replace(' (unreleased)', ''));
    expect(await check(dist)).toContainEqual(expect.stringContaining('llms.txt: no line for next (unreleased)'));
    edit(path.join(dist, 'sitemap-0.xml'), (s) => s.replace('<url><loc>https://d.example/reference/api/v1/</loc></url>', ''));
    expect(await check(dist)).toContainEqual(expect.stringContaining('sitemap: no entry for reference/api/v1/'));
    rmSync(path.join(dist, 'pagefind/fragment/1.pf_fragment'));
    expect(await check(dist)).toContainEqual(
      expect.stringContaining('search: reference/api/v1/operations/listthings/ is not in the Pagefind index'),
    );
  });

  it('fails when a version has no agent record, or the section miscounts', async () => {
    const dist = site();
    const indexFile = path.join(dist, 'api/index.json');
    const index = JSON.parse(readFileSync(indexFile, 'utf8')) as { pages: { slug: string }[] };
    index.pages = index.pages.filter((record) => record.slug !== 'reference/api/next');
    index.count = index.pages.length;
    writeFileSync(indexFile, JSON.stringify(index, null, 2));
    const problems = await check(dist);
    expect(problems).toContainEqual(expect.stringContaining('agents: no api/index.json record for reference/api/next'));
    expect(problems).toContainEqual(expect.stringContaining('agents: api/index.json holds 1 reference/api record, expected 2'));
  });

  it('fails when an agent record or page payload names the wrong digest or raw document', async () => {
    const dist = site();
    edit(path.join(dist, 'api/index.json'), (s) => s.replace(sha(doc), 'a'.repeat(64)));
    expect(await check(dist)).toContainEqual(
      expect.stringContaining("agents: the reference/api/v1 record's sha256 is not the digest of openapi/v1.yaml"),
    );
    edit(path.join(dist, 'api/pages/reference/api/next.json'), (s) => s.replace('/reference/api/next/openapi.yaml', '/nowhere.yaml'));
    expect(await check(dist)).toContainEqual(
      expect.stringContaining("agents: the reference/api/next page payload's rawDocumentUrl does not name /reference/api/next/openapi.yaml"),
    );
    rmSync(path.join(dist, 'api/pages/reference/api/v1.json'));
    expect(await check(dist)).toContainEqual(
      expect.stringContaining('agents: api/pages/reference/api/v1.json is missing'),
    );
  });

  it('the llms operation lines: required when opted in, refused otherwise (NFR-002)', async () => {
    const dist = site(true);
    expect(await checkAs(dist, { llmsOperations: true })).toEqual([]);
    // The same lines without the option must fail: byte-compat is checked, not assumed.
    expect(await checkAs(dist, {})).toContainEqual(
      expect.stringContaining('llms.txt: an operation line for reference/api/v1 is present without llmsOperations on'),
    );
    // With the option on, a dropped line fails.
    edit(path.join(dist, 'llms.txt'), (s) => s.replace('  - GET /things: List things\n', ''));
    expect(await checkAs(dist, { llmsOperations: true })).toContainEqual(
      expect.stringContaining('llms.txt: no operation line "- GET /things: List things" for reference/api/v1'),
    );
  });

  it('fails when an unreleased version reaches the sitemap, the index or the Pagefind marker (FR-015)', async () => {
    const dist = site();
    edit(path.join(dist, 'sitemap-0.xml'), (s) =>
      s.replace('</urlset>', '<url><loc>https://d.example/reference/api/next/</loc></url></urlset>'),
    );
    writeFileSync(path.join(dist, 'pagefind/fragment', '9.pf_fragment'), fragment('/reference/api/next/'));
    edit(path.join(dist, 'reference/api/next/index.html'), (s) => s.replace('<main>', '<main data-pagefind-body>'));
    const problems = await check(dist);
    expect(problems).toContainEqual(expect.stringContaining('sitemap: unreleased reference/api/next/ is listed (FR-015)'));
    expect(problems).toContainEqual(expect.stringContaining('search: unreleased reference/api/next/ is in the Pagefind index (FR-015)'));
    expect(problems).toContainEqual(expect.stringContaining('search: unreleased reference/api/next/ carries data-pagefind-body (FR-015)'));
  });

  it('fails on a missing page, a missing name, a missing link and a missing badge', async () => {
    const dist = site();
    rmSync(path.join(dist, 'reference/api/v1/operations'), { recursive: true });
    expect(await check(dist)).toContainEqual(expect.stringContaining('pages: reference/api/v1/operations/listthings/index.html is missing'));
    for (const rel of ['index.html', 'operations/listthings/index.html']) {
      edit(path.join(dist, 'reference/api/next', rel), (s) => s.replace('colour', '').replace('List things', 'x'));
    }
    edit(path.join(dist, 'reference/api/next/index.html'), (s) => s.replace('<a href="/reference/api/v1/">v1</a>', '').replace('<span class="dk-openapi-badge">unreleased</span>', ''));
    const problems = await check(dist);
    expect(problems).toContainEqual(expect.stringContaining('names: reference/api/next/operations/listthings/ does not show the operation "List things"'));
    expect(problems).toContainEqual(expect.stringContaining('property "colour" of schema Thing'));
    expect(problems).toContainEqual(expect.stringContaining('nav: reference/api/next/ does not link to version v1'));
    expect(problems).toContainEqual(expect.stringContaining('badge: the unreleased version next shows no "unreleased" text'));
  });

  it('fails when an operation page links another version overview instead of the same operation', async () => {
    const dist = site();
    edit(path.join(dist, 'reference/api/v1/operations/listthings/index.html'), (s) =>
      s.replace('/reference/api/next/operations/listthings/', '/reference/api/next/'),
    );
    expect(await check(dist)).toEqual([
      expect.stringContaining('nav: reference/api/v1/operations/listthings/ does not link to version next at the same operation'),
    ]);
  });

  it('fails on a request console, a spec fetch, a draft notice and a noindex', async () => {
    const dist = site();
    const v1 = path.join(dist, 'reference/api/v1/index.html');
    edit(v1, (s) => s.replace('Overview', 'Overview <form action="x"></form> <p class="dk-draft-notice">d</p>').replace('index', 'noindex'));
    edit(path.join(dist, 'reference/api/v1/operations/listthings/index.html'), (s) => s.replace('</script>', ';fetch("openapi.yaml")</script>'));
    const problems = await check(dist, { ...allow, scripts: [] });
    expect(problems).toEqual(expect.arrayContaining([
      expect.stringContaining('console: reference/api/v1/ shows form'),
      expect.stringContaining('status: reference/api/v1/ carries the draft notice'),
      expect.stringContaining('status: reference/api/v1/ is marked noindex'),
      expect.stringContaining('console: reference/api/v1/operations/listthings/ shows spec fetch'),
    ]));
  });

  describe('NFR-002 as waived', () => {
    it('accepts exactly the pinned renderer script and nothing else', async () => {
      const dist = site();
      expect(await check(dist)).toEqual([]);
      // Turning code samples on adds scripts the waiver does not cover: it must fail.
      edit(path.join(dist, 'reference/api/v1/operations/listthings/index.html'), (s) =>
        s.replace('</main>', '<script type="module">customElements.define("sl-openapi-snippets", class extends HTMLElement {})</script></main>'),
      );
      const problems = await check(dist);
      expect(problems.filter((p) => p.startsWith('csp:'))).toEqual([
        expect.stringMatching(/^csp: an inline script hash beyond the pinned test allowlist: sha256-/),
      ]);
    });

    it('fails when the allowlist no longer names the renderer script, an external origin appears, or a style attribute is added', async () => {
      const dist = site();
      expect(await check(dist, { ...allow, scripts: [] })).toEqual([expect.stringContaining('csp: an inline script hash')]);
      edit(path.join(dist, 'reference/api/v1/index.html'), (s) =>
        s.replace('<main>', '<main><img src="https://cdn.example/x.png"><p style="--sl-icon-size: 1em">'),
      );
      const problems = await check(dist);
      expect(problems).toContainEqual(expect.stringContaining('an external origin no ordinary page has: https://cdn.example'));
      expect(problems).toContainEqual(expect.stringContaining('an inline styleAttribute hash beyond'));
    });

    it('lets an ordinary page carry what a reference page carries (no false addition)', () => {
      const html = `<p style="color:red"><script>var a=1</script>`;
      expect(assertions.cspAdditions([html], [html], assertions.OPENAPI_INLINE_ALLOWLIST).problems).toEqual([]);
    });

    it('pins the two hashes ADR-0049 records', () => {
      expect(assertions.OPENAPI_INLINE_ALLOWLIST.scripts).toEqual(['sha256-28IjJBwKnS9sgb0aB8YXgnUhJmV3Az7aJiw6QBthXmo=']);
      expect(assertions.OPENAPI_INLINE_ALLOWLIST.styleAttributes).toEqual(['sha256-XlpZgcpFaLbPrgzm4PHCiD/OJXhR+DZxGuVpy2P4Cq0=']);
    });
  });
});
