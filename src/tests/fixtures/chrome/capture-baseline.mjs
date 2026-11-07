#!/usr/bin/env node
/**
 * capture-baseline.mjs — capture the chrome fixture's goldens and their stamp.
 *
 * Usage:
 *   pnpm fixture:chrome-baseline
 *
 * Builds the frozen fixture (`src/tests/fixtures/chrome/`) with no extra options and
 * writes, under `src/tests/fixtures/chrome/golden/`:
 *
 *  - `sidebar.html`: one deep page's whole sidebar fragment, `data-hash` included;
 *  - `page.html`: one non-hub page's HTML, build ids normalised;
 *  - `css.txt`: the list and content of the emitted CSS;
 *  - `stamp.json`: the toolkit commit, the Starlight and Astro versions, and a digest
 *    of each golden.
 *
 * These goldens record the output from BEFORE the page-chrome mission's behaviour
 * changes. `chrome-baseline.test.ts` pins the stamp's commit, so a recapture after a
 * change turns it red until someone edits that pin, in a diff a reviewer sees.
 *
 * Exits non-zero when the toolkit's sources have uncommitted changes (the stamp's
 * commit would not describe the output) or when the build fails.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  buildChromeFixture,
  DEEP_PAGE,
  GOLDEN_DIR,
  NON_HUB_PAGE,
  readBaseline,
  REPO_ROOT,
  resolvedVersion,
  TOOLKIT_PATHS,
} from './harness.mjs';

function fail(message) {
  console.error(`capture-baseline: ${message}`);
  process.exit(1);
}

function git(...args) {
  const run = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  if (run.status !== 0) fail(`git ${args.join(' ')} failed: ${run.stderr}`);
  return run.stdout.trim();
}

const dirty = git('status', '--porcelain', '--', ...TOOLKIT_PATHS);
if (dirty) fail(`the toolkit's sources have uncommitted changes:\n${dirty}`);

const build = buildChromeFixture();
if (build.status !== 0) fail(`the fixture failed to build (exit ${build.status}):\n${build.output}`);

const goldens = readBaseline(build.dist);
mkdirSync(GOLDEN_DIR, { recursive: true });
const digests = {};
for (const [name, contents] of Object.entries(goldens)) {
  const file = path.join(GOLDEN_DIR, name);
  const before = existsSync(file) ? readFileSync(file, 'utf8') : null;
  writeFileSync(file, contents);
  digests[name] = createHash('sha256').update(contents).digest('hex');
  console.log(`${name}: ${before === contents ? 'unchanged' : before === null ? 'written' : 'CHANGED: review the diff'}`);
}
const stamp = {
  toolkitCommit: git('rev-parse', 'HEAD'),
  starlight: resolvedVersion('@astrojs/starlight'),
  astro: resolvedVersion('astro'),
  pages: { sidebar: DEEP_PAGE, page: NON_HUB_PAGE },
  sha256: digests,
};
writeFileSync(path.join(GOLDEN_DIR, 'stamp.json'), `${JSON.stringify(stamp, null, 2)}\n`);
console.log(`stamp: ${stamp.toolkitCommit}, starlight ${stamp.starlight}, astro ${stamp.astro}`);
