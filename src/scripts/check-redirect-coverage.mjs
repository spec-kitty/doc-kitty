#!/usr/bin/env node
/**
 * check-redirect-coverage.mjs — target-aware redirect-coverage gate.
 *
 * Usage:
 *   node src/scripts/check-redirect-coverage.mjs <baseline-file> <dist-dir>
 *     [--redirects <map-file>]
 *     [--docs <docs-dir> [--index-basename <a,b>] [--declared-redirects <map-file>]]
 *
 * Adopter-loader-migration (#42), WP02 — FR-008/009/010/011, NFR-002/005.
 * Contract: kitty-specs/adopter-loader-migration-01M1KKYA/contracts/redirect-coverage-gate.md
 * Data model: E-03 (redirect map), E-04 (URL baseline), E-07 (verdict model).
 *
 * For every URL in the committed baseline (E-04, NEVER regenerated from the
 * current build — NFR-005), this gate asserts a LIVE terminus exists: either
 * the URL itself resolves to a real page in `<dist-dir>`, or it is a redirect
 * whose TARGET CHAIN resolves to a live page. A redirect to a dead or looping
 * target is UNCOVERED — this is the whole reason the gate exists (post-spec
 * BLOCKER B1 / D-05): a redirect to a 404 is a live 404, and a coverage gate
 * that only checks "does a redirect exist" (not "does it go anywhere real")
 * would rubber-stamp that defect.
 *
 * Redirect-map source (E-03), in priority order:
 *   1. `--redirects <map-file>` — an explicit override, either a JSON object
 *      `{ "<from>": "<to>", ... }` or a Netlify-style `_redirects` text file
 *      (`<from> <to> [status]` per line). Consulted first for any URL it
 *      names, even if a dist file also exists at that path.
 *   2. The Astro-emitted static redirect stub (default): Astro's native
 *      `redirects` config (D-04) writes each redirect as its own prerendered
 *      page — a `<meta http-equiv="refresh" content="…;url=<target>">`
 *      "Redirecting to: …" page (see astro's `core/routing/3xx.js`
 *      `redirectTemplate`) — at the redirect's OWN dist path. So resolving a
 *      baselined URL against `<dist-dir>` finds either real content, one of
 *      these stubs (follow its target), or nothing (uncovered).
 *
 * ## Draft publication (sidebar-frame-header-carrier WP05, FR-015)
 *
 * With `DK_PUBLISH_DRAFTS` off (what a live deployment sets; the default is on)
 * draft pages are not built, and the
 * toolkit leaves out the stub of any redirect that leads to one. A baselined
 * old URL whose successor is still a draft therefore returns 404 on a
 * drafts-off build. That is the honest state, and this gate names it instead
 * of hiding it or failing on it:
 *
 *   - The gate resolves `DK_PUBLISH_DRAFTS` the way the build does: the process
 *     environment, then the site's env files, then `on`. `--site-root <dir>`
 *     names the site (default: the nearest directory with an Astro config above
 *     `<dist-dir>`, else the working directory) and `--mode <mode>` the env-file
 *     mode (default `production`). The first line it prints states the value
 *     and where it came from; compare it with the build's `[dk-drafts]` line.
 *   - `--docs <docs-dir>` gives the tree the draft routes are derived from
 *     (`doc_status: draft` or absent; never a list kept by hand), and
 *     `--declared-redirects <map-file>` gives the site's declared redirects
 *     (same formats as `--redirects`; targets are routes without the site base).
 *   - A baselined URL with no page and no stub is reported as UNPUBLISHED, and
 *     accepted, only when drafts are off and the URL itself, or the end of its
 *     declared redirect chain, is a draft page of that tree. Anything else that
 *     does not resolve is uncovered, exactly as before. Without `--docs`, or
 *     with drafts on, nothing is excused.
 *   - The declared map never makes a URL count as covered. Only the built
 *     output does.
 *
 * In every mode the gate also walks the built output: a redirect stub that
 * leads to a missing page fails the gate, baselined or not. So a stub into an
 * unbuilt draft is a failure, never an accepted case.
 *
 * Bare Node (Node stdlib plus the toolkit's own draft-status reader), no Astro
 * build spawned (NFR-002) — this reads an already-built `<dist-dir>`.
 * Deterministic: pure filesystem reads, no network, same verdict on every run.
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { resolveSiteIndexBasenames } from './site-index-names.mjs';
import {
  draftRoutesOf,
  resolveDraftPublicationForGate,
  takeSiteFlags,
} from '../lib/draft-publication.mjs';

// A real redirect chain is 1-2 hops (an old URL → a renamed URL, occasionally
// through a second rename). This ceiling guards a misconfigured redirect loop
// from spinning forever rather than reporting it — see `resolveVerdict`.
const MAX_CHAIN_DEPTH = 10;

// Astro's built-in static redirect stub (astro's `core/routing/3xx.js`
// `redirectTemplate`): a `<title>Redirecting to: …</title>` page carrying a
// `<meta http-equiv="refresh" content="<delay>;url=<target>">`. Matching this
// specific two-part shape (title AND meta refresh together) — not a bare
// "contains meta refresh" check — keeps a hand-authored page that happens to
// use a refresh meta tag for an unrelated reason from being misidentified as
// a redirect.
const REDIRECT_STUB_RE =
  /<title>Redirecting to: [^<]*<\/title>[\s\S]*?<meta http-equiv="refresh" content="\d+;\s*url=([^"]*)"/i;

// review-cycle-1 Fix C follow-through (out-of-map; this script is the
// coverage-gate half of the same base-prefix fix `astro.config.mjs`'s
// `REDIRECTS` map needed): the stub's fallback link also carries the ORIGINAL
// request path — `redirectTemplate`'s `from` — as
// `Redirecting from <code>{fromPath}</code> to <code>{target}</code>`.
// `fromPath` is Astro's own base-INCLUDED pathname (the same base the `to`
// target may now legitimately carry, since #61-class hrefs need the base to
// be live in a browser). This gate's baseline/chain keys stay in the
// BASE-AGNOSTIC "route" space (matching `urlToDistFile`'s dist-file-structure
// convention — dist never nests a `base/` directory), so a base-prefixed
// target must be re-normalized back to that space before the chain
// continues. See {@link stripKnownBase}.
const FROM_CODE_RE = /Redirecting from <code>([^<]*)<\/code>/i;

/**
 * Derive the site base from the stub's embedded `fromPath` (the request path
 * Astro actually served, base-included) by diffing it against `lookupKey` —
 * the base-agnostic route this file was already found at. If `fromPath` ends
 * with `lookupKey`, the leading remainder is the base; strip that SAME prefix
 * off `rawTarget` when present. No-ops (returns `rawTarget` unchanged) when
 * there is no `fromPath` to compare (older/synthetic stub fixtures — see
 * `redirect-coverage.test.ts`), when it doesn't end with `lookupKey`, or when
 * `rawTarget` doesn't actually carry that prefix — never invents a strip.
 */
