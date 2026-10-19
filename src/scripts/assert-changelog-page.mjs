#!/usr/bin/env node
/**
 * assert-changelog-page.mjs — post-build gate: the on-site changelog shows
 * every release recorded in the repository's CHANGELOG.md (#192).
 *
 * Usage:
 *   node src/scripts/assert-changelog-page.mjs <distDir> [--changelog <path>] [--page <route>]
 *   pnpm assert:changelog
 *
 * CHANGELOG.md is the single source of the release history. The example site
 * renders it at build time (example/src/changelog-loader.ts), so there is no
 * hand-maintained copy. This gate reads every `## [x.y.z]` heading of
 * CHANGELOG.md and fails when the built page has no `<h2>` naming that version
 * — the page it guards once stopped at v0.1.0 while the toolkit shipped 0.4.0 —
 * or when the first entry of that release's section (its first words, compared
 * as plain words, at least 3) is not within that release's own part of the page, so a heading without its body fails too.
 *
 * Any other `## ` heading than `[Unreleased]` or `[x.y.z]` fails the gate too.
 *
 * Bare Node, zero dependencies, offline. It does not build.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const DEFAULT_CHANGELOG = 'CHANGELOG.md';
export const DEFAULT_PAGE = 'changelog/releases';

const RELEASE_HEADING_RE = /^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]/gm;

/** Every released version named by a `## [x.y.z]` heading, in file order. */
export function releaseVersions(changelogText) {
  return [...changelogText.matchAll(RELEASE_HEADING_RE)].map((m) => m[1]);
}

/** The plain text of every `<h2>` in the HTML (tags stripped, entities kept). */
export function h2Texts(html) {
  return [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
  );
}

/** Whether an `<h2>` text names exactly this version (`0.4.0` does not match `0.4.01` or `10.4.0`). */
function namesVersion(heading, version) {
  return new RegExp(`(^|[^0-9.])${version.replace(/\./g, '\\.')}($|[^0-9.])`).test(heading);
}

/** Versions whose release heading is missing from the page's `<h2>`s. */
export function missingReleases(changelogText, html) {
  const headings = h2Texts(html);
  return releaseVersions(changelogText).filter((v) => !headings.some((h) => namesVersion(h, v)));
}

/** The page HTML of one release: from its `<h2>` up to the next `<h2>` (or the end). */
function pageSection(html, version) {
  const parts = html.split(/(?=<h2\b)/i);
  const mine = parts.find((part) => {
    const m = /^<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(part);
    return m && namesVersion(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), version);
  });
  return mine ?? '';
}

/**
 * `## ` headings of the changelog that are neither `[Unreleased]` nor a
 * `[x.y.z]` release. Such a heading would otherwise be skipped without a word.
 */
