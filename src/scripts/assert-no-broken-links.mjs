#!/usr/bin/env node
/**
 * assert-no-broken-links.mjs — base-aware, built-output link gate (#62;
 * FR-005/NFR-003/NFR-004).
 *
 * Usage:
 *   node src/scripts/assert-no-broken-links.mjs <distDir> [--base <prefix>] [--site <origin>]
 *   pnpm assert:no-broken-links   # wired to `example/dist --base /doc-kitty --site https://spec-kitty.github.io`
 *
 * ## Why this exists (research.md D4)
 *
 * `check-links.mjs` (`pnpm validate:links`) is a fast, pre-build, filesystem
 * check: it skips site-absolute (`/…`) links entirely and resolves a relative
 * link against the FILESYSTEM, not the served URL. Neither model matches how
 * a browser actually navigates a deployed, base-prefixed (`/doc-kitty`),
 * trailing-slash-directory-routed Astro/Starlight site — so it reported
 * "✓ 863 references resolve" while ~30 links 404'd (#62). It also never sees
 * component-generated or glossary-generated hrefs at all, since it only reads
 * source Markdown.
 *
 * This gate is the authority those gaps need: it walks the ACTUAL rendered
 * `example/dist/**\/*.html`, extracts every `<a href>`, and resolves it AS A
 * URL — using the WHATWG `URL` resolver, so `./`, `../`, bare-relative, and
 * root-absolute hrefs all get the exact RFC 3986 semantics a browser applies
 * — against the page's own base-prefixed, trailing-slash directory route.
 * The resolved path is then required to exist in `distDir`, either as the
 * literal file (an asset, `rss.xml`, `api/index.json`, …) or as a directory
 * route's `index.html`.
 *
 * A resolved path that does not carry the configured `--base` at all is
 * reported explicitly as base-less/wrong-base (the #61 defect class) rather
 * than folded into a generic "missing" — that distinction is what makes a
 * reintroduced base-less link fail loudly instead of by coincidence (dist's
 * on-disk layout never nests a `<base>/` directory, so a base-less href would
 * otherwise "resolve" against the filesystem even though it 404s for real).
 *
 * ## Scope (v1)
 *
 * Skipped entirely (not resolved, not required to exist): any `scheme:` href
 * (`http:`, `https:`, `mailto:`, `tel:`, `javascript:`, …), a protocol-relative
 * `//host/…` href, and a pure `#anchor` href (same-page, same-document).
 *
 * OUT OF SCOPE for v1 (noted, not silently ignored): once an href resolves to
 * a real page, this gate does not verify that a `#fragment` it also carries
 * names a real heading id on that page (cross-page anchor existence). #63's
 * glossary-anchor fix is verified by `link-integrity.test.ts` instead; adding
 * per-page heading-id extraction here is future work if anchor drift recurs.
 *
 * ## Feed/agent-API absolute-URL scan (pre-PR review, #61/#62 completeness gap)
 *
 * `findBrokenLinks` above only ever walks rendered `<a href>`s in `.html`
 * pages — it never looks at `rss.xml`, `llms.txt`, or `api/**\/*.json`, which
 * compose their own ABSOLUTE (`https://…`) URLs rather than root-relative
 * hrefs (`routes/shared.ts`'s `absolute()`). Those absolute URLs were found to
 * be emitted base-less even after the `<a href>` gate above went green — the
 * SAME #61 defect class, in a surface this gate did not cover. `--site` (an
 * optional CLI flag, see `run`) opts a build into `findBaselessFeedUrls`
 * scanning those three surfaces for an absolute URL that shares the
 * configured site's origin but does NOT carry the configured `--base` —
 * reported distinctly, mirroring `stripBase`'s null signal above. An absolute
 * URL on a DIFFERENT origin (an external link embedded in page content) is
 * never flagged. `pnpm assert:no-broken-links` always passes `--site`, so CI
 * never runs this gate un-opted-in.
 *
 * Bare Node, dependency-free (Node stdlib only) — mirrors
 * `check-redirect-coverage.mjs`'s shape (positional `distDir`, sync fs, exit
 * non-zero with one line per failure).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

// Any `scheme:` prefix (`http:`, `https:`, `mailto:`, `tel:`, `javascript:`, …).
// Mirrors `src/lib/with-base.ts` / `src/lib/rehype/base-absolute-links.ts`'s
// classification — kept as an independent copy here (this script is
// dependency-free stdlib Node, not part of the Astro-runtime TS layer those
// live in) but documented as mirroring it so the three seams agree on what
// counts as "external".
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

// `<a href="...">` / `<a href='...'>`, href in any attribute position.
const ANCHOR_HREF_RE = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi;

// Mirrors `check-links.mjs`'s `isTemplate` skip (`/(^|\/)template\.md$/i`),
// translated to the rendered route: the ADR template's own scaffolding
// prose links a copy-me placeholder (`[ADR-XXXX](XXXX-title.md)`) that is
// intentionally never a real target — an adopter fills it in when they copy
// the template. Neither gate treats this file's links as real.
const TEMPLATE_PAGE_RE = /(^|\/)template\/index\.html$/i;

/** Extract every `<a href>` value from one page's raw HTML, in document order. */
export function extractHrefs(html) {
  const hrefs = [];
  let m;
  ANCHOR_HREF_RE.lastIndex = 0;
  while ((m = ANCHOR_HREF_RE.exec(html)) !== null) {
    hrefs.push(m[1] ?? m[2] ?? '');
  }
  return hrefs;
}