export function stripKnownBase(fromPath, lookupKey, rawTarget) {
  if (!fromPath) return rawTarget;
  const from = normalizeUrlPath(fromPath);
  const key = normalizeUrlPath(lookupKey);
  if (from.length <= key.length || !from.endsWith(key)) return rawTarget;
  const base = from.slice(0, from.length - key.length);
  if (!base || !rawTarget.startsWith(base)) return rawTarget;
  return rawTarget.slice(base.length) || '/';
}

/**
 * Normalize a baseline/redirect-target entry to a site-absolute POSIX path.
 * Strips a scheme+host if one was pasted in by mistake; defensive only — every
 * committed entry is expected to already be site-relative.
 */
export function normalizeUrlPath(url) {
  let p = String(url).trim();
  p = p.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
  if (!p.startsWith('/')) p = `/${p}`;
  return p;
}

/**
 * Map a site-absolute URL path to the dist HTML file that serves it, per
 * Astro's default directory build format (`/a/b/` → `<dist>/a/b/index.html`;
 * `/` → `<dist>/index.html`). Mirrors the convention `assert-build-artifacts.mjs`
 * already uses for every other route.
 */
export function urlToDistFile(distDir, urlPath) {
  const trimmed = urlPath.replace(/^\/+|\/+$/g, '');
  const rel = trimmed === '' ? 'index.html' : path.join(trimmed, 'index.html');
  return path.join(distDir, rel);
}

/**
 * Parse a `--redirects` override file: JSON object `{ from: to }`, or a
 * Netlify-style `_redirects` text file (`from to [status]` per line, `#`
 * comments and blank lines ignored). Returns a plain `{ [from]: to }` map.
 */
