#!/usr/bin/env node
/**
 * assert-build-artifacts.mjs — post-build gate for the example docsite.
 *
 * Usage:
 *   node src/scripts/assert-build-artifacts.mjs <distDir>
 *   pnpm assert:artifacts example/dist
 *
 * Asserts that a clean `astro build` produced every artifact the corpus
 * promises, and exits NON-ZERO with a precise message on the FIRST failure.
 * This is the "what is gated equals what is published" check (FR-010/FR-011):
 * it runs as a step in the WP04 build-example JOB, after the shared composite
 * build action (it is deliberately NOT part of the composite, so the WP05
 * deploy can reuse the pure build without inheriting this PR-gate assertion).
 *
 * Assertions target the example output shape/count (design "Test taxonomy").
 *
 * Zero runtime dependencies: WP01 vendors no XML parser, so XML
 * well-formedness is checked at the string level by a small, honest,
 * stack-based scanner (below) — not by a filename grep, and not by adding a
 * parser dependency.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Pinned expectations for today's example content (T015).
//
// The agent index at /api/index.json lists every *published, agent-discoverable*
// page. Its top-level shape is { title, version, generatedFrom, count, pages[] }
// and its `count` must equal both `pages.length` and the number below.
//
// EXPECTED_INDEX_ENTRY_COUNT is pinned, not hand-waved. Cross-check (authoring
// time), so a wrong build cannot silently lock in a wrong baseline:
//   - example/docs holds 13 Markdown content files (README-as-index + pages);
//   - exactly one is a draft — example/docs/adr/template.md (doc_status: draft),
//     which `isPublished()` excludes from the agent index;
//   - 13 − 1 = 12 published, discoverable pages.
// Independently verified against example/docs at authoring time: counting
// non-draft *.md there yields 12, matching the emitted `count`.
//
// Sitemap parity (WP02/T016): the @astrojs/sitemap `filter` now DROPS every
// draft page's URL (INV-1), so the sitemap's page-URL count equals this same
// published set — 12 — and the single draft page (adr/template) is absent from
// it. Rationale for editing this WP01-owned file here: the filter and the
// assertion that proves it must land together, or the boundary goes red (C-010).
//
// Bump this ONLY as a deliberate, reviewable act when example content changes.
const EXPECTED_INDEX_ENTRY_COUNT = 12;

// Sitemap page-URL count == the published set (draft excluded by the filter).
const EXPECTED_SITEMAP_URL_COUNT = 12;

// The single draft page (example/docs/adr/template.md, doc_status: draft). Its
// route MUST NOT appear in the sitemap once the draft filter is in place.
const DRAFT_ROUTE_MARKER = 'adr/template';

// Required top-level keys of the agent index and their JS types.
const EXPECTED_INDEX_SHAPE = {
  title: 'string',
  version: 'string',
  generatedFrom: 'string',
  count: 'number',
  pages: 'array',
};

// Required keys on each entry in `pages[]` (each a string). `doc_status` and
// `kind` land with the finalized metadata contract (ADR-0009 / C-010).
const EXPECTED_PAGE_KEYS = ['slug', 'route', 'section', 'title', 'doc_status', 'kind'];

// README-as-index proof: a section's README.md served at its directory route.
// The ADR section's README H1 is "Decision Records"; it must appear in the HTML
// rendered at /adr/ (dist/adr/index.html).
const SECTION_INDEX_RELPATH = path.join('adr', 'index.html');
const SECTION_INDEX_MARKER = 'Decision Records';
const SECTION_INDEX_SOURCE = 'example/docs/adr/README.md';

// A known content page (non-index) that must render to HTML.
const KNOWN_PAGE_RELPATH = path.join('guides', 'getting-started', 'index.html');

// ---------------------------------------------------------------------------

/** Emit a precise failure and exit non-zero (first failure wins). */
function fail(message) {
  process.stderr.write(`assert:artifacts: FAIL — ${message}\n`);
  process.exit(1);
}

function ok(message) {
  process.stdout.write(`assert:artifacts: ok — ${message}\n`);
}

