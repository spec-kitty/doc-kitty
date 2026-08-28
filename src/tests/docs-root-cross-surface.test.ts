import { describe, it, expect, vi, afterEach } from 'vitest';
import path from 'node:path';
import process from 'node:process';

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

const { defineDocKittyIntegrations, DK_DOCS_ROOT_ENV } = await import('../lib/config.js');
const { docsRoot } = await import('../lib/routes/shared.js');

const abs = (rel: string) => path.resolve(process.cwd(), rel);

const originalDocsRootEnv = process.env[DK_DOCS_ROOT_ENV];
afterEach(() => {
  collectionEntries.length = 0;
  if (originalDocsRootEnv === undefined) delete process.env[DK_DOCS_ROOT_ENV];
  else process.env[DK_DOCS_ROOT_ENV] = originalDocsRootEnv;
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