export function loadRedirectMap(file) {
  const text = readFileSync(file, 'utf8');
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Not JSON — fall through to line-based `_redirects` parsing.
  }
  const map = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [from, to] = trimmed.split(/\s+/);
    if (from && to) map[normalizeUrlPath(from)] = to;
  }
  return map;
}

/**
 * Inspect what a site-absolute URL resolves to in `<dist-dir>`:
 *   - `{ kind: 'missing' }` — no page, no redirect at this path.
 *   - `{ kind: 'redirect', target }` — a redirect; `target` is the
 *     UNRESOLVED (not-yet-followed) site-absolute href it points at.
 *   - `{ kind: 'page' }` — live content.
 *
 * `redirectMap` (from `--redirects`, optional) is consulted first so an
 * explicit override always wins over dist-stub detection.
 */
export function inspectDistUrl(distDir, urlPath, redirectMap) {
  if (redirectMap && Object.prototype.hasOwnProperty.call(redirectMap, urlPath)) {
    return { kind: 'redirect', target: normalizeUrlPath(redirectMap[urlPath]) };
  }
  const file = urlToDistFile(distDir, urlPath);
  if (!existsSync(file)) return { kind: 'missing' };
  const html = readFileSync(file, 'utf8');
  const m = html.match(REDIRECT_STUB_RE);
  if (m) {
    const fromMatch = html.match(FROM_CODE_RE);
    const target = stripKnownBase(fromMatch?.[1], urlPath, m[1]);
    return { kind: 'redirect', target: normalizeUrlPath(target) };
  }
  return { kind: 'page' };
}

/**
 * Resolve one baselined URL to an E-07 verdict, following a redirect chain to
 * its live terminus. `visited` guards a chain that returns to an
 * already-seen URL (a redirect loop) — reported as uncovered rather than
 * looping forever; `MAX_CHAIN_DEPTH` is a second, independent guard against a
 * long non-repeating misconfiguration.
 */
export function resolveVerdict(distDir, startUrl, redirectMap) {
  const url = normalizeUrlPath(startUrl);
  let current = url;
  const visited = new Set();
  const chain = [];
  for (let hop = 0; hop <= MAX_CHAIN_DEPTH; hop += 1) {
    if (visited.has(current)) {
      return { url, covered: false, reason: 'redirect loop detected', chain, failingTarget: current };
    }
    visited.add(current);
    const info = inspectDistUrl(distDir, current, redirectMap);
    if (info.kind === 'page') {
      return { url, covered: true, chain };
    }
    if (info.kind === 'missing') {
      const reason = chain.length === 0 ? 'no page and no redirect' : 'redirect target is dead';
      return { url, covered: false, reason, chain, failingTarget: current };
    }
    // info.kind === 'redirect' — record the hop and follow it.
    chain.push({ from: current, to: info.target });
    current = info.target;
  }
  return { url, covered: false, reason: 'redirect chain exceeds depth limit', chain, failingTarget: current };
}

/** Parse the committed baseline file (E-04): one URL per line, blank lines and `#` comments ignored. */
export function parseBaseline(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * The draft page an unresolved baselined URL stands for, or `null`.
 *
 * Only a URL with NO page and NO stub in the built output qualifies (an empty
 * chain): a stub that leads nowhere is a defect, whatever it points at. The
 * URL is followed through the DECLARED redirects; it qualifies when it, or the
 * end of that chain, is a draft route. A declared hop that IS built ends the
 * walk with `null`: the output then lacks a stub it should have.
 *
 * @param {string} distDir
 * @param {{ url: string, chain: unknown[] }} verdict an uncovered verdict
 * @param {ReadonlySet<string>} draftRoutes
 * @param {Record<string, string>} declared old URL -> target route (base-less)
 * @returns {string | null}
 */
export function unpublishedDraftFor(distDir, verdict, draftRoutes, declared) {
  if (verdict.chain.length > 0) return null;
  let current = normalizeUrlPath(verdict.url);
  const seen = new Set();
  for (let hop = 0; hop <= MAX_CHAIN_DEPTH; hop += 1) {
    const route = current.endsWith('/') ? current : `${current}/`;
    if (draftRoutes.has(route)) return route;
    if (seen.has(current) || !Object.prototype.hasOwnProperty.call(declared, current)) return null;
    seen.add(current);
    current = normalizeUrlPath(declared[current]);
    if (existsSync(urlToDistFile(distDir, current))) return null;
  }
  return null;
}

/** Every redirect stub in the built output, as site-absolute URL paths (sorted). */
export function redirectStubUrls(distDir) {
  const urls = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name === 'index.html' && REDIRECT_STUB_RE.test(readFileSync(abs, 'utf8'))) {
        const rel = path.relative(distDir, dir).split(path.sep).join('/');
        urls.push(rel === '' ? '/' : `/${rel}/`);
      }
    }
  };
  walk(distDir);
  return urls.sort();
}

