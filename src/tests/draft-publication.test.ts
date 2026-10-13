/**
 * WP05 T032 — the draft-publication setting, without a build (FR-013, FR-014,
 * FR-017): the resolver, the env-file reader and the loader's per-entry policy.
 * `draft-publication-build.test.ts` proves the same setting on the built site.
 *
 * Mission: sidebar-frame-header-carrier-01M4T3CB, WP05.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';

import {
  DK_PUBLISH_DRAFTS_ENV,
  DK_PUBLISH_DRAFTS_RESOLVED_ENV,
  describePublishDrafts,
  draftRoutesOf,
  findSiteRoot,
  isDraftStatus,
  parseEnvFile,
  publishDraftsInForce,
  readEnvFiles,
  redirectsToDrafts,
  resolveDraftPublication,
  resolveDraftPublicationForGate,
  resolvePublishDrafts,
  routeOfTarget,
  takeSiteFlags,
} from '../lib/draft-publication.mjs';
import { applyDraftPolicy, docKittyDocsLoader } from '../lib/schema.js';
import { checkCoverage, urlToDistFile } from '../scripts/check-redirect-coverage.mjs';
import { draftPublicationIntegration, type RouteShapingOptions } from '../lib/config.js';
import { shapeSidebar } from '../lib/route-shaping.js';
import { ROOT_ENTRY_ID, isDraftEntry, isPublished } from '../lib/metadata.js';

describe('resolvePublishDrafts', () => {
  it('is off when nothing sets it (fail-closed default, FR-014)', () => {
    expect(resolvePublishDrafts({}, {})).toBe(false);
    expect(describePublishDrafts({}, {})).toEqual({ publish: false, source: 'default' });
  });

  it('accepts on and off, ignoring case and surrounding whitespace', () => {
    for (const value of ['on', 'ON', ' On ', '\ton\n']) {
      expect(resolvePublishDrafts({ [DK_PUBLISH_DRAFTS_ENV]: value }), value).toBe(true);
    }
    for (const value of ['off', 'OFF', ' Off ']) {
      expect(resolvePublishDrafts({ [DK_PUBLISH_DRAFTS_ENV]: value }), value).toBe(false);
    }
  });

  it('prefers the process environment over the env file', () => {
    const on = { [DK_PUBLISH_DRAFTS_ENV]: 'on' };
    const off = { [DK_PUBLISH_DRAFTS_ENV]: 'off' };
    expect(describePublishDrafts(off, on)).toEqual({ publish: false, source: 'process environment' });
    expect(describePublishDrafts(on, off)).toEqual({ publish: true, source: 'process environment' });
  });

  it('uses the env file when the process environment does not set it', () => {
    expect(describePublishDrafts({}, { [DK_PUBLISH_DRAFTS_ENV]: 'on' })).toEqual({
      publish: true,
      source: 'env file',
    });
  });

  it('treats an empty or blank value as not set and falls through', () => {
    const file = { [DK_PUBLISH_DRAFTS_ENV]: 'on' };
    expect(resolvePublishDrafts({ [DK_PUBLISH_DRAFTS_ENV]: '' }, file)).toBe(true);
    expect(resolvePublishDrafts({ [DK_PUBLISH_DRAFTS_ENV]: '   ' }, file)).toBe(true);
    expect(resolvePublishDrafts({ [DK_PUBLISH_DRAFTS_ENV]: '' }, { [DK_PUBLISH_DRAFTS_ENV]: '' })).toBe(false);
  });

  it('rejects any other value, naming the setting, both accepted values and the offender (FR-017)', () => {
    for (const value of ['maybe', 'true', '1', 'yes', 'onn']) {
      let message = '';
      try {
        resolvePublishDrafts({ [DK_PUBLISH_DRAFTS_ENV]: value });
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message, value).toContain('DK_PUBLISH_DRAFTS');
      expect(message, value).toContain('"on"');
      expect(message, value).toContain('"off"');
      expect(message, value).toContain(`"${value}"`);
    }
  });

  it('rejects an invalid env-file value too, and says it came from the file', () => {
    expect(() => resolvePublishDrafts({}, { [DK_PUBLISH_DRAFTS_ENV]: 'sometimes' })).toThrow(
      /env file sets it to "sometimes"/,
    );
  });

  it('does not let a valid env-file value hide an invalid process value', () => {
    expect(() =>
      resolvePublishDrafts({ [DK_PUBLISH_DRAFTS_ENV]: 'nope' }, { [DK_PUBLISH_DRAFTS_ENV]: 'on' }),
    ).toThrow(/process environment/);
  });
});

describe('publishDraftsInForce', () => {
  it('uses what the integration recorded for this build', () => {
    expect(publishDraftsInForce({ [DK_PUBLISH_DRAFTS_RESOLVED_ENV]: 'on' })).toBe(true);
    // The recorded value already includes the env file, so it beats the raw setting.
    expect(
      publishDraftsInForce({ [DK_PUBLISH_DRAFTS_RESOLVED_ENV]: 'off', [DK_PUBLISH_DRAFTS_ENV]: 'on' }),
    ).toBe(false);
  });

  it('falls back to the setting when no integration ran', () => {
    expect(publishDraftsInForce({})).toBe(false);
    expect(publishDraftsInForce({ [DK_PUBLISH_DRAFTS_ENV]: 'on' })).toBe(true);
    expect(() => publishDraftsInForce({ [DK_PUBLISH_DRAFTS_ENV]: 'maybe' })).toThrow(/DK_PUBLISH_DRAFTS/);
  });
});

describe('isDraftStatus', () => {
  it('counts draft and absent as draft, anything else as published', () => {
    expect(isDraftStatus('draft')).toBe(true);
    expect(isDraftStatus(undefined)).toBe(true);
    expect(isDraftStatus(null)).toBe(true);
    expect(isDraftStatus('active')).toBe(false);
    expect(isDraftStatus('deprecated')).toBe(false);
  });
});

describe('env files', () => {
  const dirs: string[] = [];
  const site = (files: Record<string, string>): string => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-drafts-'));
    dirs.push(dir);
    for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text);
    return dir;
  };
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('parses DK_ settings: comments, export prefix, quotes, trailing comment', () => {
    expect(
      parseEnvFile(
        [
          '# a comment',
          'DK_PUBLISH_DRAFTS=on',
          'export DK_A = "two words"',
          "DK_B='x' # note",
          'DK_C=plain # note',
          'OTHER=ignored',
          'not a setting',
        ].join('\r\n'),
      ),
    ).toEqual({ DK_PUBLISH_DRAFTS: 'on', DK_A: 'two words', DK_B: 'x', DK_C: 'plain' });
  });

  it('.env.development reaches the dev server only', () => {
    const root = site({ '.env.development': 'DK_PUBLISH_DRAFTS=on\n' });
    expect(resolvePublishDrafts({}, readEnvFiles(root, 'development'))).toBe(true);
    expect(resolvePublishDrafts({}, readEnvFiles(root, 'production'))).toBe(false);
  });

  it('a plain .env applies to both modes, and a mode file overrides it', () => {
    const root = site({ '.env': 'DK_PUBLISH_DRAFTS=on\n', '.env.production': 'DK_PUBLISH_DRAFTS=off\n' });
    expect(resolvePublishDrafts({}, readEnvFiles(root, 'development'))).toBe(true);
    expect(resolvePublishDrafts({}, readEnvFiles(root, 'production'))).toBe(false);
  });

  it('local files win over their shared counterparts; no files means no settings', () => {
    const root = site({ '.env': 'DK_PUBLISH_DRAFTS=off\n', '.env.local': 'DK_PUBLISH_DRAFTS=on\n' });
    expect(readEnvFiles(root, 'production')).toEqual({ DK_PUBLISH_DRAFTS: 'on' });
    expect(readEnvFiles(site({}), 'production')).toEqual({});
  });

  it('the process environment still beats every env file', () => {
    const root = site({ '.env': 'DK_PUBLISH_DRAFTS=on\n' });
    expect(resolvePublishDrafts({ DK_PUBLISH_DRAFTS: 'off' }, readEnvFiles(root, 'production'))).toBe(false);
  });
});

describe('applyDraftPolicy (docs loader)', () => {
  const entry = (id: string, data: Record<string, unknown>) => ({ id, data, body: 'text' });

  it('drops a draft, and an entry without a status, when drafts are off', () => {
    expect(applyDraftPolicy(entry('guides/wip', { doc_status: 'draft' }), false)).toBeNull();
    expect(applyDraftPolicy(entry('guides/wip', {}), false)).toBeNull();
  });

  it('keeps a published entry untouched in both modes', () => {
    const page = entry('guides/done', { doc_status: 'active' });
    expect(applyDraftPolicy(page, false)).toBe(page);
    expect(applyDraftPolicy(page, true)).toBe(page);
  });

  it('never filters the site root page, whatever its status', () => {
    const root = entry('index', { doc_status: 'draft' });
    expect(applyDraftPolicy(root, false)).toBe(root);
    expect(applyDraftPolicy(root, true)).toBe(root);
  });

  it('keeps a draft out of search when drafts are on, without touching the original', () => {
    const draft = entry('guides/wip', { doc_status: 'draft', title: 'WIP' });
    const kept = applyDraftPolicy(draft, true);
    expect(kept).toEqual({ id: 'guides/wip', body: 'text', data: { doc_status: 'draft', title: 'WIP', pagefind: false } });
    expect(draft.data).not.toHaveProperty('pagefind');
    // Already marked: the same object comes back, so the loader's sweep is a no-op.
    expect(applyDraftPolicy(kept!, true)).toBe(kept);
  });
});


describe('docKittyDocsLoader: a content store kept from a build with the other value', () => {
  // Astro keeps the content store between builds, and its glob loader does not
  // touch an entry whose file digest is unchanged. So after a build with the
  // other value the store still holds what that build decided. The wrapped
  // `load()` has to correct it; the example cannot show this in a build test,
  // so the loader is driven here against a store seeded the way the earlier
  // build would have left it.
  const saved = process.env[DK_PUBLISH_DRAFTS_RESOLVED_ENV];
  const dirs: string[] = [];
  afterEach(() => {
    if (saved === undefined) delete process.env[DK_PUBLISH_DRAFTS_RESOLVED_ENV];
    else process.env[DK_PUBLISH_DRAFTS_RESOLVED_ENV] = saved;
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  type Entry = { id: string; data: Record<string, unknown>; digest?: string; filePath?: string };
  const digestOf = (text: string): string => createHash('sha1').update(text).digest('hex');
  const SOURCES: Record<string, string> = {
    'guides/done.md': '---\ntitle: Done\ndoc_status: active\n---\nBody.\n',
    'guides/wip.md': '---\ntitle: WIP\ndoc_status: draft\n---\nBody.\n',
    'guides/unset.md': '---\ntitle: Unset\n---\nBody.\n',
  };

  /** A docs tree on disk and a store in the shape Astro hands a loader. */
  function fixture(seed: (id: string, file: string) => Entry | null) {
    const root = mkdtempSync(path.join(tmpdir(), 'dk-loader-'));
    dirs.push(root);
    const entries = new Map<string, Entry>();
    for (const [rel, text] of Object.entries(SOURCES)) {
      const abs = path.join(root, 'docs', rel);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, text, 'utf8');
      const id = rel.replace(/\.md$/, '');
      const seeded = seed(id, `docs/${rel}`);
      if (seeded) entries.set(id, { ...seeded, digest: digestOf(text), filePath: `docs/${rel}` });
    }
    const store = {
      get: (id: string) => entries.get(id),
      has: (id: string) => entries.has(id),
      keys: () => [...entries.keys()],
      values: () => [...entries.values()],
      entries: () => [...entries.entries()],
      delete: (id: string) => void entries.delete(id),
      clear: () => entries.clear(),
      // Like Astro's store: an entry whose digest it already holds is left alone.
      set: (entry: Entry) => {
        if (entries.get(entry.id)?.digest === entry.digest && entry.digest !== undefined) return false;
        entries.set(entry.id, entry);
        return true;
      },
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
      generateDigest: digestOf,
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
    const loader = docKittyDocsLoader({ base: path.join(root, 'docs') });
    const load = (): Promise<void> => loader.load(context as unknown as Parameters<typeof loader.load>[0]);
    return { entries, load };
  }

  it('on -> off: drafts an earlier ON build left in the store are gone after an OFF load', async () => {
    // What an ON build stores: every page, drafts marked `pagefind: false`.
    const { entries, load } = fixture((id) => ({
      id,
      data:
        id === 'guides/done'
          ? { title: 'Done', doc_status: 'active' }
          : { title: id, ...(id === 'guides/wip' ? { doc_status: 'draft' } : {}), pagefind: false },
    }));
    expect([...entries.keys()].sort()).toEqual(['guides/done', 'guides/unset', 'guides/wip']);

    process.env[DK_PUBLISH_DRAFTS_RESOLVED_ENV] = 'off';
    await load();

    expect([...entries.keys()]).toEqual(['guides/done']);
  });

  it('off -> on: drafts come back, and a draft stored without the search opt-out gains it', async () => {
    // `guides/wip` is seeded as a store could hold it without the marker (an
    // entry written before the setting existed); `guides/unset` is absent, as
    // an OFF build leaves it.
    const { entries, load } = fixture((id) =>
      id === 'guides/unset'
        ? null
        : { id, data: { title: id, doc_status: id === 'guides/wip' ? 'draft' : 'active' } },
    );

    process.env[DK_PUBLISH_DRAFTS_RESOLVED_ENV] = 'on';
    await load();

    expect([...entries.keys()].sort()).toEqual(['guides/done', 'guides/unset', 'guides/wip']);
    expect(entries.get('guides/wip')!.data.pagefind).toBe(false);
    expect(entries.get('guides/unset')!.data.pagefind).toBe(false);
    expect(entries.get('guides/done')!.data).not.toHaveProperty('pagefind');
  });
});

