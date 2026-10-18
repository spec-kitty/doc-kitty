// @ts-check
/**
 * Body-link handling for the OKF export (#178, C-003, C-010).
 *
 * Site pages link each other by route (`/architecture/overview/`). In the bundle a
 * page lives at `/<bundle path>.md`, so those links are rewritten. Resolution uses
 * the graph's own node data (`href` of each page/persona node); no second route
 * resolver exists.
 *
 * Covered link forms: Markdown inline links and images `[t](url)`, reference
 * definitions `[ref]: url`, and raw HTML `<a href="url">`. Fenced code blocks and
 * inline code spans are never touched. Not covered: HTML attributes other than
 * `<a href>`, and autolinks `<https://...>` (always external, so unchanged).
 *
 * Rewrite policy:
 *  - resolves to a page/persona node -> `/<bundle path>.md` (+ `#fragment`);
 *  - internal, no node (assets, `/api/...`) -> absolute URL when `siteUrl` is set,
 *    else unchanged;
 *  - external, `mailto:`, pure `#anchor` -> unchanged.
 *
 * @module okf-export/links
 */

/** Markdown inline link or image destination. */
const INLINE = /(\]\()(<?)([^)\s>]+)(>?)/g;
/** Reference definition destination. */
const REFDEF = /^(\s{0,3}\[(?!\^)[^\]]+\]:\s*)(<?)(\S+?)(>?)(?=\s|$)/gm;
/** Raw HTML anchor. */
const ANCHOR = /(<a\s[^>]*?\bhref=)(["'])(.*?)\2/gi;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const CODE_SPAN = /(`+)[\s\S]*?\1/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Apply `fn` to every part of a Markdown body that is not fenced code or an
 * inline code span.
 *
 * @param {string} markdown
 * @param {(text: string) => string} fn
 * @returns {string}
 */
export function mapOutsideCode(markdown, fn) {
  const out = [];
  /** @type {string[]} */
  let prose = [];
  let fenceMark = '';
  const flush = () => {
    if (prose.length > 0) out.push(spanSafe(prose.join('\n'), fn));
    prose = [];
  };
  for (const line of markdown.split('\n')) {
    const m = FENCE.exec(line);
    if (fenceMark === '' && m) {
      flush();
      fenceMark = m[1];
      out.push(line);
    } else if (fenceMark !== '') {
      out.push(line);
      if (m && m[1][0] === fenceMark[0] && m[1].length >= fenceMark.length && line.trim() === m[1]) fenceMark = '';
    } else prose.push(line);
  }
  flush();
  return out.join('\n');
}

/**
 * @param {string} text
 * @param {(text: string) => string} fn
 */
function spanSafe(text, fn) {
  let result = '';
  let last = 0;
  for (const m of text.matchAll(CODE_SPAN)) {
    result += fn(text.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return result + fn(text.slice(last));
}

/**
 * @param {string} url
 * @returns {{path: string, tail: string}} path before `?`/`#`, and the rest
 */
function splitUrl(url) {
  const cut = url.search(/[?#]/);
  return cut < 0 ? { path: url, tail: '' } : { path: url.slice(0, cut), tail: url.slice(cut) };
}

/** @param {string} p */
const trimRoute = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';

/**
 * Route -> node-id lookup built from the graph's page/persona `href` values.
 *
 * @param {Array<Record<string, any>>} nodes
 * @returns {Map<string, string>}
 */
export function routeIndex(nodes) {
  const routes = new Map();
  for (const n of nodes) {
    if ((n.kind === 'page' || n.kind === 'persona') && typeof n.href === 'string') routes.set(trimRoute(n.href), n.id);
  }
  return routes;
}

/**
 * @typedef {object} LinkContext
 * @property {Map<string, string>} routes from `routeIndex`
 * @property {string} pageHref the linking page's route (for relative links)
 * @property {string} base site base prefix without trailing slash, '' for none
 * @property {string} siteUrl absolute site origin (+ base) without trailing slash, '' if unknown
 * @property {(id: string) => string} bundlePath node id -> bundle path
 */

/**
 * @param {string} url
 * @param {LinkContext} ctx
 * @returns {string}
 */
export function rewriteUrl(url, ctx) {
  if (url === '' || url.startsWith('#') || url.startsWith('//') || SCHEME.test(url)) return url;
  const { path, tail } = splitUrl(url);
  const abs = path.startsWith('/') ? path : new URL(path, `http://x${ctx.pageHref.endsWith('/') ? ctx.pageHref : `${ctx.pageHref}/`}`).pathname;
  const unbased = ctx.base !== '' && (abs === ctx.base || abs.startsWith(`${ctx.base}/`)) ? abs.slice(ctx.base.length) || '/' : abs;
  const id = ctx.routes.get(trimRoute(unbased));
  if (id !== undefined) return `/${ctx.bundlePath(id)}${tail}`;
  return ctx.siteUrl === '' ? url : `${ctx.siteUrl}${unbased}${tail}`;
}

/**
 * Rewrite the site links of one body.
 *
 * @param {string} body
 * @param {LinkContext} ctx
 * @returns {string}
 */
export function rewriteBodyLinks(body, ctx) {
  return mapOutsideCode(body, (text) =>
    text
      .replace(INLINE, (_m, open, lt, url, gt) => `${open}${lt}${rewriteUrl(url, ctx)}${gt}`)
      .replace(REFDEF, (_m, open, lt, url, gt) => `${open}${lt}${rewriteUrl(url, ctx)}${gt}`)
      .replace(ANCHOR, (_m, open, q, url) => `${open}${q}${rewriteUrl(url, ctx)}${q}`),
  );
}

/**
 * Every root-relative (`/...`) link destination outside code, as written.
 *
 * @param {string} body
 * @returns {string[]}
 */
export function rootLinks(body) {
  /** @type {string[]} */
  const found = [];
  mapOutsideCode(body, (text) => {
    for (const re of [INLINE, REFDEF, ANCHOR]) {
      for (const m of text.matchAll(re)) {
        if (m[3].startsWith('/') && !m[3].startsWith('//')) found.push(m[3]);
      }
    }
    return text;
  });
  return found;
}