/**
 * True for a link this gate does not resolve at all (v1 scope, see module
 * doc): empty, pure-`#anchor`, protocol-relative, or any `scheme:` href.
 */
export function isSkippableHref(href) {
  const trimmed = href.trim();
  if (trimmed === '') return true;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('//')) return true;
  if (SCHEME_RE.test(trimmed)) return true;
  return false;
}

/** Recursively collect every `.html` file under `dir`, as posix paths relative to `dir`. */
export function walkHtmlFiles(dir, root = dir) {
  return walkFilesWithExt(dir, '.html', root);
}

/** Recursively collect every file with `ext` (e.g. `.json`) under `dir`, as posix paths relative to `dir`. */
function walkFilesWithExt(dir, ext, root = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkFilesWithExt(full, ext, root));
    } else if (name.toLowerCase().endsWith(ext)) {
      out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
  return out;
}

/**
 * The page's own route (base-INCLUDED, matching what a browser actually has
 * as `location.pathname` for this page) for a dist-relative HTML file path —
 * Astro's default directory build format: `foo/index.html` -> `<base>/foo/`
 * (trailing-slash directory route, so a bare/`./`-relative href on the page
 * resolves against that directory, not against a sibling of `foo`); the
 * top-level `index.html` -> `<base>/`; a non-index file, e.g. `404.html`
 * -> `<base>/404` (no implied trailing slash — this gate does not assume a
 * directory shape for a route it did not itself derive from an `index.html`).
 */
export function pageRouteFor(relHtmlPath, base) {
  const posix = relHtmlPath.split(path.sep).join('/');
  if (posix === 'index.html') return `${base}/`;
  if (posix.endsWith('/index.html')) {
    return `${base}/${posix.slice(0, -'index.html'.length)}`;
  }
  return `${base}/${posix.slice(0, -'.html'.length)}`;
}

/**
 * Resolve one href AS A URL against the page's own route (RFC 3986, via the
 * WHATWG `URL` resolver — this is the trailing-slash-directory-semantics
 * "whole point" vs. the filesystem-based `check-links.mjs`), then strip the
 * query/fragment and return the decoded, site-absolute pathname.
 */
export function resolveHref(href, pageRoute) {
  const pageUrl = new URL(pageRoute, 'https://dist.invalid');
  const resolved = new URL(href, pageUrl);
  return decodeURI(resolved.pathname);
}

/**
 * Strip the configured `base` off a resolved pathname. Returns `null` when
 * the pathname does not carry it at all — the #61 base-less/wrong-base
 * signal, reported distinctly from an ordinary missing target (see module
 * doc: dist's on-disk layout has no `<base>/` directory, so a base-less href
 * would otherwise coincidentally "exist"). With no `base` configured
 * (`''`, the default — an un-based site), every pathname trivially carries
 * it and this is a no-op.
 */
export function stripBase(pathname, base) {
  if (!base) return pathname;
  if (pathname === base) return '/';
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length) || '/';
  return null;
}

/**
 * Dist-relative candidate file(s) a base-agnostic route could be served from,
 * per the WP spec: "an `index.html` for a directory route, or the file". A
 * route ending in `/` is unambiguously a directory route; one that doesn't
 * (an asset like `/rss.xml`, or a directory route linked without its
 * trailing slash) is checked as a literal file FIRST, falling back to its
 * `index.html` — so both shapes resolve without needing an extension
 * allowlist.
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

/**
 * Walk every `.html` file in `distDir` and return every internal-href
 * failure. Pure given a built dist dir — no network, no build.
 * @returns {{ page: string, href: string, resolved: string | null, reason: string }[]}
 */
export function findBrokenLinks(distDir, base) {
  const failures = [];
  for (const relHtmlPath of walkHtmlFiles(distDir).sort()) {
    if (TEMPLATE_PAGE_RE.test(relHtmlPath)) continue;
    const pageRoute = pageRouteFor(relHtmlPath, base);
    const html = readFileSync(path.join(distDir, relHtmlPath), 'utf8');
    for (const rawHref of extractHrefs(html)) {
      if (isSkippableHref(rawHref)) continue;

      let pathname;
      try {
        pathname = resolveHref(rawHref, pageRoute);
      } catch {
        failures.push({
          page: relHtmlPath,
          href: rawHref,
          resolved: null,
          reason: 'href could not be parsed as a URL',
        });
        continue;
      }

      const route = stripBase(pathname, base);
      if (route === null) {
        failures.push({
          page: relHtmlPath,
          href: rawHref,
          resolved: pathname,
          reason: `resolves outside the configured base "${base}" — likely a base-less internal link (#61)`,
        });
        continue;
      }

      if (!distFileExists(distDir, route)) {
        failures.push({
          page: relHtmlPath,
          href: rawHref,
          resolved: pathname,
          reason: 'no matching page or file in dist',
        });
      }
    }
  }
  return failures;
}

