#!/usr/bin/env node
/**
 * assert-consumer-artifacts.mjs — consumer-owned, corpus-agnostic post-build
 * gate for the clean-room consumption fixture (contract C-3; research D1).
 *
 * Usage:
 *   node tests/consumption/scripts/assert-consumer-artifacts.mjs <distDir>
 *
 * Auto-discovered and run by run-consumption-test.mjs (the `assert-consumer-*.mjs`
 * glob, step 6) against the fixture's built `dist/`. Where the shipped, repo-root
 * `assert-build-artifacts.mjs` pins corpus-specific COUNTS and paths — non-portable
 * over a tarball (D1) — this checker asserts only SHAPE, PRESENCE, and published-
 * contract INVARIANTS, so it holds for any corpus a consumer builds.
 *
 * Zero runtime dependencies (the toolkit vendors no XML parser, NFR-006): XML
 * well-formedness is proven by the same honest, stack-based scanner the shipped
 * gate uses — never a filename grep, never a parser dependency, never a regex
 * "does it look like XML" heuristic.
 *
 * Exits NON-ZERO with a precise per-assertion message on the FIRST failure.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Reporting: first failure wins, precise message, non-zero exit.
// ---------------------------------------------------------------------------

/** Emit a precise failure and exit non-zero. */
function fail(message) {
  process.stderr.write(`assert:consumer-artifacts: FAIL — ${message}\n`);
  process.exit(1);
}

function ok(message) {
  process.stdout.write(`assert:consumer-artifacts: ok — ${message}\n`);
}

async function statOrFail(absPath, label) {
  let info;
  try {
    info = await stat(absPath);
  } catch {
    fail(`${label}: missing (${absPath})`);
  }
  if (!info.isFile()) fail(`${label}: not a file (${absPath})`);
  return info;
}

async function readNonEmptyText(absPath, label) {
  const info = await statOrFail(absPath, label);
  if (info.size === 0) fail(`${label}: present but empty (${absPath})`);
  let text;
  try {
    text = await readFile(absPath, 'utf8');
  } catch (err) {
    fail(`${label}: could not read ${absPath} (${err.code ?? err.message})`);
  }
  if (text.trim().length === 0) fail(`${label}: present but blank (${absPath})`);
  return text;
}

// ---------------------------------------------------------------------------
// String-level XML well-formedness check — no parser dependency.
//
// A stack-based scanner that honours the XML declaration, comments, CDATA and
// processing instructions, respects quoted attribute values (so a `>` inside a
// value does not end a tag), and verifies every element is closed in the right
// order. Not a validating parser, but it genuinely proves the document is
// balanced and nested. Throws Error(reason) on the first structural problem.
// ---------------------------------------------------------------------------
function assertWellFormedXml(text) {
  const src = text;
  const len = src.length;
  const stack = [];
  let sawElement = false;
  let i = 0;

  while (i < len) {
    const lt = src.indexOf('<', i);
    if (lt === -1) break; // trailing text only
    i = lt;

    // XML declaration / processing instruction: <? ... ?>
    if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i + 2);
      if (end === -1) throw new Error('unterminated processing instruction / XML declaration');
      i = end + 2;
      continue;
    }

    // Comment: <!-- ... -->
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      if (end === -1) throw new Error('unterminated comment');
      i = end + 3;
      continue;
    }

    // CDATA: <![CDATA[ ... ]]>
    if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i + 9);
      if (end === -1) throw new Error('unterminated CDATA section');
      i = end + 3;
      continue;
    }

    // DOCTYPE or other declaration: <! ... >
    if (src.startsWith('<!', i)) {
      const end = src.indexOf('>', i + 2);
      if (end === -1) throw new Error('unterminated declaration');
      i = end + 1;
      continue;
    }

    // A real element start/end tag. Find its terminating '>' honouring quotes.
    let j = i + 1;
    let quote = null;
    while (j < len) {
      const ch = src[j];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        break;
      }
      j += 1;
    }
    if (j >= len) throw new Error('unterminated tag');

    const inner = src.slice(i + 1, j).trim();
    if (inner.length === 0) throw new Error('empty tag <>');

    if (inner.startsWith('/')) {
      // Closing tag </name>
      const name = inner.slice(1).trim().split(/[\s>]/)[0];
      if (!name) throw new Error('closing tag has no name');
      const open = stack.pop();
      if (open === undefined) throw new Error(`unexpected closing tag </${name}>`);
      if (open !== name) throw new Error(`mismatched tag: expected </${open}>, got </${name}>`);
    } else {
      // Opening or self-closing tag.
      const selfClosing = inner.endsWith('/');
      const body = selfClosing ? inner.slice(0, -1).trim() : inner;
      const name = body.split(/[\s/]/)[0];
      if (!name) throw new Error('opening tag has no name');
      sawElement = true;
      if (!selfClosing) stack.push(name);
    }

    i = j + 1;
  }

  if (!sawElement) throw new Error('no XML element found');
  if (stack.length > 0) throw new Error(`unclosed element(s): ${stack.reverse().join(', ')}`);
}