describe('draftPublicationIntegration', () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const name of [DK_PUBLISH_DRAFTS_ENV, DK_PUBLISH_DRAFTS_RESOLVED_ENV]) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  const DOCS = path.resolve(import.meta.dirname, '../../example/docs');
  const setup = (value: string | undefined, command = 'build'): RouteShapingOptions => {
    if (value === undefined) delete process.env[DK_PUBLISH_DRAFTS_ENV];
    else process.env[DK_PUBLISH_DRAFTS_ENV] = value;
    const options: RouteShapingOptions = {
      docsDir: DOCS,
      base: '/doc-kitty',
      indexBasename: ['README', 'index'],
      shapeSidebar: true,
      pagination: true,
    };
    const hook = draftPublicationIntegration(options).hooks['astro:config:setup'] as unknown as (
      arg: unknown,
    ) => void;
    // A site root with no env files, so only the process environment counts.
    hook({ command, config: { root: new URL('file:///nonexistent-dk-site/') } });
    return options;
  };

  it('off by default: records off and hands the draft slugs to sidebar shaping', () => {
    const options = setup(undefined);
    expect(process.env[DK_PUBLISH_DRAFTS_RESOLVED_ENV]).toBe('off');
    expect(options.unpublishedDirs).toEqual(
      expect.arrayContaining(['plans', 'plans/missions', 'adr/template', 'presentations/draft-preview']),
    );
    // Published pages are not listed.
    expect(options.unpublishedDirs).not.toContain('guides/getting-started');
  });

  it('on: records on, lists no unpublished directory, and leaves the user setting alone', () => {
    const options = setup('on');
    expect(process.env[DK_PUBLISH_DRAFTS_RESOLVED_ENV]).toBe('on');
    expect(process.env[DK_PUBLISH_DRAFTS_ENV]).toBe('on');
    expect(options.unpublishedDirs).toEqual([]);
  });

  it('an invalid value throws from the setup hook, which stops the build (FR-017)', () => {
    expect(() => setup('maybe')).toThrow(/DK_PUBLISH_DRAFTS must be "on" or "off"/);
  });

  it('the bare-Node draft routes are the ones the integration hands to sidebar shaping', () => {
    // The integration calls `draftRoutesOf`, the walker the gates use; this
    // checks the hand-over to sidebar shaping on the example tree.
    const fromIntegration = [...(setup('off').unpublishedDirs ?? [])].sort();
    const fromGates = [...draftRoutesOf(DOCS, ['README', 'index'])].map((r) => r.slice(1, -1)).sort();
    expect(fromGates).toEqual(fromIntegration);
    expect(fromGates).toContain('plans/missions/mission-alpha');
    expect(fromGates).not.toContain('');
  });

  describe('redirects into draft pages', () => {
    const STUB = (to: string): string =>
      `<!doctype html><title>Redirecting to: ${to}</title><meta http-equiv="refresh" content="0;url=${to}">`;
    const REDIRECTS = {
      '/guides/old-getting-started/': '/doc-kitty/guides/getting-started/',
      '/plans/features/mission-alpha/': '/doc-kitty/plans/missions/mission-alpha/',
      '/plans/features/mission-beta/': { status: 301, destination: '/doc-kitty/plans/missions/mission-beta' },
    };
    const outDirs: string[] = [];
    afterEach(() => {
      while (outDirs.length) rmSync(outDirs.pop()!, { recursive: true, force: true });
    });

    /** Run both hooks over a fake output holding one stub per redirect, plus a real page. */
    function build(value: string): { warnings: string[]; out: string } {
      process.env[DK_PUBLISH_DRAFTS_ENV] = value;
      const out = mkdtempSync(path.join(tmpdir(), 'dk-withheld-'));
      outDirs.push(out);
      for (const from of Object.keys(REDIRECTS)) {
        mkdirSync(path.join(out, from), { recursive: true });
        writeFileSync(path.join(out, from, 'index.html'), STUB('/somewhere/'), 'utf8');
      }
      const hooks = draftPublicationIntegration({
        docsDir: DOCS,
        base: '/doc-kitty',
        indexBasename: ['README', 'index'],
        shapeSidebar: true,
        pagination: true,
      }).hooks as unknown as Record<string, (arg: unknown) => void>;
      const warnings: string[] = [];
      const warn = console.warn;
      console.warn = (line: string) => void warnings.push(line);
      try {
        hooks['astro:config:setup']!({
          command: 'build',
          config: { root: new URL('file:///nonexistent-dk-site/'), redirects: REDIRECTS },
        });
        hooks['astro:build:done']!({ dir: pathToFileURL(`${out}/`), pages: [] });
      } finally {
        console.warn = warn;
      }
      return { warnings, out };
    }
    const stub = (out: string, from: string): boolean => existsSync(path.join(out, from, 'index.html'));

    it('off: warns once, naming each redirect and its draft target, and leaves their stubs out', () => {
      const { warnings, out } = build('off');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('/plans/features/mission-alpha/ -> /plans/missions/mission-alpha/');
      expect(warnings[0]).toContain('/plans/features/mission-beta/ -> /plans/missions/mission-beta/');
      expect(warnings[0]).not.toContain('old-getting-started');
      expect(stub(out, '/plans/features/mission-alpha/')).toBe(false);
      expect(stub(out, '/plans/features/mission-beta/')).toBe(false);
      // The emptied directories go too; a redirect to a published page stays.
      expect(existsSync(path.join(out, 'plans'))).toBe(false);
      expect(stub(out, '/guides/old-getting-started/')).toBe(true);
    });

    it('on: no warning, and every stub is kept', () => {
      const { warnings, out } = build('on');
      expect(warnings).toEqual([]);
      for (const from of Object.keys(REDIRECTS)) expect(stub(out, from)).toBe(true);
    });

    it('never deletes a real page that sits at a withheld redirect path', () => {
      process.env[DK_PUBLISH_DRAFTS_ENV] = 'off';
      const { out } = build('off');
      const file = path.join(out, 'plans/features/mission-alpha/index.html');
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, '<!doctype html><title>A page</title>', 'utf8');
      const hooks = draftPublicationIntegration({
        docsDir: DOCS,
        base: '/doc-kitty',
        indexBasename: ['README', 'index'],
        shapeSidebar: true,
        pagination: true,
      }).hooks as unknown as Record<string, (arg: unknown) => void>;
      const warn = console.warn;
      console.warn = () => {};
      try {
        hooks['astro:config:setup']!({
          command: 'build',
          config: { root: new URL('file:///nonexistent-dk-site/'), redirects: REDIRECTS },
        });
        hooks['astro:build:done']!({ dir: pathToFileURL(`${out}/`), pages: [] });
      } finally {
        console.warn = warn;
      }
      expect(existsSync(file)).toBe(true);
    });

    it('routeOfTarget strips base, query and fragment; another site is not a route', () => {
      expect(routeOfTarget('/doc-kitty/plans/missions/mission-alpha/', '/doc-kitty')).toBe('/plans/missions/mission-alpha/');
      expect(routeOfTarget('/doc-kitty/plans?x=1#top', '/doc-kitty/')).toBe('/plans/');
      expect(routeOfTarget('/doc-kitty-two/plans/', '/doc-kitty')).toBe('/doc-kitty-two/plans/');
      expect(routeOfTarget('plans/', '')).toBe('/plans/');
      expect(routeOfTarget('https://example.test/plans/', '')).toBeNull();
    });

    it('redirectsToDrafts lists only redirects whose target is a draft route, sorted by old URL', () => {
      const drafts = new Set(['/plans/missions/mission-alpha/', '/plans/missions/mission-beta/']);
      expect(redirectsToDrafts(REDIRECTS, drafts, '/doc-kitty')).toEqual([
        { from: '/plans/features/mission-alpha/', route: '/plans/missions/mission-alpha/' },
        { from: '/plans/features/mission-beta/', route: '/plans/missions/mission-beta/' },
      ]);
      expect(redirectsToDrafts(undefined, drafts)).toEqual([]);
      expect(redirectsToDrafts(REDIRECTS, new Set(), '/doc-kitty')).toEqual([]);
    });

    it('redirectsToDrafts follows a chain to its terminus: old -> renamed -> draft withholds both hops', () => {
      const drafts = new Set(['/plans/missions/mission-alpha/']);
      const chained = {
        '/plans/older/mission-alpha/': '/doc-kitty/plans/features/mission-alpha/',
        '/plans/features/mission-alpha': '/doc-kitty/plans/missions/mission-alpha/',
      };
      expect(redirectsToDrafts(chained, drafts, '/doc-kitty')).toEqual([
        { from: '/plans/features/mission-alpha', route: '/plans/missions/mission-alpha/' },
        { from: '/plans/older/mission-alpha/', route: '/plans/missions/mission-alpha/' },
      ]);
    });

    it('redirectsToDrafts keeps a redirect whose target is a draft route that itself redirects to a published page', () => {
      // With drafts off the page at /plans/ is not built, so the redirect
      // declared at /plans/ is, and /old-plans/ -> /plans/ -> /roadmap/ works.
      const drafts = new Set(['/plans/']);
      const chained = { '/old-plans/': '/plans/', '/plans/': { destination: '/roadmap/' } };
      expect(redirectsToDrafts(chained, drafts)).toEqual([]);
      // The same first hop is withheld once the chain ends at a draft instead.
      expect(redirectsToDrafts(chained, new Set(['/plans/', '/roadmap/'])).map((r) => r.from)).toEqual([
        '/old-plans/',
        '/plans/',
      ]);
    });

    it('redirectsToDrafts terminates on a redirect loop and withholds none of it', () => {
      const drafts = new Set(['/a/', '/b/', '/c/']);
      expect(redirectsToDrafts({ '/a/': '/b/', '/b/': '/c/', '/c/': '/a/' }, drafts)).toEqual([]);
      expect(redirectsToDrafts({ '/self/': '/self/' }, new Set(['/self/']))).toEqual([]);
      // A redirect that leads into a loop has no terminus either.
      expect(redirectsToDrafts({ '/in/': '/a/', '/a/': '/b/', '/b/': '/a/' }, drafts)).toEqual([]);
    });
  });
});

