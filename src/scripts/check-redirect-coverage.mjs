#!/usr/bin/env node
/**
 * check-redirect-coverage.mjs — target-aware redirect-coverage gate.
 *
 * Usage:
 *   node src/scripts/check-redirect-coverage.mjs <baseline-file> <dist-dir> [--redirects <map-file>]
 *   pnpm assert:redirects example/url-baseline.txt example/dist
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
 * Bare Node, dependency-free (Node stdlib only), no Astro build spawned
 * (NFR-002) — this reads an already-built `<dist-dir>`. Deterministic: pure
 * filesystem reads, no network, same verdict on every run.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

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
  if (m) return { kind: 'redirect', target: normalizeUrlPath(m[1]) };
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

/** Run the gate over a parsed baseline against a built dist dir. Pure — no I/O beyond what callers pass in. */
export function checkCoverage(distDir, baselineUrls, redirectMap) {
  const results = baselineUrls.map((url) => resolveVerdict(distDir, url, redirectMap));
  const uncovered = results.filter((r) => !r.covered);
  return { results, uncovered, ok: uncovered.length === 0 };
}

function parseArgs(argv) {
  const positional = [];
  let redirectsFile;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--redirects') {
      redirectsFile = argv[i + 1];
      i += 1;
    } else {
      positional.push(arg);
    }
  }
  return { baselineFile: positional[0], distDir: positional[1], redirectsFile };
}

export function run(argv) {
  const { baselineFile, distDir, redirectsFile } = parseArgs(argv.slice(2));
  if (!baselineFile || !distDir) {
    console.error(
      'Usage: check-redirect-coverage.mjs <baseline-file> <dist-dir> [--redirects <map-file>]',
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

  const baselineUrls = parseBaseline(readFileSync(baselineFile, 'utf8'));
  const redirectMap = redirectsFile ? loadRedirectMap(redirectsFile) : undefined;
  const { uncovered, ok } = checkCoverage(distDir, baselineUrls, redirectMap);

  if (ok) {
    console.log(`redirect-coverage: OK — ${baselineUrls.length} baselined URL(s) covered.`);
    process.exit(0);
    return;
  }

  console.error(
    `redirect-coverage: FAILED — ${uncovered.length}/${baselineUrls.length} baselined URL(s) uncovered:`,
  );
  for (const r of uncovered) {
    const targetNote =
      r.failingTarget && r.failingTarget !== r.url ? ` (failing target: ${r.failingTarget})` : '';
    console.error(`  ✖ ${r.url}: ${r.reason}${targetNote}`);
  }
  process.exit(1);
}

// Run the CLI only when invoked directly, so the module can be imported by tests.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run(process.argv);
}
