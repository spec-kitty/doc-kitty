/**
 * Excluded folders in a REAL BUILD (ADR-0068, #247). A fixture site sets
 * `exclude: ['archive', 'reports', 'plans/engineering-notes', 'adr/archive']` in
 * `defineDocKittyIntegrations`. The excluded pages carry frontmatter that would
 * fail the schema and the frontmatter gate (no title, no description) and a
 * dangling link, and each holds a sentinel string.
 *
 *  1. The site builds, and no built file of any kind (pages, sitemap, rss.xml,
 *     llms.txt, the agent API, the search index) carries a sentinel or an
 *     excluded route. The ADR Hub lists the published ADR only.
 *  2. `dockitty-validate-frontmatter` and `dockitty-check-links --strict` pass:
 *     they skip the excluded folders, reading the list from the site config.
 *  3. A published page that links into an excluded folder fails
 *     `check-links` (relative link, folder link, root-absolute link and
 *     `related:` ref), the build (the `related:` ref) and
 *     `assert-no-broken-links --docs` (the body links) with "excluded from the
 *     site", not a generic message.
 *
 * Like the other build suites, the site lives in `example/` so the toolkit,
 * Astro and Starlight resolve as for an adopter, with its own `dist/` and
 * content cache, and is removed afterwards (git-ignored in case a run dies).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { stripVTControlCharacters } from 'node:util';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = path.join(REPO_ROOT, 'example', '.dk-test-exclude-folders');
const ASTRO_BIN = path.join(REPO_ROOT, 'example', 'node_modules', 'astro', 'bin', 'astro.mjs');
const SCRIPTS = path.join(REPO_ROOT, 'src', 'scripts');

const EXCLUDE = ['archive', 'reports', 'plans/engineering-notes', 'adr/archive'];
const SENTINEL = 'EXCLUDED-SENTINEL-6100';

const page = (fm: Record<string, string>, body: string) =>
  `---\n${Object.entries(fm)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n---\n\n${body}\n`;
const published = (title: string, kind: string, body = '', extra: Record<string, string> = {}) =>
  page({ title: JSON.stringify(title), description: 'Fixture page.', doc_status: 'active', updated: '2026-10-31T00:00:00Z', kind, ...extra }, `# ${title}\n\n${body}`);
/** An excluded page: no title or description (fails the schema), a dangling link, the sentinel. */
const hidden = (name: string) => page({ doc_status: 'active' }, `# ${SENTINEL} ${name}\n\n[nowhere](./does-not-exist.md)`);

const FILES: Record<string, string> = {
  'astro.config.mjs': `import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';
export default defineConfig({
  site: 'https://example.test',
  base: '/site',
  integrations: defineDocKittyIntegrations({ title: 'Exclude fixture', base: '/site', exclude: ${JSON.stringify(EXCLUDE)} }),
});
`,
  'src/content.config.ts': `import { defineCollection } from 'astro:content';
import { docKittyDocsLoader, docKittyDocsSchema } from '@spec-kitty/doc-toolkit/schema';
export const collections = { docs: defineCollection({ loader: docKittyDocsLoader({ base: 'docs' }), schema: docKittyDocsSchema() }) };
`,
  'src/pages/llms.txt.ts': `import { llmsTxtRoute } from '@spec-kitty/doc-toolkit/routes';
export const GET = llmsTxtRoute({ title: 'Exclude fixture', description: 'Fixture.' });
`,
  'src/pages/rss.xml.ts': `import { rssRoute } from '@spec-kitty/doc-toolkit/routes';
export const GET = rssRoute({ title: 'Exclude fixture', description: 'Fixture.' });
`,
  'src/pages/api/index.json.ts': `import { agentIndexRoute } from '@spec-kitty/doc-toolkit/routes';
export const GET = agentIndexRoute({ title: 'Exclude fixture' });
`,
  'src/pages/api/pages/[...slug].json.ts': `import { agentPageRoute } from '@spec-kitty/doc-toolkit/routes';
const route = agentPageRoute();
export const getStaticPaths = route.getStaticPaths;
export const GET = route.GET;
`,
  'docs/README.md': published('Exclude fixture', 'Hub', 'See the [guide](./guide.md) and the [plans](./plans/README.md).'),
  'docs/guide.md': published('Guide', 'How-To', 'Read the [roadmap](./plans/roadmap.md).'),
  'docs/plans/README.md': published('Plans', 'Hub'),
  'docs/plans/roadmap.md': published('Roadmap', 'Planning'),
  // The table `generate-adr-index --docs docs` writes: the excluded ADR is not in it.
  'docs/adr/README.md': published(
    'Decision Records',
    'Hub',
    '| ID | Title | Status | Date |\n|----|-------|--------|------|\n| [0001](./0001-keep-this.md) | ADR-0001: Keep this | Accepted | 2026-10-31 |',
  ),
  'docs/adr/0001-keep-this.md': published('ADR-0001: Keep this', 'ADR', '## Status\n\nAccepted'),
  'docs/adr/archive/0002-old-decision.md': hidden('adr'),
  'docs/archive/old-plan.md': hidden('archive'),
  'docs/archive/nested/deep.md': hidden('archive-deep'),
  'docs/reports/analysis.md': hidden('reports'),
  'docs/plans/engineering-notes/note.md': hidden('notes'),
};

