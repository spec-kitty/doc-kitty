import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';

/**
 * F3/F5 cross-surface agreement. The finding: the section registry could be
 * resolved from TWO different roots — the sitemap draft/feeds filter (config.ts)
 * from the `docsDir` OPTION, the discovery routes (`docsRoot()`) from the
 * content-layer `filePath`. If a consumer set them differently the sitemap and the
 * routes filtered against DIFFERENT `sections.yaml` files.
 *
 * The fix publishes ONE authoritative root: `defineDocKittyIntegrations` writes
 * `DK_DOCS_ROOT = path.resolve(cwd, docsDir)` at setup — the exact value the
 * sitemap filter resolves internally — and `docsRoot()` PREFERS it. This test
 * proves the route consumes the identical absolute root the integration published,
 * even when the content-layer signal would derive a DIFFERENT one.
 *
 * `config.ts` statically imports `@astrojs/starlight`; `shared.ts` statically
 * imports `astro:content`. Both are neutralized so importing the modules is
 * side-effect-free (we only build the integrations array + call the resolver).
 */
vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({
    name: '@astrojs/starlight',
    __starlightConfig: config,
    hooks: {},
  }),
}));

const { collectionEntries } = vi.hoisted(() => ({
  collectionEntries: [] as Array<{ id: string; filePath?: string }>,
}));
vi.mock('astro:content', () => ({
  getCollection: async () => collectionEntries,
}));

const { defineDocKittyIntegrations, DK_DOCS_ROOT_ENV, DK_INDEX_BASENAME_ENV } = await import('../lib/config.js');
const { docsRoot } = await import('../lib/routes/shared.js');
const { docKittyDocsLoader } = await import('../lib/schema.js');

const abs = (rel: string) => path.resolve(process.cwd(), rel);

const originalDocsRootEnv = process.env[DK_DOCS_ROOT_ENV];
const originalIndexEnv = process.env[DK_INDEX_BASENAME_ENV];
const tmpRoots: string[] = [];
afterEach(() => {
  collectionEntries.length = 0;
  if (originalDocsRootEnv === undefined) delete process.env[DK_DOCS_ROOT_ENV];
  else process.env[DK_DOCS_ROOT_ENV] = originalDocsRootEnv;
  if (originalIndexEnv === undefined) delete process.env[DK_INDEX_BASENAME_ENV];
  else process.env[DK_INDEX_BASENAME_ENV] = originalIndexEnv;
  while (tmpRoots.length) rmSync(tmpRoots.pop()!, { recursive: true, force: true });
});

describe('integration ↔ route resolve the SAME docs root (F3/F5)', () => {
  it('the route reads the root the integration published for a custom docsDir', async () => {
    // The content layer would derive `documentation/`, but the integration was
    // configured with docsDir `content-tree` — the classic #22 split. After the
    // integration publishes DK_DOCS_ROOT, the route must resolve the integration's
    // root, guaranteeing the sitemap filter and the route share one registry.
    collectionEntries.push({ id: 'index', filePath: 'documentation/README.md' });

    defineDocKittyIntegrations({ title: 'Docs', docsDir: 'content-tree' });

    expect(process.env[DK_DOCS_ROOT_ENV]).toBe(abs('content-tree'));
    expect(await docsRoot()).toBe(abs('content-tree'));
  });

  it('publishes the convention default `<cwd>/docs` when docsDir is omitted', async () => {
    defineDocKittyIntegrations({ title: 'Docs' });
    expect(process.env[DK_DOCS_ROOT_ENV]).toBe(abs('docs'));
    expect(await docsRoot()).toBe(abs('docs'));
  });
});

/**
 * FR-007: a site sets its index names once, in `defineDocKittyIntegrations`, and
 * the docs loader reads them without being told again. The loader is driven
 * through its real `load()` against an in-memory store, and the ids it stores
 * are what decide each page's route.
 */
