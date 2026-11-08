/**
 * link-check-shared.mjs — the dist link-check primitives two gates share
 * (#285; pre-PR review fold F3).
 *
 * `src/scripts/assert-no-broken-links.mjs` (the site-wide built-output gate)
 * and `src/lib/integrations/openapi-link-check.ts` (the OpenAPI section gate)
 * each grew the same machinery: an HTML walk, `<a href>` extraction with
 * entity decoding, base stripping, and route-to-dist-file resolution. Before
 * F3 they were two independent copies that had already drifted (the script's
 * href regex only matched quoted values and never decoded entities; the
 * OpenAPI walk sorted and tolerated a missing root while the script's did
 * neither). This module is the ONE copy both gates use, at the superset of
 * their needs, so they cannot drift apart again:
 *
 *   - `extractHrefs` uses the fuller regex (quoted AND unquoted href values)
 *     and decodes entities, so a `java&#x09;script:` href is visible to every
 *     caller's scheme classification the way it is to a browser;
 *   - `walkHtmlFiles` sorts its output and tolerates a missing root (an empty
 *     list), which the OpenAPI gate needs for a section with no built pages;
 *   - `stripBase` signals a base-less pathname with `null` (not `undefined`)
 *     — the #61 wrong-base signal the site gate reports distinctly;
 *   - `pageRouteFor`'s prefix parameter generalises both call shapes: the
 *     script passes the configured `--base`, the OpenAPI gate passes `''`
 *     for a base-less section route.
 *
 * Bare Node, dependency-free (Node stdlib only) — the same constraint the
 * site gate script documents for itself, so sharing costs the script nothing.
 * `src/scripts/assert-openapi-artifacts.mjs`'s own entity decoder stays
 * private on purpose: it feeds CSP style-attribute hashing, which must stay
 * byte-stable and must not silently gain this module's behaviour.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// Any `scheme:` prefix (`http:`, `https:`, `mailto:`, `tel:`, `javascript:`, …).
// Mirrors `src/lib/with-base.ts` / `src/lib/rehype/base-absolute-links.ts`'s
// classification — kept in this stdlib-only module (not the Astro-runtime TS
// layer those live in) but documented as mirroring it so the seams agree on
// what counts as "external" / non-relative.
export const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

// `<a href="...">` / `<a href='...'>` / unquoted `<a href=value>`, href in any
// attribute position. The unquoted third alternative is the superset both
// gates need: a renderer that emits an unquoted href still gets checked.
const ANCHOR_HREF_RE = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))[^>]*>/gi;

// The named entities a browser may decode inside an attribute value before
// classifying the URL. Kept to the set both gates actually encounter in
// built HTML; unknown names are left untouched rather than guessed.
const NAMED_ENTITIES = {
  amp: '&',
  apos: "'",
  colon: ':',
  gt: '>',
  lt: '<',
  newline: '\n',
  quot: '"',
  tab: '\t',
};

/**
 * Decode the HTML attribute entities a browser decodes before classifying a
 * URL: decimal numeric (`&#65;`), hex numeric (`&#x3a;`), and the known named
 * ones. Unknown entities and bare ampersands are left untouched.
 * @param {string} value
 * @returns {string}
 */
export function decodeEntities(value) {
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z][\da-z]+));/gi, (match, decimal, hex, named) => {
    if (named !== undefined) return NAMED_ENTITIES[named.toLowerCase()] ?? match;
    const codePoint = Number.parseInt(decimal ?? hex, decimal === undefined ? 16 : 10);
    return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
  });
}

/**
 * Extract every `<a href>` value from one page's raw HTML, in document order,
 * entity-decoded — so a `java&#x09;script:` href reaches the caller's scheme
 * classification already decoded, the way a browser sees it.
 * @param {string} html
 * @returns {string[]}
 */
export function extractHrefs(html) {
  const hrefs = [];
  let m;
  ANCHOR_HREF_RE.lastIndex = 0;
  while ((m = ANCHOR_HREF_RE.exec(html)) !== null) {
    hrefs.push(decodeEntities(m[1] ?? m[2] ?? m[3] ?? ''));
  }
  return hrefs;
}

/**
 * Recursively collect every `.html` file under `dir`, as SORTED posix paths
 * relative to `dir` (both gates walk in a deterministic order). A `dir` that
 * does not exist yields an empty list — the OpenAPI gate walks a section root
 * that a build with no rendered pages never created.
 * @param {string} dir
 * @param {string} [root]
 * @returns {string[]}
 */
export function walkHtmlFiles(dir, root = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkHtmlFiles(full, root));
    } else if (name.toLowerCase().endsWith('.html')) {
      out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
  return out.sort();
}

/**
 * The page's own route for a dist-relative HTML file path, Astro's default
 * directory build format: `foo/index.html` -> `<prefix>/foo/`
 * (trailing-slash directory route, so a bare/`./`-relative href on the page
 * resolves against that directory, not against a sibling of `foo`); the
 * top-level `index.html` -> `<prefix>/`; a non-index file, e.g. `404.html`
 * -> `<prefix>/404`. The prefix generalises both gates: the site gate passes
 * the configured base (base-INCLUDED, matching the browser's
 * `location.pathname`), the OpenAPI gate passes `''` for a base-less section
 * route it resolves against the base separately.
 * @param {string} relHtmlPath
 * @param {string} prefix
 * @returns {string}
 */
export function pageRouteFor(relHtmlPath, prefix) {
  const posix = relHtmlPath.split(path.sep).join('/');
  if (posix === 'index.html') return `${prefix}/`;
  if (posix.endsWith('/index.html')) {
    return `${prefix}/${posix.slice(0, -'index.html'.length)}`;
  }
  return `${prefix}/${posix.slice(0, -'.html'.length)}`;
}

/**
 * Strip the configured `base` off a resolved pathname. Returns `null` when
 * the pathname does not carry it at all — the #61 base-less/wrong-base
 * signal, reported distinctly from an ordinary missing target (dist's
 * on-disk layout has no `<base>/` directory, so a base-less href would
 * otherwise coincidentally "exist"). With no `base` configured (`''`, the
 * default — an un-based site), every pathname trivially carries it and this
 * is a no-op.
 * @param {string} pathname
 * @param {string} base
 * @returns {string | null}
 */
export function stripBase(pathname, base) {
  if (!base) return pathname;
  if (pathname === base) return '/';
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length) || '/';
  return null;
}

/**
 * Dist-relative candidate file(s) a base-agnostic route could be served from:
 * "an `index.html` for a directory route, or the file". A route ending in `/`
 * is unambiguously a directory route; one that doesn't (an asset like
 * `/rss.xml`, or a directory route linked without its trailing slash) is
 * checked as a literal file FIRST, falling back to its `index.html` — so both
 * shapes resolve without needing an extension allowlist.
 * @param {string} route
 * @returns {string[]}
 */
export function distCandidatesFor(route) {
  const trimmed = route.replace(/^\/+/, '');
  if (trimmed === '') return ['index.html'];
  if (route.endsWith('/')) return [path.posix.join(trimmed, 'index.html')];
  return [trimmed, path.posix.join(trimmed, 'index.html')];
}

/** Does `route` (base already stripped) exist in `distDir`, per {@link distCandidatesFor}? */
export function distFileExists(distDir, route) {
  return distCandidatesFor(route).some((candidate) => existsSync(path.join(distDir, candidate)));
}
