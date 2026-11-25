/**
 * The large-hub fixture site (#341, WP04): writes a small DocKitty site with one
 * hub of N generated children, builds it with Astro, and reads the built pages.
 *
 * The site lives under `example/.dk-test-sidebar-cap*` so the toolkit, Astro and
 * Starlight resolve as they do for an adopter (git-ignored in case a run dies).
 * Used by `sidebar-child-cap-build.test.ts`, by `capture-golden.mjs` (on the
 * mission's base commit) and by `measure.mjs`.
 *
 * Node built-ins only.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** Every fixture site is a folder with this prefix directly in an `example/` folder. */
export const SITE_PREFIX = '.dk-test-sidebar-cap-';

/** `p` after symlinks when it exists, else `p` resolved against its nearest existing ancestor. */
function realpathOrSelf(p) {
  let probe = p;
  const tail = [];
  while (true) {
    try {
      return path.join(realpathSync(probe), ...tail.reverse());
    } catch {
      const up = path.dirname(probe);
      if (up === probe) return p;
      tail.push(path.basename(probe));
      probe = up;
    }
  }
}

/**
 * The fixture site folder `dir`, checked: an `example/.dk-test-sidebar-cap-*`
 * folder inside this repository (after symlinks). `writeSite` deletes it and
 * `buildSite` runs Astro in it, so any other path is refused.
 */
export function siteDir(dir) {
  const abs = path.resolve(dir);
  const example = path.dirname(abs);
  if (!path.basename(abs).startsWith(SITE_PREFIX) || path.basename(example) !== 'example') {
    throw new Error(`[large-hub] not a fixture site folder (example/${SITE_PREFIX}*): ${abs}`);
  }
  const root = realpathSync(REPO_ROOT);
  const inside = (p) => p === root || p.startsWith(root + path.sep);
  // Checked before anything is created, and again after symlinks are resolved.
  if (!inside(realpathOrSelf(example))) {
    throw new Error(`[large-hub] fixture site folder outside the repository ${root}: ${abs}`);
  }
  mkdirSync(example, { recursive: true });
  const parent = realpathSync(example);
  if (!inside(parent)) throw new Error(`[large-hub] fixture site folder outside the repository ${root}: ${abs}`);
  return path.join(parent, path.basename(abs));
}

/** The site's `base`. */
export const BASE = '/site';

const page = (title, kind, { body = '', extra = '' } = {}) =>
  `---\ntitle: ${JSON.stringify(title)}\ndescription: Fixture page.\ndoc_status: active\nupdated: 2026-11-23T00:00:00Z\nkind: ${kind}\n${extra}---\n\n${body || `Text of ${title}.`}\n`;

/** Zero-padded child number, so slug order and title order differ (titles count down). */
const pad = (n) => String(n).padStart(4, '0');

/**
 * The child pages of the `missions` hub. Slugs count up and titles count down,
 * so the hub's listing order (by title) is the reverse of Starlight's (by slug).
 */
export function missionChildren(count) {
  return Array.from({ length: count }, (_, i) => ({
    slug: `missions/m-${pad(i + 1)}`,
    title: `Mission ${pad(count - i)}`,
  }));
}

/**
 * The files of a fixture site.
 *
 * @param {object} options
 * @param {number} [options.missions=0] Children of the `missions` hub (0: no `missions` section).
 * @param {boolean} [options.hidden=false] Write every mission child with `sidebar: { hidden: true }`.
 * @param {number} [options.siteCap] The site's `sidebar.childCap`.
 * @param {number} [options.guides=10] Children of the `guides` hub (under the default cap).
 * @param {number} [options.pageSize] The site's `hub.pageSize` (#342).
 * @param {number} [options.hubPageSize] The `missions` hub's `hub_page_size` frontmatter (#342).
 * @param {number} [options.hubCap] The `missions` hub's `sidebar_child_cap` frontmatter.
 * @param {boolean} [options.customSidebar=false] Hand Starlight a consumer sidebar, so the toolkit does not shape it.
 * @param {number} [options.fr=0] Children of a translated `fr/missions` hub; adds the `fr` locale (#342, FR-018).
 * @param {boolean} [options.pageChild=false] Add `missions/page.md`, a child whose route a paged hub's listing needs (FR-016).
 */
