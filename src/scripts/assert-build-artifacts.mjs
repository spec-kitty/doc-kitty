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
// WP05 out-of-map edit (recorded): the chrome + pagefind assertions live in their
// own WP05-owned module to keep lane ownership clean; the main gate awaits them so
// `pnpm assert:artifacts` runs the full set. See kitty-specs/.../WP05-*.md.
import { assertChromeArtifacts } from './assert-chrome-artifacts.mjs';

// ---------------------------------------------------------------------------
// Pinned expectations for today's example content (T015).
//
// The agent index at /api/index.json lists every *published, agent-discoverable*
// page. Its top-level shape is { title, version, generatedFrom, count, pages[] }
// and its `count` must equal both `pages.length` and the number below.
//
// EXPECTED_INDEX_ENTRY_COUNT is pinned, not hand-waved. Cross-check (authoring
// time), so a wrong build cannot silently lock in a wrong baseline. Derivation
// from the published-`.md` count minus drafts (`isPublished()` excludes drafts
// from the agent index):
//   - PRE-WP03 baseline: example/docs held 14 Markdown files with TWO drafts —
//     example/docs/adr/template.md AND the persona (draft, at its old
//     personas/ location) — i.e. 14 − 2 = 12 published, discoverable pages.
//   - WP03 (ADR-0020) INTERIM delta: the persona is promoted draft → active
//     (+1 published) and relocates to context/audience/; an Audiences hub
//     README is added (+1 published); one retained draft demonstrator persona is
//     added (0 published — still draft). So 12 + 1 + 1 + 0 = 14.
//   - audience-related mission FINAL delta: the three-block demonstrator
//     (architecture/blocks-demonstrator.md, published, +1) and its stale related
//     target (architecture/superseded-note.md, published, +1) are added — both
//     published, so +2. So 14 + 2 = 16 (the prior-mission published set).
//   - slide-decks WP01 delta: a DRAFT smoke deck
//     (presentations/draft-preview.md, doc_status: draft) is added — 0 published,
//     +0 to both counts (BA-7: it must not move the pins).
//   - slide-decks WP04 delta (THIS recompute, atomic — BA-1): the published
//     showcase deck (presentations/showcase-deck.md, kind:Presentation,
//     doc_status:active, +1 — it stays fully enumerated by Starlight and the
//     generators; the deck route only shadows the URL, "shadow, not exclude")
//     AND the presentations overview Hub (presentations/README.md, kind:Hub,
//     doc_status:active, +1). Both published, so +2. So 16 + 2 = 18.
//   - POST-WP04 tree: 21 Markdown files with THREE drafts (adr/template, the
//     retained draft persona context/audience/draft-persona.md, and the WP01
//     draft deck presentations/draft-preview.md) → 21 − 3 = 18 published,
//     cross-checking the delta arithmetic above.
// This is the slide-decks pin (WP04 owns it; the prior-mission pin was 16). Both
// count-moving published pages of the slide-decks mission (the deck AND the
// overview Hub) land in THIS one recompute — no later WP may add a count-moving
// published page (BA-1 double-pin guard).
//
// Sitemap parity (INV-1): the @astrojs/sitemap `filter` DROPS every draft page's
// URL, so the sitemap's page-URL count equals this same published set — 18 — and
// every draft page (adr/template + the draft persona + the draft deck) is absent
// from it. The published showcase deck IS present in the sitemap (it is a normal
// enumerated collection entry; the out-of-frame route only changes what HTML the
// URL renders, not whether the URL is generated).
//
// Bump this ONLY as a deliberate, reviewable act when example content changes.
const EXPECTED_INDEX_ENTRY_COUNT = 18;

// Sitemap page-URL count == the published set (drafts excluded by the filter).
const EXPECTED_SITEMAP_URL_COUNT = 18;

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

// Required STRING keys on each entry in `pages[]`. `doc_status` and `kind` land
// with the finalized metadata contract (ADR-0009 / C-010). The enriched agent
// surface (WP05/WP06) also adds `audience` and `related`, but those are ARRAYS of
// objects — they are DELIBERATELY not listed here: this loop hard-asserts every
// listed key is a `string` (below), so an array key would red a correct build.
// They get a bespoke shape assertion outside that loop instead (agent-surface
// contract).
const EXPECTED_PAGE_KEYS = ['slug', 'route', 'section', 'title', 'doc_status', 'kind'];

