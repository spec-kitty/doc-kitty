#!/usr/bin/env node
/**
 * Capture the uncapped large-hub fixture's goldens (#341, WP04; NFR-002).
 *
 * Builds the fixture site with no hub over its cap using the toolkit of an
 * earlier commit (the one before the sidebar child cap existed), and writes
 * `golden/uncapped.json`: route → sha256 of the built page. The build suite
 * builds the same site with today's toolkit and compares. Pages are hashed after
 * `normaliseBuildPaths`, which masks the checkout path Astro hashes into scoped
 * class names; nothing else is masked.
 *
 *   node src/tests/fixtures/large-hub/capture-golden.mjs --commit <base-commit>
 *
 * The script checks the commit out as a temporary git worktree inside this
 * repository (`example/.dk-test-sidebar-cap-base/`, git-ignored), installs its
 * dependencies, builds there, and removes the worktree.
 *
 * Recapture only when a change outside the cap legitimately changes the
 * fixture's output (a rebase onto a main that changed page chrome), on that
 * change's base commit, and say so in the commit.
 */
import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { REPO_ROOT, SITE_PREFIX, builtPages, buildSite, normaliseBuildPaths, sha256, writeSite } from './site.mjs';

/** The fixture the goldens are captured from: two hubs, both under the default cap. */
export const UNCAPPED = { guides: 10 };
export const GOLDEN_FILE = fileURLToPath(new URL('./golden/uncapped.json', import.meta.url));

const { values } = parseArgs({ options: { commit: { type: 'string' } } });
// A commit id, nothing else: it is handed to git.
if (!values.commit || !/^[0-9a-f]{7,40}$/.test(values.commit)) {
  console.error('usage: capture-golden.mjs --commit <base commit id, hex>');
  process.exit(2);
}

/** Run a command in `cwd`; exit on failure. The command and its arguments are fixed here. */
function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`${cmd} ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
    process.exit(1);
  }
  return r.stdout.trim();
}

// The full id as git reports it, so only a real commit reaches the worktree step.
const commit = run('git', ['rev-parse', '--verify', `${values.commit}^{commit}`], REPO_ROOT);
const base = path.join(REPO_ROOT, 'example', `${SITE_PREFIX}base`);
rmSync(base, { recursive: true, force: true });
run('git', ['worktree', 'prune'], REPO_ROOT);
run('git', ['worktree', 'add', '--detach', base, commit], REPO_ROOT);
try {
  run('pnpm', ['install', '--frozen-lockfile'], base);
  const dir = path.join(base, 'example', `${SITE_PREFIX}uncapped`);
  writeSite(dir, UNCAPPED);
  const result = buildSite(dir);
  if (result.status !== 0) {
    console.error(result.output);
    process.exit(1);
  }
  const pages = Object.fromEntries(
    [...builtPages(path.join(dir, 'dist'))]
      .map(([route, html]) => [route, sha256(normaliseBuildPaths(html))])
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  writeFileSync(GOLDEN_FILE, `${JSON.stringify({ capturedOn: commit, fixture: UNCAPPED, pages }, null, 2)}\n`);
  console.log(`wrote ${Object.keys(pages).length} page hashes to ${GOLDEN_FILE}`);
} finally {
  run('git', ['worktree', 'remove', '--force', base], REPO_ROOT);
}