/** Count occurrences of a literal needle (non-overlapping). */
function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

// ---------------------------------------------------------------------------
// Filesystem helpers.
// ---------------------------------------------------------------------------

/** Recursively collect every file path under `dir` (absolute). */
async function walkFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(abs)));
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

async function isExistingFile(absPath) {
  try {
    return (await stat(absPath)).isFile();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// T017 — Feeds well-formedness (rss.xml, llms.txt, sitemap).
// ---------------------------------------------------------------------------
async function assertRss(distDir) {
  const abs = path.join(distDir, 'rss.xml');
  const text = await readNonEmptyText(abs, 'rss.xml');
  try {
    assertWellFormedXml(text);
  } catch (err) {
    fail(`rss.xml: not well-formed XML (${err.message})`);
  }
  if (!/<channel[\s>]/.test(text)) {
    fail('rss.xml: no <channel> element');
  }
  const items = countOccurrences(text, '<item>');
  if (items < 1) {
    fail('rss.xml: <channel> has no <item> (expected ≥1)');
  }
  ok(`rss.xml: well-formed, <channel> with ${items} <item>(s)`);
}

async function assertLlms(distDir) {
  const abs = path.join(distDir, 'llms.txt');
  const text = await readNonEmptyText(abs, 'llms.txt');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  // A top-level Markdown title: a single `#` then a space then text.
  if (!/^#\s+\S/.test(firstLine)) {
    fail(`llms.txt: first line is not a top-level "# " title (got: ${JSON.stringify(firstLine)})`);
  }
  ok(`llms.txt: present, first line is a top-level # title`);
}

async function assertSitemap(distDir) {
  // Astro's sitemap emits sitemap-index.xml + sitemap-0.xml; accept either as
  // the presence proof (corpus-agnostic — a single-page corpus may differ).
  const candidates = ['sitemap-index.xml', 'sitemap-0.xml'];
  let found = null;
  for (const name of candidates) {
    if (await isExistingFile(path.join(distDir, name))) {
      found = name;
      break;
    }
  }
  if (!found) {
    fail(`sitemap: none of ${candidates.join(', ')} present in dist`);
  }
  const text = await readNonEmptyText(path.join(distDir, found), `sitemap (${found})`);
  try {
    assertWellFormedXml(text);
  } catch (err) {
    fail(`sitemap (${found}): not well-formed XML (${err.message})`);
  }
  const locs = countOccurrences(text, '<loc>');
  if (locs < 1) {
    fail(`sitemap (${found}): no <loc> entries (expected ≥1)`);
  }
  ok(`sitemap: ${found} well-formed with ${locs} <loc>(s)`);
}

// ---------------------------------------------------------------------------
// T018 — Agent-API shape (api/index.json): the corrected `pages` key.
// ---------------------------------------------------------------------------
async function assertAgentIndex(distDir) {
  const abs = path.join(distDir, 'api', 'index.json');
  const text = await readNonEmptyText(abs, 'api/index.json');
  let body;
  try {
    body = JSON.parse(text);
  } catch (err) {
    fail(`api/index.json: not valid JSON (${err.message})`);
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    fail('api/index.json: top-level value is not a JSON object');
  }
  // The corrected key: the shipped agent-index.ts route emits `pages[]`, NOT
  // `entries[]` (the first draft was wrong; DIRECTIVE_032 conceptual alignment).
  if ('entries' in body && !('pages' in body)) {
    fail('api/index.json: top-level key is `entries` — the shipped route emits `pages` (agent-index.ts)');
  }
  if (!Array.isArray(body.pages)) {
    fail('api/index.json: top-level `pages` is not an array (agent-index.ts emits `pages[]`)');
  }
  const pages = body.pages;
  if (body.version !== '2') {
    fail(`api/index.json: version must be '2' (got ${JSON.stringify(body.version)})`);
  }
  if (body.count !== pages.length) {
    fail(`api/index.json: count (${JSON.stringify(body.count)}) !== pages.length (${pages.length})`);
  }
  const required = ['slug', 'route', 'section', 'title', 'doc_status', 'kind'];
  pages.forEach((record, idx) => {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      fail(`api/index.json: pages[${idx}] is not an object`);
    }
    for (const key of required) {
      if (!(key in record)) {
        fail(`api/index.json: pages[${idx}] missing required key \`${key}\``);
      }
    }
    if ('related' in record && !Array.isArray(record.related)) {
      fail(`api/index.json: pages[${idx}].related present but not an array`);
    }
    if ('audience' in record && !Array.isArray(record.audience)) {
      fail(`api/index.json: pages[${idx}].audience present but not an array`);
    }
  });
  ok(`api/index.json: version '2', pages[] array (${pages.length}), count===pages.length, records well-shaped`);
}

// ---------------------------------------------------------------------------
// T019 — Favicon output + bibliography.
// ---------------------------------------------------------------------------

/** Every `<link ...>` tag whose `rel` names an icon; returns their href values. */
function iconLinkHrefs(html) {
  const hrefs = [];
  const linkTag = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkTag.exec(html)) !== null) {
    const tag = m[0];
    const rel = /\brel\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    const relValue = (rel ? rel[2] ?? rel[3] ?? '' : '').toLowerCase();
    if (!/\bicon\b/.test(relValue)) continue; // "icon" or "shortcut icon"
    const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    const hrefValue = href ? href[2] ?? href[3] ?? '' : '';
    if (hrefValue) hrefs.push(hrefValue);
  }
  return hrefs;
}

