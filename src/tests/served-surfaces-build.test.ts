/**
 * Served-surface detection in a real build (page-chrome WP01; FR-002), on the chrome
 * fixture. The probe route renders what `servedSurfaces()` returns while pages
 * render, so it proves the hook ran first, through `astro build` and the env handoff.
 * Deleting `rss.xml.ts` is the variant: a file route resolves whatever its handler
 * does, so an env-guarded route would not change what is detected.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ServedSurfaces } from '../lib/served-surfaces.js';
import { buildChromeFixture, REPO_ROOT } from './fixtures/chrome/harness.mjs';

const BUILD_TIMEOUT = 240_000;
const PROBE = {
  'src/pages/surfaces-probe.json.ts': `import { servedSurfaces } from '../../../../../src/lib/served-surfaces.ts';
export const GET = () => new Response(JSON.stringify(servedSurfaces() ?? 'detection did not run'));
`,
};
/** What the fixture site serves: it mounts no bibliography or scenarios route. */
const FIXTURE_SURFACES = {
  llms: true,
  agentIndex: true,
  agentPages: true,
  rss: true,
  bibliography: false,
  scenarios: false,
  contentGraph: true,
  sitemap: true,
  okf: true,
};

function built(request: Parameters<typeof buildChromeFixture>[0]) {
  const build = buildChromeFixture(request);
  expect(build.status, build.output).toBe(0);
  const read = (rel: string) => JSON.parse(readFileSync(path.join(build.dist, rel), 'utf8'));
  return {
    has: (rel: string) => existsSync(path.join(build.dist, rel)),
    surfaces: read('surfaces-probe.json') as ServedSurfaces,
    links: () => read('api/index.json')._links as Record<string, unknown>,
  };
}

describe('served surfaces in a real build (FR-002)', () => {
  it(
    'a page sees what the site mounts, under a base path, and removing a route removes only that surface',
    () => {
      const stock = built({ files: PROBE });
      expect(stock.surfaces).toMatchObject(FIXTURE_SURFACES);
      expect(stock.has('rss.xml')).toBe(true);
      expect(stock.links()).toHaveProperty('rss');
      expect(stock.links()).toHaveProperty('llms');
      expect(stock.links()).toHaveProperty('sitemap');
      expect(stock.links()).not.toHaveProperty('bibliography');
      expect(stock.links()).not.toHaveProperty('scenarios');

      const noRss = built({ files: { ...PROBE, 'src/pages/rss.xml.ts': null } });
      expect(noRss.surfaces).toEqual({ ...stock.surfaces, rss: false });
      expect(noRss.has('rss.xml')).toBe(false);
      expect(noRss.links()).not.toHaveProperty('rss');
      expect(noRss.links(), 'control: the route still runs').toHaveProperty('llms');

      const noLlms = built({ files: { ...PROBE, 'src/pages/llms.txt.ts': null } });
      expect(noLlms.surfaces).toEqual({ ...stock.surfaces, llms: false });
      expect(noLlms.has('llms.txt')).toBe(false);
      expect(noLlms.links()).not.toHaveProperty('llms');
      expect(noLlms.links(), 'control: sitemap is unaffected').toHaveProperty('sitemap');
    },
    BUILD_TIMEOUT * 2,
  );

  it(
    'an explicit link still wins over detection in a built site',
    () => {
      const explicit = built({
        files: {
          ...PROBE,
          'src/pages/rss.xml.ts': null,
          'src/pages/api/index.json.ts': `import { agentIndexRoute } from '@spec-kitty/doc-toolkit/routes';
export const GET = agentIndexRoute({ title: 'Chrome fixture', links: { rss: true } });
`,
        },
      });
      expect(explicit.surfaces.rss).toBe(false);
      expect(explicit.links()).toHaveProperty('rss');
    },
    BUILD_TIMEOUT,
  );

  it(
    'sitemap is true only when the site is set, matching what @astrojs/sitemap writes',
    () => {
      const withSite = built({ files: PROBE });
      expect(withSite.surfaces.sitemap).toBe(true);
      expect(withSite.has('sitemap-index.xml')).toBe(true);
      expect(withSite.links()).toHaveProperty('sitemap');

      const noSite = built({ files: PROBE, options: { site: null } });
      expect(noSite.surfaces).toEqual({ ...withSite.surfaces, sitemap: false, pageAtom: false });
      expect(noSite.has('sitemap-index.xml')).toBe(false);
      expect(noSite.links()).not.toHaveProperty('sitemap');
      expect(noSite.links(), 'control: llms is unaffected').toHaveProperty('llms');
      expect(noSite.has('okf/index.md'), 'okf is served either way').toBe(true);
    },
    BUILD_TIMEOUT * 2,
  );

  it(
    'the example, which mounts its RSS route, keeps the link the no-RSS fixture loses',
    () => {
      const outDir = 'dist-wp01-served-surfaces-test';
      const dist = path.join(REPO_ROOT, 'example', outDir);
      rmSync(dist, { recursive: true, force: true });
      const env: NodeJS.ProcessEnv = { ...process.env, DK_OUTDIR: outDir };
      delete env.BASE_URL;
      const run = spawnSync('pnpm', ['--filter', 'example', 'build'], { cwd: REPO_ROOT, encoding: 'utf8', env });
      expect(run.status, `build stderr:\n${run.stderr}`).toBe(0);
      const index = JSON.parse(readFileSync(path.join(dist, 'api/index.json'), 'utf8'));
      expect(existsSync(path.join(dist, 'rss.xml'))).toBe(true);
      expect(index._links).toHaveProperty('rss');
      rmSync(dist, { recursive: true, force: true });
    },
    BUILD_TIMEOUT,
  );
});
