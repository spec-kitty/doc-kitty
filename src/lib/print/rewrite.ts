/**
 * `print/rewrite` — fit one page's rendered HTML into a print document (ADR-0081, #380).
 * Pure string work on the HTML the content pipeline already produced.
 *
 * - Ids are namespaced: every `id` gets the page prefix (`p3-…`), and every reference to
 *   one of this page's ids follows: `href`/`xlink:href="#…"`, `url(#…)`, ARIA and
 *   `for`/`headers` id lists, and `#id` selectors in `<style>` blocks (Mermaid scopes
 *   its CSS to the SVG id). Two pages with an "Overview" heading, or two copies of one
 *   diagram, no longer collide.
 * - Root-relative links are rewritten: a page in the same document becomes an
 *   in-document anchor; anything else becomes an absolute site URL, so the PDF's links
 *   work outside the site. Every rewritten link carries `data-dk-print-link`, which the
 *   print stylesheet reads to print no URL after it.
 * - Headings are demoted so page content sits below the page title in the outline.
 */

export interface RewriteOptions {
  /** The page prefix, e.g. `p3`; ids become `p3-<id>`. */
  prefix: string;
  /** Route path (with the site base and a trailing slash) → the page anchor id. */
  pageAnchors: ReadonlyMap<string, string>;
  /** The site origin, e.g. `https://example.org` (no trailing slash). */
  origin: string;
  /** Levels to demote every heading by (capped at `h6`). */
  demote: number;
  /** The lowest level a heading may end at, e.g. one below the page titles. */
  floor?: number;
  /** The page's own route path, to resolve its relative links (`./x/`, `../y/`). */
  pagePath?: string;
}

const ID_ATTR = /(\s)id="([^"]+)"/g;
const ID_LIST_ATTR = /(\s(?:aria-labelledby|aria-describedby|aria-controls|aria-owns|for|headers))="([^"]*)"/g;
const FRAGMENT_HREF = /(\s(?:href|xlink:href))="#([^"]*)"/g;
const URL_REF = /url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g;
const STYLE_BLOCK = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g;
const ROOT_LINK = /(<a\b[^>]*?\s)href="(\/(?!\/)[^"]*)"/g;
/** A relative href: not root-relative, not a fragment, no scheme, not protocol-relative. */
const RELATIVE_LINK = /(<a\b[^>]*?\s)href="(?![#/]|[a-zA-Z][a-zA-Z0-9+.-]*:)([^"]+)"/g;
const HEADING_TAG = /<(\/?)h([1-6])(?=[\s>])/g;
const LEVEL_CLASS = /\blevel-h([1-6])\b/g;
/** An element that is a heading by ARIA (`role="heading" aria-level="N"`), e.g. a Markua aside's. */
const ARIA_HEADING_TAG = /<[a-zA-Z][^<>]*\brole="heading"[^<>]*>/g;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Normalise a route path for lookup: decode, and end in exactly one slash. */
function routeKey(pathname: string): string {
  let key = pathname;
  try {
    key = decodeURI(pathname);
  } catch {
    /* keep the raw path */
  }
  if (key.endsWith('/index.html')) key = key.slice(0, -'index.html'.length);
  return key.endsWith('/') ? key : `${key}/`;
}

export function rewritePage(html: string, options: RewriteOptions): string {
  const { prefix, pageAnchors, origin, demote, pagePath, floor = 1 } = options;
  const ids = new Set<string>();
  for (const match of html.matchAll(ID_ATTR)) ids.add(match[2]);
  const local = (id: string): string => (ids.has(id) ? `${prefix}-${id}` : id);

  let out = html.replace(ID_ATTR, (_m, space: string, id: string) => `${space}id="${prefix}-${id}"`);
  out = out.replace(ID_LIST_ATTR, (_m, attr: string, list: string) => `${attr}="${list.split(/\s+/).map(local).join(' ')}"`);
  out = out.replace(FRAGMENT_HREF, (_m, attr: string, id: string) => `${attr}="#${local(id)}"`);
  // `url(#…)` only in attribute values (SVG `marker-end`, `fill`, inline `style`) and in
  // `<style>` blocks (below), never in text, so a code sample that shows one is untouched.
  const urlRefs = (text: string): string =>
    text.replace(URL_REF, (_m, quote: string, id: string) => `url(${quote}#${local(id)}${quote})`);
  out = out.replace(/(<[a-zA-Z][^<>]*>)/g, (tag: string) => tag.replace(/="([^"]*)"/g, (_m, value: string) => `="${urlRefs(value)}"`));

  // `#id` selectors in a page's own `<style>` blocks, for ids this page defines only.
  if (ids.size > 0) {
    const selector = new RegExp(
      `#(${[...ids].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})(?![\\w-])`,
      'g',
    );
    out = out.replace(STYLE_BLOCK, (_m, open: string, css: string, close: string) =>
      `${open}${urlRefs(css).replace(selector, (_s, id: string) => `#${prefix}-${id}`)}${close}`,
    );
  }

  // A relative link means the same thing from the print route only by accident: make it
  // root-relative against the page it was written in, then treat it like the rest.
  if (pagePath !== undefined) {
    out = out.replace(RELATIVE_LINK, (_m, head: string, href: string) => {
      const url = new URL(href, `http://print.invalid${pagePath}`);
      return `${head}href="${url.pathname}${url.search}${url.hash}"`;
    });
  }
  out = out.replace(ROOT_LINK, (_m, head: string, href: string) => {
    const hash = href.indexOf('#');
    const pathPart = hash === -1 ? href : href.slice(0, hash);
    const fragment = hash === -1 ? '' : href.slice(hash + 1);
    const anchor = pageAnchors.get(routeKey(pathPart.split('?')[0]));
    const target = anchor ? `#${fragment ? `${anchor}-${fragment}` : anchor}` : `${origin}${href}`;
    return `${head}href="${target}" data-dk-print-link`;
  });

  if (demote > 0 || floor > 1) {
    // A content `<h1>` (a Markua part title, say) must not land on the page-title level.
    const shift = (level: string): number => Math.min(6, Math.max(Number(level) + demote, floor));
    out = out.replace(HEADING_TAG, (_m, close: string, level: string) => `<${close}h${shift(level)}`);
    out = out.replace(LEVEL_CLASS, (_m, level: string) => `level-h${shift(level)}`);
    // The PDF outline counts these as headings too.
    out = out.replace(ARIA_HEADING_TAG, (tag: string) =>
      tag.replace(/\baria-level="([1-6])"/, (_m, level: string) => `aria-level="${shift(level)}"`),
    );
  }
  return out;
}