export function siteFiles({
  missions = 0,
  hidden = false,
  siteCap,
  guides = 10,
  pageSize,
  hubPageSize,
  hubCap,
  customSidebar = false,
  fr = 0,
  pageChild = false,
} = {}) {
  const sidebar = customSidebar
    ? `, sidebar: [{ label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] }, { label: 'Missions', link: '/missions/' }]`
    : siteCap === undefined
      ? ''
      : `, sidebar: { childCap: ${siteCap} }`;
  const hub = pageSize === undefined ? '' : `, hub: { pageSize: ${pageSize} }`;
  const locales = fr
    ? `, starlight: { defaultLocale: 'root', locales: { root: { label: 'English', lang: 'en' }, fr: { label: 'Français', lang: 'fr' } } }`
    : '';
  const files = {
    'astro.config.mjs': `import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';
export default defineConfig({
  site: 'https://example.test',
  base: '${BASE}',
  integrations: defineDocKittyIntegrations({ title: 'Large hub fixture', base: '${BASE}'${sidebar}${hub}${locales} }),
});
`,
    'src/content.config.ts': `import { defineCollection } from 'astro:content';
import { docKittyDocsLoader, docKittyDocsSchema } from '@spec-kitty/doc-toolkit/schema';
export const collections = { docs: defineCollection({ loader: docKittyDocsLoader({ base: 'docs' }), schema: docKittyDocsSchema() }) };
`,
    'docs/_meta/sections.yaml': `version: 1
sections:
  - id: guides
    label: Guides
    order: 10
${missions ? '  - id: missions\n    label: Missions\n    order: 20\n' : ''}  - id: ops
    label: Ops
    order: 30
`,
    ...(fr
      ? {
          'src/content.config.ts': `import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { i18nSchema } from '@astrojs/starlight/schema';
import { docKittyDocsLoader, docKittyDocsSchema } from '@spec-kitty/doc-toolkit/schema';
export const collections = {
  docs: defineCollection({ loader: docKittyDocsLoader({ base: 'docs' }), schema: docKittyDocsSchema() }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
`,
          'src/content/i18n/fr.json': `${JSON.stringify({ 'dockitty.hub.pagination.label': 'Pagination (fr)', 'dockitty.hub.pagination.next': 'Suivant' }, null, 2)}\n`,
        }
      : {}),
    'docs/README.md': page('Large hub fixture', 'Hub'),
    'docs/guides/README.md': page('Guides', 'Hub'),
    'docs/ops/README.md': page('Ops', 'Hub'),
    'docs/ops/runbook.md': page('Runbook', 'Runbook'),
  };
  for (let i = 1; i <= guides; i += 1) files[`docs/guides/guide-${pad(i)}.md`] = page(`Guide ${pad(i)}`, 'How-To');
  if (missions) {
    const hubExtra = `${hubCap === undefined ? '' : `sidebar_child_cap: ${hubCap}\n`}${hubPageSize === undefined ? '' : `hub_page_size: ${hubPageSize}\n`}`;
    files['docs/missions/README.md'] = page('Missions', 'Hub', { extra: hubExtra });
    if (pageChild) files['docs/missions/page.md'] = page('Page', 'Explanation');
    const extra = hidden ? 'sidebar:\n  hidden: true\n' : '';
    for (const { slug, title } of missionChildren(missions)) files[`docs/${slug}.md`] = page(title, 'Explanation', { extra });
  }
  if (fr) {
    files['docs/fr/README.md'] = page('Accueil', 'Hub');
    files['docs/fr/missions/README.md'] = page('Missions (fr)', 'Hub');
    for (const { slug, title } of missionChildren(fr)) files[`docs/fr/${slug}.md`] = page(`${title} (fr)`, 'Explanation');
  }
  return files;
}

/** Write a fixture site to `dir`, replacing whatever was there. */
export function writeSite(dir, options) {
  const site = siteDir(dir);
  rmSync(site, { recursive: true, force: true });
  for (const [rel, contents] of Object.entries(siteFiles(options))) {
    const abs = path.join(site, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
  }
}

/**
 * Build the site in `dir` with the Astro of the checkout it sits in (the
 * `example/` folder's own dependencies); returns status, output and seconds.
 */
export function buildSite(dir) {
  const site = siteDir(dir);
  const astroBin = path.join(path.dirname(site), 'node_modules', 'astro', 'bin', 'astro.mjs');
  // A production build wherever it is run from. Vitest exports Vite's own variables
  // (`MODE`, `DEV`, `PROD`, `SSR`, `BASE_URL`) and `NODE_ENV=test`: inherited, they
  // give Starlight's dev-mode search markup and override the site's `base`.
  const env = { ...process.env, CI: '', NODE_ENV: 'production' };
  for (const key of ['BASE_URL', 'MODE', 'DEV', 'PROD', 'SSR']) delete env[key];
  const started = process.hrtime.bigint();
  const r = spawnSync(process.execPath, [astroBin, 'build'], { cwd: site, encoding: 'utf8', env, maxBuffer: 1 << 28 });
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  return { status: r.status, output: stripVTControlCharacters(`${r.stdout}\n${r.stderr}`), seconds };
}

/** Every built HTML page of `dist`, as route (`missions/m-0001`) → HTML. */
export function builtPages(dist) {
  const out = new Map();
  const walk = (rel) => {
    for (const entry of readdirSync(path.join(dist, rel), { withFileTypes: true })) {
      const child = path.join(rel, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.name === 'index.html') out.set(rel.split(path.sep).join('/'), readFileSync(path.join(dist, child), 'utf8'));
    }
  };
  walk('');
  return out;
}

/**
 * Mask the parts of a built page that encode WHERE it was built, not what it is:
 * Astro hashes the absolute path of a component outside the site root (the
 * toolkit's, here) into its scoped class names, and those reach the CSS bundle's
 * file name. Two checkouts of the same commit therefore differ only there. Used to
 * compare a build with goldens captured in another checkout; content, attributes,
 * links and the sidebar are untouched.
 */
export function normaliseBuildPaths(html) {
  return html
    .replace(/astro-[a-z0-9]{8}/g, 'astro-X')
    .replace(/data-astro-cid-[a-z0-9]{8}/g, 'data-astro-cid-X')
    .replace(/(_astro\/[\w.-]*?)\.[\w-]{8}\.(css|js)/g, '$1.H.$2');
}

/** sha256 of a string, hex. */
export const sha256 = (text) => createHash('sha256').update(text).digest('hex');
