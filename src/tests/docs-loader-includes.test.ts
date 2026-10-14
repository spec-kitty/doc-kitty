/**
 * Content-layer freshness for `::gherkin` includes (ADR-0051 decision 11;
 * 02 §Content-layer freshness; 05 mutation check 6).
 *
 * `docKittyDocsLoader` wraps Astro's `glob()`. These tests drive the REAL
 * `glob()` through a fake loader context shaped like the one the Astro 5 content
 * layer passes (`content-layer.js` `#getLoaderContext`): a Map-backed store, a
 * string digest, an `.md` entry type that strips frontmatter, and an
 * EventEmitter standing in for the dev watcher. What they pin:
 *
 *  - the page digest covers the bytes of each included file: same bytes, same
 *    digest; an edited include changes it; an unrelated `.feature` does not;
 *  - a page without an include directive (including one whose `::gherkin` sits
 *    in a code fence) keeps exactly the digest `glob()` alone would store, so no
 *    existing cache is invalidated;
 *  - a watcher `change` of an included file re-emits `change` for the pages that
 *    include it, and only those, and `glob()` then re-syncs the page; a page
 *    named as an include `src` (not a `.feature` file, so the stage refuses
 *    it) is never tracked, so a page cannot include itself or form a cycle;
 *  - a page whose Gherkin render threw is stored under a digest no sync
 *    computes, so every sync renders it again until it renders (ADR-0051
 *    decision 5).
 *
 * The build-level proof (a real `astro build` twice over one content cache) is
 * `docs-loader-includes-build.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { docKittyDocsLoader } from '../lib/schema.js';
import { MAX_INCLUDE_BYTES } from '../lib/gherkin/include-path.mjs';
import { gherkinIncludeSources } from '../lib/gherkin/include-scan.mjs';

type StoredEntry = { id: string; data: Record<string, unknown>; digest?: string; filePath?: string };

/** Stand-in for Astro's xxhash digest: any deterministic string hash will do. */
const plainDigest = (data: Record<string, unknown> | string): string =>
  createHash('sha1')
    .update(typeof data === 'string' ? data : JSON.stringify(data))
    .digest('hex');

/** Astro's `.md` entry type, reduced to what `glob()` reads: frontmatter off, body trimmed. */
const markdownEntryType = {
  extensions: ['.md'],
  async getEntryInfo({ contents }: { contents: string; fileUrl: URL }) {
    const m = /^---\n([\s\S]*?)\n---\n?/.exec(contents);
    const data: Record<string, unknown> = {};
    for (const line of (m?.[1] ?? '').split('\n')) {
      const kv = /^(\w+):\s*(.*)$/.exec(line);
      if (kv) data[kv[1]] = kv[2];
    }
    return { data, body: (m ? contents.slice(m[0].length) : contents).trim() };
  },
};

class FakeWatcher extends EventEmitter {
  added: string[] = [];
  add(p: string) {
    this.added.push(p);
    return this;
  }
}

let root: string;
const store = new Map<string, StoredEntry>();

function write(rel: string, contents: string) {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, contents);
}
const abs = (rel: string) => path.join(root, rel);
const page = (body: string) => ['---', 'title: T', 'doc_status: published', '---', '', body, ''].join('\n');

function fakeContext(watcher?: FakeWatcher, entryType: object = markdownEntryType) {
  return {
    collection: 'docs',
    store: {
      keys: () => store.keys(),
      values: () => store.values(),
      entries: () => store.entries(),
      get: (id: string) => store.get(id),
      has: (id: string) => store.has(id),
      set: (entry: StoredEntry) => {
        store.set(entry.id, entry);
        return true;
      },
      delete: (id: string) => {
        store.delete(id);
      },
      clear: () => store.clear(),
      addModuleImport: () => {},
      addAssetImports: () => {},
    },
    meta: {},
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    config: {
      root: pathToFileURL(`${root}/`),
      srcDir: pathToFileURL(`${root}/src/`),
      legacy: { collections: false },
    },
    parseData: async ({ data }: { data: Record<string, unknown> }) => data,
    renderMarkdown: async () => ({ html: '' }),
    generateDigest: plainDigest,
    watcher,
    entryTypes: new Map([['.md', entryType]]),
  };
}

/** One full sync of the docs collection, as the content layer would run it. */
async function load(loader = docKittyDocsLoader({ base: 'docs' }), watcher?: FakeWatcher, entryType?: object) {
  // The loader's `load` is typed with Astro's public `LoaderContext`; the fake
  // implements the members `glob()` touches.
  await loader.load(fakeContext(watcher, entryType) as never);
  return loader;
}
const digestOf = (id: string) => store.get(id)?.digest;

