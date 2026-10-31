/**
 * Legacy `.html` redirects (issue #249, ADR-0068).
 *
 * A site that moves to DocKitty from a generator with `.html` URLs (DocFX,
 * Sphinx, Jekyll without permalinks) must keep every old `/a/b.html` URL
 * working. Astro's own `redirects` cannot do that on a static host: with the
 * directory build format it writes a redirect keyed on `/a/b.html` as the
 * FOLDER `<dist>/a/b.html/index.html`, so `/a/b.html` only works if the host
 * answers a request for a folder with a redirect to `/a/b.html/`; and a key
 * `/a/b/index.html` replaces the live page `<dist>/a/b/index.html` with a
 * folder of the same name (both seen in the ADR-0068 spike).
 *
 * The toolkit therefore writes each legacy redirect itself, after the build,
 * as a FLAT file at `<dist>/a/b.html`: the one file a static host serves for
 * that exact URL. The file is the same meta-refresh page Astro writes for its
 * own redirects (title, refresh, `noindex`, canonical link to the target), so
 * the redirect-coverage gate and the draft-publication integration recognise
 * it without a second shape. It is written in `astro:build:done`, after the
 * sitemap and every route has been generated, so it never appears in the
 * sitemap, `llms.txt` or the agent API.
 *
 * Bare Node (stdlib only): the integration, the gate and the map-generator CLI
 * all import it.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Astro's static redirect stub shape; the same expression the gate uses. */
export const REDIRECT_STUB_RE =
  /<title>Redirecting to: [^<]*<\/title>[\s\S]*?<meta http-equiv="refresh" content="\d+;\s*url=([^"]*)"/i;

const EXTERNAL_RE = /^([a-z][a-z0-9+.-]*:)?\/\//i;

/** `true` for a site path whose last segment ends in `.html`. */
export function isHtmlSource(urlPath) {
  return /\.html$/i.test(String(urlPath));
}

/**
 * Validate a legacy map (`{ '/old.html': '/new/' }`, sources and targets without
 * the site base) and return it as entries sorted by source. Throws one error
 * that names every bad entry.
 *
 * @param {Record<string, unknown> | undefined} map
 * @returns {Array<{ from: string, to: string }>}
 */