describe('redirect-coverage gate with drafts off (FR-015)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
  });
  const STUB = (to: string): string =>
    `<!doctype html>\n<title>Redirecting to: ${to}</title>\n<meta http-equiv="refresh" content="0;url=${to}">`;
  const DRAFTS = new Set(['/plans/missions/mission-alpha/']);
  const DECLARED = {
    '/plans/features/mission-alpha/': '/plans/missions/mission-alpha/',
    '/old-guide/': '/guides/start/',
    '/older-guide/': '/old-guide/',
  };
  /** A built output: one page, one live redirect, plus whatever the test adds. */
  function dist(extra: Record<string, string> = {}): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-redirect-drafts-'));
    dirs.push(dir);
    const pages = { '/guides/start/': '<!doctype html><title>Start</title>', '/old-guide/': STUB('/guides/start/'), ...extra };
    for (const [url, html] of Object.entries(pages)) {
      const file = urlToDistFile(dir, url);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, html, 'utf8');
    }
    return dir;
  }
  const off = { publishDrafts: false, draftRoutes: DRAFTS, declaredRedirects: DECLARED };
  const BASELINE = ['/guides/start/', '/old-guide/', '/plans/features/mission-alpha/'];

  it('names an old URL whose declared redirect ends at a draft as unpublished, and passes', () => {
    const result = checkCoverage(dist(), BASELINE, undefined, off);
    expect(result.ok).toBe(true);
    expect(result.uncovered).toEqual([]);
    expect(result.unpublished.map((r) => [r.url, r.draftRoute])).toEqual([
      ['/plans/features/mission-alpha/', '/plans/missions/mission-alpha/'],
    ]);
  });

  it('accepts a baselined draft page itself as unpublished', () => {
    const result = checkCoverage(dist(), ['/plans/missions/mission-alpha/'], undefined, off);
    expect(result.ok).toBe(true);
    expect(result.unpublished).toHaveLength(1);
  });

  it('excuses nothing when drafts are published, or when no draft routes are given', () => {
    const on = checkCoverage(dist(), BASELINE, undefined, { ...off, publishDrafts: true });
    expect(on.ok).toBe(false);
    expect(on.uncovered.map((r) => r.url)).toEqual(['/plans/features/mission-alpha/']);
    expect(checkCoverage(dist(), BASELINE).ok).toBe(false);
    expect(checkCoverage(dist(), BASELINE, undefined, { ...off, draftRoutes: new Set() }).ok).toBe(false);
  });

  it('still fails an unresolved URL that does not lead to a draft', () => {
    const result = checkCoverage(dist(), [...BASELINE, '/never-built/'], undefined, off);
    expect(result.ok).toBe(false);
    expect(result.uncovered.map((r) => r.url)).toEqual(['/never-built/']);
    expect(result.unpublished).toHaveLength(1);
  });

  it('fails a stub that leads to an unbuilt draft: a dead stub is never the expected case', () => {
    const result = checkCoverage(
      dist({ '/plans/features/mission-alpha/': STUB('/plans/missions/mission-alpha/') }),
      BASELINE,
      undefined,
      off,
    );
    expect(result.ok).toBe(false);
    expect(result.unpublished).toEqual([]);
    expect(result.uncovered.map((r) => r.url)).toEqual(['/plans/features/mission-alpha/']);
    expect(result.deadStubs.map((r) => r.url)).toEqual(['/plans/features/mission-alpha/']);
  });

  it('fails a dead stub that no baselined URL covers, with drafts on too', () => {
    const result = checkCoverage(dist({ '/stray/': STUB('/nowhere/') }), ['/guides/start/']);
    expect(result.ok).toBe(false);
    expect(result.uncovered).toEqual([]);
    expect(result.deadStubs.map((r) => r.url)).toEqual(['/stray/']);
  });

  it('does not let the declared map stand in for a missing stub', () => {
    // `/older-guide/` is declared to reach a built page, but the output has no
    // stub for it: the URL is a 404 and no draft explains it.
    const result = checkCoverage(dist(), ['/older-guide/'], undefined, off);
    expect(result.ok).toBe(false);
    expect(result.uncovered.map((r) => r.url)).toEqual(['/older-guide/']);
  });

  describe('CLI', () => {
    const gate = path.resolve(import.meta.dirname, '../scripts/check-redirect-coverage.mjs');
    /** A docs tree with one draft, a declared map and a baseline next to a built output. */
    function site(): { args: string[]; dir: string } {
      const dir = dist();
      const docs = path.join(dir, '_docs');
      mkdirSync(path.join(docs, 'plans/missions'), { recursive: true });
      mkdirSync(path.join(docs, 'guides'), { recursive: true });
      writeFileSync(path.join(docs, 'plans/missions/mission-alpha.md'), '---\ntitle: A\ndoc_status: draft\n---\n');
      writeFileSync(path.join(docs, 'guides/start.md'), '---\ntitle: S\ndoc_status: active\n---\n');
      const declared = path.join(dir, '_redirects.json');
      writeFileSync(declared, JSON.stringify(DECLARED));
      const baseline = path.join(dir, '_baseline.txt');
      writeFileSync(baseline, `${BASELINE.join('\n')}\n`);
      return { dir, args: [gate, baseline, dir, '--docs', docs, '--declared-redirects', declared] };
    }
    const run = (args: string[], value: string) =>
      spawnSync('node', args, { encoding: 'utf8', env: { ...process.env, [DK_PUBLISH_DRAFTS_ENV]: value } });

    it('off: exits 0 and names the unpublished URL with its draft', () => {
      const result = run(site().args, 'off');
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('/plans/features/mission-alpha/: draft /plans/missions/mission-alpha/');
      expect(result.stdout).toMatch(/2\/3 baselined URL\(s\) covered, 1 unpublished/);
    });

    it('on: the same output fails, because a published draft must resolve', () => {
      const result = run(site().args, 'on');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('/plans/features/mission-alpha/: no page and no redirect');
    });

    it('off without --docs: nothing is excused, and the message names both missing flags', () => {
      const result = run(site().args.slice(0, 3), 'off');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('--docs <docs-dir> and --declared-redirects <map-file> were not given');
    });

    it('off with --docs but without --declared-redirects: fails and names the missing flag', () => {
      const result = run(site().args.slice(0, 5), 'off');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('/plans/features/mission-alpha/: no page and no redirect');
      expect(result.stderr).toContain('--declared-redirects <map-file> was not given');
      expect(result.stderr).not.toContain('--docs <docs-dir> and');
    });

    it('names no flag when both are given, or when drafts are on', () => {
      const { args, dir } = site();
      writeFileSync(path.join(dir, '_baseline.txt'), '/never-built/\n');
      expect(run(args, 'off').stderr).not.toContain('not given');
      expect(run(args.slice(0, 3), 'on').stderr).not.toContain('not given');
    });

    it('off: a stub into the unbuilt draft fails and is named as a dead stub', () => {
      const { args, dir } = site();
      const file = urlToDistFile(dir, '/plans/features/mission-alpha/');
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, STUB('/plans/missions/mission-alpha/'));
      const result = run(args, 'off');
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/1 redirect stub\(s\) in .* lead to a missing page/);
    });

    it('stops on an unrecognised setting value', () => {
      const result = run(site().args, 'maybe');
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('DK_PUBLISH_DRAFTS must be "on" or "off"');
    });
  });
});

