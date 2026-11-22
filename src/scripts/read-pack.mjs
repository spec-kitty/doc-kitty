#!/usr/bin/env node
/**
 * `dockitty-read-pack`: print the `PackModel` doc-kitty reads from one pack
 * directory (#330, ADR-0079 D6). A debugging aid and the reader's first
 * consumer; pack pages arrive with #338.
 *
 *   dockitty-read-pack <dir> [--json] [--charter-lock <file>] [--contract <dir>] [--repo-root <dir>]
 *
 * Exit 0 when a model is printed, warnings included. Exit 2 for a usage error, a
 * directory with no `pack.yaml`, a path outside the repository root, or a
 * contract snapshot that fails its lock.
 *
 * Every path argument must resolve, after symlinks, inside the repository root:
 * `--repo-root`, else the nearest directory upward that holds `.git`, else the
 * working directory. That is ADR-0079 D5's rule for pack sources.
 */
import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { readPack } from '../lib/packs/index.mjs';

const USAGE =
  'usage: dockitty-read-pack <dir> [--json] [--charter-lock <file>] [--contract <dir>] [--repo-root <dir>]';

/**
 * A short human summary of a model.
 *
 * @param {import('../lib/packs/read.mjs').PackModel} m
 * @returns {string}
 */
export function summarise(m) {
  const lines = [];
  const level = m.identity.level ? ` ${m.identity.level}` : '';
  lines.push(`${m.identity.name} (${m.dir}) ${m.identity.version || '(no version)'}${level}`);
  lines.push(`  pack_id: ${m.identity.packId || '(none)'}`);
  for (const dep of m.identity.dependsOn) lines.push(`  depends on: ${dep.packId}${dep.range ? ` ${dep.range}` : ''}`);
  lines.push(`  manifest: ${m.manifest ? `${m.manifest.verified ? 'verified' : 'unverified'} ${m.manifest.hash}` : 'absent'}`);
  const total = m.inventory.kinds.reduce((n, k) => n + k.ids.length, 0);
  lines.push(`  inventory (from ${m.inventory.source}): ${total} artefact(s)`);
  for (const k of m.inventory.kinds) lines.push(`    ${k.kind}: ${k.ids.length}`);
  if (m.presets.length > 0) lines.push(`  presets: ${m.presets.map((p) => p.name).join(', ')}`);
  lines.push(`  contract: read with ${m.contract.readWith}${m.contract.provenAgainst ? `, proven against ${m.contract.provenAgainst}` : ''}`);
  for (const p of m.problems) lines.push(`warning [${p.code}]${p.file ? ` ${p.file}` : ''}: ${p.message}`);
  lines.push(`${m.problems.length} warning(s)`);
  return `${lines.join('\n')}\n`;
}

/**
 * The repository root: the nearest directory at or above `start` that holds a
 * `.git` entry, else `start`.
 *
 * @param {string} start absolute
 */
export function findRepoRoot(start) {
  for (let dir = start; ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, '.git'))) return dir;
    if (path.dirname(dir) === dir) return start;
  }
}

/**
 * A path argument resolved inside `root` (after symlinks), else undefined.
 *
 * @param {string} root real, absolute
 * @param {string} arg
 */
function insideRoot(root, arg) {
  const abs = path.resolve(arg);
  let real;
  try {
    real = realpathSync(abs);
  } catch {
    // A path that does not exist yet (a charter lock the reader will warn
    // about) is checked as written.
    real = abs;
  }
  return real === root || real.startsWith(root + path.sep) ? real : undefined;
}

/**
 * @param {string[]} argv
 * @returns {number} the exit code
 */
export function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        json: { type: 'boolean', default: false },
        'charter-lock': { type: 'string' },
        contract: { type: 'string' },
        'repo-root': { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (error) {
    process.stderr.write(`${/** @type {Error} */ (error).message}\n${USAGE}\n`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (positionals.length !== 1) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const root = realpathSync(values['repo-root'] ? path.resolve(values['repo-root']) : findRepoRoot(process.cwd()));
  /** @type {Record<string, string | undefined>} */
  const paths = {};
  for (const [name, arg] of /** @type {[string, string | undefined][]} */ ([
    ['dir', positionals[0]],
    ['charter-lock', values['charter-lock']],
    ['contract', values.contract],
  ])) {
    if (arg === undefined) continue;
    const resolved = insideRoot(root, arg);
    if (resolved === undefined) {
      process.stderr.write(`[dk-packs] ${arg} is outside the repository root ${root}; pass --repo-root to widen it\n`);
      return 2;
    }
    paths[name] = resolved;
  }
  const dir = /** @type {string} */ (paths.dir);
  if (!existsSync(dir) || !statSync(dir).isDirectory() || !existsSync(path.join(dir, 'pack.yaml'))) {
    process.stderr.write(`[dk-packs] ${positionals[0]} is not a pack directory (no pack.yaml)\n`);
    return 2;
  }
  let model;
  try {
    model = readPack(dir, { charterLock: paths['charter-lock'], contract: paths.contract, repoRoot: root });
  } catch (error) {
    process.stderr.write(`${/** @type {Error} */ (error).message}\n`);
    return 2;
  }
  process.stdout.write(values.json ? `${JSON.stringify(model, null, 2)}\n` : summarise(model));
  return 0;
}

// CLI guard: compare against the REAL path of argv[1], since a pnpm or
// node_modules/.bin symlink keeps the link path in argv[1] (as the other bins do).
/** @returns {boolean} */
function invokedDirectly() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  process.exitCode = main(process.argv.slice(2));
}