/**
 * Run the gate over a parsed baseline against a built dist dir.
 *
 * `drafts` carries the draft-publication inputs (see the file header). Left
 * out, the gate behaves as if drafts were published: nothing is excused.
 *
 * @param {string} distDir
 * @param {string[]} baselineUrls
 * @param {Record<string, string>} [redirectMap]
 * @param {{ publishDrafts?: boolean, draftRoutes?: ReadonlySet<string>, declaredRedirects?: Record<string, string> }} [drafts]
 */
export function checkCoverage(distDir, baselineUrls, redirectMap, drafts = {}) {
  const { publishDrafts = true, draftRoutes = new Set(), declaredRedirects = {} } = drafts;
  const results = baselineUrls.map((url) => resolveVerdict(distDir, url, redirectMap));
  const uncovered = [];
  const unpublished = [];
  for (const r of results) {
    if (r.covered) continue;
    const draftRoute = publishDrafts
      ? null
      : unpublishedDraftFor(distDir, r, draftRoutes, declaredRedirects);
    if (draftRoute === null) uncovered.push(r);
    else unpublished.push({ ...r, draftRoute });
  }
  // Every stub the build emitted must lead somewhere, baselined or not.
  const deadStubs = redirectStubUrls(distDir)
    .map((url) => resolveVerdict(distDir, url, redirectMap))
    .filter((r) => !r.covered);
  return {
    results,
    uncovered,
    unpublished,
    deadStubs,
    ok: uncovered.length === 0 && deadStubs.length === 0,
  };
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const names = {
    '--redirects': 'redirectsFile',
    '--docs': 'docsDir',
    '--index-basename': 'indexBasename',
    '--declared-redirects': 'declaredFile',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (Object.prototype.hasOwnProperty.call(names, arg)) {
      flags[names[arg]] = argv[i + 1];
      i += 1;
    } else {
      positional.push(arg);
    }
  }
  return { baselineFile: positional[0], distDir: positional[1], ...flags };
}

