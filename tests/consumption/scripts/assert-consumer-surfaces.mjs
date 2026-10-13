#!/usr/bin/env node
/**
 * assert-consumer-surfaces.mjs — the three consumer-facing surfaces added by the
 * sidebar-frame-header-carrier mission, proven from the PACKED tarball (C-006).
 *
 * Usage:  node assert-consumer-surfaces.mjs <dist-dir>
 *
 * Auto-discovered and run by `run-consumption-test.mjs` (step 6, glob
 * `assert-consumer-*.mjs`) with the fixture's default build, `dist/`, which
 * holds the draft pages (the default is `on`). That script also builds the
 * fixture a second time with `DK_PUBLISH_DRAFTS=off`, read from an env file,
 * into the sibling `dist-nodrafts/`, which this checker reads as well.
 *
 * What the fixture supplies, and what is asserted here:
 *
 *   1. FRAME WIDTH. `src/theme/press.css` sets `--dk-width-frame: 90rem`. The
 *      CSS the built home page loads must hold the token's registration
 *      (`@property`, initial value 100%), the frame rule that reads it, the
 *      frame gutter, and the consumer's value.
 *   2. DRAFT PUBLICATION. `docs/guides/draft-note.md` is `doc_status: draft`.
 *      Default build (drafts on): the page exists, carries `noindex`, and the
 *      sidebar lists it; the sitemap, feed, `llms.txt` and agent index do not;
 *      its per-page agent record exists. Drafts-off build, the setting read
 *      from an env file: the page is absent and nothing names its route.
 *      Non-vacuity: a published page of the same section is present in every
 *      one of those surfaces.
 *   3. THEME HEADER. `src/theme/index.ts` fills `dk:site-header` with
 *      `SiteHeader.astro`. Every framed page renders it exactly once, inside
 *      Starlight's `<header class="header">`, the stock header's root is gone,
 *      and the skip link is still there. On the home page each of the three
 *      parts it re-supplies (site title, search, theme select) is checked on
 *      its own, inside the element that carries the theme header's marker, and
 *      the two wrappers only the stock header draws are absent.
 *   4. SIDEBAR SHAPING. The route middleware resolves from the tarball: the
 *      `rhetoric/book-one` group carries its index page's title, not the
 *      directory name, and that index is the group's first entry.
 *
 * Every check reads built output only. No dependency beyond Node's stdlib.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const BASE = '/consumer-fixture';
const DRAFT_SLUG = 'guides/draft-note';
const DRAFT_ROUTE = `${BASE}/${DRAFT_SLUG}/`;
const DRAFT_TITLE = 'A draft note';
/** A published page of the same section: the positive control for every listing. */
const PUBLISHED_SLUG = 'guides/getting-started';
const HEADER_MARKER = 'data-consumer-header="press"';
const BOOK_ONE_TITLE = 'I: Purposes and Definitions of Rhetoric';

const failures = [];
const passes = [];
function check(ok, label, detail = '') {
  if (ok) passes.push(label);
  else failures.push(detail ? `${label} — ${detail}` : label);
}

const read = (dir, rel) => readFileSync(path.join(dir, rel), 'utf8');
const has = (dir, rel) => existsSync(path.join(dir, rel));
const count = (text, needle) => text.split(needle).length - 1;

function htmlFiles(dir, rel = '') {
  return readdirSync(path.join(dir, rel)).flatMap((name) => {
    const child = path.join(rel, name);
    if (statSync(path.join(dir, child)).isDirectory()) return htmlFiles(dir, child);
    return name.endsWith('.html') ? [child] : [];
  });
}

/** Every stylesheet a page loads, inline and linked, in document order. */
function pageCss(dir, html) {
  let css = '';
  const token = /<style[^>]*>([\s\S]*?)<\/style>|<link\b[^>]*rel="stylesheet"[^>]*>/g;
  let m;
  while ((m = token.exec(html)) !== null) {
    if (m[1] !== undefined) {
      css += `${m[1]}\n`;
      continue;
    }
    const href = /href="([^"]+)"/.exec(m[0])?.[1];
    if (!href || /^https?:/.test(href)) continue;
    const rel = href.startsWith(`${BASE}/`) ? href.slice(BASE.length + 1) : href.replace(/^\//, '');
    if (has(dir, rel)) css += `${read(dir, rel)}\n`;
  }
  return css;
}

