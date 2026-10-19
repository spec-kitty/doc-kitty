/**
 * The CHANGELOG.md loader wrapper (#192): the page is stored rendered even when
 * the wrapped loader calls `store.set` after load() returned (the `astro dev`
 * file watcher), and an edit of CHANGELOG.md re-renders it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Loader, LoaderContext } from 'astro/loaders';
import { withRepoChangelog, CHANGELOG_MARKER } from '../../example/src/changelog-loader.ts';

interface Entry {
  id: string;
  body?: string;
  digest?: string;
  rendered?: { html: string };
}
interface FakeStore {
  get(id: string): Entry | undefined;
  set(e: Entry): boolean;
  delete(id: string): void;
}

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function setup(changelog: string) {
  const dir = mkdtempSync(path.join(tmpdir(), 'changelog-loader-'));
  dirs.push(dir);
  const changelogPath = path.join(dir, 'CHANGELOG.md');
  writeFileSync(changelogPath, changelog);
  const entries = new Map<string, Entry>();
  const store: FakeStore = {
    get: (id: string) => entries.get(id),
    set: (e: Entry) => (entries.set(e.id, e), true),
    delete: (id: string) => entries.delete(id),
  };
  const handlers: Record<string, (p: string) => unknown> = {};
  const watcher = {
    add: vi.fn(),
    on: (ev: string, cb: (p: string) => unknown) => {
      handlers[ev] = cb;
    },
  };
  let wrappedStore!: FakeStore;
  const inner = {
    name: 'inner',
    load: async (ctx: LoaderContext) => {
      wrappedStore = ctx.store as unknown as FakeStore;
      wrappedStore.set({ id: 'changelog/releases', body: `x ${CHANGELOG_MARKER}`, digest: ctx.generateDigest(`x ${CHANGELOG_MARKER}`) });
    },
  } as unknown as Loader;
  const context = {
    store,
    watcher,
    generateDigest: (d: string) => `d:${d.length}`,
    renderMarkdown: async (md: string) => ({ html: `<r>${md}</r>` }),
  } as unknown as LoaderContext;
  const loader = withRepoChangelog(inner, {
    changelogPath,
    entryId: 'changelog/releases',
    repoBlobBase: 'https://github.com/o/r/blob/main/',
  });
  return { loader, context, entries, handlers, watcher, changelogPath, getStore: () => wrappedStore };
}

describe('withRepoChangelog (#192)', () => {
  it('stores the rendered changelog for a set during load', async () => {
    const t = setup('# Changelog\n\n## [0.1.0]\n- one\n');
    await t.loader.load(t.context);
    expect(t.entries.get('changelog/releases')?.rendered?.html).toContain('## [0.1.0]');
  });

  it('renders and stores a set made AFTER load() returned (dev watcher)', async () => {
    const t = setup('# Changelog\n\n## [0.1.0]\n- one\n');
    await t.loader.load(t.context);
    t.entries.clear();
    t.getStore().set({ id: 'changelog/releases', body: `y ${CHANGELOG_MARKER}`, digest: 'z' });
    const e = t.entries.get('changelog/releases');
    expect(e?.rendered?.html).toContain('- one');
    expect(e?.body).not.toContain(CHANGELOG_MARKER);
  });

  it('passes other entries through untouched', async () => {
    const t = setup('# Changelog\n');
    await t.loader.load(t.context);
    t.getStore().set({ id: 'other', body: 'b', digest: 'd' });
    expect(t.entries.get('other')?.rendered).toBeUndefined();
  });

  it('watches CHANGELOG.md and re-renders the page when it changes', async () => {
    const t = setup('# Changelog\n\n- old\n');
    await t.loader.load(t.context);
    expect(t.watcher.add).toHaveBeenCalledWith(path.resolve(t.changelogPath));
    writeFileSync(t.changelogPath, '# Changelog\n\n- fresh\n');
    await t.handlers.change(t.changelogPath);
    expect(t.entries.get('changelog/releases')?.rendered?.html).toContain('- fresh');
    await t.handlers.change('/elsewhere/other.md');
    expect(t.entries.get('changelog/releases')?.rendered?.html).toContain('- fresh');
  });
});
