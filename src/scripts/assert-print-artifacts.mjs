/**
 * The print-route gate (ADR-0081, #380 FR-019): run by `assert-build-artifacts.mjs`.
 *
 * The expected print documents come from the site config and `sections.yaml`, never
 * from `dist/print/manifest.json`, which the route itself writes: a resolution bug that
 * dropped a section would otherwise drop it from both sides and pass. The config is
 * evaluated in a child process (`site-config-eval.mjs`), and every section that
 * AUTHORS `pdf: true` or `pdf: false` in the bare-Node registry must agree with it.
 * The manifest is read for page counts and titles only.
 *
 * Per document: the route exists, is `noindex`, has no Pagefind body, holds at least
 * one page with as many page-title headings as the manifest says, has no duplicate
 * `id`, and every same-site absolute link in it resolves to a built file. No other
 * print route exists, and no print route is in the sitemap.
 */
import { existsSync, statSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { findSiteRoot } from '../lib/draft-publication.mjs';
import { resolveSectionRegistryEntries } from '../lib/vocabulary-loader.mjs';
import { evaluateSiteConfig } from './site-config-eval.mjs';

/** The reserved whole-site name (pdf-options.ts `SITE_PDF_NAME`). */
const SITE = 'site';

/** The names the evaluated config expects, checked against the authored registry. */
function expectedNames(pdf, registry, fail) {
  const sections = pdf?.sections ?? [];
  const excluded = new Set(pdf?.excludeSections ?? []);
  for (const entry of registry ?? []) {
    if (excluded.has(entry.id) || entry.pdf?.section === undefined) continue;
    if (entry.pdf.section && !sections.includes(entry.id)) {
      fail(`print routes: sections.yaml gives "${entry.id}" pdf: true, but the resolved config has no PDF for it`);
    }
    if (!entry.pdf.section && sections.includes(entry.id)) {
      fail(`print routes: sections.yaml gives "${entry.id}" pdf: false, but the resolved config has a PDF for it`);
    }
  }
  return pdf?.site ? [...sections, SITE] : [...sections];
}

/** A file under `dist` for a same-site URL path (directory → `index.html`), or null. */
function distFileFor(distDir, base, pathname) {
  if (!pathname.startsWith(`${base}/`) && pathname !== base) return null;
  let rel = decodeURIComponent(pathname.slice(base.length));
  if (rel === '' || rel.endsWith('/')) rel = `${rel}index.html`;
  const file = path.join(distDir, rel);
  // A path without its trailing slash names a page directory: the page is its index.
  return existsSync(file) && statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
}

/**
 * @param {string} distDir
 * @param {{ ok: (m: string) => void, fail: (m: string) => void }} report
 */
export async function assertPrintArtifacts(distDir, { ok, fail }) {
  const { config } = evaluateSiteConfig({ siteRoot: findSiteRoot(distDir), tool: 'assert:artifacts' });
  // Charter-aware, like the build: a site may keep its registry in charter.yaml.
  const registry = config?.docsRoot ? resolveSectionRegistryEntries(config.docsRoot) : null;
  const expected = expectedNames(config?.pdf ?? null, registry, fail);
  const printDir = path.join(distDir, 'print');
  const manifestPath = path.join(printDir, 'manifest.json');

  // No print route at all on a site without PDFs.
  if (expected.length === 0) {
    if (existsSync(printDir)) fail('print routes: dist/print/ exists, but the site enables no PDF');
    ok('print routes: none expected, none built');
    return;
  }
  if (!existsSync(manifestPath)) {
    fail(`print routes: dist/print/manifest.json is missing; expected documents ${expected.join(', ')}`);
    return;
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const listed = (manifest.documents ?? []).map((doc) => doc.name).sort();
  if (JSON.stringify(listed) !== JSON.stringify([...expected].sort())) {
    fail(`print routes: the manifest lists ${listed.join(', ') || 'nothing'}, the config expects ${[...expected].sort().join(', ')}`);
  }

  // No print route beyond the expected ones.
  const built = (await readdir(printDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  const strays = built.filter((name) => !expected.includes(name));
  if (strays.length) fail(`print routes: unexpected print route(s) ${strays.join(', ')} (no PDF enabled for them)`);
  if (!expected.includes(SITE) && existsSync(path.join(printDir, 'index.html'))) {
    fail('print routes: /print/ is built, but the whole-site PDF is off');
  }

  for (const doc of manifest.documents ?? []) {
    const file = doc.name === SITE ? path.join(printDir, 'index.html') : path.join(printDir, doc.name, 'index.html');
    if (!existsSync(file)) {
      fail(`print routes: ${doc.name}: ${path.relative(distDir, file)} is missing`);
      continue;
    }
    const html = await readFile(file, 'utf8');
    const where = `print routes: ${doc.name}`;
    if (!/<meta name="robots" content="noindex"/.test(html)) fail(`${where}: no robots noindex meta`);
    if (/data-pagefind-body/.test(html)) fail(`${where}: the page is in the search index (data-pagefind-body)`);
    if (!(doc.pages >= 1)) fail(`${where}: no published page to print (pages: ${doc.pages})`);
    const titles = (html.match(new RegExp(`<h${doc.titleLevel}\\b[^>]*class="dk-print-page__title"`, 'g')) ?? []).length;
    if (titles !== doc.pages) fail(`${where}: ${titles} page title(s) at h${doc.titleLevel}, the manifest says ${doc.pages}`);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    if (dupes.length) fail(`${where}: duplicate id(s) ${dupes.slice(0, 5).join(', ')}`);

    // Rewritten links are absolute: map the same-site ones back into dist.
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (!canonical) {
      fail(`${where}: no canonical link to derive the site URL from`);
      continue;
    }
    const docUrl = new URL(canonical);
    const base = docUrl.pathname.replace(/\/print\/(?:[^/]+\/)?$/, '');
    const dangling = [];
    const missingFragments = [];
    for (const [, href] of html.matchAll(/<a\b[^>]*\shref="([^"]+)"[^>]*data-dk-print-link/g)) {
      if (href.startsWith('#')) {
        // The target page must be in the document. A fragment inside it is checked as the
        // site checks fragments (it does not): one the source page already got wrong is
        // reported, not failed, so the print document is no stricter than the site.
        const page = href.match(/^#(p\d+)/)?.[1];
        if (!page || !ids.includes(page)) dangling.push(href);
        else if (!ids.includes(href.slice(1))) missingFragments.push(href);
        continue;
      }
      const url = new URL(href);
      if (url.origin !== docUrl.origin) continue;
      const target = distFileFor(distDir, base, url.pathname);
      if (!target || !existsSync(target)) dangling.push(href);
    }
    if (dangling.length) fail(`${where}: ${dangling.length} link(s) resolve to nothing: ${dangling.slice(0, 5).join(', ')}`);
    ok(`${where}: ${doc.pages} page(s), noindex, out of search, ids unique, links resolve`);
    if (missingFragments.length) {
      ok(`${where}: note: ${missingFragments.length} link(s) name a fragment the target page lacks (as on the site): ${missingFragments.slice(0, 5).join(', ')}`);
    }
  }

  for (const name of (await readdir(distDir)).filter((f) => /^sitemap.*\.xml$/.test(f))) {
    if ((await readFile(path.join(distDir, name), 'utf8')).includes('/print/')) fail(`print routes: ${name} lists a print route`);
  }
  ok(`print routes: exactly ${expected.join(', ')}, as the config and sections.yaml expect; none in the sitemap`);
}