const GUIDE = page('# Guide\n\n::gherkin{src="features/a.feature"}');
const PLAIN = page('# Plain\n\nNo include here.');
const FENCED = page('# Fenced\n\n```markdown\n::gherkin{src="features/a.feature"}\n```');

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'dk-loader-includes-'));
  store.clear();
  // `src` resolves against the cwd, as in the remark stage (the site root in a build).
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  write('docs/README.md', page('# Home'));
  write('docs/guide.md', GUIDE);
  write('docs/plain.md', PLAIN);
  write('docs/fenced.md', FENCED);
  write('features/a.feature', 'Feature: A\n  Scenario: One\n    Given a step\n');
  write('features/b.feature', 'Feature: B\n  Scenario: Two\n    Given a step\n');
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('gherkinIncludeSources', () => {
  it('collects leaf directives only, de-duplicated and sorted', () => {
    const md = [
      '::gherkin{src="z.feature"}',
      '',
      '- ::gherkin{src="a.feature" scenario="x"}',
      '',
      '::gherkin{src="z.feature" tags="@t"}',
      '',
      'Prose :gherkin{src="text.feature"} and `::gherkin{src="code.feature"}`.',
      '',
      '```',
      '::gherkin{src="fence.feature"}',
      '```',
      '',
      ':::gherkin{src="container.feature"}',
      ':::',
    ].join('\n');
    expect(gherkinIncludeSources(md)).toEqual(['a.feature', 'z.feature']);
  });

  it('does not parse markdown without the marker', () => {
    expect(gherkinIncludeSources('# Title\n\n:gherkin text directive')).toEqual([]);
  });
});

