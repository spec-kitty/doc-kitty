/**
 * The paged hub listing through the MCP corpus loader, and on every surface (#342,
 * WP06; consolidation items 2 and 2a). A real `astro build` of a site with a paged
 * hub (`missions`: seven children, cap 3, page size 2, so listing pages 2..4) must:
 *
 *  - give an agent API the loader accepts: every shape guard, the version
 *    handshake and the buildId compare-all hold for the `kind: "Listing"` records
 *    and their per-page artifacts, as for docs pages;
 *  - list every listing URL exactly once in the sitemap, the Pagefind index, the
 *    agent index, `api/pages` and llms.txt, and every child exactly once in each.
 *
 * Self-contained like openapi-entries.test.ts: it copies the toolkit's OpenAPI
 * fixture site (which mounts the agent and llms.txt routes), adds the hub, builds
 * through `example/`'s astro shim with no OpenAPI option, and loads the dist
 * through FsCorpusSource + loadSnapshot.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FsCorpusSource } from '../../src/corpus/fs-source.js';
import { loadSnapshot } from '../../src/corpus/snapshot.js';
import { assertIndexShape, assertPageShape, parseArtifact } from '../../src/corpus/source.js';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FIXTURES = path.join(REPO_ROOT, 'src', 'tests', 'fixtures', 'openapi');
const ROOT = path.join(REPO_ROOT, 'example', '.dk-test-openapi', 'mcp-corpus-paged-hub');
const ASTRO_BIN = path.join(REPO_ROOT, 'example', 'node_modules', '.bin', 'astro');
const SITE = 'https://docs.example.test';
const LISTING = ['missions/page/2', 'missions/page/3', 'missions/page/4'];
const CHILDREN = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf'].map((name) => `missions/${name}`);

const page = (title: string, kind: string, extra = '') =>
  `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(`About ${title}.`)}\ndoc_status: active\nupdated: 2026-11-24T00:00:00Z\nkind: ${kind}\n${extra}---\n\n# ${title}\n\nText of ${title}.\n`;

function buildEnv(): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = { ...process.env, CI: '' };
  for (const name of Object.keys(clean)) {
    if (name.startsWith('DK_') || ['NODE_ENV', 'MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL'].includes(name)) delete clean[name];
  }
  return { ...clean, DK_PUBLISH_DRAFTS: 'on', DK_TEST_OPTIONS: '{}', DK_OUTDIR: 'dist' };
}

/** Each occurrence count of `items` in `list`. */
const counts = (list: string[], items: string[]) => items.map((item) => [item, list.filter((x) => x === item).length]);
const once = (items: string[]) => items.map((item) => [item, 1]);

describe('a paged hub through the MCP corpus loader and every surface (#342)', () => {
  let dist = '';

  beforeAll(() => {
    rmSync(ROOT, { recursive: true, force: true });
    mkdirSync(ROOT, { recursive: true });
    cpSync(path.join(FIXTURES, 'site'), ROOT, { recursive: true });
    cpSync(path.join(FIXTURES, 'astro.config.mjs'), path.join(ROOT, 'astro.config.mjs'));
    mkdirSync(path.join(ROOT, 'docs', 'missions'), { recursive: true });
    writeFileSync(path.join(ROOT, 'docs', 'missions', 'README.md'), page('Missions', 'Hub', 'sidebar_child_cap: 3\nhub_page_size: 2\n'));
    CHILDREN.forEach((slug, i) => writeFileSync(path.join(ROOT, 'docs', `${slug}.md`), page(`Mission ${i + 1}`, 'Explanation')));
    const run = spawnSync(ASTRO_BIN, ['build'], { cwd: ROOT, encoding: 'utf8', env: buildEnv() });
    expect(run.status, `astro build output:\n${stripVTControlCharacters(`${run.stdout}\n${run.stderr}`)}`).toBe(0);
    dist = path.join(ROOT, 'dist');
  }, 600_000);

  afterAll(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  it('the index passes the shape guard, with the Listing records after the docs records', () => {
    const index = parseArtifact(readFileSync(path.join(dist, 'api', 'index.json'), 'utf8'), 'api/index.json');
    assertIndexShape(index);
    const slugs = index.pages.map((record) => record.slug);
    expect(slugs.slice(-3)).toEqual(LISTING);
    expect(index.pages.slice(-3).every((record) => record.kind === 'Listing')).toBe(true);
    expect(index.count).toBe(index.pages.length);
  });

  it('each listing page artifact passes the page guard and lists its children', () => {
    const seen: string[] = [];
    for (const slug of LISTING) {
      const artifactPath = `api/pages/${slug}.json`;
      const artifact = parseArtifact(readFileSync(path.join(dist, artifactPath), 'utf8'), artifactPath);
      assertPageShape(artifact, artifactPath);
      seen.push(...(artifact as unknown as { children: Array<{ slug: string }> }).children.map((child) => child.slug));
    }
    // Page 1 (the hub) lists two children; pages 2..4 the other five, each once.
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it('loadSnapshot loads the whole corpus, listing pages included, under one buildId', async () => {
    const snapshot = await loadSnapshot(new FsCorpusSource(dist));
    const ids = snapshot.pages.map((p) => p.id);
    expect(counts(ids, LISTING)).toEqual(once(LISTING));
    expect(counts(ids, CHILDREN)).toEqual(once(CHILDREN));
    for (const p of snapshot.pages) expect(p.artifact.buildId, p.id).toBe(snapshot.buildId);
  });

  it('lists every listing URL and every child exactly once on every surface', () => {
    const url = (slug: string) => `${SITE}/${slug}/`;
    const sitemap = readdirSync(dist)
      .filter((name) => /^sitemap-\d+\.xml$/.test(name))
      .flatMap((name) => [...readFileSync(path.join(dist, name), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!));
    const fragments = path.join(dist, 'pagefind', 'fragment');
    expect(existsSync(fragments)).toBe(true);
    const pagefind = readdirSync(fragments).map((name) => {
      const text = gunzipSync(readFileSync(path.join(fragments, name))).toString('utf8');
      return `${SITE}${(JSON.parse(text.slice(text.indexOf('{'))) as { url: string }).url}`;
    });
    const index = (JSON.parse(readFileSync(path.join(dist, 'api', 'index.json'), 'utf8')) as { pages: Array<{ url: string }> }).pages.map((r) => r.url);
    const pageArtifacts = LISTING.concat(CHILDREN).filter((slug) => existsSync(path.join(dist, 'api', 'pages', `${slug}.json`)));
    const llms = [...readFileSync(path.join(dist, 'llms.txt'), 'utf8').matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]!);
    const all = LISTING.concat(CHILDREN);
    for (const [surface, list] of [['sitemap', sitemap], ['pagefind', pagefind], ['agent index', index], ['llms.txt', llms]] as const) {
      expect(counts(list, all.map(url)), surface).toEqual(once(all.map(url)));
    }
    expect(pageArtifacts.sort()).toEqual([...all].sort());
  });
});
