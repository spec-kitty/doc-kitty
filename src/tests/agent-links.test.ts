/**
 * FR-005 (#103): the shape of the agent API's navigation links in the real built
 * example. That every href resolves to a built file is `pnpm assert:artifacts`'s
 * job (`assertAgentLinksResolve`), proven in example-adopter.test.ts; this suite
 * pins what that gate does not check. Builds the example once into a dedicated
 * outDir (DK_OUTDIR, relative to example/) so it cannot race the other build suites.
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
  it('records link back to their page, to the index and to related pages, with no `source` relation', () => {
    const index = JSON.parse(readFileSync(path.join(DIST, 'api/index.json'), 'utf8'));
    const pageFiles = walkJson(path.join(DIST, 'api/pages'));
    const pageBodies = pageFiles.map((f) => JSON.parse(readFileSync(f, 'utf8')));

    expect(Object.keys(index._links)).toEqual(expect.arrayContaining(['self', 'llms', 'sitemap']));
    expect(index.pages.length).toBeGreaterThan(0);
    for (const record of index.pages) expect(record._links.html.href).toBe(record.url);
    expect(index.pages.some((r: { _links: Links }) => (r._links.related as Link[])?.length > 0)).toBe(true);
    // `source` is not a relation: the record's source IS the per-page JSON (`self`).
    for (const r of index.pages) expect('source' in r._links).toBe(false);
    expect(pageBodies.length).toBeGreaterThan(0);
    for (const body of pageBodies) expect('source' in body._links).toBe(false);
    for (const body of pageBodies) expect(body._links.up.href).toBe(index._links.self.href);
    // The artifact gate catches a dangling `scenarios` link, not a missing one.
    expect('scenarios' in index._links).toBe(existsSync(path.join(DIST, 'api/scenarios.json')));

    rmSync(DIST, { recursive: true, force: true });
  });
});
