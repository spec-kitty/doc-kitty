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
 * — the page it guards once stopped at v0.1.0 while the toolkit shipped 0.4.0.
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
  const missing = missingReleases(readFileSync(changelog, 'utf8'), readFileSync(htmlPath, 'utf8'));
  if (missing.length > 0) {
    console.error(
      `assert-changelog-page: FAILED — ${missing.length} release(s) of ${changelog} missing from ${htmlPath}:`,
    );
    for (const v of missing) console.error(`  ✖ ## [${v}]`);
    return 1;
  }
  console.log(
    `assert-changelog-page: OK — all ${versions.length} release(s) of ${changelog} (${versions.join(', ')}) appear on /${page}/.`,
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
