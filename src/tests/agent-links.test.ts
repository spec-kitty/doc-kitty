/**
 * FR-005 / SC-001 (#103): every `_links` href in the agent API resolves to a
 * file of the built site. Builds the real example once into a dedicated outDir
 * (DK_OUTDIR, relative to example/) so it cannot race the other build suites.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT_DIR_NAME = 'dist-wp06-agent-links-test';
const DIST = path.join(REPO_ROOT, 'example', OUT_DIR_NAME);

interface Link {
  href: string;
}
type Links = Record<string, Link | Link[]>;

function walkJson(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walkJson(full) : full.endsWith('.json') ? [full] : [];
  });
}

/** Every href under any `_links` key, at any depth. */
function collectHrefs(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => collectHrefs(n, out));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '_links') {
        const links = value as Links;
        for (const entry of Object.values(links)) {
          for (const l of Array.isArray(entry) ? entry : [entry]) out.push(l.href);
        }
      } else collectHrefs(value, out);
    }
  }
  return out;
}

beforeAll(() => {
  rmSync(DIST, { recursive: true, force: true });
  const env: NodeJS.ProcessEnv = { ...process.env, DK_OUTDIR: OUT_DIR_NAME };
  delete env.BASE_URL;
  const built = spawnSync('pnpm', ['--filter', 'example', 'build'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env,
  });
  expect(built.status, `build stderr:\n${built.stderr}`).toBe(0);
}, 240_000);

describe('agent-API _links (FR-005)', () => {
  it('every _links href resolves to a built file, and the expected links exist', () => {
    const index = JSON.parse(readFileSync(path.join(DIST, 'api/index.json'), 'utf8'));
    const pageFiles = walkJson(path.join(DIST, 'api/pages'));
    const pageBodies = pageFiles.map((f) => JSON.parse(readFileSync(f, 'utf8')));

    // Site base = everything before /api/index.json in the index's own self link.
    const selfPath = new URL(index._links.self.href).pathname;
    const base = selfPath.slice(0, -'/api/index.json'.length);

    expect(Object.keys(index._links)).toEqual(expect.arrayContaining(['self', 'llms', 'sitemap']));
    expect(index.pages.length).toBeGreaterThan(0);
    for (const record of index.pages) expect(record._links.html.href).toBe(record.url);
    expect(index.pages.some((r: { _links: Links }) => (r._links.related as Link[])?.length > 0)).toBe(true);
    expect(index.pages.some((r: { _links: Links }) => r._links.source)).toBe(true);
    expect(pageBodies.length).toBeGreaterThan(0);
    for (const body of pageBodies) expect(body._links.up.href).toBe(index._links.self.href);

    const hrefs = [...collectHrefs(index), ...pageBodies.flatMap((b) => collectHrefs(b))];
    expect(hrefs.length).toBeGreaterThan(2 * index.pages.length);

    for (const href of hrefs) {
      let rel = new URL(href).pathname;
      expect(rel.startsWith(base), `${href} lacks base ${base}`).toBe(true);
      rel = rel.slice(base.length).replace(/^\//, '');
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      expect(existsSync(path.join(DIST, rel)), `${href} -> ${rel} missing in dist`).toBe(true);
    }

    // `scenarios` is linked iff the build emitted /api/scenarios.json.
    expect('scenarios' in index._links).toBe(existsSync(path.join(DIST, 'api/scenarios.json')));
    rmSync(DIST, { recursive: true, force: true });
  });
});