describe('shapeSidebar with unpublished pages', () => {
  // What Starlight hands over when every page under plans/ was a filtered draft:
  // the registry group and its autogenerated subgroup, both without entries.
  const link = (label: string, href: string) =>
    ({ type: 'link', label, href, isCurrent: false, badge: undefined, attrs: {} }) as const;
  const group = (label: string, entries: unknown[]) =>
    ({ type: 'group', label, entries, collapsed: false, badge: undefined }) as never;
  const tree = [
    group('Guides', [link('Getting started', '/guides/getting-started/')]),
    group('Plans', [group('missions', [])]),
  ];

  it('drops a group left with no entries, and the parent that leaves empty', () => {
    const { sidebar, warnings } = shapeSidebar(tree, new Map(), {
      unpublishedDirs: ['plans', 'plans/missions'],
    });
    expect(sidebar.map((entry) => entry.label)).toEqual(['Guides']);
    expect(warnings).toEqual([]);
  });

  it('leaves the tree alone when nothing is unpublished', () => {
    const { sidebar } = shapeSidebar(tree, new Map(), {});
    expect(sidebar.map((entry) => entry.label)).toEqual(['Guides', 'Plans']);
  });
});

describe('check-links: links to unpublished drafts (T030)', () => {
  const GATE = path.resolve(import.meta.dirname, '../scripts/check-links.mjs');
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  /** A built-site tree (`…/example/docs`, so the gate treats it as a site root). */
  const tree = (pages: Record<string, string>): string => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-links-'));
    dirs.push(dir);
    const root = path.join(dir, 'example/docs');
    for (const [rel, text] of Object.entries(pages)) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), text);
    }
    return root;
  };
  const md = (status: string | null, body: string, extra = ''): string =>
    `---\ntitle: T\n${status ? `doc_status: ${status}\n` : ''}${extra}---\n\n${body}\n`;
  const run = (root: string, setting?: string) => {
    const env = { ...process.env };
    delete env.DK_PUBLISH_DRAFTS;
    if (setting) env.DK_PUBLISH_DRAFTS = setting;
    return spawnSync('node', [GATE, root], { encoding: 'utf8', env });
  };

  const PAGES = {
    'README.md': md(null, 'Home, no status: the root is never a draft.'),
    'guides/README.md': md('active', 'See [the draft](/guides/wip/) and [ok](/guides/done/).'),
    'guides/done.md': md('active', 'Done.', 'related:\n  - guides/wip\n'),
    'guides/wip.md': md('draft', 'A draft may link anywhere: [home](/guides/done/).'),
    'guides/nostatus.md': md(null, 'No status is a draft; [it links](/guides/wip/) freely.'),
  };

  it('reports a published page linking or relating to a draft when drafts are off', () => {
    const res = run(tree(PAGES));
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/guides\/README\.md: link points at a draft page.*→ \/guides\/wip\//);
    expect(res.stderr).toMatch(/guides\/done\.md: related ref points at a draft page.*→ guides\/wip/);
    // Only those two: draft pages are not held to it, and /guides/done/ is fine.
    expect(res.stderr).toContain('2 dangling reference(s)');
  });

  it('accepts the same tree when drafts are published', () => {
    const res = run(tree(PAGES), 'on');
    expect(res.status, res.stderr).toBe(0);
  });

  it('accepts a link to the root page, which has no status but is never a draft', () => {
    const res = run(tree({ 'README.md': md(null, 'Home.'), 'a.md': md('active', '[home](/)') }));
    expect(res.status, res.stderr).toBe(0);
  });

  it('stops on an unrecognised setting value', () => {
    const res = run(tree(PAGES), 'maybe');
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('DK_PUBLISH_DRAFTS must be "on" or "off"');
  });
});