export function run(argv) {
  let site;
  try {
    site = takeSiteFlags(argv.slice(2));
  } catch (err) {
    console.error(`redirect-coverage: ${err.message}`);
    process.exit(2);
    return;
  }
  const { baselineFile, distDir, redirectsFile, docsDir, indexBasename, declaredFile } = parseArgs(
    site.rest,
  );
  if (!baselineFile || !distDir) {
    console.error(
      'Usage: check-redirect-coverage.mjs <baseline-file> <dist-dir> [--redirects <map-file>] ' +
        '[--docs <docs-dir> [--index-basename <a,b>] [--declared-redirects <map-file>]] ' +
        '[--site-root <dir>] [--mode <mode>]',
    );
    process.exit(2);
    return;
  }
  if (!existsSync(baselineFile)) {
    console.error(`redirect-coverage: baseline file not found: ${baselineFile}`);
    process.exit(2);
    return;
  }
  if (!existsSync(distDir)) {
    console.error(
      `redirect-coverage: dist dir not found: ${distDir} (build the example first — this gate does not build)`,
    );
    process.exit(2);
    return;
  }

  for (const [flag, value] of [['--docs', docsDir], ['--declared-redirects', declaredFile]]) {
    if (value && !existsSync(value)) {
      console.error(`redirect-coverage: ${flag} path not found: ${value}`);
      process.exit(2);
      return;
    }
  }
  // The same resolver the build uses, so a value kept in the site's env files
  // counts here too. The site root is the one given, else the nearest Astro
  // config above the build output.
  let publishDrafts;
  try {
    const resolved = resolveDraftPublicationForGate({
      checkedDir: distDir,
      siteRoot: site.siteRoot,
      mode: site.mode,
    });
    publishDrafts = resolved.publish;
    console.log(`redirect-coverage: ${resolved.summary}`);
  } catch (err) {
    console.error(`redirect-coverage: ${err.message}`);
    process.exit(2);
    return;
  }

  const baselineUrls = parseBaseline(readFileSync(baselineFile, 'utf8'));
  const redirectMap = redirectsFile ? loadRedirectMap(redirectsFile) : undefined;
  const declaredRedirects = {};
  if (declaredFile) {
    for (const [from, to] of Object.entries(loadRedirectMap(declaredFile))) {
      if (typeof to === 'string') declaredRedirects[normalizeUrlPath(from)] = to;
    }
  }
  // Index names come from the site config next to the docs folder (FR-007); the
  // flag, when given, must agree with it (FR-008).
  let draftRoutes = new Set();
  if (docsDir) {
    try {
      const { names } = resolveSiteIndexBasenames(docsDir, {
        flag: indexBasename ? indexBasename.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        tool: 'redirect-coverage',
      });
      draftRoutes = draftRoutesOf(path.resolve(docsDir), names);
    } catch (err) {
      console.error(err.message);
      process.exit(2);
      return;
    }
  }
  const { uncovered, unpublished, deadStubs, ok } = checkCoverage(distDir, baselineUrls, redirectMap, {
    publishDrafts,
    draftRoutes,
    declaredRedirects,
  });

  const note = (r) =>
    r.failingTarget && r.failingTarget !== r.url ? ` (failing target: ${r.failingTarget})` : '';
  // Named on success too: these URLs return 404 on this build, by the setting.
  const reportUnpublished = (log) => {
    if (unpublished.length === 0) return;
    log(
      `redirect-coverage: ${unpublished.length} baselined URL(s) unpublished, expected with ` +
        `DK_PUBLISH_DRAFTS off — each leads to a draft page and returns 404 on this build:`,
    );
    for (const r of unpublished) log(`  - ${r.url}: draft ${r.draftRoute}`);
  };

  if (ok) {
    reportUnpublished(console.log);
    console.log(
      `redirect-coverage: OK — ${baselineUrls.length - unpublished.length}/${baselineUrls.length} ` +
        `baselined URL(s) covered${unpublished.length ? `, ${unpublished.length} unpublished (drafts off)` : ''}.`,
    );
    process.exit(0);
    return;
  }

  reportUnpublished(console.error);
  if (uncovered.length > 0) {
    console.error(
      `redirect-coverage: FAILED — ${uncovered.length}/${baselineUrls.length} baselined URL(s) uncovered:`,
    );
    for (const r of uncovered) console.error(`  ✖ ${r.url}: ${r.reason}${note(r)}`);
    // With drafts off, an old URL that leads to a draft is only recognised as
    // unpublished when the gate is given both inputs. Name the missing flag, so
    // a 404 the setting explains is not mistaken for a lost redirect.
    const missing = [
      ...(docsDir ? [] : ['--docs <docs-dir>']),
      ...(declaredFile ? [] : ['--declared-redirects <map-file>']),
    ];
    if (!publishDrafts && missing.length > 0) {
      console.error(
        `redirect-coverage: DK_PUBLISH_DRAFTS is off and ${missing.join(' and ')} ` +
          `${missing.length > 1 ? 'were' : 'was'} not given, so no URL could be recognised as ` +
          `leading to an unpublished draft. If a URL above redirects to a draft page, pass ` +
          `${missing.join(' and ')}, or check a build made with DK_PUBLISH_DRAFTS=on.`,
      );
    }
  }
  if (deadStubs.length > 0) {
    console.error(
      `redirect-coverage: FAILED — ${deadStubs.length} redirect stub(s) in ${distDir} lead to a missing page:`,
    );
    for (const r of deadStubs) console.error(`  ✖ ${r.url}: ${r.reason}${note(r)}`);
  }
  process.exit(1);
}

// Run the CLI only when invoked directly, so the module can be imported by tests.
// CLI guard. Compare against the REAL path of argv[1]: when the package is
// installed behind a symlink (pnpm's node_modules, or a node_modules/.bin shim),
// import.meta.url is the resolved path while argv[1] keeps the symlink path, so a
// plain comparison would never match and the gate would exit 0 having done nothing.
function invokedDirectly() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  run(process.argv);
}