// Any `https://…`/`http://…` run, stopped at whitespace, a quote, an angle
// bracket, or a closing paren — bounds an absolute URL embedded in XML text
// content (`<link>…</link>`), an XML attribute (`href="…"`), Markdown-ish
// llms.txt prose (`[text](…)`, `pointer: …`), or a quoted JSON string value,
// without pulling in a full XML/JSON parser for a value-shaped scan.
const ABSOLUTE_URL_RE = /https?:\/\/[^\s"'<>)]+/g;

/** Extract every absolute `http(s)://` URL substring from raw text, in document order. */
export function extractAbsoluteUrls(text) {
  return text.match(ABSOLUTE_URL_RE) ?? [];
}

/**
 * Scan `rss.xml`, `llms.txt`, and every `api/**\/*.json` file under `distDir`
 * for an absolute URL that shares `siteOrigin` but does not carry `base` (the
 * #61 defect class, in the one surface `findBrokenLinks` never covers: these
 * three routes emit absolute URLs, not root-relative `<a href>`s). An
 * absolute URL on a different origin (an external link inside page content,
 * e.g. an image or a citation) is never flagged. With no `siteOrigin`
 * configured, this is an explicit no-op (see module doc) — `run` always opts
 * a real build in via `--site`.
 * @returns {{ file: string, url: string, reason: string }[]}
 */
export function findBaselessFeedUrls(distDir, base, siteOrigin) {
  const failures = [];
  if (!siteOrigin) return failures;

  const targets = [];
  const rssPath = path.join(distDir, 'rss.xml');
  if (existsSync(rssPath)) targets.push('rss.xml');
  const llmsPath = path.join(distDir, 'llms.txt');
  if (existsSync(llmsPath)) targets.push('llms.txt');
  const apiDir = path.join(distDir, 'api');
  if (existsSync(apiDir)) {
    for (const rel of walkFilesWithExt(apiDir, '.json').sort()) {
      targets.push(path.posix.join('api', rel));
    }
  }

  for (const relPath of targets) {
    const text = readFileSync(path.join(distDir, relPath), 'utf8');
    for (const url of extractAbsoluteUrls(text)) {
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        continue; // not a well-formed absolute URL — not this gate's concern
      }
      if (parsed.origin !== siteOrigin) continue; // external — never flagged

      if (stripBase(parsed.pathname, base) === null) {
        failures.push({
          file: relPath,
          url,
          reason: `internal absolute URL missing the configured base "${base}" — likely a base-less RSS/llms.txt/agent-API URL (#61/#62)`,
        });
      }
    }
  }
  return failures;
}

function parseArgs(argv) {
  let base = '';
  let site = '';
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base') {
      base = argv[i + 1] ?? '';
      i += 1;
    } else if (argv[i] === '--site') {
      site = argv[i + 1] ?? '';
      i += 1;
    } else {
      positional.push(argv[i]);
    }
  }
  return { distDir: positional[0], base: base.replace(/\/+$/, ''), site: site.replace(/\/+$/, '') };
}

export function run(argv) {
  const { distDir, base, site } = parseArgs(argv.slice(2));
  if (!distDir) {
    console.error('Usage: assert-no-broken-links.mjs <distDir> [--base <prefix>] [--site <origin>]');
    process.exit(2);
    return;
  }
  if (!existsSync(distDir)) {
    console.error(
      `assert-no-broken-links: dist dir not found: ${distDir} (build the example first — this gate does not build)`,
    );
    process.exit(2);
    return;
  }

  const linkFailures = findBrokenLinks(distDir, base);
  const feedFailures = findBaselessFeedUrls(distDir, base, site);

  if (linkFailures.length === 0 && feedFailures.length === 0) {
    console.log(
      `assert-no-broken-links: OK — every internal <a href> in ${distDir} resolves (base "${base || '(none)'}")` +
        `${site ? `, and every RSS/llms.txt/agent-API absolute URL carries it (site "${site}").` : '.'}`,
    );
    process.exit(0);
    return;
  }

  const total = linkFailures.length + feedFailures.length;
  console.error(`assert-no-broken-links: FAILED — ${total} broken internal link(s):`);
  for (const f of linkFailures) {
    const resolvedNote = f.resolved ? ` (resolved: ${f.resolved})` : '';
    console.error(`  ✖ ${f.page} → ${f.href}${resolvedNote}: ${f.reason}`);
  }
  for (const f of feedFailures) {
    console.error(`  ✖ ${f.file} → ${f.url}: ${f.reason}`);
  }
  process.exit(1);
}

// Run the CLI only when invoked directly, so the module can be imported by tests.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run(process.argv);
}