describe('one resolver for the build and its gates', () => {
  const SCRIPTS = path.resolve(import.meta.dirname, '../scripts');
  const dirs: string[] = [];
  const saved = { ...process.env };
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    for (const name of [DK_PUBLISH_DRAFTS_ENV, DK_PUBLISH_DRAFTS_RESOLVED_ENV]) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  /**
   * A site whose only source for the setting is an env file: `<tmp>/example`
   * holds the Astro config, the env files, a docs tree (`example/docs`, so
   * check-links treats it as site-built) with one draft that a published page
   * links to, and a build output in which the draft page was not built.
   */
  function envFileSite(envFiles: Record<string, string>) {
    const tmp = mkdtempSync(path.join(tmpdir(), 'dk-one-resolver-'));
    dirs.push(tmp);
    const root = path.join(tmp, 'example');
    const docs = path.join(root, 'docs');
    const dist = path.join(root, 'dist');
    mkdirSync(path.join(docs, 'guides'), { recursive: true });
    mkdirSync(path.join(dist, 'guides/done'), { recursive: true });
    writeFileSync(path.join(root, 'astro.config.mjs'), 'export default {};\n');
    for (const [name, text] of Object.entries(envFiles)) writeFileSync(path.join(root, name), text);
    writeFileSync(path.join(docs, 'README.md'), '---\ntitle: Home\n---\n');
    writeFileSync(path.join(docs, 'guides/done.md'), '---\ntitle: D\ndoc_status: active\n---\n\n[wip](/guides/wip/)\n');
    writeFileSync(path.join(docs, 'guides/wip.md'), '---\ntitle: W\ndoc_status: draft\n---\n');
    writeFileSync(path.join(dist, 'guides/done/index.html'), '<html><body>done</body></html>');
    const baseline = path.join(root, 'url-baseline.txt');
    writeFileSync(baseline, '/guides/done/\n/guides/wip/\n');
    const declared = path.join(root, 'redirects.json');
    writeFileSync(declared, '{}');
    return { tmp, root, docs, dist, baseline, declared };
  }

  /** Run a gate with no draft setting in the process environment unless `value` is given. */
  const gate = (script: string, args: string[], value?: string) => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env[DK_PUBLISH_DRAFTS_ENV];
    delete env[DK_PUBLISH_DRAFTS_RESOLVED_ENV];
    if (value !== undefined) env[DK_PUBLISH_DRAFTS_ENV] = value;
    return spawnSync('node', [path.join(SCRIPTS, script), ...args], { encoding: 'utf8', env });
  };

  /** What the integration records for a site root, with no value in the process environment. */
  const integration = (root: string, command = 'build'): string | undefined => {
    delete process.env[DK_PUBLISH_DRAFTS_ENV];
    delete process.env[DK_PUBLISH_DRAFTS_RESOLVED_ENV];
    const hook = draftPublicationIntegration({
      docsDir: path.join(root, 'docs'),
      base: '/',
      shapeSidebar: true,
      pagination: true,
    }).hooks['astro:config:setup'] as unknown as (arg: unknown) => void;
    hook({ command, config: { root: pathToFileURL(`${root}/`) } });
    return process.env[DK_PUBLISH_DRAFTS_RESOLVED_ENV];
  };

  const ON_FROM_FILE = 'DK_PUBLISH_DRAFTS=on (from: env file;';

  it('resolveDraftPublication reads the env files of the site root and mode it is given', () => {
    const { root } = envFileSite({ '.env': 'DK_PUBLISH_DRAFTS=on\n', '.env.staging': 'DK_PUBLISH_DRAFTS=off\n' });
    expect(resolveDraftPublication(root, 'production', {})).toEqual({ publish: true, source: 'env file' });
    expect(resolveDraftPublication(root, 'staging', {})).toEqual({ publish: false, source: 'env file' });
    expect(resolveDraftPublication(root, 'production', { DK_PUBLISH_DRAFTS: 'off' })).toEqual({
      publish: false,
      source: 'process environment',
    });
    expect(resolveDraftPublication(path.join(root, 'docs'), 'production', {})).toEqual({
      publish: false,
      source: 'default',
    });
  });

  it('findSiteRoot is the nearest directory with an Astro config, else the fallback', () => {
    const { tmp, root, dist } = envFileSite({});
    expect(findSiteRoot(dist)).toBe(root);
    expect(findSiteRoot(path.join(dist, 'guides/done'))).toBe(root);
    expect(findSiteRoot(root)).toBe(root);
    expect(findSiteRoot(tmp, '/some/fallback')).toBe('/some/fallback');
  });

  it('takeSiteFlags removes --site-root and --mode and rejects a flag without a value', () => {
    expect(takeSiteFlags(['a', '--site-root', 'site', 'b', '--mode', 'staging', '--docs', 'd'])).toEqual({
      siteRoot: 'site',
      mode: 'staging',
      rest: ['a', 'b', '--docs', 'd'],
    });
    expect(takeSiteFlags(['a'])).toEqual({ rest: ['a'] });
    expect(() => takeSiteFlags(['a', '--mode'])).toThrow('--mode needs a value');
    expect(() => takeSiteFlags(['--site-root', '--mode', 'x'])).toThrow('--site-root needs a value');
  });

  it('the gate summary names the value, its source, the site root and the mode', () => {
    const { root, dist } = envFileSite({ '.env': 'DK_PUBLISH_DRAFTS=on\n' });
    const resolved = resolveDraftPublicationForGate({ checkedDir: dist, env: {} });
    expect(resolved).toMatchObject({ publish: true, source: 'env file', siteRoot: root, mode: 'production' });
    expect(resolved.summary).toContain(ON_FROM_FILE);
    expect(resolved.summary).toContain('mode: production)');
  });

  it('an env-file-only value: the integration builds with it', () => {
    const { root } = envFileSite({ '.env': 'DK_PUBLISH_DRAFTS=on\n' });
    expect(integration(root)).toBe('on');
    // Without the file the same site builds draft-free.
    expect(integration(envFileSite({}).root)).toBe('off');
  });

  it('an env-file-only value: the redirect-coverage gate sees what the integration saw', () => {
    const { root, docs, dist, baseline, declared } = envFileSite({ '.env': 'DK_PUBLISH_DRAFTS=on\n' });
    expect(integration(root)).toBe('on');
    const res = gate('check-redirect-coverage.mjs', [baseline, dist, '--docs', docs, '--declared-redirects', declared]);
    expect(res.stdout).toContain(`redirect-coverage: ${ON_FROM_FILE}`);
    // With drafts on, the unbuilt draft page is a failure, not an excused URL.
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('/guides/wip/: no page and no redirect');
  });

  it('an env-file-only value: check-links sees what the integration saw', () => {
    const { root, docs } = envFileSite({ '.env': 'DK_PUBLISH_DRAFTS=on\n' });
    expect(integration(root)).toBe('on');
    const res = gate('check-links.mjs', [docs]);
    expect(res.stdout).toContain(`check-links: ${ON_FROM_FILE}`);
    // With drafts on, a published page may link to a draft.
    expect(res.status, res.stderr).toBe(0);
    // The same tree with no env file is draft-free, and the link is reported.
    const off = gate('check-links.mjs', [envFileSite({}).docs]);
    expect(off.stdout).toContain('check-links: DK_PUBLISH_DRAFTS=off (from: default;');
    expect(off.status).toBe(1);
  });

  it('an env-file-only value: assert-build-artifacts sees what the integration saw', () => {
    const { root, dist } = envFileSite({ '.env': 'DK_PUBLISH_DRAFTS=on\n' });
    expect(integration(root)).toBe('on');
    // The fixture is not a full build, so the gate fails later; its first line is the resolution.
    const res = gate('assert-build-artifacts.mjs', [dist]);
    expect(res.stdout.split('\n')[0]).toContain(`assert-build-artifacts: ${ON_FROM_FILE}`);
  });

  it('the process environment still wins over the env file, in the build and in every gate', () => {
    const { root, docs, dist, baseline, declared } = envFileSite({ '.env': 'DK_PUBLISH_DRAFTS=on\n' });
    const OFF = 'DK_PUBLISH_DRAFTS=off (from: process environment;';
    process.env[DK_PUBLISH_DRAFTS_ENV] = 'off';
    const hook = draftPublicationIntegration({ docsDir: docs, base: '/', shapeSidebar: true, pagination: true })
      .hooks['astro:config:setup'] as unknown as (arg: unknown) => void;
    hook({ command: 'build', config: { root: pathToFileURL(`${root}/`) } });
    expect(process.env[DK_PUBLISH_DRAFTS_RESOLVED_ENV]).toBe('off');

    const coverage = gate(
      'check-redirect-coverage.mjs',
      [baseline, dist, '--docs', docs, '--declared-redirects', declared],
      'off',
    );
    expect(coverage.stdout).toContain(`redirect-coverage: ${OFF}`);
    expect(coverage.status, coverage.stderr).toBe(0);
    const links = gate('check-links.mjs', [docs], 'off');
    expect(links.stdout).toContain(`check-links: ${OFF}`);
    expect(links.status).toBe(1);
    expect(gate('assert-build-artifacts.mjs', [dist], 'off').stdout).toContain(`assert-build-artifacts: ${OFF}`);
  });

  it('--site-root and --mode pick the env files when the checked directory is outside the site', () => {
    const { root, baseline, declared, docs } = envFileSite({ '.env.staging': 'DK_PUBLISH_DRAFTS=on\n' });
    const elsewhere = mkdtempSync(path.join(tmpdir(), 'dk-out-'));
    dirs.push(elsewhere);
    mkdirSync(path.join(elsewhere, 'guides/done'), { recursive: true });
    writeFileSync(path.join(elsewhere, 'guides/done/index.html'), '<html></html>');
    const args = [baseline, elsewhere, '--docs', docs, '--declared-redirects', declared];
    expect(gate('check-redirect-coverage.mjs', args).stdout).toContain('DK_PUBLISH_DRAFTS=off (from: default;');
    const staged = gate('check-redirect-coverage.mjs', [...args, '--site-root', root, '--mode', 'staging']);
    expect(staged.stdout).toContain(ON_FROM_FILE);
    expect(staged.stdout).toContain('mode: staging)');
    expect(gate('check-redirect-coverage.mjs', [...args, '--site-root']).status).toBe(2);
  });

  it('the development env file reaches the dev server only, so a gate in the default mode ignores it', () => {
    const { root, docs } = envFileSite({ '.env.development': 'DK_PUBLISH_DRAFTS=on\n' });
    expect(integration(root, 'dev')).toBe('on');
    expect(integration(root, 'build')).toBe('off');
    expect(gate('check-links.mjs', [docs]).stdout).toContain('DK_PUBLISH_DRAFTS=off (from: default;');
    expect(gate('check-links.mjs', [docs, '--mode', 'development']).stdout).toContain(ON_FROM_FILE);
  });
});