/** The page added for the link cases: every link form into an excluded folder. */
const LEAKY = published(
  'Leaky',
  'Explanation',
  [
    'A [relative link](./archive/old-plan.md).',
    'A [folder link](./reports/).',
    'A [root-absolute link](/plans/engineering-notes/note/).',
  ].join('\n\n'),
  { related: '\n  - archive/old-plan' },
);

function writeSite() {
  rmSync(SITE, { recursive: true, force: true });
  for (const [rel, contents] of Object.entries(FILES)) {
    const abs = path.join(SITE, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
  }
}

function run(args: string[]) {
  const env: NodeJS.ProcessEnv = { ...process.env, CI: '' };
  // Vitest's env carries `BASE_URL`, which would override the child's `base`.
  delete env.BASE_URL;
  const r = spawnSync(process.execPath, args, { cwd: SITE, encoding: 'utf8', env });
  return { status: r.status, output: stripVTControlCharacters(`${r.stdout}\n${r.stderr}`) };
}
const build = () => run([ASTRO_BIN, 'build']);
const script = (name: string, ...args: string[]) => run([path.join(SCRIPTS, name), ...args]);

/** Every file under `dir`, as paths relative to it. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(path.join(dir, e.name)).map((f) => path.join(e.name, f)) : [e.name],
  );
}
/** A built file's text; Pagefind's index files are gzipped. */
function textOf(abs: string): string {
  const raw = readFileSync(abs);
  if (/\.pf_(fragment|index|meta)$/.test(abs)) return gunzipSync(raw).toString('utf8');
  return raw.toString('utf8');
}

beforeAll(writeSite);
afterAll(() => {
  rmSync(SITE, { recursive: true, force: true });
});

describe('excluded folders in a real build (ADR-0068)', () => {
  it(
    'builds, and no output of any kind carries an excluded page; the gates skip the folders',
    () => {
      const result = build();
      expect(result.status, result.output).toBe(0);

      const dist = path.join(SITE, 'dist');
      const built = filesUnder(dist);
      // Positive control: every surface was built, and the published pages are in them.
      for (const f of ['guide/index.html', 'plans/roadmap/index.html', 'adr/0001-keep-this/index.html', 'sitemap-0.xml', 'rss.xml', 'llms.txt', 'api/index.json', 'api/pages/guide.json']) {
        expect(built, `built ${f}`).toContain(f);
      }
      expect(built.some((f) => f.startsWith('pagefind/') && f.endsWith('.pf_fragment')), 'built a search index').toBe(true);
      expect(readFileSync(path.join(dist, 'llms.txt'), 'utf8')).toContain('/site/plans/roadmap/');

      // No route for an excluded folder.
      for (const f of built) {
        expect(f, 'an excluded route was built').not.toMatch(/^(archive|reports|plans\/engineering-notes|adr\/archive)\//);
      }
      // No built file mentions an excluded page: sentinel, route or id.
      for (const f of built) {
        if (/\.(png|ico|woff2?|jpe?g|gif|webp|svg|wasm|pagefind)$/.test(f)) continue;
        const text = textOf(path.join(dist, f));
        expect(text, `${f} carries an excluded page`).not.toContain(SENTINEL);
        for (const leak of ['old-plan', 'engineering-notes', 'reports/analysis', '0002-old-decision']) {
          expect(text, `${f} names ${leak}`).not.toContain(leak);
        }
      }
      // The ADR Hub card list holds the published ADR only.
      const hub = readFileSync(path.join(dist, 'adr', 'index.html'), 'utf8');
      expect(hub).toContain('ADR-0001: Keep this');
      expect(hub).not.toContain('0002');

      // The gates read the list from the site config and skip the folders: the
      // excluded files would fail both (no title, a dangling link).
      const fm = script('validate-frontmatter.mjs', 'docs');
      expect(fm.status, fm.output).toBe(0);
      expect(fm.output).toContain('excluded folders: archive, reports, plans/engineering-notes, adr/archive (from astro.config.mjs)');
      const links = script('check-links.mjs', 'docs', '--strict');
      expect(links.status, links.output).toBe(0);
      expect(links.output).toContain('excluded folders: archive, reports, plans/engineering-notes, adr/archive');
      const built404 = script('assert-no-broken-links.mjs', 'dist', '--base', '/site', '--site', 'https://example.test', '--docs', 'docs');
      expect(built404.status, built404.output).toBe(0);
      const adrIndex = script('generate-adr-index.mjs', '--docs', 'docs', '--dir', 'docs/adr', '--check');
      expect(adrIndex.status, adrIndex.output).toBe(0);
      // Control: without the site's list the excluded ADR is in the table.
      const adrWhole = script('generate-adr-index.mjs', '--dir', 'docs/adr', '--check');
      expect(adrWhole.status, adrWhole.output).toBe(1);
    },
    240_000,
  );

  it(
    'a published page linking into an excluded folder fails both link gates with "excluded from the site"',
    () => {
      writeFileSync(path.join(SITE, 'docs', 'leaky.md'), LEAKY);
      try {
        const links = script('check-links.mjs', 'docs', '--strict');
        expect(links.status, links.output).toBe(1);
        const lines = links.output.split('\n').filter((l) => l.startsWith('✖'));
        expect(lines).toEqual([
          expect.stringMatching(/leaky\.md: link target is excluded from the site \(the folder "archive" is in exclude.* → \.\/archive\/old-plan\.md$/),
          expect.stringMatching(/leaky\.md: link target is excluded from the site \(the folder "reports" is in exclude.* → \.\/reports\/$/),
          expect.stringMatching(/leaky\.md: link target is excluded from the site \(the folder "plans\/engineering-notes" is in exclude.* → \/plans\/engineering-notes\/note\/$/),
          expect.stringMatching(/leaky\.md: related ref target is excluded from the site \(the folder "archive" is in exclude.* → archive\/old-plan$/),
        ]);

        // The build itself refuses the `related:` ref, naming the exclusion.
        const refused = build();
        expect(refused.status, refused.output).not.toBe(0);
        expect(refused.output).toContain(
          'related reference "archive/old-plan" — target is excluded from the site (the folder "archive" is in exclude',
        );

        // Without the ref the site builds; its body links are 404s there, which the built-output gate names.
        writeFileSync(path.join(SITE, 'docs', 'leaky.md'), LEAKY.replace(/related:\s*\n\s*- archive\/old-plan\n/, ''));
        const result = build();
        expect(result.status, result.output).toBe(0);
        const gate = script('assert-no-broken-links.mjs', 'dist', '--base', '/site', '--docs', 'docs');
        expect(gate.status, gate.output).toBe(1);
        expect(gate.output).toMatch(/leaky\/index\.html → \/site\/plans\/engineering-notes\/note\/.*: target is excluded from the site \(the folder "plans\/engineering-notes"/);
        // A relative link the build did not rewrite resolves under the page's own URL, so the
        // built-output gate cannot tell where it pointed: it still fails, with the generic reason
        // (check-links above names it precisely).
        expect(gate.output).toContain('leaky/index.html → ./archive/old-plan.md (resolved: /site/leaky/archive/old-plan.md): no matching page or file in dist');
        expect(gate.output).toContain('leaky/index.html → ./reports/ (resolved: /site/leaky/reports/): no matching page or file in dist');
        // Without --docs the same links still fail, with the generic reason.
        const plain = script('assert-no-broken-links.mjs', 'dist', '--base', '/site');
        expect(plain.status, plain.output).toBe(1);
        expect(plain.output).not.toContain('excluded from the site');
      } finally {
        rmSync(path.join(SITE, 'docs', 'leaky.md'), { force: true });
      }
    },
    240_000,
  );
});
