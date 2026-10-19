#!/usr/bin/env node
/**
 * assert-specification-artifacts.mjs — Specification layout build-artifact
 * assertions (gherkin-authoring-aids mission, WP06: FR-014, FR-015, FR-017;
 * contracts/specification-layout.md).
 *
 * Usage:
 *   node src/scripts/assert-specification-artifacts.mjs <distDir>
 *   (also invoked from assert-build-artifacts.mjs, so `pnpm assert:artifacts` runs it)
 *
 * Positive: the generated feature page `behaviour/shipping/book-consignment/`
 * (`kind: Specification`) renders exactly one header card, named by its
 * `aria-label` (no heading), holding the `FR-003` tag and the feature's source
 * path; the card is not a nav, carries no `aria-current`, never repeats the
 * ADR-0055 results summary or the draft notice, and the one Starlight TOC lists
 * only the feature's own headings (the only scenario navigation, D9).
 * Negative: non-Specification pages (a Hub, a guide, the in-page Gherkin guide)
 * render no card.
 *
 * Zero runtime dependencies: HTML is string-searched. Exits non-zero with a
 * precise message on the FIRST failure. `book-consignment` is `active`, so the
 * check holds on the drafts-off dist too; the draft feature page is checked only
 * when it was built.
 */
import { existsSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const FEATURE_PAGE = 'behaviour/shipping/book-consignment/index.html';
const DRAFT_FEATURE_PAGE = 'behaviour/shipping/track-consignment/index.html';
const NON_SPEC_PAGES = [
  'context/index.html', // Hub
  'guides/getting-started/index.html', // prose guide
  'guides/scenarios-in-pages/index.html', // in-page Gherkin, not kind: Specification
];
// The card is a region named by `aria-label`, not by a heading: a heading
// (even a visually hidden one) would file the page's lead prose under it in
// screen-reader heading navigation, because the body's own `# Title` is
// dropped by the single-h1 pass. It also keeps the name out of Pagefind.
const CARD_OPEN = '<section class="dk-spec-card" aria-label="Specification details">';

function fail(message) {
  process.stderr.write(`assert:specification: FAIL — ${message}\n`);
  process.exit(1);
}

function ok(message) {
  process.stdout.write(`assert:specification: ok — ${message}\n`);
}

async function readHtml(distDir, relPath) {
  try {
    return await readFile(path.join(distDir, relPath), 'utf8');
  } catch (err) {
    fail(`could not read ${relPath} (${err.code ?? err.message}) — did the build run?`);
  }
}

const count = (html, needle) => html.split(needle).length - 1;

/** The card's markup, from its opening tag to its closing `</section>`. */
function cardOf(html, relPath) {
  const start = html.indexOf(CARD_OPEN);
  if (start === -1) fail(`${relPath}: no \`${CARD_OPEN}\` (FR-014)`);
  const end = html.indexOf('</section>', start);
  if (end === -1) fail(`${relPath}: the spec card is never closed`);
  return html.slice(start, end + '</section>'.length);
}

/** Assert the card contract on one built Specification page; returns the card. */
function assertCard(html, relPath) {
  const n = count(html, 'class="dk-spec-card"');
  if (n !== 1) fail(`${relPath}: expected exactly one class="dk-spec-card", found ${n} (FR-014)`);
  const card = cardOf(html, relPath);
  if (!card.startsWith(CARD_OPEN)) {
    fail(`${relPath}: the card does not open with \`${CARD_OPEN}\` (contract)`);
  }
  if (/<h[1-6]\b/i.test(card)) fail(`${relPath}: the card contains a heading; it is named by aria-label (contract)`);
  if (/<nav\b/i.test(card)) fail(`${relPath}: the card contains a <nav>; the TOC is the only scenario navigation (FR-015)`);
  if (/role="navigation"/i.test(card)) fail(`${relPath}: the card carries role="navigation" (FR-015)`);
  if (/aria-current/i.test(card)) fail(`${relPath}: the card carries aria-current (FR-015)`);
  if (card.includes('dk-gherkin__results')) fail(`${relPath}: the card repeats the results summary (R-08)`);
  if (card.includes('dk-draft-notice')) fail(`${relPath}: the card renders its own draft notice (WP05 owns it)`);
  const tocs = count(html, '<starlight-toc');
  if (tocs !== 1) fail(`${relPath}: expected exactly one <starlight-toc>, found ${tocs} (FR-015)`);
  const results = count(html, 'class="dk-gherkin__results"');
  if (results > 1) fail(`${relPath}: ${results} results summaries; the card must not repeat it (R-08)`);
  return card;
}

export async function assertSpecificationArtifacts(distDir) {
  // Positive: the active generated feature page.
  const html = await readHtml(distDir, FEATURE_PAGE);
  const card = assertCard(html, FEATURE_PAGE);
  if (!/<ul class="dk-spec-card__tags" aria-label="Tags">[\s\S]*?<li>FR-003<\/li>/.test(card)) {
    fail(`${FEATURE_PAGE}: the card's tag list has no <li>FR-003</li> (FR-014)`);
  }
  if (!/<p class="dk-spec-card__source">[\s\S]*?features\/shipping\/book-consignment\.feature/.test(card)) {
    fail(`${FEATURE_PAGE}: the card's source does not name features/shipping/book-consignment.feature (FR-014)`);
  }
  // The example sets no sourceUrlPrefix: the source is text, not a link.
  if (/<a\b/i.test(card)) fail(`${FEATURE_PAGE}: the source is a link, but the example's resource is a relative path`);
  ok(`${FEATURE_PAGE}: one labelled spec card (tag FR-003, source path), not a nav, no repeated results, one TOC without the hidden heading`);

  // The draft feature page, when drafts were built: card + the WP05 notice, once.
  if (existsSync(path.join(distDir, DRAFT_FEATURE_PAGE))) {
    const draft = await readHtml(distDir, DRAFT_FEATURE_PAGE);
    assertCard(draft, DRAFT_FEATURE_PAGE);
    const notices = count(draft, 'class="dk-draft-notice"');
    if (notices !== 1) fail(`${DRAFT_FEATURE_PAGE}: expected one draft notice, found ${notices}`);
    ok(`${DRAFT_FEATURE_PAGE}: spec card plus exactly one draft notice, outside the card`);
  } else {
    ok(`${DRAFT_FEATURE_PAGE}: not built (drafts off) — skipped`);
  }

  // Negative: pages of other kinds render no card.
  for (const rel of NON_SPEC_PAGES) {
    const other = await readHtml(distDir, rel);
    if (!other.includes('<meta name="dk-chrome"')) fail(`${rel}: not an in-frame page — negative control is vacuous`);
    if (other.includes('dk-spec-card')) fail(`${rel}: a non-Specification page renders a spec card (FR-017)`);
  }
  ok(`no spec card on ${NON_SPEC_PAGES.length} non-Specification pages (${NON_SPEC_PAGES.join(', ')})`);
}

// Standalone entry point; argv[1] is resolved to its real path (pnpm symlinks).
const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  const distArg = process.argv[2];
  if (!distArg) fail('usage: node src/scripts/assert-specification-artifacts.mjs <distDir>');
  assertSpecificationArtifacts(distArg)
    .then(() => process.stdout.write('assert:specification: PASS — Specification layout artifacts valid\n'))
    .catch((err) => fail(`unexpected error — ${err.stack ?? err.message ?? String(err)}`));
}