export function normalizeLegacyHtmlRedirects(map) {
  const problems = [];
  const entries = [];
  for (const [from, to] of Object.entries(map ?? {})) {
    if (!from.startsWith('/')) problems.push(`"${from}": a source must start with / (a site path without the base)`);
    else if (/[?#]/.test(from)) problems.push(`"${from}": a source cannot carry a query or fragment`);
    else if (!isHtmlSource(from)) problems.push(`"${from}": a source must end in .html (use Astro's \`redirects\` for directory URLs)`);
    if (typeof to !== 'string' || to.trim() === '') problems.push(`"${from}": the target must be a non-empty string`);
    else if (!EXTERNAL_RE.test(to) && !to.startsWith('/')) problems.push(`"${from}": the target "${to}" must start with / or be an absolute URL`);
    if (problems.length === 0) entries.push({ from, to: /** @type {string} */ (to).trim() });
  }
  if (problems.length > 0) {
    throw new Error(`[dk-legacy-html] invalid legacyHtmlRedirects:\n  - ${problems.join('\n  - ')}`);
  }
  return entries.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

/**
 * Point each entry at the end of its chain through the legacy map itself, so a
 * visitor takes one meta refresh instead of several (`/a.html -> /b.html ->
 * /c/` becomes `/a.html -> /c/`). A loop is refused. A chain that leaves the
 * legacy map (into a directory redirect or a page) is left for the gate to
 * follow.
 *
 * @param {Array<{ from: string, to: string }>} entries
 * @returns {Array<{ from: string, to: string }>}
 */
export function flattenLegacyChains(entries) {
  const next = new Map(entries.map((e) => [e.from, e.to]));
  return entries.map(({ from, to }) => {
    const seen = new Set([from]);
    let target = to;
    while (next.has(target.replace(/[?#].*$/, ''))) {
      const key = target.replace(/[?#].*$/, '');
      if (seen.has(key)) throw new Error(`[dk-legacy-html] redirect loop in legacyHtmlRedirects: ${[...seen, key].join(' -> ')}`);
      seen.add(key);
      target = /** @type {string} */ (next.get(key));
    }
    return { from, to: target };
  });
}

/** `'/'`, `''`, `'/proj'`, `'proj/'` → `''` or `'/proj'`. */
function basePrefix(base) {
  return ('/' + (base ?? '') + '/').replace(/\/{2,}/g, '/').replace(/\/$/, '');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * The stub page for one legacy redirect. The same markup as Astro's own
 * redirect page (`core/routing/3xx.js`), so every tool that reads one reads the
 * other: refresh after 0 seconds, `noindex`, a canonical link to the target,
 * and a fallback link naming the source and the target.
 *
 * @param {{ from: string, to: string, base?: string, site?: string }} entry
 *   `from` and `to` without the base; `site` the site's origin, when set
 */
export function renderLegacyStub({ from, to, base = '/', site }) {
  const prefix = basePrefix(base);
  const href = EXTERNAL_RE.test(to) ? to : `${prefix}${to}`;
  const canonical = site && !EXTERNAL_RE.test(href) ? new URL(href, site).href : href;
  const h = escapeHtml(href);
  return (
    `<!doctype html><title>Redirecting to: ${h}</title>` +
    `<meta http-equiv="refresh" content="0;url=${h}">` +
    '<meta name="robots" content="noindex">' +
    `<link rel="canonical" href="${escapeHtml(canonical)}">` +
    `<body>\t<a href="${h}">Redirecting from <code>${escapeHtml(`${prefix}${from}`)}</code> to <code>${h}</code></a></body>`
  );
}

/** The route `/x/index.html` stands for (`/x/`), or `null` for any other source. */
function indexRouteOf(from) {
  const m = /^(.*\/)index\.html$/i.exec(from);
  return m ? m[1] : null;
}

/**
 * Write the stubs into a built output folder. `dist` never holds the base, so a
 * source `/a/b.html` is written at `<outDir>/a/b.html` at any base.
 *
 * - A source `/x/index.html` whose own route `/x/` is a live page and whose
 *   target IS `/x/` needs no stub: the host already serves the page at that
 *   URL. It is reported as `servedByPage`.
 * - Any other file already at a source path (a page, an asset from `public/`,
 *   a stub Astro wrote) is never overwritten: the build fails naming it.
 * - A folder at a source path (Astro's directory form of an `.html` redirect)
 *   fails the build too.
 *
 * @param {string} outDir
 * @param {Array<{ from: string, to: string }>} entries
 * @param {{ base?: string, site?: string }} options
 * @returns {{ written: string[], servedByPage: string[] }}
 */
export function writeLegacyHtmlStubs(outDir, entries, { base = '/', site } = {}) {
  const written = [];
  const servedByPage = [];
  const problems = [];
  const planned = [];
  for (const entry of entries) {
    const file = path.join(outDir, entry.from.replace(/^\/+/, ''));
    if (existsSync(file)) {
      if (statSync(file).isDirectory()) {
        problems.push(`${entry.from}: a folder is already at ${path.relative(outDir, file)} (an Astro \`redirects\` entry keyed on the same URL?)`);
        continue;
      }
      const route = indexRouteOf(entry.from);
      const isStub = REDIRECT_STUB_RE.test(readFileSync(file, 'utf8'));
      if (route !== null && !isStub && entry.to.replace(/[?#].*$/, '') === route) {
        servedByPage.push(entry.from);
        continue;
      }
      problems.push(`${entry.from}: a file is already at ${path.relative(outDir, file)} and is never overwritten`);
      continue;
    }
    planned.push({ entry, file });
  }
  if (problems.length > 0) {
    throw new Error(`[dk-legacy-html] cannot write ${problems.length} legacy redirect(s):\n  - ${problems.join('\n  - ')}`);
  }
  for (const { entry, file } of planned) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, renderLegacyStub({ ...entry, base, site }));
    written.push(entry.from);
  }
  return { written, servedByPage };
}

/**
 * Refuse Astro `redirects` keys that end in `.html`: Astro writes them as a
 * folder (`<dist>/a/b.html/index.html`) and, for `/a/b/index.html`, in place of
 * the live page. The message names the toolkit option that replaces them.
 *
 * @param {Record<string, unknown> | undefined} redirects Astro's `redirects` config
 */
export function refuseAstroHtmlRedirects(redirects) {
  const keys = Object.keys(redirects ?? {}).filter(isHtmlSource).sort();
  if (keys.length === 0) return;
  throw new Error(
    `[dk-legacy-html] Astro \`redirects\` has ${keys.length} key(s) ending in .html: ${keys.join(', ')}. ` +
      'Astro writes these as a folder (<dist>/a/b.html/index.html), which a static host does not serve at ' +
      '/a/b.html, and a key /a/b/index.html replaces the live page /a/b/. Move them to the ' +
      '`legacyHtmlRedirects` option of defineDocKittyIntegrations (targets without the base), which writes ' +
      'a flat <dist>/a/b.html stub. See docs/migrations/legacy-html-urls.md.',
  );
}

/**
 * The mechanical map for a whole tree moving from `.html` URLs to directory
 * URLs: `/x.html -> /x/`, `/x/index.html -> /x/`, `/index.html -> /`. URLs are
 * taken as site paths without the base (an origin is stripped); blank lines,
 * `#` comments and URLs that end neither in `.html` nor fall under the rule
 * are skipped and returned. `overrides` (a page that moved, a page that was
 * dropped) win over the mechanical rule, and may add sources the list lacks.
 *
 * @param {string[]} urls
 * @param {Record<string, string>} [overrides]
 * @returns {{ map: Record<string, string>, skipped: string[] }}
 */
export function mechanicalHtmlMap(urls, overrides = {}) {
  /** @type {Record<string, string>} */
  const map = {};
  const skipped = [];
  for (const raw of urls) {
    const line = String(raw).trim();
    if (!line || line.startsWith('#')) continue;
    let p = line.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '').replace(/[?#].*$/, '');
    if (!p.startsWith('/')) p = `/${p}`;
    if (!isHtmlSource(p)) {
      skipped.push(p);
      continue;
    }
    const route = indexRouteOf(p);
    map[p] = route ?? `${p.replace(/\.html$/i, '')}/`;
  }
  for (const [from, to] of Object.entries(overrides)) map[from] = to;
  return { map: Object.fromEntries(Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), skipped };
}
