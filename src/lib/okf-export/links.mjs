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
 *  - a `.md`/`.mdx` target (path only, not `#fragment`/`?query`) is a source link: a
 *    relative one resolves against the linking page's SOURCE directory (its node id),
 *    a root-absolute one against the docs root (a leading `base` is stripped); the
 *    result is decoded and looked up by node id -> `/<bundle path>.md` (an index id
 *    maps to `index.md`);
 *  - a `.md`/`.mdx` target with no node (draft, excluded page, repo file outside the
 *    docs root) -> left unchanged, never turned into a URL that would 404;
 *  - other internal links, no node (assets, `/api/...`) -> absolute URL when `siteUrl`
 *    is set, else unchanged;
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
 * Ids of the page/persona nodes: the source path without extension.
 *
 * @param {Array<Record<string, any>>} nodes
 * @returns {Set<string>}
 */
export function idIndex(nodes) {
  return new Set(nodes.filter((n) => n.kind === 'page' || n.kind === 'persona').map((n) => n.id));
}

/**
 * @typedef {object} LinkContext
 * @property {Map<string, string>} routes from `routeIndex`
 * @property {Set<string>} ids from `idIndex`
 * @property {string} pageId the linking page's node id (its source path, for `.md` links)
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
  if (/\.mdx?$/i.test(path)) return resolveSourceLink(path, tail, ctx) ?? url;
  const abs = path.startsWith('/') ? path : new URL(path, `http://x${ctx.pageHref.endsWith('/') ? ctx.pageHref : `${ctx.pageHref}/`}`).pathname;
  const unbased = stripBase(abs, ctx.base);
  const id = ctx.routes.get(trimRoute(unbased));
  if (id !== undefined) return `/${ctx.bundlePath(id)}${tail}`;
  return ctx.siteUrl === '' ? url : `${ctx.siteUrl}${unbased}${tail}`;
}

/**
 * @param {string} abs root-absolute path
 * @param {string} base
 */
function stripBase(abs, base) {
  return base !== '' && (abs === base || abs.startsWith(`${base}/`)) ? abs.slice(base.length) || '/' : abs;
}

/** @param {string} p */
function safeDecode(p) {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

/**
 * Resolve a relative path against a docs-relative directory, without the clamping of
 * `new URL`: a path that climbs above the docs root resolves to nothing.
 *
 * @param {string} dir docs-relative directory with trailing slash, or ''
 * @param {string} path relative link path
 * @returns {string | undefined} root-absolute path, or undefined when it escapes the root
 */
function climb(dir, path) {
  const stack = dir.split('/').filter(Boolean);
  for (const seg of path.split('/')) {
    if (seg === '..') {
      if (stack.pop() === undefined) return undefined;
    } else if (seg !== '.' && seg !== '') stack.push(seg);
  }
  return `/${stack.join('/')}`;
}

/**
 * Resolve a `.md`/`.mdx` link by node id: relative targets against the directory of
 * the linking page's source, root-absolute ones against the docs root.
 *
 * @param {string} path link path (extension included, no fragment or query)
 * @param {string} tail `#fragment` / `?query`
 * @param {LinkContext} ctx
 * @returns {string | undefined} the bundle link, or undefined when no node matches
 */
function resolveSourceLink(path, tail, ctx) {
  const slash = ctx.pageId.lastIndexOf('/');
  const dir = slash < 0 ? '' : ctx.pageId.slice(0, slash + 1);
  const abs = path.startsWith('/') ? stripBase(path, ctx.base) : climb(dir, path);
  if (abs === undefined) return undefined;
  const id = safeDecode(abs).replace(/^\/+/, '').replace(/\.mdx?$/i, '');
  return ctx.ids.has(id) ? `/${ctx.bundlePath(id)}${tail}` : undefined;
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
 * Every link destination outside code that passes `keep`, as written.
 *
 * @param {string} body
 * @param {(dest: string) => boolean} keep
 * @returns {string[]}
 */
function linksWhere(body, keep) {
  /** @type {string[]} */
  const found = [];
  mapOutsideCode(body, (text) => {
    for (const re of [INLINE, REFDEF, ANCHOR]) {
      for (const m of text.matchAll(re)) {
        if (keep(m[3])) found.push(m[3]);
      }
    }
    return text;
  });
  return found;
}

/**
 * Every root-relative (`/...`) link destination outside code, as written.
 *
 * @param {string} body
 * @returns {string[]}
 */
export function rootLinks(body) {
  return linksWhere(body, (d) => d.startsWith('/') && !d.startsWith('//'));
}

/**
 * Every relative file link destination outside code, as written: not a scheme, `//`,
 * root-absolute, or a pure `#anchor`/`?query`.
 *
 * @param {string} body
 * @returns {string[]}
 */
export function relativeLinks(body) {
  return linksWhere(body, (d) => d !== '' && !/^[/#?]/.test(d) && !SCHEME.test(d));
}
