/**
 * The materialised spec list and the WP02 extension points (mission
 * openapi-second-slice-01M6WXJ4, WP02; FR-006, FR-007, FR-008, FR-023, FR-028,
 * C-007).
 *
 * `materialiseOpenApiSpecs` runs once at config time and returns the ONE
 * ordered list every surface reads: bytes and sha256 computed once (FR-007),
 * operations extracted with the pinned renderer's slug rules (C-007, proved
 * against the routes of a real ops-200 build), and the publisher writing the
 * config-time bytes even after the source file changes (TOCTOU).
 *
 * The rejected-input rows that used to live in `openapi-options.test.ts`
 * (unknown version, unparsable, missing, empty, over 10 MB, alias-heavy) are
 * proven here now: they are file reads, and the option's own check is static.
 *
 * The extension points of plan.md's parallel-edit registry each get a unit
 * test here: `specSources`, `buildDoneHooks`, `devHandlers`, `pagePropsHooks`,
 * `sitemapPredicates`, `OpenApiNav.current.operationSlug`, the virtual module's
 * operations, the extended publication and the shared cache writer.
 *
 * Every case is titled `[WP02]`: red until this work package lands.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildOpenApiFixture, readAll, removeOpenApiFixtureBuilds } from './helpers/openapi-build';
import { ops200Yaml } from './fixtures/openapi/ops-200/generate.mjs';

const materialise = await import('../lib/openapi/materialise.mjs');
const archive = await import('../lib/openapi/archive.mjs');
const { extractOperations } = await import('../lib/openapi/operations.mjs');
const cache = await import('../lib/openapi/cache.mjs');
const { MAX_YAML_ALIASES } = await import('../lib/openapi/limits.mjs');
const { normaliseOpenApiOptions, parseDocument } = await import('../lib/openapi/options.mjs');
// WP09's sources: the two transitional refusal tests below unregister them for
// their assertion and restore them afterwards (coordinator ruling, pre-granted
// edit; WP09 registration lands them on materialise.mjs's load).
const { bundleSource, swagger2Source } = await import('../lib/openapi/bundle.mjs');
const adapters = await import('../lib/openapi/adapters.js');
const publish = await import('../lib/integrations/openapi-publish.js');
const { readPublication } = await import('../lib/openapi/publication.js');
const { publicationFile } = await import('./helpers/openapi-publication.js');

const sha = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

const V1 = `${[
  'openapi: 3.1.0',
  'info:',
  '  title: Parcels API',
  '  version: 1.0.0',
  'paths:',
  '  /parcels:',
  '    get:',
  '      operationId: listParcels',
  '      summary: List parcels',
  '      responses:',
  "        '200':",
  '          description: The parcels.',
  '  /parcels/{parcelId}:',
  '    delete:',
  '      operationId: deleteParcel',
  '      summary: Delete a parcel',
  '      responses:',
  "        '204':",
  '          description: Gone.',
  'components:',
  '  schemas:',
  '    Parcel:',
  '      type: object',
].join('\n')}\n`;

const V2 = V1.replace('Parcels API', 'Parcels API v2').replace('version: 1.0.0', 'version: 2.0.0');

let cwd: string;
let site: string;

beforeAll(() => {
  cwd = process.cwd();
  site = mkdtempSync(path.join(tmpdir(), 'dk-openapi-mat-'));
  mkdirSync(path.join(site, 'docs'), { recursive: true });
  mkdirSync(path.join(site, 'openapi'), { recursive: true });
  const put = (name: string, text: string) => writeFileSync(path.join(site, 'openapi', name), text);
  put('v1.yaml', V1);
  put('v2.yaml', V2);
  put('v0.yml', V1.replace('3.1.0', '3.0.3'));
  put('unknown.yaml', 'openapi: 4.0.0\ninfo: {title: T, version: "1"}\npaths: {}\n');
  put('swagger3.yaml', 'swagger: "3.0"\ninfo: {title: T, version: "1"}\npaths: {}\n');
  put('swagger2.yaml', 'swagger: "2.0"\ninfo: {title: T, version: "1"}\npaths: {}\n');
  put('unparsable.yaml', 'openapi: 3.1.0\ninfo: {title: T, version: "1"}\npaths: {}\nkey: [unclosed\n');
  put('empty.yaml', '   \n');
  put('noinfo.yaml', 'openapi: 3.1.0\npaths: {}\n');
  put('nopaths.yaml', 'openapi: 3.1.0\ninfo: {title: T, version: "1"}\n');
  put(
    'multi.yaml',
    'openapi: 3.1.0\ninfo: {title: T, version: "1"}\npaths:\n  /a:\n    get:\n      responses:\n        "200":\n          $ref: "./other.yaml#/R"\n',
  );
  put('internal.yaml', 'openapi: 3.1.0\ninfo: {title: T, version: "1"}\npaths: {}\ncomponents:\n  schemas:\n    A: { $ref: "#/components/schemas/B" }\n    B: { type: string }\n');
  const aliases = ['openapi: 3.1.0', 'info: {title: T, version: "1"}', 'paths: {}', 'components:', '  schemas:'];
  for (let i = 0; i <= MAX_YAML_ALIASES; i += 1) aliases.push(`    A${i}: &a${i} {type: object}`, `    B${i}: *a${i}`);
  put('aliases.yaml', `${aliases.join('\n')}\n`);
});

afterAll(() => {
  process.chdir(cwd);
  rmSync(site, { recursive: true, force: true });
  removeOpenApiFixtureBuilds();
});

const renderer = () => ({});
const option = (over: Record<string, unknown> = {}) =>
  normaliseOpenApiOptions(
    { renderer, specs: [{ path: 'openapi/v1.yaml', label: 'v1', released: true }], ...over },
    { siteRoot: site },
  );
const context = () => ({ siteRoot: site, offline: false, cacheDir: path.join(site, '.cache') });
const materialised = (over?: Record<string, unknown>) => materialise.materialiseOpenApiSpecs(option(over), context());

describe('materialiseOpenApiSpecs (FR-006, FR-007, FR-023)', () => {
  it('[WP02] materialises a self-contained local file: bytes, sha256, renderPath, title, apiVersion, operations', () => {
    const specs = materialised();
    expect(specs).toHaveLength(1);
    const spec = specs[0]!;
    expect(spec.label).toBe('v1');
    expect(spec.released).toBe(true);
    expect(spec.origin).toBe('file');
    expect(spec.ext).toBe('yaml');
    expect(spec.renderPath).toBe(path.join(site, 'openapi/v1.yaml'));
    expect(spec.bytes.equals(readFileSync(path.join(site, 'openapi/v1.yaml')))).toBe(true);
    expect(spec.sha256).toBe(sha(spec.bytes));
    expect(spec.title).toBe('Parcels API');
    expect(spec.apiVersion).toBe('1.0.0');
    expect(spec.operations.map((o) => [o.method, o.path, o.summary, o.operationId, o.slug])).toEqual([
      ['GET', '/parcels', 'List parcels', 'listParcels', 'operations/listparcels'],
      ['DELETE', '/parcels/{parcelId}', 'Delete a parcel', 'deleteParcel', 'operations/deleteparcel'],
    ]);
  });

  it('[WP02] explicit specs keep config order (FR-023)', () => {
    const specs = materialised({
      specs: [
        { path: 'openapi/v2.yaml', label: 'v2', released: false },
        { path: 'openapi/v1.yaml', label: 'v1', released: true },
      ],
    });
    expect(specs.map((s) => s.label)).toEqual(['v2', 'v1']);
    expect(specs[0]!.released).toBe(false);
    expect(specs[0]!.title).toBe('Parcels API v2');
  });

  it('[WP02] accepts a 3.0 document, a .yml file and an internal $ref', () => {
    const specs = materialised({ specs: [{ path: 'openapi/v0.yml', label: 'v0', released: true }] });
    expect(specs[0]!.ext).toBe('yml');
    expect(() =>
      materialise.materialiseOpenApiSpecs(
        normaliseOpenApiOptions(
          { renderer, specs: [{ path: 'openapi/internal.yaml', label: 'internal', released: true }] },
          { siteRoot: site },
        ),
        context(),
      ),
    ).not.toThrow();
  });

  it('[WP02] rejects a document whose version field is unknown, naming the entry and the cause', () => {
    expect(() => materialised({ specs: [{ path: 'openapi/unknown.yaml', label: 'v1', released: true }] })).toThrow(
      /\[dk-openapi\] specs\[0\] "v1": not OpenAPI 3\.0, 3\.1 or Swagger 2\.0 \(found openapi: "4\.0\.0"\)/,
    );
  });

  it('[WP02] rejects a Swagger document that is not 2.0 the same way', () => {
    expect(() => materialised({ specs: [{ path: 'openapi/swagger3.yaml', label: 'v1', released: true }] })).toThrow(
      /not OpenAPI 3\.0, 3\.1 or Swagger 2\.0 \(found swagger: "3\.0"\)/,
    );
  });

  it('[WP02] rejects an unparsable file', () => {
    expect(() => materialised({ specs: [{ path: 'openapi/unparsable.yaml', label: 'v1', released: true }] })).toThrow(
      /\[dk-openapi\] specs\[0\] "v1": cannot parse as YAML or JSON/,
    );
  });

  it('[WP02] rejects a missing file, and a directory, as unreadable', () => {
    expect(() => materialised({ specs: [{ path: 'openapi/absent.yaml', label: 'v1', released: true }] })).toThrow(
      '[dk-openapi] specs[0] "v1": cannot read the file (openapi/absent.yaml)',
    );
    // The path must pass the static extension check, so the directory itself
    // needs a .yaml name; a bare directory path is refused before the read.
    mkdirSync(path.join(site, 'openapi', 'dir.yaml'));
    expect(() => materialised({ specs: [{ path: 'openapi/dir.yaml', label: 'v1', released: true }] })).toThrow(
      /cannot read the file/,
    );
  });

  it('[WP02] rejects an empty file', () => {
    expect(() => materialised({ specs: [{ path: 'openapi/empty.yaml', label: 'v1', released: true }] })).toThrow(
      '[dk-openapi] specs[0] "v1": the file is empty (openapi/empty.yaml)',
    );
  });

  it('[WP02] rejects a file over the 10 MB limit (FR-028)', () => {
    const huge = path.join(site, 'openapi', 'huge.yaml');
    writeFileSync(huge, `openapi: 3.1.0\ninfo:\n  title: Big\n  version: "1"\n  description: ${'x'.repeat(11 * 1024 * 1024)}\npaths: {}\n`);
    try {
      expect(() => materialised({ specs: [{ path: 'openapi/huge.yaml', label: 'v1', released: true }] })).toThrow(
        /\[dk-openapi\] specs\[0\] "v1": .*10 MB.* \(openapi\/huge\.yaml\)/,
      );
    } finally {
      rmSync(huge);
    }
  });

  it(`[WP02] rejects a file with more than ${MAX_YAML_ALIASES} YAML aliases (FR-028)`, () => {
    expect(() => materialised({ specs: [{ path: 'openapi/aliases.yaml', label: 'v1', released: true }] })).toThrow(
      /\[dk-openapi\] specs\[0\] "v1": .*alias/,
    );
  });

  it('[WP02] rejects a document without info, or without paths/webhooks/components', () => {
    expect(() => materialised({ specs: [{ path: 'openapi/noinfo.yaml', label: 'v1', released: true }] })).toThrow(
      '"info" must be an object',
    );
    expect(() => materialised({ specs: [{ path: 'openapi/nopaths.yaml', label: 'v1', released: true }] })).toThrow(
      'one of "paths", "webhooks" or "components" must be an object',
    );
  });

  it('[WP02] verifies a path pin and rejects a wrong one', () => {
    const pin = sha(V1);
    expect(() => materialised({ specs: [{ path: 'openapi/v1.yaml', label: 'v1', released: true, sha256: pin }] })).not.toThrow();
    expect(() =>
      materialised({ specs: [{ path: 'openapi/v1.yaml', label: 'v1', released: true, sha256: 'f'.repeat(64) }] }),
    ).toThrow(/\[dk-openapi\] specs\[0\] "v1": sha256 mismatch/);
  });
});

describe('the specSources registry (plan.md seam; WP08/WP09/WP10 add one import each)', () => {
  it('[WP02] refuses multi-file specs until the bundler lands (WP09)', () => {
    // WP09's bundler registers on load now; this test pins the UNREGISTERED
    // refusal, so it unregisters for the assertion and restores in finally
    // (coordinator ruling; pre-granted edit).
    materialise.registerSpecSource('bundle', undefined as never);
    try {
      expect(() => materialised({ specs: [{ path: 'openapi/multi.yaml', label: 'v1', released: true }] })).toThrow(
        /\[dk-openapi\] specs\[0\] "v1": .*not supported/,
      );
    } finally {
      materialise.registerSpecSource('bundle', bundleSource);
    }
  });

  it('[WP02] refuses Swagger 2.0 specs until the converter lands', () => {
    // As above: WP09's converter source registers on load now.
    materialise.registerSpecSource('swagger2', undefined as never);
    try {
      expect(() => materialised({ specs: [{ path: 'openapi/swagger2.yaml', label: 'v1', released: true }] })).toThrow(
        /\[dk-openapi\] specs\[0\] "v1": .*not supported/,
      );
    } finally {
      materialise.registerSpecSource('swagger2', swagger2Source);
    }
  });

  it('[WP02] refuses remote specs until the fetcher lands (WP10)', async () => {
    const { materialiseRemote } = await import('../lib/openapi/remote.mjs');
    materialise.registerSpecSource('remote', undefined);
    try {
      expect(() =>
        materialised({ specs: [{ url: 'https://specs.example.test/api.yaml', sha256: 'e'.repeat(64), label: 'v1', released: true }] }),
      ).toThrow(/\[dk-openapi\] specs\[0\] "v1": .*not supported/);
    } finally {
      materialise.registerSpecSource('remote', materialiseRemote);
    }
  });

  it('[WP02] refuses an unregistered archive kind — the registry\'s refusal, not the kind\'s', () => {
    // WP08 registers the archive source; unregister it to prove the refusal
    // below is the registry's. Restored in `finally`, so this case holds
    // whichever sources a lane registers.
    materialise.registerSpecSource('archive', undefined as never);
    try {
      expect(() =>
        materialised({ specs: [], archive: { glob: 'openapi/*.yaml', labelPattern: 'v(\\d+)', released: true } }),
      ).toThrow(/\[dk-openapi\] archive "openapi\/\*\.yaml": .*not supported/);
    } finally {
      materialise.registerSpecSource('archive', archive.materialiseArchive);
    }
  });

  it('[WP02] dispatches to a registered source with the read file and its parsed document', () => {
    const seen: Array<{ entry: string; document?: unknown; bytes?: Buffer }> = [];
    const stub = (input: { entry: string; document?: unknown; bytes?: Buffer }) => {
      seen.push(input);
      return [
        {
          label: 'from-source',
          released: false,
          origin: 'swagger2' as const,
          ext: 'yaml',
          bytes: input.bytes!,
          sha256: sha(input.bytes!),
          renderPath: '/converted',
          title: 'Converted',
          apiVersion: '2.0',
          operations: [],
        },
      ];
    };
    materialise.registerSpecSource('swagger2', stub);
    try {
      const specs = materialised({ specs: [{ path: 'openapi/swagger2.yaml', label: 'v1', released: true }] });
      expect(seen).toHaveLength(1);
      expect(seen[0]!.entry).toBe('specs[0] "v1"');
      expect((seen[0]!.document as { swagger: string }).swagger).toBe('2.0');
      expect(specs).toHaveLength(1);
      expect(specs[0]!.label).toBe('from-source');
      expect(specs[0]!.origin).toBe('swagger2');
    } finally {
      materialise.registerSpecSource('swagger2', undefined as never);
    }
    // Unregistered again: the not-supported refusal is back.
    expect(() => materialised({ specs: [{ path: 'openapi/swagger2.yaml', label: 'v1', released: true }] })).toThrow(
      /not supported/,
    );
  });
});

describe('the adapter seams (plan.md registry)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Plugin = { name: string; hooks: Record<string, (p: any) => unknown> };

  function innerIntegration(): Plugin['hooks'] {
    const specs = materialised();
    const plugin = adapters.openApiPlugin(option(), specs) as unknown as Plugin;
    const addIntegration = vi.fn();
    plugin.hooks['config:setup']({ command: 'build', addIntegration, addRouteMiddleware: vi.fn() });
    return (addIntegration.mock.calls[0][0] as { hooks: Plugin['hooks'] }).hooks;
  }

  it('[WP02] buildDoneHooks run inside the inner integration, after the publisher wrote its output', () => {
    const hooks = innerIntegration();
    expect(hooks['astro:build:done']).toBeTypeOf('function');
    const outDir = path.join(site, 'dist-hooks');
    const rawPath = path.join(outDir, 'reference/api/v1/openapi.yaml');
    let sawPublished: boolean | undefined;
    materialise.buildDoneHooks.push(() => {
      sawPublished = existsSync(rawPath);
    });
    try {
      hooks['astro:build:done']({ dir: pathToFileURL(`${outDir}/`), logger: { warn: () => {} } });
      expect(sawPublished).toBe(true);
    } finally {
      materialise.buildDoneHooks.pop();
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('[WP02] devHandlers run in astro:server:setup', () => {
    const hooks = innerIntegration();
    expect(hooks['astro:server:setup']).toBeTypeOf('function');
    const seen: unknown[] = [];
    materialise.devHandlers.push((params: unknown) => {
      seen.push(params);
    });
    try {
      const params = { server: {} };
      hooks['astro:server:setup'](params);
      expect(seen).toEqual([params]);
    } finally {
      materialise.devHandlers.pop();
    }
  });

  it('[WP02] pagePropsHooks merge into the getPageProps splice; an empty list leaves it byte-identical', () => {
    const code = 'const x = { frontmatter: { title } }';
    const plain = adapters.patchPageProps(code);
    materialise.pagePropsHooks.push({ key: 'pagefind', moduleUrl: 'file:///virtual-wp05.mjs', exportName: 'pagefind' });
    try {
      const patched = adapters.patchPageProps(code);
      expect(patched).toContain('import { pagefind as dkPageProps_pagefind } from "file:///virtual-wp05.mjs";');
      expect(patched).toContain(', pagefind: dkPageProps_pagefind(title, schema, pathItemOperation, tag)');
    } finally {
      materialise.pagePropsHooks.pop();
    }
    expect(adapters.patchPageProps(code)).toBe(plain);
  });

  it('[WP02] sitemapPredicates compose with AND over the draft filter, which passes through untouched when none is registered', () => {
    const draft = vi.fn((page: { draftOk: boolean }) => page.draftOk);
    expect(materialise.composeSitemapPredicates(draft)).toBe(draft);
    const predicate = vi.fn((page: { a: boolean }) => page.a);
    materialise.sitemapPredicates.push(predicate);
    try {
      const composed = materialise.composeSitemapPredicates(draft);
      expect(composed({ draftOk: true, a: true })).toBe(true);
      expect(composed({ draftOk: true, a: false })).toBe(false);
      expect(composed({ draftOk: false, a: true })).toBe(false);
      expect(predicate).toHaveBeenCalledTimes(2);
    } finally {
      materialise.sitemapPredicates.pop();
    }
  });

  it('[WP02] resolveOpenApiNav carries the operation slug of an operation page, not of a tag page or an overview', () => {
    const data = { section: 'reference/api', versions: [{ label: 'v1', released: true, operations: [] }] };
    expect(adapters.resolveOpenApiNav('/reference/api/v1/operations/listparcels/', '/', data)?.current.operationSlug).toBe('listparcels');
    expect(adapters.resolveOpenApiNav('/reference/api/v1/operations/listparcels', '/', data)?.current.operationSlug).toBe('listparcels');
    expect(adapters.resolveOpenApiNav('/reference/api/v1/operations/sharedthing/delete/', '/', data)?.current.operationSlug).toBe('sharedthing/delete');
    expect(adapters.resolveOpenApiNav('/reference/api/v1/operations/tags/parcels/', '/', data)?.current.operationSlug).toBeUndefined();
    expect(adapters.resolveOpenApiNav('/reference/api/v1/', '/', data)?.current.operationSlug).toBeUndefined();
  });

  it('[WP02] the virtual module carries the operations and released flags', () => {
    const source = adapters.openApiModuleSource({
      section: 'reference/api',
      versions: [
        { label: 'v1', released: false, operations: [{ method: 'GET', path: '/p', summary: 'List', slug: 'operations/list' }] },
      ],
    });
    const data = JSON.parse(source.replace(/^export const openApi = /, '').replace(/;\n$/, '')) as {
      versions: Array<{ released: boolean; operations: Array<{ method: string }> }>;
    };
    expect(data.versions[0]!.released).toBe(false);
    expect(data.versions[0]!.operations[0]!.method).toBe('GET');
  });
});

describe('the extended publication (FR-006 handoff)', () => {
  it('[WP02] toPublication carries llmsOperations and every version\'s sha256, title, apiVersion, operations and rawRoute', () => {
    const options = option({ llmsOperations: true });
    const specs = materialise.materialiseOpenApiSpecs(options, context());
    const publication = publish.toPublication(options, specs);
    expect(publication.section).toBe('reference/api');
    expect(publication.llmsOperations).toBe(true);
    expect(publication.versions).toHaveLength(1);
    const entry = publication.versions[0]!;
    expect(entry).toMatchObject({
      label: 'v1',
      released: true,
      ext: 'yaml',
      sha256: specs[0]!.sha256,
      title: 'Parcels API',
      apiVersion: '1.0.0',
      rawRoute: '/reference/api/v1/openapi.yaml',
    });
    expect(entry.operations).toEqual(specs[0]!.operations);
    expect(readPublication(publicationFile(publication))).toEqual(publication);
    expect(readPublication(publicationFile({ section: 'reference/api', llmsOperations: false, versions: [] }))).toEqual({
      section: 'reference/api',
      llmsOperations: false,
      versions: [],
    });
  });
});

describe('the publisher writes the config-time bytes (FR-007, TOCTOU)', () => {
  it('[WP02] a source file changed after materialisation never reaches the output', () => {
    const options = normaliseOpenApiOptions(
      { renderer, specs: [{ path: 'openapi/toctou.yaml', label: 't', released: true }] },
      { siteRoot: site },
    );
    writeFileSync(path.join(site, 'openapi', 'toctou.yaml'), V1);
    const specs = materialise.materialiseOpenApiSpecs(options, context());
    const configTime = specs[0]!.bytes;
    writeFileSync(path.join(site, 'openapi', 'toctou.yaml'), V1.replace('Parcels API', 'Mutated API'));
    const outDir = path.join(site, 'dist-toctou');
    try {
      publish.publishOpenApiDocuments(outDir, { section: options.section, specs });
      const written = readFileSync(path.join(outDir, 'reference/api/t/openapi.yaml'));
      expect(written.equals(configTime)).toBe(true);
      expect(written.toString('utf8')).not.toContain('Mutated');
      expect(readFileSync(path.join(outDir, 'reference/api/t/openapi.yaml.sha256'), 'utf8')).toBe(
        `${specs[0]!.sha256}  openapi.yaml\n`,
      );
    } finally {
      rmSync(outDir, { recursive: true, force: true });
      rmSync(path.join(site, 'openapi', 'toctou.yaml'));
    }
  });
});

describe('the shared cache writer (plan.md seam; WP09/WP10 call it)', () => {
  it('[WP02] writeCacheAtomic renames a unique temp file into place, and readCacheVerified hashes before returning', () => {
    const dir = path.join(site, 'cache');
    const payload = Buffer.from('openapi: 3.1.0\n');
    const target = cache.writeCacheAtomic(dir, sha(payload), 'yaml', payload);
    expect(target).toBe(path.join(dir, `${sha(payload)}.yaml`));
    expect(readFileSync(target).equals(payload)).toBe(true);
    expect(readdirSync(dir).filter((name) => name.includes('.tmp'))).toEqual([]);
    expect(cache.readCacheVerified(dir, sha(payload), 'yaml')!.equals(payload)).toBe(true);
  });

  it('[WP02] readCacheVerified refuses a corrupted entry, and a missing one, with undefined', () => {
    const dir = path.join(site, 'cache-corrupt');
    const payload = Buffer.from('openapi: 3.1.0\n');
    cache.writeCacheAtomic(dir, sha(payload), 'yaml', payload);
    writeFileSync(path.join(dir, `${sha(payload)}.yaml`), 'tampered');
    expect(cache.readCacheVerified(dir, sha(payload), 'yaml')).toBeUndefined();
    expect(cache.readCacheVerified(dir, 'b'.repeat(64), 'yaml')).toBeUndefined();
  });

  it('[WP02] writeCacheAtomic accepts a cache under a symlinked project path', () => {
    const real = path.join(site, 'symlinked-project-real');
    const link = path.join(site, 'symlinked-project-link');
    mkdirSync(real, { recursive: true });
    symlinkSync(real, link);
    const payload = Buffer.from('from a symlinked project');
    const dir = path.join(link, 'node_modules/.cache/doc-kitty/openapi');
    const target = cache.writeCacheAtomic(dir, sha(payload), 'yaml', payload);
    expect(target).toBe(path.join(realpathSync(real), 'node_modules/.cache/doc-kitty/openapi', `${sha(payload)}.yaml`));
    expect(readFileSync(target).equals(payload)).toBe(true);
  });

  it('[WP02] writeCacheAtomic refuses a symlinked cache entry below the resolved cache root', () => {
    const dir = path.join(site, 'cache-entry-symlink');
    mkdirSync(dir, { recursive: true });
    const target = path.join(dir, `${'d'.repeat(64)}.yaml`);
    const outside = path.join(site, 'outside-cache.yaml');
    writeFileSync(outside, 'outside');
    symlinkSync(outside, target);
    expect(() => cache.writeCacheAtomic(dir, 'd'.repeat(64), 'yaml', Buffer.from('x'))).toThrow(
      /\[dk-openapi\].*symlink/i,
    );
    expect(readFileSync(outside, 'utf8')).toBe('outside');
  });
});

describe('C-007: the slug rules of the pinned renderer (ops-200)', () => {
  it('[WP02] extractOperations lists exactly the operation routes the renderer built', () => {
    const built = buildOpenApiFixture({
      fixture: 'ops-200',
      openapi: { specs: [{ path: 'openapi/api.yaml', label: 'v1', released: true }] },
      files: { 'openapi/api.yaml': ops200Yaml() },
    });
    expect(built.status, `ops-200 build output:\n${built.output}`).toBe(0);
    const routes = [...readAll(built.dist).keys()]
      .filter((key) => /^reference\/api\/v1\/operations\/.+\/index\.html$/.test(key) && !key.includes('/operations/tags/'))
      .map((key) => key.slice('reference/api/v1/'.length, -'/index.html'.length));
    const slugs = new Set(extractOperations(parseDocument(ops200Yaml()) as never).map((operation) => operation.slug));
    expect(routes.length).toBeGreaterThan(100);
    expect(slugs.size).toBeGreaterThan(100);
    expect([...slugs].sort()).toEqual([...new Set(routes)].sort());
  }, 600_000);
});