/** The sidebar pane's markup of a page. */
function sidebarOf(html) {
  const start = html.indexOf('id="starlight__sidebar"');
  return start === -1 ? '' : html.slice(start, html.indexOf('</nav>', start));
}

function main() {
  const dist = process.argv[2];
  if (!dist || !existsSync(dist)) {
    console.error('Usage: assert-consumer-surfaces.mjs <dist-dir>  (the default build)');
    process.exit(2);
  }
  // `drafts` is the default build (drafts on); `noDrafts` the env-file `off` build.
  const drafts = dist;
  const noDrafts = path.join(path.dirname(path.resolve(dist)), 'dist-nodrafts');
  if (!existsSync(noDrafts)) {
    console.error(
      `assert-consumer-surfaces: ${noDrafts} not found. run-consumption-test.mjs builds it with ` +
        'DK_PUBLISH_DRAFTS=off in an env file; this checker needs both builds.',
    );
    process.exit(2);
  }

  const home = read(dist, 'index.html');

  // ── 1. Frame width ────────────────────────────────────────────────────────
  const css = pageCss(dist, home).replace(/\s+/g, '');
  check(css.length > 1000, 'frame: the home page loads CSS to inspect', `${css.length} characters`);
  const registration = /@property--dk-width-frame\{([^}]*)\}/.exec(css)?.[1] ?? '';
  check(registration !== '', 'frame: --dk-width-frame is a registered property');
  check(
    /initial-value:100%/.test(registration) && /syntax:["']<length-percentage>["']/.test(registration),
    'frame: the registration is a <length-percentage> with initial value 100%',
    registration,
  );
  check(
    /\.main-frame\{[^}]*max-width:var\(--dk-width-frame\)/.test(css),
    'frame: .main-frame is capped by the token',
  );
  check(/--dk-width-frame:90rem/.test(css), "frame: the consumer's 90rem cap is in the loaded CSS");
  // Both must be present: `lastIndexOf` is -1 for a missing default, and the
  // comparison below would then pass with nothing to come after.
  check(/--dk-width-frame:100%/.test(css), "frame: the toolkit's 100% default is in the loaded CSS");
  check(
    css.lastIndexOf('--dk-width-frame:90rem') > css.lastIndexOf('--dk-width-frame:100%'),
    "frame: the consumer's value comes after the toolkit default",
  );

  // ── 2. Draft publication ──────────────────────────────────────────────────
  const draftPage = `${DRAFT_SLUG}/index.html`;
  const listings = ['sitemap-0.xml', 'rss.xml', 'llms.txt', 'api/index.json'];

  // Drafts-off build (the setting came from an env file): gone everywhere.
  check(!has(noDrafts, draftPage), 'drafts off (env file): the draft page is not built');
  check(!has(noDrafts, `api/pages/${DRAFT_SLUG}.json`), 'drafts off: no per-page agent record for the draft');
  const namers = htmlFiles(noDrafts).filter((rel) => read(noDrafts, rel).includes(DRAFT_ROUTE));
  check(namers.length === 0, 'drafts off: no built page names the draft route', namers.join(', '));
  check(has(noDrafts, `${PUBLISHED_SLUG}/index.html`), 'drafts off: a published page of the section is built');
  for (const rel of listings) {
    check(has(noDrafts, rel), `drafts off: ${rel} exists`);
    if (!has(noDrafts, rel)) continue;
    const text = read(noDrafts, rel);
    check(!text.includes(DRAFT_SLUG), `drafts off: ${rel} does not list the draft`);
    check(text.includes(PUBLISHED_SLUG), `drafts off: ${rel} lists the published page (non-vacuity)`);
  }

  // Default build (drafts on): built, listed, noindex; machine surfaces unchanged.
  check(has(drafts, draftPage), 'drafts on (default): the draft page is built');
  if (has(drafts, draftPage)) {
    const page = read(drafts, draftPage);
    check(
      /<meta\s+name="robots"\s+content="[^"]*noindex/.test(page),
      'drafts on: the draft page carries a robots noindex meta',
    );
    check(page.includes(DRAFT_TITLE), 'drafts on: the draft page renders its title');
  }
  const published = read(drafts, `${PUBLISHED_SLUG}/index.html`);
  check(
    !/<meta\s+name="robots"\s+content="[^"]*noindex/.test(published),
    'drafts on: a published page carries no noindex (non-vacuity)',
  );
  check(
    sidebarOf(home).includes(`href="${DRAFT_ROUTE}"`),
    'drafts on (default): the sidebar lists the draft page',
  );
  check(
    !sidebarOf(read(noDrafts, 'index.html')).includes(`href="${DRAFT_ROUTE}"`),
    'drafts off: the sidebar does not list the draft page',
  );
  check(has(drafts, `api/pages/${DRAFT_SLUG}.json`), 'drafts on: the per-page agent record exists');
  for (const rel of listings) {
    check(has(drafts, rel), `drafts on: ${rel} exists`);
    if (!has(drafts, rel)) continue;
    const text = read(drafts, rel);
    check(!text.includes(DRAFT_SLUG), `drafts on: ${rel} does not list the draft`);
    check(text.includes(PUBLISHED_SLUG), `drafts on: ${rel} lists the published page (non-vacuity)`);
  }

  // ── 3. Theme header ───────────────────────────────────────────────────────
  const framed = htmlFiles(dist).filter((rel) => read(dist, rel).includes('<div class="page sl-flex'));
  check(framed.length >= 10, 'header: the build has framed pages to inspect', `${framed.length} pages`);
  const wrong = [];
  for (const rel of framed) {
    const page = read(dist, rel);
    const start = page.indexOf('<header class="header');
    const block = start === -1 ? '' : page.slice(start, page.indexOf('</header>', start));
    const ok =
      count(page, HEADER_MARKER) === 1 &&
      count(block, HEADER_MARKER) === 1 &&
      count(page, '<header') === 1 &&
      !page.includes('<div class="header sl-flex') &&
      /<a\s[^>]*href="#_top"/.test(page.slice(0, page.indexOf('<header')));
    if (!ok) wrong.push(rel);
  }
  check(
    wrong.length === 0,
    'header: every framed page renders the theme header once, inside the one <header>, with no stock header and the skip link before it',
    wrong.slice(0, 5).join(', '),
  );
  // The parts, one check each. An alternation of the three would pass on the
  // stock header too (it draws all of them), and would still pass if the theme
  // header dropped two. So each part must sit INSIDE the theme header's own
  // element, and the wrappers only the stock header draws must be absent.
  const headerStart = home.indexOf('<header class="header');
  const headerBlock = headerStart === -1 ? '' : home.slice(headerStart, home.indexOf('</header>', headerStart));
  const markerAt = headerBlock.indexOf(HEADER_MARKER);
  check(markerAt !== -1, "header: the home page's <header> holds the theme header's marker attribute");
  const themeHeader = markerAt === -1 ? '' : headerBlock.slice(markerAt);
  for (const [part, pattern] of [
    ['site title', /<a\s[^>]*class="site-title[\s"]/],
    ['search', /<site-search[\s>]/],
    ['theme select', /<starlight-theme-select[\s>]/],
  ]) {
    check(pattern.test(themeHeader), `header: the theme header re-supplies the ${part} inside its own element`);
  }
  for (const stockOnly of ['title-wrapper', 'right-group']) {
    check(
      !headerBlock.includes(stockOnly),
      `header: the stock header's "${stockOnly}" is not in the <header> (the theme header leaves it out)`,
    );
  }

  // ── 4. Sidebar shaping ────────────────────────────────────────────────────
  const sidebar = sidebarOf(home);
  check(sidebar !== '', 'sidebar: the home page has a sidebar');
  const labels = [...sidebar.matchAll(/<span class="large[^"]*"[^>]*>([^<]*)<\/span>/g)].map((m) =>
    m[1].trim().replace(/&amp;/g, '&'),
  );
  check(labels.includes(BOOK_ONE_TITLE), "sidebar: the book-one group carries its index page's title", labels.join(' | '));
  check(!labels.includes('book-one'), 'sidebar: no group is labelled with the raw directory name "book-one"');
  const groupStart = sidebar.indexOf(BOOK_ONE_TITLE);
  const firstHref = /<a href="([^"]*)"/.exec(sidebar.slice(Math.max(groupStart, 0)))?.[1];
  check(
    firstHref === `${BASE}/rhetoric/book-one/`,
    'sidebar: the section index is the first entry of its group',
    String(firstHref),
  );

  if (failures.length > 0) {
    console.error(`assert-consumer-surfaces: FAILED — ${failures.length} of ${failures.length + passes.length} check(s):`);
    for (const f of failures) console.error(`  ✖ ${f}`);
    process.exit(1);
  }
  console.log(`assert-consumer-surfaces: OK — ${passes.length} checks (frame token, draft publication, theme header, sidebar shaping).`);
}

main();
