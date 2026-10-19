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
 * as plain words) is not on the page, so a heading without its body fails too.
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

/** Versions whose release heading is missing from the page's `<h2>`s. */
export function missingReleases(changelogText, html) {
  const headings = h2Texts(html);
  return releaseVersions(changelogText).filter(
    (v) => !headings.some((h) => new RegExp(`(^|[^0-9.])${v.replace(/\./g, '\\.')}($|[^0-9.])`).test(h)),
  );
}

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
      current.sample = markdownText(line);
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

const SAMPLE_WORDS = 8;

/** Versions whose body sample (its first words, in order) is not on the page. */
export function missingBodies(changelogText, html) {
  const page = ` ${words(html).join(' ')} `;
  return releaseSections(changelogText)
    .filter(({ sample }) => {
      const probe = words(sample).slice(0, SAMPLE_WORDS);
      return probe.length > 0 && !page.includes(` ${probe.join(' ')} `);
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
  if (missing.length > 0 || bodiless.length > 0) {
    console.error(`assert-changelog-page: FAILED — ${changelog} is not fully on ${htmlPath}:`);
    for (const v of missing) console.error(`  ✖ ## [${v}]: release heading missing`);
    for (const v of bodiless) console.error(`  ✖ ## [${v}]: the first entry of its section is missing`);
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
