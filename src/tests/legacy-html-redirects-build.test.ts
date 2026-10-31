/**
 * Legacy `.html` redirects in a REAL build (issue #249, ADR-0068).
 *
 * A minimal toolkit site (sitemap, `llms.txt`, agent API) with a
 * `legacyHtmlRedirects` map is built at the domain root (`base: '/'`, the
 * docs.spec-kitty.ai case) and under a base path (`/proj`, a GitHub Pages
 * project site). For each build:
 *  - every legacy URL is a flat file in `dist/` holding a `noindex` stub with a
 *    canonical link to its target, which a static host serves for that exact
 *    URL;
 *  - `X/index.html -> X/` leaves the live page alone;
 *  - no stub is in the sitemap, `llms.txt` or the agent index;
 *  - the redirect-coverage gate covers the old URLs, and fails on a baselined
 *    `.html` URL that has no stub.
 * A third build proves an Astro `redirects` key ending in `.html` is refused.
 *
 * The site is written at test time into `example/.dk-test-legacy-html/` (so the
 * toolkit, Astro and Starlight resolve through `example/node_modules`) with its
 * own `dist/` and cache, and removed afterwards. Real builds take seconds, so
 * this suite is in the serialized `build` project.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = path.join(REPO_ROOT, 'example', '.dk-test-legacy-html');
const ASTRO_BIN = path.join(REPO_ROOT, 'example', 'node_modules', 'astro', 'bin', 'astro.mjs');
const GATE = path.join(REPO_ROOT, 'src', 'scripts', 'check-redirect-coverage.mjs');

const LEGACY = {
  '/guides/how-to/accept-and-merge.html': '/guides/how-to/accept-and-merge/',
  '/guides/index.html': '/guides/',
  '/index.html': '/',
  '/old/moved.html': '/guides/how-to/accept-and-merge.html',
  '/retired/index.html': '/guides/',
};

const page = (title: string) => ['---', `title: ${title}`, `description: ${title} page.`, 'doc_status: active', 'updated: 2026-10-31', 'kind: Guide', '---', '', `# ${title}`, ''].join('\n');

function files(base: string, astroRedirects: Record<string, string> = {}): Record<string, string> {
  return {
    'astro.config.mjs': [
      "import { defineConfig } from 'astro/config';",
      "import sitemap from '@astrojs/sitemap';",
      "import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';",
      '',
      'export default defineConfig({',
      "  site: 'https://docs.example.test',",
      `  base: ${JSON.stringify(base)},`,
      `  redirects: ${JSON.stringify(astroRedirects)},`,
      '  integrations: [',
      '    ...defineDocKittyIntegrations({',
      "      title: 'Legacy fixture',",
      `      base: ${JSON.stringify(base)},`,
      `      legacyHtmlRedirects: ${JSON.stringify(LEGACY)},`,
      '    }),',
      '    sitemap(),',
      '  ],',
      '});',
      '',
    ].join('\n'),
    'src/content.config.ts': [
      "import { defineCollection } from 'astro:content';",
      "import { docKittyDocsLoader, docKittyDocsSchema } from '@spec-kitty/doc-toolkit/schema';",
      'export const collections = {',
      "  docs: defineCollection({ loader: docKittyDocsLoader({ base: 'docs' }), schema: docKittyDocsSchema() }),",
      '};',
      '',
    ].join('\n'),
    'src/pages/llms.txt.ts': [
      "import { llmsTxtRoute } from '@spec-kitty/doc-toolkit/routes';",
      "export const GET = llmsTxtRoute({ title: 'Legacy fixture', description: 'Fixture.' });",
      '',
    ].join('\n'),
    'src/pages/api/index.json.ts': [
      "import { agentIndexRoute } from '@spec-kitty/doc-toolkit/routes';",
      "export const GET = agentIndexRoute({ title: 'Legacy fixture' });",
      '',
    ].join('\n'),
    'docs/README.md': page('Home'),
    'docs/guides/README.md': page('Guides'),
    'docs/guides/how-to/accept-and-merge.md': page('Accept and merge'),
    'baseline.txt': [...Object.keys(LEGACY), '/guides/', '/guides/how-to/accept-and-merge/'].join('\n') + '\n',
  };
}

function freshSite(base: string, astroRedirects?: Record<string, string>) {
  rmSync(SITE, { recursive: true, force: true });
  for (const [rel, text] of Object.entries(files(base, astroRedirects))) {
    const abs = path.join(SITE, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
}

function build() {
  const env = { ...process.env, DK_PUBLISH_DRAFTS: 'on' };
  delete env.BASE_URL; // vitest's, would override the child's base
  const r = spawnSync(process.execPath, [ASTRO_BIN, 'build'], { cwd: SITE, encoding: 'utf8', env });
  return { status: r.status, output: stripVTControlCharacters(`${r.stdout}\n${r.stderr}`) };
}

function gate(baseline: string) {
  const r = spawnSync(process.execPath, [GATE, baseline, path.join(SITE, 'dist')], {
    cwd: SITE,
    encoding: 'utf8',
    env: { ...process.env, DK_PUBLISH_DRAFTS: 'on' },
  });
  return { status: r.status, output: `${r.stdout}\n${r.stderr}` };
}

/** Every file under `dir`, as POSIX paths relative to it. */
function walk(dir: string, rel = ''): string[] {
  return readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(dir, path.posix.join(rel, e.name)) : [path.posix.join(rel, e.name)],
  );
}