// The concrete agent-API `version`. WP05/T028 bumped the owned default from '1' to
// '2' because `related` changed shape (raw slugs → resolved objects) and records
// gained `audience` — a published-contract change consumers branch on (DIRECTIVE_018).
// Pinned to the CONCRETE value, not just its type, so a silent re-bump/regress reds.
const EXPECTED_AGENT_API_VERSION = '2';

// `/api/bibliography.json` is a catalog projection emitted OUTSIDE page gating
// (ADR-0018 / FR-015): { version, count, records[] } with each record carrying at
// least id/title/url (catalog-and-citation contract).
const BIBLIOGRAPHY_ENDPOINT_RELPATH = path.join('api', 'bibliography.json');
const EXPECTED_BIBLIOGRAPHY_RECORD_KEYS = ['id', 'title', 'url'];

// README-as-index proof: a section's README.md served at its directory route.
// The ADR section's README H1 is "Decision Records"; it must appear in the HTML
// rendered at /adr/ (dist/adr/index.html).
const SECTION_INDEX_RELPATH = path.join('adr', 'index.html');
const SECTION_INDEX_MARKER = 'Decision Records';
const SECTION_INDEX_SOURCE = 'example/docs/adr/README.md';

// A known content page (non-index) that must render to HTML.
const KNOWN_PAGE_RELPATH = path.join('guides', 'getting-started', 'index.html');

// --- slide-decks WP04: the published showcase deck ------------------------------
// The published deck's canonical collection slug. `deckSlug(entry)` (WP01's
// src/lib/deck/deck-slug.ts) is `slugFromEntryId(entry.id)`, and the agent index
// emits that SAME `slug` for each page, so the shipped `slug` field IS deckSlug's
// output — the shared oracle, read from the artifact rather than recomputed.
//
// [Recorded deviation — BA-3 oracle import] The contract asks BA-3 to `import`
// deckSlug directly. This gate runs as `node src/scripts/assert-build-artifacts.mjs`
// with NO TypeScript loader, and deck-slug.ts imports `../metadata.js` (a `.js`
// specifier that resolves only to the `.ts` source under a bundler) — so a runtime
// `import` of the helper throws ERR_MODULE_NOT_FOUND and would red every build.
// The faithful substitute keeps ONE oracle: the deck's route/url parity is checked
// against the agent index's own `slug` (== deckSlug's output) plus the canonical
// `/${slug}/` reconstruction, which catches the prefix-doubling trap deckSlug
// guards (a doubled route would be `/presentations/presentations/showcase-deck/`).
const DECK_SLUG = 'presentations/showcase-deck';
const DECK_ROUTE = `/${DECK_SLUG}/`; // canonical reconstruction — must equal the emitted route
// The WP01 draft smoke deck: absent from every generator AND Pagefind (BA-7).
const DRAFT_DECK_SLUG = 'presentations/draft-preview';
// The published overview Hub route (BA-1 second count-moving page; BA-10 present).
const OVERVIEW_ROUTE = '/presentations/';

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

// --- Deck slide-structure scanners (BA-2 flatten proof) --------------------
// The emitted deck is flat HTML; these depth-aware scanners prove the transform's
// slides are TOP-LEVEL `.slides > section` (not nested inside one wrapper) without
// a DOM parser (NFR-006, zero deps).

