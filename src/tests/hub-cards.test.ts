/**
 * The hub card composition reads the CONFIGURED docs root (#342 consolidation
 * item 3; #426 deferred item 7): `DK_DOCS_ROOT`, as the hub data does through
 * `options.docsDir`, else `cwd/docs` as before. With a custom `docsDir` the hub page
 * and the paged listing otherwise disagree with the hub data and fail the build.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { DK_DOCS_ROOT_ENV, deleteInternalEnv, setInternalEnv } from '../lib/internal-env.mjs';
import { restoreInternalEnv } from './helpers/restore-internal-env';

const { roots } = vi.hoisted(() => ({ roots: [] as string[] }));
vi.mock('astro:content', () => ({ getCollection: async () => [] }));
vi.mock('../lib/sections.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sections.js')>();
  return { ...actual, resolveSectionRegistry: (root: string) => (roots.push(root), actual.resolveSectionRegistry(root)) };
});
vi.mock('../scripts/generate-adr-index.mjs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../scripts/generate-adr-index.mjs')>();
  return { ...actual, loadAdrIdRule: (root: string) => (roots.push(root), actual.loadAdrIdRule(root)) };
});

const { composeHubCards } = await import('../lib/hub-cards.js');
restoreInternalEnv();

afterEach(() => {
  roots.length = 0;
  deleteInternalEnv(DK_DOCS_ROOT_ENV);
});

describe('composeHubCards docs root (item 3)', () => {
  it('reads the configured docs root', async () => {
    const custom = path.join(path.sep, 'site', 'content');
    setInternalEnv(DK_DOCS_ROOT_ENV, custom);
    await composeHubCards('missions');
    expect(roots).toEqual([custom, custom]);
  });

  it('falls back to cwd/docs without one', async () => {
    deleteInternalEnv(DK_DOCS_ROOT_ENV);
    await composeHubCards('missions');
    expect(roots).toEqual([path.join(process.cwd(), 'docs'), path.join(process.cwd(), 'docs')]);
  });
});