afterAll(() => rmSync(SITE, { recursive: true, force: true }));

for (const base of ['/', '/proj']) {
  const prefix = base === '/' ? '' : base;
  describe(`legacy .html redirects, base ${base}`, () => {
    it(
      'writes each legacy URL as a flat noindex stub, keeps live index pages, and the gate covers them',
      () => {
        freshSite(base);
        const r = build();
        expect(r.status, r.output).toBe(0);
        expect(r.output).toContain('wrote 3 legacy .html redirect stub(s); 2 index.html URL(s) are served by their own page');
        const dist = path.join(SITE, 'dist');

        // A flat FILE at the exact legacy path, never Astro's folder form.
        const stub = path.join(dist, 'guides/how-to/accept-and-merge.html');
        expect(statSync(stub).isFile()).toBe(true);
        const html = readFileSync(stub, 'utf8');
        expect(html).toContain(`<meta http-equiv="refresh" content="0;url=${prefix}/guides/how-to/accept-and-merge/">`);
        expect(html).toContain('<meta name="robots" content="noindex">');
        expect(html).toContain(`<link rel="canonical" href="https://docs.example.test${prefix}/guides/how-to/accept-and-merge/">`);
        // The chain is flattened: one refresh straight to the page.
        expect(readFileSync(path.join(dist, 'old/moved.html'), 'utf8')).toContain(
          `url=${prefix}/guides/how-to/accept-and-merge/"`,
        );
        // The section index stays the live page; the retired one is a stub.
        expect(readFileSync(path.join(dist, 'guides/index.html'), 'utf8')).not.toContain('Redirecting to:');
        expect(readFileSync(path.join(dist, 'retired/index.html'), 'utf8')).toContain(`url=${prefix}/guides/`);
        expect(existsSync(path.join(dist, 'guides/how-to/accept-and-merge.html/index.html'))).toBe(false);

        // Out of the sitemap, llms.txt and the agent index.
        const surfaces = walk(dist)
          .filter((f) => /^sitemap.*\.xml$/.test(f) || f === 'llms.txt' || f === 'api/index.json')
          .map((f) => readFileSync(path.join(dist, f), 'utf8'))
          .join('\n');
        expect(surfaces).toContain('accept-and-merge');
        expect(surfaces).not.toMatch(/\.html\b/);
        expect(surfaces).not.toContain('/retired/');
        expect(surfaces).not.toContain('/old/');

        const ok = gate(path.join(SITE, 'baseline.txt'));
        expect(ok.status, ok.output).toBe(0);
        expect(ok.output).toContain('7/7 baselined URL(s) covered');

        writeFileSync(path.join(SITE, 'missing.txt'), '/guides/how-to/not-mapped.html\n');
        const red = gate(path.join(SITE, 'missing.txt'));
        expect(red.status, red.output).toBe(1);
        expect(red.output).toContain('/guides/how-to/not-mapped.html: no page and no redirect');
      },
      180_000,
    );
  });
}

describe('an Astro `redirects` key ending in .html', () => {
  it(
    'fails the build, naming the key and the legacyHtmlRedirects option',
    () => {
      freshSite('/', { '/guides/how-to/accept-and-merge/index.html': '/guides/' });
      const r = build();
      expect(r.status, r.output).not.toBe(0);
      expect(r.output).toContain('/guides/how-to/accept-and-merge/index.html');
      expect(r.output).toContain('legacyHtmlRedirects');
    },
    180_000,
  );
});
