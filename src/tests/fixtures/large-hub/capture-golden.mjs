#!/usr/bin/env node
/**
 * Capture the uncapped large-hub fixture's goldens (#341, WP04; NFR-002).
 *
 * Builds the fixture site with no hub over its cap using the toolkit of ANOTHER
 * checkout (the commit before the sidebar child cap existed), and writes
 * `golden/uncapped.json`: route → sha256 of the built page. The build suite
 * builds the same site with today's toolkit and compares. Pages are hashed after
 * `normaliseBuildPaths`, which masks the checkout path Astro hashes into scoped
 * class names; nothing else is masked.
 *
 *   git worktree add /tmp/base <base-commit> && (cd /tmp/base && pnpm install --frozen-lockfile)
 *   node src/tests/fixtures/large-hub/capture-golden.mjs --repo /tmp/base --commit <base-commit>
 *
 * Recapture only when a change outside the cap legitimately changes the
 * fixture's output (a rebase onto a main that changed page chrome), on that
 * change's base commit, and say so in the commit.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { builtPages, buildSite, normaliseBuildPaths, sha256, writeSite } from './site.mjs';

/** The fixture the goldens are captured from: two hubs, both under the default cap. */
export const UNCAPPED = { guides: 10 };
export const GOLDEN_FILE = fileURLToPath(new URL('./golden/uncapped.json', import.meta.url));

const { values } = parseArgs({ options: { repo: { type: 'string' }, commit: { type: 'string' } } });
if (!values.repo || !values.commit) {
  console.error('usage: capture-golden.mjs --repo <base checkout> --commit <base commit id>');
  process.exit(2);
}
const dir = path.join(values.repo, 'example', '.dk-test-sidebar-cap-uncapped');
writeSite(dir, UNCAPPED);
const result = buildSite(dir, path.join(values.repo, 'example', 'node_modules', 'astro', 'bin', 'astro.mjs'));
if (result.status !== 0) {
  console.error(result.output);
  process.exit(1);
}
const pages = Object.fromEntries([...builtPages(path.join(dir, 'dist'))].map(([route, html]) => [route, sha256(normaliseBuildPaths(html))]).sort());
writeFileSync(GOLDEN_FILE, `${JSON.stringify({ capturedOn: values.commit, fixture: UNCAPPED, pages }, null, 2)}\n`);
console.log(`wrote ${Object.keys(pages).length} page hashes to ${GOLDEN_FILE}`);