/** The inner HTML of the `.slides` container (balanced `<div>` scan), or null. */
function extractSlidesInner(html) {
  const open = html.match(/<div\b[^>]*\bclass="[^"]*\bslides\b[^"]*"[^>]*>/);
  if (!open) return null;
  const start = open.index + open[0].length;
  const tagRe = /<\/?div\b[^>]*>/g;
  tagRe.lastIndex = start;
  let depth = 1;
  let t;
  while ((t = tagRe.exec(html)) !== null) {
    depth += t[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(start, t.index);
  }
  return html.slice(start);
}

/** Count DIRECT-child `<section>`s of the given inner HTML (section-depth 0). */
function countDirectChildSections(inner) {
  const re = /<\/?section\b[^>]*>/g;
  let depth = 0;
  let count = 0;
  let m;
  while ((m = re.exec(inner)) !== null) {
    if (m[0].startsWith('</')) depth -= 1;
    else {
      if (depth === 0) count += 1;
      depth += 1;
    }
  }
  return count;
}

/** True iff some top-level `<section>` contains a nested `<section>` (a stack). */
function hasNestedSectionStack(inner) {
  const re = /<\/?section\b[^>]*>/g;
  let depth = 0;
  let nested = false;
  let m;
  while ((m = re.exec(inner)) !== null) {
    if (m[0].startsWith('</')) depth -= 1;
    else {
      if (depth >= 1) nested = true;
      depth += 1;
    }
  }
  return nested;
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
        `(the published set — 21 example .md files − 3 drafts; if example content changed ` +
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

  // 4a) Concrete agent-API version (WP05/T028 bump). Pinned to the exact value so a
  // silent re-bump or regress is caught, not just "some string" (agent-surface
  // contract / DIRECTIVE_018).
  if (index.version !== EXPECTED_AGENT_API_VERSION) {
    fail(
      `agent index: version is ${JSON.stringify(index.version)}, expected ` +
        `${JSON.stringify(EXPECTED_AGENT_API_VERSION)} — the enriched-record shape bump (raw slugs → ` +
        `resolved related objects + audience) must carry version "2" (DIRECTIVE_018)`,
    );
  }
  ok(`agent index: version pinned to "${index.version}" (enriched-record contract)`);

  // 4b) BESPOKE shape for the ENRICHED array keys (agent-surface contract). These
  // are arrays of objects, so they cannot live in the string-type loop above.
  //   - related:  { ref, title, kind, doc_status }[]  — RESOLVED (never raw slugs)
  //   - audience: { profile, guidance_text }[]        — carried as authored
  // Asserted on EVERY page (the keys are always present, empty when unused), and at
  // least one page must actually carry a non-empty resolved `related` so the
  // enrichment is proven non-vacuously (the demonstrator does).
  let sawResolvedRelated = false;
  let sawAudience = false;
  index.pages.forEach((page, idx) => {
    if (!('related' in page) || !Array.isArray(page.related)) {
      fail(`agent index: pages[${idx}].related must be an array (enriched record), got ${typeof page.related}`);
    }
    if (!('audience' in page) || !Array.isArray(page.audience)) {
      fail(`agent index: pages[${idx}].audience must be an array (enriched record), got ${typeof page.audience}`);
    }
    for (const rel of page.related) {
      if (rel === null || typeof rel !== 'object' || Array.isArray(rel)) {
        fail(`agent index: pages[${idx}].related[] entry is not an object — related must be RESOLVED, not a raw slug string`);
      }
      for (const key of ['ref', 'title', 'kind', 'doc_status']) {
        if (typeof rel[key] !== 'string') {
          fail(
            `agent index: pages[${idx}].related[] missing/typed key "${key}" ` +
              `(resolved related is { ref, title, kind, doc_status }, all strings)`,
          );
        }
      }
      sawResolvedRelated = true;
    }
    for (const aud of page.audience) {
      if (aud === null || typeof aud !== 'object' || Array.isArray(aud)) {
        fail(`agent index: pages[${idx}].audience[] entry is not an object ({ profile, guidance_text })`);
      }
      for (const key of ['profile', 'guidance_text']) {
        if (typeof aud[key] !== 'string') {
          fail(`agent index: pages[${idx}].audience[] missing/typed key "${key}" (audience is { profile, guidance_text })`);
        }
      }
      sawAudience = true;
    }
  });
  if (!sawResolvedRelated) {
    fail(
      `agent index: no page carries a non-empty resolved \`related\` — the enrichment (resolveRelated in ` +
        `the route) is unexercised; the demonstrator must contribute at least one resolved related object`,
    );
  }
  if (!sawAudience) {
    fail(
      `agent index: no page carries a non-empty \`audience\` — the enriched audience field is unexercised; ` +
        `the demonstrator must contribute at least one audience entry`,
    );
  }
  ok(`agent index: enriched related[] ({ref,title,kind,doc_status}) + audience[] ({profile,guidance_text}) shapes valid`);

  // 4c) /api/bibliography.json — a catalog projection OUTSIDE page gating: valid
  // JSON, { version, count, records[] }, each record carrying id/title/url
  // (catalog-and-citation contract / FR-015).
  const biblioAbs = path.join(distDir, BIBLIOGRAPHY_ENDPOINT_RELPATH);
  await assertNonEmptyFile(biblioAbs, `bibliography endpoint (${BIBLIOGRAPHY_ENDPOINT_RELPATH})`);
  const biblioText = await readTextOrFail(biblioAbs, `bibliography endpoint (${BIBLIOGRAPHY_ENDPOINT_RELPATH})`);
  let biblio;
  try {
    biblio = JSON.parse(biblioText);
  } catch (err) {
    fail(`bibliography endpoint: not valid JSON (${err.message})`);
  }
  if (biblio === null || typeof biblio !== 'object' || Array.isArray(biblio)) {
    fail('bibliography endpoint: top level is not a JSON object');
  }
  if (typeof biblio.version !== 'string') {
    fail(`bibliography endpoint: "version" should be a string, got ${typeof biblio.version}`);
  }
  if (!Array.isArray(biblio.records)) {
    fail(`bibliography endpoint: "records" should be an array, got ${typeof biblio.records}`);
  }
  if (biblio.count !== biblio.records.length) {
    fail(`bibliography endpoint: count (${biblio.count}) does not match records.length (${biblio.records.length})`);
  }
  if (biblio.records.length === 0) {
    fail('bibliography endpoint: records is empty — the example bibliography catalog projects at least one record');
  }
  biblio.records.forEach((record, idx) => {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      fail(`bibliography endpoint: records[${idx}] is not an object`);
    }
    for (const key of EXPECTED_BIBLIOGRAPHY_RECORD_KEYS) {
      if (typeof record[key] !== 'string') {
        fail(`bibliography endpoint: records[${idx}].${key} should be a string, got ${typeof record[key]}`);
      }
    }
  });
  ok(`bibliography endpoint: valid JSON, { version, count, records[] }, ${biblio.count} record(s) with id/title/url`);

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

  // 7) slide-decks WP04: published-deck build-artifact assertions (BA-2/3/6/7/9).
  // The published showcase deck renders OUT-OF-FRAME via the deck route yet stays a
  // normal enumerated collection entry, so it is present in every published-set
  // generator and absent from RSS; the WP01 draft deck is absent everywhere.
  const llmsText = await readTextOrFail(llmsAbs, 'llms.txt');
  const sitemapText = (
    await Promise.all(
      sitemaps.map((n) => readTextOrFail(path.join(distDir, n), `sitemap ${n}`)),
    )
  ).join('\n');
  const indexJson = JSON.stringify(index);

  // BA-2 — Route-uniqueness + flatten: exactly one HTML at /presentations/showcase-deck/,
  // and it is the reveal deck document (`.reveal > .slides`), NOT the Starlight
  // article shell. The transform's slides are TOP-LEVEL `.slides > section`
  // (multiple horizontals + a `##`+`###` stack that nests `section > section`),
  // never a single wrapper `<section>` that would collapse the deck into one
  // vertical stack (the WP04 DeckLayout flatten).
  const deckHtmlAbs = path.join(distDir, DECK_SLUG, 'index.html');
  await assertNonEmptyFile(deckHtmlAbs, `deck route (${DECK_SLUG}/index.html)`);
  const deckHtml = await readTextOrFail(deckHtmlAbs, `deck route (${DECK_SLUG})`);
  const revealIdx = deckHtml.search(/class="[^"]*\breveal\b[^"]*"/);
  const slidesIdx = deckHtml.search(/class="[^"]*\bslides\b[^"]*"/);
  if (revealIdx === -1 || slidesIdx === -1 || !(revealIdx < slidesIdx)) {
    fail(`deck route: ${DECK_SLUG}/index.html is not the reveal shell (.reveal > .slides missing or misordered) — BA-2`);
  }
  if (/sl-markdown-content/.test(deckHtml)) {
    fail(
      `deck route: ${DECK_SLUG}/index.html contains the Starlight article shell (sl-markdown-content) — ` +
        `the deck is not rendering out-of-frame (BA-2)`,
    );
  }
  const slidesInner = extractSlidesInner(deckHtml);
  if (slidesInner === null) {
    fail(`deck route: could not locate the .slides container in ${DECK_SLUG}/index.html (BA-2)`);
  }
  const topSections = countDirectChildSections(slidesInner);
  if (topSections < 2) {
    fail(
      `deck route: .slides has ${topSections} direct-child <section>(s) — the transform's slides are nested ` +
        `inside a single wrapper <section> instead of being TOP-LEVEL (reveal would collapse the deck into ` +
        `one vertical stack). DeckLayout must render <Content/> as the direct child of .slides (BA-2 flatten)`,
    );
  }
  if (!hasNestedSectionStack(slidesInner)) {
    fail(
      `deck route: no vertical stack (a top-level <section> containing nested <section>s) in ${DECK_SLUG} — ` +
        `the ###-stack did not render (BA-2)`,
    );
  }
  ok(
    `deck route: single reveal deck at ${DECK_ROUTE} with ${topSections} top-level slides (flattened) + a ` +
      `nested stack, not the Starlight shell (BA-2)`,
  );

  // BA-3 — URL parity via the deckSlug oracle (see the DECK_SLUG note). The
  // canonical route is `/${DECK_SLUG}/`; the deck's agent-index entry, its llms.txt
  // URL, and its emitted dist path must all agree, and the `presentations/` prefix
  // must not double.
  const refPage = index.pages.find(
    (p) =>
      p.section !== 'presentations' &&
      typeof p.url === 'string' &&
      typeof p.route === 'string' &&
      p.url.endsWith(p.route),
  );
  if (!refPage) {
    fail('deck URL parity: no non-deck reference page (url ending in route) to derive the site origin — BA-3');
  }
  const origin = refPage.url.slice(0, refPage.url.length - refPage.route.length);
  const expectedDeckUrl = `${origin}${DECK_ROUTE}`;
  const deckPage = index.pages.find((p) => p.slug === DECK_SLUG);
  if (!deckPage) {
    fail(`deck URL parity: the published deck (slug "${DECK_SLUG}") is absent from the agent index — it must stay enumerated (BA-3)`);
  }
  if (deckPage.route !== DECK_ROUTE) {
    fail(
      `deck URL parity: agent-index route is ${JSON.stringify(deckPage.route)}, expected ` +
        `${JSON.stringify(DECK_ROUTE)} — the deck slug already carries "presentations/", so a route built ` +
        `from the raw slug would DOUBLE the prefix (BA-3 prefix-doubling guard)`,
    );
  }
  if (deckPage.url !== expectedDeckUrl) {
    fail(
      `deck URL parity: agent-index url is ${JSON.stringify(deckPage.url)}, expected ` +
        `${JSON.stringify(expectedDeckUrl)} (absolute(site, ${DECK_ROUTE})) — BA-3`,
    );
  }
  if (!llmsText.includes(`(${expectedDeckUrl})`)) {
    fail(`deck URL parity: llms.txt does not list the deck at ${expectedDeckUrl} — the llms URL diverges from the agent API/route (BA-3)`);
  }
  const doubled = `/presentations${DECK_ROUTE}`; // /presentations/presentations/showcase-deck/
  if (llmsText.includes(doubled) || sitemapText.includes(doubled) || indexJson.includes(doubled)) {
    fail(`deck URL parity: the prefix-doubled path ${doubled} appears in a generator — deckRouteParams must strip the presentations/ prefix (BA-3)`);
  }
  ok(`deck URL parity: agent index + llms.txt + emitted route all resolve the deck to ${expectedDeckUrl} (one oracle, no prefix-doubling) (BA-3)`);

  // BA-6 — RSS exclusion: the published deck URL is absent from rss.xml (the RSS
  // route excludes kind: Presentation).
  if (rss.includes(DECK_SLUG)) {
    fail(`deck RSS exclusion: the published deck ${DECK_SLUG} appears in rss.xml — kind:Presentation must be excluded from the feed (BA-6)`);
  }
  ok(`deck RSS exclusion: ${DECK_SLUG} absent from rss.xml (BA-6)`);

  // BA-7 — Draft deck exclusion (build generators): the WP01 draft deck is absent
  // from sitemap, RSS, llms.txt, and the agent index; and it did NOT move the pins
  // (proven by the count assertions above passing at 18 with the draft deck in the
  // tree — it contributes 0). Its Pagefind-index absence is asserted in the chrome
  // gate below (the BA-7 Pagefind half).
  for (const [artifact, text] of [
    ['sitemap', sitemapText],
    ['rss.xml', rss],
    ['llms.txt', llmsText],
    ['agent index', indexJson],
  ]) {
    if (text.includes(DRAFT_DECK_SLUG)) {
      fail(`draft deck exclusion: the draft deck ${DRAFT_DECK_SLUG} appears in ${artifact} — a doc_status:draft deck must be absent from every published-set generator (BA-7)`);
    }
  }
  ok(`draft deck exclusion: ${DRAFT_DECK_SLUG} absent from sitemap/rss/llms/agent, and did not move the pins (BA-7)`);

  // BA-9 — Print asset/bundle check. reveal 6.0.1 has NO separate print/pdf.css
  // export; the print rules are folded into core reveal.css `@media print`, and the
  // print VIEW is activated at runtime by reveal-init.client on `?print-pdf`. So the
  // check is (a) an emitted _astro CSS asset carries the reveal core sentinel AND an
  // `@media print` block (the bundled print rules), and (b) an emitted reveal-init
  // JS chunk references `print-pdf` under the `view:'print'` branch. There is
  // deliberately NO distinct ?print-pdf HTML artifact (SSG emits one page).
  const astroDir = path.join(distDir, '_astro');
  let astroEntries;
  try {
    astroEntries = await readdir(astroDir);
  } catch (err) {
    fail(`print asset: could not read ${path.join('_astro')} (${err.code ?? err.message}) — BA-9`);
  }
  // The reveal CORE sheet is pinned by the core-UNIQUE viewport-hijack literal
  // `.reveal-viewport{color:#000` (the token-map sheet references `.reveal-viewport`
  // as a selector and even carries its own `@media print`, so a bare substring would
  // mis-identify it). The core sheet's `@media print` block is reveal 6's folded
  // print stylesheet — there is no separate print/pdf.css.
  const REVEAL_CORE_PRINT_SENTINEL = '.reveal-viewport{color:#000';
  let printSheet = null;
  for (const n of astroEntries.filter((f) => f.endsWith('.css'))) {
    const sheet = await readFile(path.join(astroDir, n), 'utf8');
    if (sheet.includes(REVEAL_CORE_PRINT_SENTINEL) && /@media\s+print/.test(sheet)) {
      printSheet = n;
      break;
    }
  }
  if (printSheet === null) {
    fail(
      `print asset: no emitted _astro/*.css carries reveal's core sheet ` +
        `(${JSON.stringify(REVEAL_CORE_PRINT_SENTINEL)}) WITH an @media print block — reveal 6 folds print ` +
        `into core reveal.css, so the bundled print rules must ship (BA-9/FR-013)`,
    );
  }
  let printChunk = null;
  for (const n of astroEntries.filter((f) => f.endsWith('.js') && f.includes('reveal-init'))) {
    const js = await readFile(path.join(astroDir, n), 'utf8');
    if (js.includes('print-pdf') && /view:\s*["']print["']/.test(js)) {
      printChunk = n;
      break;
    }
  }
  if (printChunk === null) {
    fail(
      `print asset: no emitted reveal-init client chunk references \`print-pdf\` under the \`view:'print'\` ` +
        `branch — the ?print-pdf activation (FR-013) is not bundled (BA-9)`,
    );
  }
  ok(`print asset: reveal core sheet (${printSheet}) ships @media print, and ${printChunk} activates the print view on ?print-pdf (BA-9)`);

  // 8) Chrome + pagefind assertions (WP05-owned module + WP04 deck additions).
  // Fails non-zero on the first stubbed/missing chrome element, same contract.
  await assertChromeArtifacts(distDir);

  process.stdout.write(`assert:artifacts: PASS — all build artifacts present and valid in ${distDir}\n`);
}

main().catch((err) => {
  fail(`unexpected error — ${err.stack ?? err.message ?? String(err)}`);
});
