/**
 * FsCorpusSource (T009): zero-network local loading and the FR-007
 * re-origining carve-out - only `source`/`url` strings and `href`s inside
 * `links`/`_links` move from the baked origin to the effective link base;
 * markdown and content fields never change.
 */
import { mkdtempSync, cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FsCorpusSource, rewriteLinkFields } from '../../src/corpus/fs-source.js';
import { loadSnapshot } from '../../src/corpus/snapshot.js';
import { fixture } from './helpers.js';

const DECLARED = 'https://spec-kitty.github.io/doc-kitty';
const LOCAL = 'http://localhost:4321/docs';

/**
 * Collect every link-field string of an artifact, tracking the carve-out
 * containers exactly like the rewriter: `source`/`url` strings and `href`s
 * inside `links`/`_links` containers. Returns [jsonPath, value][] pairs.
 */
function linkFieldStrings(node: unknown, prefix = '', inLinkContainer = false, key?: string): Array<[string, string]> {
  if (typeof node === 'string') {
    const linkish = (inLinkContainer && key === 'href') || key === 'source' || key === 'url';
    return linkish ? [[prefix, node]] : [];
  }
  if (Array.isArray(node)) {
    return node.flatMap((v, i) => linkFieldStrings(v, `${prefix}[${i}]`, inLinkContainer, key));
  }
  if (typeof node === 'object' && node !== null) {
    return Object.entries(node).flatMap(([k, v]) =>
      linkFieldStrings(v, `${prefix}.${k}`, inLinkContainer || k === 'links' || k === '_links', k),
    );
  }
  return [];
}

describe('FsCorpusSource identity mode (no --link-base)', () => {
  it('passes artifact bytes through untouched when the effective base is the declared one', async () => {
    const snapshot = await loadSnapshot(new FsCorpusSource(fixture('example')));
    const homeRaw = readFileSync(`${fixture('example')}/api/pages/home.json`, 'utf8');
    const home = snapshot.pages.find((p) => p.id === 'home')!;
    expect(home.raw).toBe(homeRaw);
    const indexRaw = readFileSync(`${fixture('example')}/api/index.json`, 'utf8');
    const parsed = JSON.parse(indexRaw);
    expect(snapshot.pages).toHaveLength(parsed.count);
    expect(snapshot.scenarios!.raw).toBe(readFileSync(`${fixture('example')}/api/scenarios.json`, 'utf8'));
  });
});

