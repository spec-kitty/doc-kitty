#!/usr/bin/env node
/**
 * Refresh doc-kitty's vendored charter packs contract (#330, ADR-0079 D1):
 *
 *   pnpm packs:sync-contract --ref <tag|sha> [--from <charter checkout>] [--to <snapshot dir>]
 *
 * `--ref` is a tag or a full 40-character commit, never a branch, `HEAD` or a
 * short sha: the lock records provenance, so it must name the same code
 * tomorrow. `--commit <sha>` is the same as `--ref <sha>`; give one of the two.
 * Without `--from`, the script fetches spec-kitty-charter shallow at the ref
 * into a temporary directory. It copies
 * the files the snapshot's current `contract.lock.json` lists (or the default
 * set when there is no lock) from `contracts/packs/` at the resolved commit,
 * byte for byte, and rewrites the lock with the commit, the tag (when `--ref`
 * named one) and a sha256 per file. All files are read before any is written, so
 * a ref that lacks a locked file changes nothing. A maintainer tool: never run at build time.
 * After a refresh, run the conformance tests (`src/tests/packs-classify.test.ts`).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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

const USAGE =
  'usage: packs-sync-contract (--ref <tag|sha> | --commit <sha>) [--from <charter checkout>] [--to <snapshot dir>]';

/** @param {string} ref */
const isFullSha = (ref) => /^[0-9a-f]{40}$/.test(ref);

/**
 * A plain tag name: no revision syntax (`~`, `^`, `:`, `@{`, `..`), so
 * `refs/tags/<ref>` names exactly one ref and never a commit relative to it.
 *
 * @param {string} ref
 */
const isPlainTagName = (ref) => /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref) && !ref.includes('..') && !ref.endsWith('.lock');

/** @param {string} ref @param {string} where */
const notPinnable = (ref, where) =>
  new Error(`packs-sync-contract: ${ref} is not a tag or a full 40-character commit in ${where}; a branch, HEAD or a short sha cannot pin the contract`);

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
  try {
    git(dir, ['init', '-q']);
    // A tag is fetched as a tag, so a branch of the same name is never taken for it.
    if (!isFullSha(ref) && !isPlainTagName(ref)) throw new Error('not a plain tag name');
    const refspec = isFullSha(ref) ? ref : `refs/tags/${ref}:refs/tags/${ref}`;
    git(dir, ['fetch', '-q', '--depth', '1', CHARTER_REPOSITORY, refspec]);
  } catch {
    rmSync(dir, { recursive: true, force: true });
    throw notPinnable(ref, CHARTER_REPOSITORY);
  }
  return dir;
}

/**
 * The commit a pinnable ref names: a full sha the checkout holds, or a tag.
 *
 * @param {string} checkout
 * @param {string} ref
 * @returns {{ commit: string, tag?: string }}
 */
function resolvePinnable(checkout, ref) {
  try {
    if (isFullSha(ref)) return { commit: git(checkout, ['rev-parse', '--verify', `${ref}^{commit}`]).toString().trim() };
    if (!isPlainTagName(ref)) throw new Error('not a plain tag name');
    // The tag must exist as a ref of its own; only then is it peeled to its commit.
    git(checkout, ['show-ref', '--verify', '--quiet', `refs/tags/${ref}`]);
    return { commit: git(checkout, ['rev-parse', '--verify', `refs/tags/${ref}^{commit}`]).toString().trim(), tag: ref };
  } catch {
    throw notPinnable(ref, checkout);
  }
}

/**
 * @param {{ ref: string, from?: string, to?: string, log?: (line: string) => void }} options
 * @returns {{ commit: string, tag?: string, files: Record<string, string> }}
 */
export function syncContract({ ref, from, to = VENDORED_CONTRACT_DIR, log = (l) => process.stdout.write(`${l}\n`) }) {
  const checkout = from ?? cloneCharter(ref);
  try {
    const { commit, tag } = resolvePinnable(checkout, ref);
    const lockFile = path.join(to, CONTRACT_LOCK_FILE);
    const previous = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, 'utf8')) : undefined;
    const list = previous?.files ? Object.keys(previous.files).sort() : [...DEFAULT_SNAPSHOT_FILES];
    /** @type {Map<string, Buffer>} */
    const contents = new Map();
    for (const file of list) {
      try {
        contents.set(file, git(checkout, ['show', `${commit}:${CONTRACT_PATH}/${file}`]));
      } catch {
        throw new Error(`packs-sync-contract: ${CONTRACT_PATH}/${file} is not in ${ref} (${commit}); nothing was written`);
      }
    }
    /** @type {Record<string, string>} */
    const files = {};
    for (const [file, bytes] of contents) {
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
  if (values.ref !== undefined && values.commit !== undefined) {
    process.stderr.write(`give either --ref or --commit, not both\n${USAGE}\n`);
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

// CLI guard: compare against the REAL path of argv[1], as the other scripts do
// (a symlinked checkout or node_modules/.bin keeps the link path in argv[1]).
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