describe('integration -> loader: index names are set once (FR-007)', () => {
  /** A docs tree with `x/index.md` and `y/README.md`; returns the ids `load()` stores. */
  async function loadedIds(
    loaderOptions: { indexBasename?: string | string[] } = {},
    files: string[] = ['x/index.md', 'y/README.md'],
  ): Promise<string[]> {
    const root = mkdtempSync(path.join(tmpdir(), 'dk-loader-ids-'));
    tmpRoots.push(root);
    for (const rel of files) {
      mkdirSync(path.dirname(path.join(root, 'docs', rel)), { recursive: true });
      writeFileSync(path.join(root, 'docs', rel), '---\ntitle: T\ndoc_status: active\n---\nBody.\n');
    }
    const entries = new Map<string, { id: string; digest?: string }>();
    const store = {
      get: (id: string) => entries.get(id),
      has: (id: string) => entries.has(id),
      keys: () => [...entries.keys()],
      values: () => [...entries.values()],
      entries: () => [...entries.entries()],
      delete: (id: string) => void entries.delete(id),
      clear: () => entries.clear(),
      set: (entry: { id: string; digest?: string }) => void entries.set(entry.id, entry),
      addModuleImport: () => {},
      addAssetImports: () => {},
    };
    const context = {
      collection: 'docs',
      store,
      config: {
        root: pathToFileURL(`${root}/`),
        srcDir: pathToFileURL(`${root}/src/`),
        legacy: { collections: false },
      },
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
      parseData: async ({ data }: { data: Record<string, unknown> }) => data,
      generateDigest: (text: string) => String(text.length),
      entryTypes: new Map([
        [
          '.md',
          {
            getEntryInfo: async ({ contents }: { contents: string }) => {
              const parsed = matter(contents);
              return { data: parsed.data, body: parsed.content };
            },
          },
        ],
      ]),
    };
    const loader = docKittyDocsLoader({ base: path.join(root, 'docs'), ...loaderOptions });
    await loader.load(context as unknown as Parameters<typeof loader.load>[0]);
    return [...entries.keys()].sort();
  }

  it('publishes the normalised list, ordered as written, and README when nothing is set', () => {
    defineDocKittyIntegrations({ title: 'Docs' });
    expect(JSON.parse(process.env[DK_INDEX_BASENAME_ENV]!)).toEqual(['README']);
    defineDocKittyIntegrations({ title: 'Docs', indexBasename: ['index', 'README'] });
    expect(JSON.parse(process.env[DK_INDEX_BASENAME_ENV]!)).toEqual(['index', 'README']);
  });

  it('rejects a bad index name without the gherkin option, and accepts a good one', () => {
    expect(() => defineDocKittyIntegrations({ title: 'Docs', indexBasename: 'a/b' })).toThrow(/indexBasename/);
    expect(() => defineDocKittyIntegrations({ title: 'Docs', indexBasename: 'index' })).not.toThrow();
  });

  it('serves the pages the integration names as indexes, with no option on the loader', async () => {
    defineDocKittyIntegrations({ title: 'Docs', indexBasename: ['index'] });
    expect(await loadedIds()).toEqual(['x', 'y/README']);
    // Same tree, integration says README: the answer flips, so the first
    // assertion is the setting at work and not a property of the fixture.
    defineDocKittyIntegrations({ title: 'Docs', indexBasename: ['README'] });
    expect(await loadedIds()).toEqual(['x/index', 'y']);
    // The seam is internal: a hand-set value that is not a JSON array is refused.
    for (const bad of ['README', '{"a":1}']) {
      process.env[DK_INDEX_BASENAME_ENV] = bad;
      await expect(loadedIds()).rejects.toThrow(/\[dk-config\] DK_INDEX_BASENAME is set by defineDocKittyIntegrations and must not be set by hand; got: /);
    }
  });

  it('refuses a loader option that differs from the integration, naming both values', async () => {
    defineDocKittyIntegrations({ title: 'Docs', indexBasename: ['README', 'index'] });
    const error = await loadedIds({ indexBasename: ['index'] }).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/\["index"\].*\["README","index"\]/);
    expect((error as Error).message).toMatch(/Move the value to defineDocKittyIntegrations/);
    // Positive control: the same set in both places loads the same tree, in any order or case.
    expect(await loadedIds({ indexBasename: ['README', 'index'] })).toEqual(['x', 'y']);
    expect(await loadedIds({ indexBasename: ['INDEX', 'readme'] })).toEqual(['x', 'y']);
  });

  it('refuses a tree where two files share a route, naming both; one file less loads (FR-004)', async () => {
    defineDocKittyIntegrations({ title: 'Docs', indexBasename: ['README'] });
    const error = await loadedIds({}, ['x/README.md', 'x/index.md']).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/x\/README\.md/);
    expect((error as Error).message).toMatch(/x\/index\.md/);
    expect((error as Error).message).toMatch(/^\s*\/x\/$/m); // the contested route
    // Positive control: the same tree minus one file loads.
    expect(await loadedIds({}, ['x/README.md'])).toEqual(['x']);
  });
});