describe('the page digest folds included files', () => {
  it('gives the same digest for the same bytes', async () => {
    await load();
    const first = digestOf('guide');
    expect(first).toBeDefined();
    store.clear();
    await load();
    expect(digestOf('guide')).toBe(first);
  });

  it('changes when the included file changes', async () => {
    await load();
    const before = digestOf('guide');
    write('features/a.feature', 'Feature: A\n  Scenario: One edited\n    Given a step\n');
    await load();
    expect(digestOf('guide')).not.toBe(before);
  });

  it('stays the same when an unrelated .feature file changes', async () => {
    await load();
    const before = digestOf('guide');
    write('features/b.feature', 'Feature: B\n  Scenario: Two edited\n    Given a step\n');
    await load();
    expect(digestOf('guide')).toBe(before);
  });

  it('folds a sentinel for a missing include, deterministically', async () => {
    write('docs/guide.md', page('# Guide\n\n::gherkin{src="features/missing.feature"}'));
    await load();
    const missing = digestOf('guide');
    store.clear();
    await load();
    expect(digestOf('guide')).toBe(missing);
    // The file appears: the page re-renders.
    write('features/missing.feature', 'Feature: Now here\n');
    await load();
    expect(digestOf('guide')).not.toBe(missing);
  });

  describe('reads only what the stage could include', () => {
    it('never reads a file over the include size limit', async () => {
      const huge = (fill: string) => 'Feature: Huge\n'.padEnd(MAX_INCLUDE_BYTES + 1, fill);
      write('features/huge.feature', huge('#'));
      write('docs/guide.md', page('# Guide\n\n::gherkin{src="features/huge.feature"}'));
      await load();
      const before = digestOf('guide');
      write('features/huge.feature', huge('%'));
      await load();
      expect(digestOf('guide')).toBe(before);
    });

    it.skipIf(process.platform === 'win32')('treats a FIFO as unreadable instead of blocking on it', async () => {
      execFileSync('mkfifo', [abs('features/pipe.feature')]);
      write('docs/guide.md', page('# Guide\n\n::gherkin{src="features/pipe.feature"}'));
      await load();
      const fifo = digestOf('guide');
      expect(fifo).toBeDefined();
      // Same fold as a file that cannot be read: the src stays, the hash is the sentinel.
      unlinkSync(abs('features/pipe.feature'));
      store.clear();
      await load();
      expect(digestOf('guide')).toBe(fifo);
    });

    it('never reads nor watches a src that is not a .feature file', async () => {
      const outside = mkdtempSync(path.join(tmpdir(), 'dk-loader-not-feature-'));
      try {
        const rel = path.relative(root, path.join(outside, 'notes.txt')).split(path.sep).join('/');
        writeFileSync(path.join(outside, 'notes.txt'), 'one\n');
        write('docs/guide.md', page(`# Guide\n\n::gherkin{src="${rel}"}`));
        const watcher = new FakeWatcher();
        await load(undefined, watcher);
        const before = digestOf('guide');
        expect(watcher.added).not.toContain(path.join(outside, 'notes.txt'));
        writeFileSync(path.join(outside, 'notes.txt'), 'two\n');
        await load();
        expect(digestOf('guide')).toBe(before);
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    });

    it('never reads nor watches an absolute src', async () => {
      const outside = mkdtempSync(path.join(tmpdir(), 'dk-loader-absolute-'));
      try {
        const file = path.join(outside, 'x.feature');
        writeFileSync(file, 'Feature: X\n');
        write('docs/guide.md', page(`# Guide\n\n::gherkin{src="${file.split(path.sep).join('/')}"}`));
        const watcher = new FakeWatcher();
        await load(undefined, watcher);
        const before = digestOf('guide');
        expect(watcher.added).toEqual([abs('docs/')]);
        writeFileSync(file, 'Feature: X edited\n');
        await load(undefined, watcher);
        expect(digestOf('guide')).toBe(before);
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
    });
  });

  it('keeps the unwrapped digest for a page with no include directive', async () => {
    await load();
    const raw = (rel: string) => plainDigest(readFileSync(abs(rel), 'utf8'));
    expect(digestOf('plain')).toBe(raw('docs/plain.md'));
    // A `::gherkin` inside a code fence is not a directive: no fold either.
    expect(digestOf('fenced')).toBe(raw('docs/fenced.md'));
    // And the guide's digest is NOT the plain one: its include is folded.
    expect(digestOf('guide')).not.toBe(raw('docs/guide.md'));
  });

  it('ignores an edit to a file named only inside a code fence', async () => {
    await load();
    const before = digestOf('fenced');
    write('features/a.feature', 'Feature: A\n  Scenario: Edited\n');
    await load();
    expect(digestOf('fenced')).toBe(before);
  });
});

describe('a failed render is never a cache hit', () => {
  /** An `.md` entry type that renders, and throws for a body holding `BROKEN` (as the stage would). */
  function renderingEntryType() {
    const rendered: string[] = [];
    return {
      rendered,
      entryType: {
        ...markdownEntryType,
        async getRenderFunction() {
          return async ({ id, body }: { id: string; body: string }) => {
            rendered.push(id);
            if (body.includes('BROKEN')) throw new Error('[dk-gherkin] broken');
            return { html: '<p></p>' };
          };
        },
      },
    };
  }
  const BROKEN = page('```gherkin\nBROKEN\n```');
  const raw = (rel: string) => plainDigest(readFileSync(abs(rel), 'utf8'));

  it('renders a page whose Gherkin render failed on every sync, until it renders', async () => {
    write('docs/broken.md', BROKEN);
    const { rendered, entryType } = renderingEntryType();
    const loader = await load(undefined, undefined, entryType);
    expect(digestOf('broken')).not.toBe(raw('docs/broken.md'));
    expect(digestOf('plain')).toBe(raw('docs/plain.md'));

    rendered.length = 0;
    await load(loader, undefined, entryType);
    // Unchanged pages are cache hits; the broken one is rendered again.
    expect(rendered).toEqual(['broken']);

    write('docs/broken.md', page('```gherkin\nFeature: Fixed\n```'));
    await load(loader, undefined, entryType);
    expect(digestOf('broken')).toBe(raw('docs/broken.md'));
    rendered.length = 0;
    await load(loader, undefined, entryType);
    expect(rendered).toEqual([]);
  });

  it('forgets a failed render whose entry is dropped as a draft', async () => {
    // Drafts off: the broken draft renders (and throws) but is never stored.
    vi.stubEnv('DK_PUBLISH_DRAFTS_RESOLVED', 'off');
    try {
      const draft = (body: string) => ['---', 'title: T', 'doc_status: draft', '---', '', body, ''].join('\n');
      write('docs/later.md', draft('```gherkin\nBROKEN\n```'));
      const { rendered, entryType } = renderingEntryType();
      const loader = await load(undefined, undefined, entryType);
      expect(store.has('later')).toBe(false);

      // Published and fixed: stored under its plain digest, then a cache hit.
      write('docs/later.md', page('```gherkin\nFeature: Fixed\n```'));
      await load(loader, undefined, entryType);
      expect(digestOf('later')).toBe(raw('docs/later.md'));
      rendered.length = 0;
      await load(loader, undefined, entryType);
      expect(rendered).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('leaves a failed render that does not mention gherkin to Astro', async () => {
    write('docs/other.md', page('BROKEN for another reason'));
    const { entryType } = renderingEntryType();
    await load(undefined, undefined, entryType);
    expect(digestOf('other')).toBe(raw('docs/other.md'));
  });
});

describe('the dev watcher re-syncs dependent pages', () => {
  /** Wait for `glob()`'s async `onChange` to store a new digest. */
  async function until(check: () => boolean) {
    for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
    expect(check()).toBe(true);
  }

  it('emits change for the pages that include the changed file, and only those', async () => {
    write('docs/second.md', page('::gherkin{src="features/a.feature" scenario="One"}'));
    write('docs/other.md', page('::gherkin{src="features/b.feature"}'));
    const watcher = new FakeWatcher();
    await load(undefined, watcher);
    const before = digestOf('guide');
    const emit = vi.spyOn(watcher, 'emit');

    write('features/a.feature', 'Feature: A\n  Scenario: One\n    Given an edited step\n');
    watcher.emit('change', abs('features/a.feature'));

    const pageEmits = emit.mock.calls.filter(([, p]) => p !== abs('features/a.feature'));
    expect(pageEmits).toEqual([
      ['change', abs('docs/guide.md')],
      ['change', abs('docs/second.md')],
    ]);
    // `glob()`'s own handler re-read the page and stored the new digest.
    await until(() => digestOf('guide') !== before);
  });

  it('emits nothing for an unrelated .feature change', async () => {
    const watcher = new FakeWatcher();
    await load(undefined, watcher);
    const emit = vi.spyOn(watcher, 'emit');
    watcher.emit('change', abs('features/b.feature'));
    expect(emit.mock.calls).toEqual([['change', abs('features/b.feature')]]);
  });

  it('drops the edges of a page that no longer includes the file', async () => {
    const watcher = new FakeWatcher();
    await load(undefined, watcher);
    write('docs/guide.md', page('# Guide\n\nNo include any more.'));
    watcher.emit('change', abs('docs/guide.md'));
    await until(() => digestOf('guide') === plainDigest(page('# Guide\n\nNo include any more.')));
    const emit = vi.spyOn(watcher, 'emit');
    watcher.emit('change', abs('features/a.feature'));
    expect(emit.mock.calls).toEqual([['change', abs('features/a.feature')]]);
  });

  it('re-syncs dependents when an included file is deleted', async () => {
    const watcher = new FakeWatcher();
    await load(undefined, watcher);
    const before = digestOf('guide');
    const emit = vi.spyOn(watcher, 'emit');
    unlinkSync(abs('features/a.feature'));
    watcher.emit('unlink', abs('features/a.feature'));
    expect(emit.mock.calls).toContainEqual(['change', abs('docs/guide.md')]);
    await until(() => digestOf('guide') !== before);
  });

  it('adds only includes outside the project root to the watcher', async () => {
    const outside = mkdtempSync(path.join(tmpdir(), 'dk-loader-outside-'));
    try {
      writeFileSync(path.join(outside, 'x.feature'), 'Feature: X\n');
      const rel = path.relative(root, path.join(outside, 'x.feature')).split(path.sep).join('/');
      write('docs/outside.md', page(`::gherkin{src="${rel}"}`));
      const watcher = new FakeWatcher();
      await load(undefined, watcher);
      // `glob()` adds its base directory; the loader adds the outside include only.
      expect([...watcher.added].sort()).toEqual([abs('docs/'), path.join(outside, 'x.feature')].sort());
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('does not loop on a page that includes itself: a page is no include', async () => {
    write('docs/self.md', page('::gherkin{src="docs/self.md"}'));
    const watcher = new FakeWatcher();
    await load(undefined, watcher);
    const emit = vi.spyOn(watcher, 'emit');
    // `glob()`'s own handler re-syncs the page; the loader adds nothing.
    watcher.emit('change', abs('docs/self.md'));
    expect(emit.mock.calls).toEqual([['change', abs('docs/self.md')]]);
  });

  it('never chases an include cycle between pages: neither page is tracked as an include', async () => {
    write('docs/ping.md', page('::gherkin{src="docs/pong.md"}'));
    write('docs/pong.md', page('::gherkin{src="docs/ping.md"}'));
    const watcher = new FakeWatcher();
    await load(undefined, watcher);
    const emit = vi.spyOn(watcher, 'emit');
    watcher.emit('change', abs('docs/ping.md'));
    expect(emit.mock.calls).toEqual([['change', abs('docs/ping.md')]]);
  });

  it('does not stack listeners across re-syncs', async () => {
    const watcher = new FakeWatcher();
    const loader = await load(undefined, watcher);
    await load(loader, watcher);
    const emit = vi.spyOn(watcher, 'emit');
    watcher.emit('change', abs('features/a.feature'));
    expect(emit.mock.calls.filter(([, p]) => p === abs('docs/guide.md'))).toHaveLength(1);
  });
});