describe('one draft predicate, and the site root is never a draft', () => {
  it('isPublished is the negation of isDraftStatus for every status', () => {
    for (const status of [undefined, 'draft', 'active', 'durable', 'deprecated']) {
      expect(isPublished({ doc_status: status } as never), String(status)).toBe(!isDraftStatus(status));
    }
  });

  it('isDraftEntry exempts the root page, with or without a status', () => {
    expect(isDraftEntry({ id: ROOT_ENTRY_ID, data: {} })).toBe(false);
    expect(isDraftEntry({ id: ROOT_ENTRY_ID, data: { doc_status: 'draft' } })).toBe(false);
    expect(isDraftEntry({ id: 'guides/wip', data: {} })).toBe(true);
    expect(isDraftEntry({ id: 'guides/wip', data: { doc_status: 'draft' } })).toBe(true);
    expect(isDraftEntry({ id: 'guides/done', data: { doc_status: 'active' } })).toBe(false);
  });

  it('the loader and the Head carrier decide "draft" with isDraftEntry, so a root page is never noindex', () => {
    const lib = path.resolve(import.meta.dirname, '..');
    const head = readFileSync(path.join(lib, 'components/Head.astro'), 'utf8');
    const frontmatter = head.slice(0, head.indexOf('\n---', 3));
    expect(frontmatter).toMatch(/const isDraft = isDraftEntry\(entry\b/);
    expect(head).toMatch(/\{isDraft && <meta name="robots" content="noindex" \/>\}/);
    // No second rule: the carrier does not test the status on its own.
    expect(frontmatter).not.toMatch(/isPublished|isDraftStatus|doc_status \?\?/);
    const schema = readFileSync(path.join(lib, 'lib/schema.ts'), 'utf8');
    expect(schema).toMatch(/if \(!isDraftEntry\(entry\)\) return entry;/);
    // And the walker and integration hold no predicate or walker of their own.
    const config = readFileSync(path.join(lib, 'lib/config.ts'), 'utf8');
    expect(config).not.toMatch(/\?\? 'draft'/);
    expect(config).toMatch(/draftRoutesOf\(path\.resolve\(process\.cwd\(\), docsDir\), indexBasename\)/);
  });
});