export function unparsableHeadings(changelogText) {
  let fence = false;
  const bad = [];
  for (const line of changelogText.split('\n')) {
    if (/^ {0,3}(```|~~~)/.test(line)) fence = !fence;
    else if (!fence && /^## /.test(line) && !/^## \[Unreleased\]/i.test(line) && !new RegExp(RELEASE_HEADING_RE.source).test(line)) {
      bad.push(line.trim());
    }
  }
  return bad;
}

const SAMPLE_WORDS = 8;
const MIN_SAMPLE_WORDS = 3;

/** Inline Markdown reduced to its text: links, emphasis and code marks go. */
function markdownText(line) {
  return line
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .trim();
}

/**
 * Each release with a body sample: the first line of text under its heading
 * (a list item or a paragraph, not a `###` subheading), inline marks removed.
 */
export function releaseSections(changelogText) {
  const lines = changelogText.split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    const heading = /^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]/.exec(line);
    if (heading) {
      current = { version: heading[1], sample: '' };
      sections.push(current);
    } else if (/^## /.test(line) || /^\[[^\]]+\]:/.test(line)) {
      current = null;
    } else if (current && !current.sample && line.trim() && !/^#{3,} /.test(line)) {
      const text = markdownText(line);
      // A line of fewer than MIN_SAMPLE_WORDS words is too weak a probe: try the next one.
      if (words(text).length >= MIN_SAMPLE_WORDS) current.sample = text;
    }
  }
  return sections;
}

/** Lowercased words of letters and digits only, so markup, entities and smart punctuation cannot matter. */
function words(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[#a-z0-9]+;/gi, ' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}


/** Releases with no line of at least MIN_SAMPLE_WORDS words to probe the page with. */
export function unprobeableBodies(changelogText) {
  return releaseSections(changelogText)
    .filter(({ sample }) => !sample)
    .map(({ version }) => version);
}

/**
 * Versions whose body sample (its first words, in order) is not in THAT
 * version's section of the page, so another release's text cannot vouch for it.
 */
export function missingBodies(changelogText, html) {
  return releaseSections(changelogText)
    .filter(({ version, sample }) => {
      if (!sample) return false;
      const probe = words(sample).slice(0, SAMPLE_WORDS);
      const section = ` ${words(pageSection(html, version)).join(' ')} `;
      return !section.includes(` ${probe.join(' ')} `);
    })
    .map(({ version }) => version);
}

function parseArgs(argv) {
  let changelog = DEFAULT_CHANGELOG;
  let page = DEFAULT_PAGE;
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--changelog') {
      changelog = argv[i + 1] ?? '';
      i += 1;
    } else if (argv[i] === '--page') {
      page = argv[i + 1] ?? '';
      i += 1;
    } else {
      positional.push(argv[i]);
    }
  }
  return { distDir: positional[0], changelog, page: page.replace(/^\/+|\/+$/g, '') };
}

export function run(argv) {
  const { distDir, changelog, page } = parseArgs(argv.slice(2));
  if (!distDir) {
    console.error('Usage: assert-changelog-page.mjs <distDir> [--changelog <path>] [--page <route>]');
    return 2;
  }
  if (!existsSync(changelog)) {
    console.error(`assert-changelog-page: changelog not found: ${changelog}`);
    return 2;
  }
  const versions = releaseVersions(readFileSync(changelog, 'utf8'));
  const badHeadings = unparsableHeadings(readFileSync(changelog, 'utf8'));
  if (badHeadings.length > 0) {
    console.error(`assert-changelog-page: FAILED — ${changelog} has "## " headings that are not a release version:`);
    for (const h of badHeadings) console.error(`  ✖ ${h} (use "## [x.y.z]" or "## [Unreleased]")`);
    return 1;
  }
  if (versions.length === 0) {
    console.error(`assert-changelog-page: no "## [x.y.z]" release heading in ${changelog}`);
    return 1;
  }
  const htmlPath = path.join(distDir, page, 'index.html');
  if (!existsSync(htmlPath)) {
    console.error(
      `assert-changelog-page: FAILED — changelog page not built: ${htmlPath} (build the example first — this gate does not build)`,
    );
    return 1;
  }
  const text = readFileSync(changelog, 'utf8');
  const html = readFileSync(htmlPath, 'utf8');
  const missing = missingReleases(text, html);
  const bodiless = missingBodies(text, html);
  const unprobeable = unprobeableBodies(text);
  if (missing.length > 0 || bodiless.length > 0 || unprobeable.length > 0) {
    console.error(`assert-changelog-page: FAILED — ${changelog} is not fully on ${htmlPath}:`);
    for (const v of missing) console.error(`  ✖ ## [${v}]: release heading missing`);
    for (const v of bodiless) console.error(`  ✖ ## [${v}]: the first entry of its section is missing`);
    for (const v of unprobeable) {
      console.error(`  ✖ ## [${v}]: no line of at least ${MIN_SAMPLE_WORDS} words to check its body with`);
    }
    return 1;
  }
  console.log(
    `assert-changelog-page: OK — all ${versions.length} release(s) of ${changelog} (${versions.join(', ')}) appear on /${page}/ with their section bodies.`,
  );
  return 0;
}

function invokedDirectly() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  process.exit(run(process.argv));
}