describe('FsCorpusSource re-origining (FR-007)', () => {
  it('rebases exactly the carved-out link fields from the baked origin to --link-base', async () => {
    const snapshot = await loadSnapshot(new FsCorpusSource(fixture('example'), { linkBase: LOCAL }));
    const home = snapshot.pages.find((p) => p.id === 'home')!;

    // Rewritten link fields.
    expect(home.artifact.source).toBe(`${LOCAL}/api/pages/home.json`);
    expect(home.artifact.url).toBe(`${LOCAL}/`);
    expect(home.artifact._links.self.href).toBe(`${LOCAL}/api/pages/home.json`);
    expect(home.artifact._links.html.href).toBe(`${LOCAL}/`);
    expect(home.artifact._links.up!.href).toBe(`${LOCAL}/api/index.json`);
    expect(home.links.self!.href).toBe(`${LOCAL}/api/pages/home.json`);

    // scenario artifacts: baked absolute `url` fields rebase; `source` is a
    // repo-relative .feature path here (never origin-prefixed), so it passes
    // through untouched - the carve-out only moves strings baked FROM the
    // declared base.
    const feature = snapshot.scenarios!.artifact.features[0]!;
    expect(feature.source).toMatch(/^features\//);
    expect(feature.url.startsWith(`${LOCAL}/`)).toBe(true);
  });

  it('never touches markdown or content fields', async () => {
    const snapshot = await loadSnapshot(new FsCorpusSource(fixture('example'), { linkBase: LOCAL }));
    for (const page of snapshot.pages) {
      const diskRaw = JSON.parse(readFileSync(`${fixture('example')}/api/pages/${page.id}.json`, 'utf8'));
      expect(page.markdown).toBe(diskRaw.markdown);
      expect(page.artifact.title).toBe(diskRaw.title);
      expect(page.artifact.description).toBe(diskRaw.description);
      expect(page.artifact.keywords).toEqual(diskRaw.keywords);
      expect(page.artifact.authors).toEqual(diskRaw.authors);
      expect(page.artifact.tags).toEqual(diskRaw.tags);
    }
  });

  it('leaves no carved-out link field on the baked origin after rewrite', async () => {
    const snapshot = await loadSnapshot(new FsCorpusSource(fixture('example'), { linkBase: LOCAL }));
    for (const page of snapshot.pages) {
      for (const [jsonPath, value] of linkFieldStrings(page.artifact)) {
        expect(value.startsWith(DECLARED), `${page.id}.artifact${jsonPath} = ${value}`).toBe(false);
      }
      for (const [jsonPath, value] of linkFieldStrings(page.record)) {
        expect(value.startsWith(DECLARED), `${page.id}.record${jsonPath} = ${value}`).toBe(false);
      }
    }
  });

  it('an explicit --link-base equal to the declared base stays byte-identical (no-op)', async () => {
    const declared = new FsCorpusSource(fixture('example'));
    const same = new FsCorpusSource(fixture('example'), { linkBase: DECLARED });
    const [a, b] = await Promise.all([loadSnapshot(declared), loadSnapshot(same)]);
    expect(b.pages.map((p) => p.raw)).toEqual(a.pages.map((p) => p.raw));
  });
});

describe('rewriteLinkFields unit behavior', () => {
  it('rewrites hrefs under links/_links containers but not their titles, and only the baked prefix', () => {
    const obj = {
      _links: {
        self: { href: `${DECLARED}/api/pages/x.json` },
        related: [{ href: `${DECLARED}/guides/`, title: `${DECLARED} is text, stays` }],
      },
      links: { next: { href: `${DECLARED}/next` } },
      source: `${DECLARED}/api/pages/x.json`,
      url: 'https://other.example/page', // external - untouched
      markdown: `see ${DECLARED}/guides/ in prose - never rewritten`,
    };
    rewriteLinkFields(obj, DECLARED, LOCAL);
    expect(obj._links.self.href).toBe(`${LOCAL}/api/pages/x.json`);
    expect(obj._links.related[0]!.href).toBe(`${LOCAL}/guides/`);
    expect(obj._links.related[0]!.title).toBe(`${DECLARED} is text, stays`);
    expect(obj.links.next.href).toBe(`${LOCAL}/next`);
    expect(obj.source).toBe(`${LOCAL}/api/pages/x.json`);
    expect(obj.url).toBe('https://other.example/page');
    expect(obj.markdown).toContain(DECLARED);
  });
});

const tmpDirs: string[] = [];
function tmpCopyOf(name: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), `doc-kitty-mcp-${name}-`));
  cpSync(fixture('gated-pages'), dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

describe('FsCorpusSource failure surface', () => {
  it('UNREACHABLE_ENDPOINT naming the path when the directory has no index', async () => {
    await expect(loadSnapshot(new FsCorpusSource(fixture('missing-dir-does-not-exist')))).rejects.toMatchObject({
      code: 'UNREACHABLE_ENDPOINT',
    });
    await expect(loadSnapshot(new FsCorpusSource(fixture('missing-dir-does-not-exist')))).rejects.toThrow(/api[\\/]index\.json/);
  });

  it('UNREACHABLE_ENDPOINT when the linked scenarios artifact is absent', async () => {
    const dir = tmpCopyOf('no-scenarios');
    rmSync(path.join(dir, 'api', 'scenarios.json'));
    await expect(loadSnapshot(new FsCorpusSource(dir))).rejects.toMatchObject({ code: 'UNREACHABLE_ENDPOINT' });
  });

  it('MALFORMED_CORPUS with path when an artifact is not valid JSON', async () => {
    const dir = tmpCopyOf('bad-json');
    writeFileSync(path.join(dir, 'api', 'scenarios.json'), '{ nope');
    await expect(loadSnapshot(new FsCorpusSource(dir))).rejects.toMatchObject({
      code: 'MALFORMED_CORPUS',
      message: expect.stringContaining('api/scenarios.json'),
    });
  });
});
