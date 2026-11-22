#!/usr/bin/env node
/**
 * Refresh doc-kitty's vendored charter packs contract (#330, ADR-0079 D1):
 *
 *   pnpm packs:sync-contract --ref <tag|sha> [--from <charter checkout>] [--to <snapshot dir>]
 *
 * `--commit <sha>` is an alias of `--ref`. Without `--from`, the script clones
 * spec-kitty-charter shallow at the ref into a temporary directory. It copies
 * the files the snapshot's current `contract.lock.json` lists (or the default
 * set when there is no lock) from `contracts/packs/` at the resolved commit,
 * byte for byte, and rewrites the lock with the commit, the tag (when `--ref`
 * named one) and a sha256 per file. A maintainer tool: never run at build time.
 * After a refresh, run the conformance tests (`src/tests/packs-classify.test.ts`).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { CONTRACT_LOCK_FILE, VENDORED_CONTRACT_DIR } from '../lib/packs/contract.mjs';

export const CHARTER_REPOSITORY = 'https://github.com/spec-kitty/spec-kitty-charter';
const CONTRACT_PATH = 'contracts/packs';

/** The files a snapshot holds when it has no lock yet. */
export const DEFAULT_SNAPSHOT_FILES = Object.freeze([
  'conformance/classifier-cases.yaml',
  'file-kinds.yaml',
  'schemas/pack-descriptor.schema.json',
  'schemas/pack-document.schema.json',
  'schemas/pack-manifest.schema.json',
  'schemas/policy.schema.json',
  'schemas/preset.schema.json',
]);

const USAGE = 'usage: packs-sync-contract --ref <tag|sha> [--from <charter checkout>] [--to <snapshot dir>]';

/**
 * @param {string} cwd
 * @param {string[]} args
 * @returns {Buffer}
 */
const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * Clone the charter shallow at `ref` into a temporary directory.
 *
 * @param {string} ref
 * @returns {string}
 */
function cloneCharter(ref) {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-charter-'));
  git(dir, ['init', '-q']);
  git(dir, ['fetch', '-q', '--depth', '1', CHARTER_REPOSITORY, ref]);
  git(dir, ['update-ref', 'refs/dk-sync', 'FETCH_HEAD']);
  if (!/^[0-9a-f]{40}$/.test(ref)) git(dir, ['update-ref', `refs/tags/${ref}`, 'FETCH_HEAD']);
  return dir;
}

/**
 * @param {{ ref: string, from?: string, to?: string, log?: (line: string) => void }} options
 * @returns {{ commit: string, tag?: string, files: Record<string, string> }}
 */
export function syncContract({ ref, from, to = VENDORED_CONTRACT_DIR, log = (l) => process.stdout.write(`${l}\n`) }) {
  const checkout = from ?? cloneCharter(ref);
  try {
    let commit;
    try {
      commit = git(checkout, ['rev-parse', '--verify', `${ref}^{commit}`]).toString().trim();
    } catch {
      throw new Error(`packs-sync-contract: ${checkout} has no commit for ref ${ref}`);
    }
    const lockFile = path.join(to, CONTRACT_LOCK_FILE);
    const previous = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, 'utf8')) : undefined;
    const list = previous?.files ? Object.keys(previous.files).sort() : [...DEFAULT_SNAPSHOT_FILES];
    /** @type {Record<string, string>} */
    const files = {};
    for (const file of list) {
      const bytes = git(checkout, ['show', `${commit}:${CONTRACT_PATH}/${file}`]);
      const hash = createHash('sha256').update(bytes).digest('hex');
      const target = path.join(to, file);
      const same = existsSync(target) && readFileSync(target).equals(bytes);
      if (!same) {
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, bytes);
      }
      files[file] = hash;
      log(`${same ? 'unchanged' : 'updated  '} ${file}`);
    }
    const tag = ref === commit ? undefined : ref;
    const lock = {
      commit,
      contractPath: CONTRACT_PATH,
      files,
      source: CHARTER_REPOSITORY,
      ...(tag === undefined ? {} : { tag }),
    };
    writeFileSync(lockFile, `${JSON.stringify(lock, null, 2)}\n`);
    log(`locked ${CONTRACT_PATH} at ${commit}${tag ? ` (${tag})` : ''}; run the conformance tests next`);
    return { commit, tag, files };
  } finally {
    if (from === undefined) rmSync(checkout, { recursive: true, force: true });
  }
}

/** @param {string[]} argv */
export function main(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { ref: { type: 'string' }, commit: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } },
    }));
  } catch (error) {
    process.stderr.write(`${/** @type {Error} */ (error).message}\n${USAGE}\n`);
    return 2;
  }
  const ref = values.ref ?? values.commit;
  if (!ref) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  try {
    syncContract({ ref, from: values.from && path.resolve(values.from), to: values.to && path.resolve(values.to) });
    return 0;
  } catch (error) {
    process.stderr.write(`${/** @type {Error} */ (error).message}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