/**
 * Resolve a favicon href to a concrete file inside dist, corpus-agnostically.
 * The href is base-prefixed in the built HTML (e.g. `/consumer-fixture/favicon.svg`),
 * so try the full pathname first, then drop leading path segments (the base
 * prefix) until the file resolves. Returns the resolved absolute path or null.
 */
async function resolveHrefInDist(distDir, href) {
  let pathname = href;
  try {
    // Absolute URL → take its pathname; relative href → strip query/hash.
    pathname = new URL(href, 'https://x.invalid/').pathname;
  } catch {
    /* keep href as-is */
  }
  const segments = pathname.split('/').filter((s) => s.length > 0);
  for (let start = 0; start < segments.length; start += 1) {
    const candidate = path.join(distDir, ...segments.slice(start));
    if (await isExistingFile(candidate)) return candidate;
  }
  return null;
}

async function assertFavicon(distDir) {
  // Pick a built HTML page to read the emitted <head> from. Prefer the site
  // root index.html; else any *.html in dist. Corpus-agnostic: no fixed route.
  let htmlPath = path.join(distDir, 'index.html');
  if (!(await isExistingFile(htmlPath))) {
    const all = await walkFiles(distDir);
    htmlPath = all.find((p) => p.toLowerCase().endsWith('.html')) ?? null;
  }
  if (!htmlPath) {
    fail('favicon: no HTML page found in dist to inspect for <link rel="icon">');
  }
  const html = await readNonEmptyText(htmlPath, `favicon source (${path.relative(distDir, htmlPath)})`);
  const hrefs = iconLinkHrefs(html);
  if (hrefs.length === 0) {
    fail(`favicon: no <link rel="icon"> in ${path.relative(distDir, htmlPath)} (favicon warn-path hole, C-2)`);
  }
  for (const href of hrefs) {
    const resolved = await resolveHrefInDist(distDir, href);
    if (!resolved) {
      fail(`favicon: <link rel="icon" href="${href}"> target does not exist in dist (asset not emitted, C-2)`);
    }
    ok(`favicon: <link rel="icon"> → ${path.relative(distDir, resolved)} emitted in dist`);
  }
}

async function assertBibliography(distDir) {
  const abs = path.join(distDir, 'api', 'bibliography.json');
  const text = await readNonEmptyText(abs, 'api/bibliography.json');
  let body;
  try {
    body = JSON.parse(text);
  } catch (err) {
    fail(`api/bibliography.json: not valid JSON (${err.message})`);
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    fail('api/bibliography.json: top-level value is not a JSON object');
  }
  if (!Array.isArray(body.records)) {
    fail('api/bibliography.json: top-level `records` is not an array');
  }
  body.records.forEach((record, idx) => {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      fail(`api/bibliography.json: records[${idx}] is not an object`);
    }
    for (const key of ['id', 'title', 'url']) {
      if (!(key in record)) {
        fail(`api/bibliography.json: records[${idx}] missing required key \`${key}\``);
      }
    }
  });
  ok(`api/bibliography.json: valid JSON, records[] (${body.records.length}) each with id/title/url`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const distArg = process.argv[2];
  if (!distArg) {
    fail('usage: assert-consumer-artifacts.mjs <distDir>');
  }
  const distDir = path.resolve(distArg);
  let info;
  try {
    info = await stat(distDir);
  } catch {
    fail(`dist: directory not found (${distDir})`);
  }
  if (!info.isDirectory()) {
    fail(`dist: not a directory (${distDir})`);
  }

  // T017 — feeds
  await assertRss(distDir);
  await assertLlms(distDir);
  await assertSitemap(distDir);
  // T018 — agent-API
  await assertAgentIndex(distDir);
  // T019 — favicon + bibliography
  await assertFavicon(distDir);
  await assertBibliography(distDir);

  ok('all consumer artifact assertions passed');
}

main().catch((err) => {
  fail(`unexpected error — ${err.stack ?? err.message ?? String(err)}`);
});