async function readTextOrFail(absPath, label) {
  try {
    return await readFile(absPath, 'utf8');
  } catch (err) {
    fail(`${label}: could not read ${absPath} (${err.code ?? err.message})`);
  }
}

async function assertNonEmptyFile(absPath, label) {
  let info;
  try {
    info = await stat(absPath);
  } catch {
    fail(`${label}: missing (${absPath})`);
  }
  if (!info.isFile()) fail(`${label}: not a file (${absPath})`);
  if (info.size === 0) fail(`${label}: present but empty (${absPath})`);
  return info;
}

/**
 * String-level XML well-formedness check — no parser dependency.
 *
 * A stack-based scanner that honours the XML declaration, comments, CDATA and
 * processing instructions, respects quoted attribute values (so a `>` inside a
 * value does not end a tag), and verifies that every element is closed in the
 * right order. It is not a validating parser, but it genuinely proves the
 * document is balanced and nested — far more than a filename check.
 * Throws Error(reason) on the first structural problem.
 */
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

// ---------------------------------------------------------------------------

async function main() {
  const distArg = process.argv[2];
  if (!distArg) {
    fail('usage: node src/scripts/assert-build-artifacts.mjs <distDir>');
  }
  const distDir = path.resolve(distArg);

  try {
    const info = await stat(distDir);
    if (!info.isDirectory()) fail(`distDir is not a directory: ${distDir}`);
  } catch {
    fail(`distDir does not exist: ${distDir} (did you run \`pnpm build\`?)`);
  }

  // 1) sitemap*.xml — present, non-empty, well-formed.
  const topLevel = await readdir(distDir);
  const sitemaps = topLevel.filter((f) => /^sitemap.*\.xml$/i.test(f)).sort();
  if (sitemaps.length === 0) {
    fail('sitemap: no sitemap*.xml file found at the dist root');
  }
  let sitemapUrlCount = 0;
  let draftSeenIn = null;
  for (const name of sitemaps) {
    const abs = path.join(distDir, name);
    await assertNonEmptyFile(abs, `sitemap ${name}`);
    const xml = await readTextOrFail(abs, `sitemap ${name}`);
    try {
      assertWellFormedXml(xml);
    } catch (err) {
      fail(`sitemap ${name}: not well-formed XML (${err.message})`);
    }
    // Count page URLs only: page entries are <url>…</url>; the sitemap index
    // uses <sitemap>…</sitemap>, so <url> never over-counts sub-sitemap refs.
    sitemapUrlCount += (xml.match(/<url\b/g) ?? []).length;
    if (xml.includes(DRAFT_ROUTE_MARKER)) draftSeenIn = name;
  }
  ok(`sitemap: ${sitemaps.length} file(s) present, non-empty, well-formed (${sitemaps.join(', ')})`);

  // Draft-exclusion (INV-1 / WP02 filter): the draft route must be absent and
  // the page-URL count must equal the published set.
  if (draftSeenIn !== null) {
    fail(
      `sitemap: draft route "${DRAFT_ROUTE_MARKER}" is present in ${draftSeenIn} — ` +
        `the @astrojs/sitemap draft filter must exclude every doc_status:draft page`,
    );
  }
  if (sitemapUrlCount !== EXPECTED_SITEMAP_URL_COUNT) {
    fail(
      `sitemap: page-URL count is ${sitemapUrlCount}, expected ${EXPECTED_SITEMAP_URL_COUNT} ` +
        `(the published set — 13 example files − 1 draft; if example content changed ` +
        `intentionally, update EXPECTED_SITEMAP_URL_COUNT and re-cross-check example/docs)`,
    );
  }
  ok(`sitemap: draft "${DRAFT_ROUTE_MARKER}" absent, ${sitemapUrlCount} page URL(s) (published set)`);

  // 2) rss.xml — present, well-formed.
  const rssAbs = path.join(distDir, 'rss.xml');
  await assertNonEmptyFile(rssAbs, 'rss.xml');
  const rss = await readTextOrFail(rssAbs, 'rss.xml');
  try {
    assertWellFormedXml(rss);
  } catch (err) {
    fail(`rss.xml: not well-formed XML (${err.message})`);
  }
  ok('rss.xml: present and well-formed');

  // 3) llms.txt — present, non-empty.
  const llmsAbs = path.join(distDir, 'llms.txt');
  await assertNonEmptyFile(llmsAbs, 'llms.txt');
  ok('llms.txt: present and non-empty');

  // 4) agent index JSON — valid JSON, expected top-level shape, pinned count.
  const indexAbs = path.join(distDir, 'api', 'index.json');
  await assertNonEmptyFile(indexAbs, 'agent index (api/index.json)');
  const indexText = await readTextOrFail(indexAbs, 'agent index (api/index.json)');
  let index;
  try {
    index = JSON.parse(indexText);
  } catch (err) {
    fail(`agent index: not valid JSON (${err.message})`);
  }
  if (index === null || typeof index !== 'object' || Array.isArray(index)) {
    fail('agent index: top level is not a JSON object');
  }
  for (const [key, expectedType] of Object.entries(EXPECTED_INDEX_SHAPE)) {
    const value = index[key];
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (!(key in index)) fail(`agent index: missing top-level key "${key}"`);
    if (actualType !== expectedType) {
      fail(`agent index: key "${key}" should be ${expectedType}, got ${actualType}`);
    }
  }
  if (index.count !== index.pages.length) {
    fail(`agent index: count (${index.count}) does not match pages.length (${index.pages.length})`);
  }
  if (index.count !== EXPECTED_INDEX_ENTRY_COUNT) {
    fail(
      `agent index: entry count is ${index.count}, expected ${EXPECTED_INDEX_ENTRY_COUNT} ` +
        `(pinned baseline for today's example content — if the change is intentional, ` +
        `update EXPECTED_INDEX_ENTRY_COUNT in this script and re-cross-check against example/docs)`,
    );
  }
  index.pages.forEach((page, idx) => {
    if (page === null || typeof page !== 'object' || Array.isArray(page)) {
      fail(`agent index: pages[${idx}] is not an object`);
    }
    for (const key of EXPECTED_PAGE_KEYS) {
      if (!(key in page)) fail(`agent index: pages[${idx}] missing required key "${key}"`);
      if (typeof page[key] !== 'string') {
        fail(`agent index: pages[${idx}].${key} should be a string, got ${typeof page[key]}`);
      }
    }
  });
  ok(`agent index: valid JSON, expected shape, ${index.count} entries (pinned)`);

  // 5) README-as-index — a section README.md served at its directory route.
  const sectionIndexAbs = path.join(distDir, SECTION_INDEX_RELPATH);
  await assertNonEmptyFile(sectionIndexAbs, `README-as-index (${SECTION_INDEX_RELPATH})`);
  const sectionHtml = await readTextOrFail(sectionIndexAbs, `README-as-index (${SECTION_INDEX_RELPATH})`);
  if (!sectionHtml.includes(SECTION_INDEX_MARKER)) {
    fail(
      `README-as-index: ${SECTION_INDEX_RELPATH} does not contain the ${SECTION_INDEX_SOURCE} ` +
        `heading "${SECTION_INDEX_MARKER}" — the section README is not served at its directory route`,
    );
  }
  ok(`README-as-index: ${SECTION_INDEX_SOURCE} served at /adr/ (marker "${SECTION_INDEX_MARKER}" present)`);

  // 6) A known content page rendered to HTML.
  const knownAbs = path.join(distDir, KNOWN_PAGE_RELPATH);
  await assertNonEmptyFile(knownAbs, `known page (${KNOWN_PAGE_RELPATH})`);
  const knownHtml = await readTextOrFail(knownAbs, `known page (${KNOWN_PAGE_RELPATH})`);
  const looksLikeHtml = /<!doctype html/i.test(knownHtml) || /<html[\s>]/i.test(knownHtml);
  if (!looksLikeHtml) {
    fail(`known page: ${KNOWN_PAGE_RELPATH} does not look like a rendered HTML document`);
  }
  ok(`known page: ${KNOWN_PAGE_RELPATH} rendered to HTML`);

  process.stdout.write(`assert:artifacts: PASS — all build artifacts present and valid in ${distDir}\n`);
}

main().catch((err) => {
  fail(`unexpected error — ${err.stack ?? err.message ?? String(err)}`);
});
