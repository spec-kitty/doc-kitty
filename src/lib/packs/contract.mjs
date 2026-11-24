/**
 * The charter's packs contract, as doc-kitty vendors it (#330, ADR-0079 D1, D2).
 *
 * `./contract/` is a byte-exact snapshot of spec-kitty-charter's
 * `contracts/packs/` at a packs-contract release: `file-kinds.yaml`, the schemas
 * the pack reader interprets, and the classifier conformance cases. Its
 * `contract.lock.json` records the source, the tag, the charter commit and a
 * sha256 per file. The directory holds only locked files: a changed, added or
 * removed file fails `verifyContractLock`, and the unit tests. Refresh it with
 * `pnpm packs:sync-contract --ref <tag|sha>`, never by hand.
 *
 * A consumer may point `packs.contract` at another snapshot directory in the
 * same layout (D2). It is verified the same way when it is loaded.
 *
 * This module never fetches anything. Loading throws only for a broken
 * snapshot (a configuration error); everything the reader finds in a pack is a
 * warning, never a throw.
 *
 * @module packs/contract
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

/** The snapshot shipped with doc-kitty. */
export const VENDORED_CONTRACT_DIR = fileURLToPath(new URL('./contract/', import.meta.url));

/** The lock file's name inside a snapshot directory. */
export const CONTRACT_LOCK_FILE = 'contract.lock.json';

/** The top-level `file-kinds.yaml` keys this reader knows (any other key warns). */
export const KNOWN_FILE_KINDS_KEYS = Object.freeze([
  'node_kinds',
  'artifact_kinds',
  'fragment_kinds',
  'files',
  'exclusions',
  'retired',
  'payloads',
  'ignored',
]);

/** The rule sections of `file-kinds.yaml`, in the order the classifier consults them. */
const RULE_SECTIONS = Object.freeze(['files', 'exclusions', 'retired', 'payloads', 'ignored']);

/** The content forms this reader knows (any other warns, and the rule is kept). */
export const KNOWN_CONTENT_FORMS = Object.freeze(['yaml', 'markdown', 'text', 'bytes']);

const PREFIX = '[dk-packs]';

/**
 * @typedef {object} ContractLock
 * @property {string} source
 * @property {string} contractPath
 * @property {string} [tag]
 * @property {string} commit
 * @property {Record<string, string>} files POSIX path (snapshot-relative) -> sha256 hex
 */

/**
 * @typedef {object} LoadedContract
 * @property {string} dir absolute snapshot directory
 * @property {ContractLock} lock
 * @property {Record<string, any>} fileKinds the parsed `file-kinds.yaml`
 * @property {Record<string, any>} schemas parsed `schemas/<name>.schema.json`, keyed by `<name>`
 * @property {{ code: string, message: string }[]} warnings
 */

/** Code-unit order: deterministic, independent of the locale. @param {string} a @param {string} b */
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** @param {Buffer} bytes */
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * Snapshot-relative POSIX paths of every file under `dir`, the lock excepted, and
 * of every symlink (never followed: a snapshot holds only real files).
 *
 * @param {string} dir
 * @returns {{ files: string[], symlinks: string[] }}
 */
function snapshotFiles(dir) {
  /** @type {string[]} */
  const files = [];
  /** @type {string[]} */
  const symlinks = [];
  /** @param {string} sub */
  const walk = (sub) => {
    for (const entry of readdirSync(path.join(dir, sub), { withFileTypes: true })) {
      const rel = sub === '' ? entry.name : `${sub}/${entry.name}`;
      if (entry.isSymbolicLink()) symlinks.push(rel);
      else if (entry.isDirectory()) walk(rel);
      else files.push(rel);
    }
  };
  walk('');
  return { files: files.filter((f) => f !== CONTRACT_LOCK_FILE).sort(byCodeUnit), symlinks: symlinks.sort(byCodeUnit) };
}

/**
 * Why a lock key is not a safe snapshot path, or `undefined` when it is (#423).
 *
 * A key names a file inside the snapshot directory, so it must be a relative
 * POSIX path of plain segments: no leading `/`, no backslash, no empty, `.` or
 * `..` segment, no NUL, no colon, and never the lock itself in any case. A key that passes cannot
 * resolve outside the snapshot, whatever directory the snapshot sits in.
 *
 * @param {unknown} key
 * @returns {string | undefined}
 */
export function lockKeyProblem(key) {
  const shown = JSON.stringify(key);
  /** @param {string} why */
  const unsafe = (why) => `${CONTRACT_LOCK_FILE} key ${shown} is not a safe snapshot path (${why})`;
  if (typeof key !== 'string' || key === '') return unsafe('it is empty');
  if (key.includes('\\')) return unsafe('it holds a backslash');
  if (key.includes('\0')) return unsafe('it holds a NUL');
  if (key.startsWith('/') || path.win32.isAbsolute(key)) return unsafe('it is absolute');
  // A colon makes `C:x` drive-relative and `x:stream` an alternate data stream on Windows.
  if (key.includes(':')) return unsafe('it holds a colon');
  const segments = key.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) return unsafe('it has an empty, `.` or `..` segment');
  // Compared case-insensitively: on macOS and Windows a case variant is the lock's own file.
  if (key.toLowerCase() === CONTRACT_LOCK_FILE) return unsafe('it names the lock itself');
  return undefined;
}

/**
 * Read and shape-check a snapshot's lock.
 *
 * @param {string} dir
 * @returns {{ lock?: ContractLock, problem?: string }}
 */
function readLock(dir) {
  const file = path.join(dir, CONTRACT_LOCK_FILE);
  if (!existsSync(file)) return { problem: `${CONTRACT_LOCK_FILE} is missing` };
  let lock;
  try {
    lock = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { problem: `${CONTRACT_LOCK_FILE} does not parse: ${/** @type {Error} */ (error).message}` };
  }
  if (lock === null || typeof lock !== 'object' || typeof lock.commit !== 'string' || !/^[0-9a-f]{40}$/.test(lock.commit)) {
    return { problem: `${CONTRACT_LOCK_FILE} has no 40-character lower-hex \`commit\`` };
  }
  if (lock.files === null || typeof lock.files !== 'object' || Array.isArray(lock.files)) {
    return { problem: `${CONTRACT_LOCK_FILE} has no \`files\` map` };
  }
  for (const key of Object.keys(lock.files).sort(byCodeUnit)) {
    const unsafe = lockKeyProblem(key);
    if (unsafe) return { problem: unsafe };
  }
  return { lock };
}

/**
 * Check a snapshot against its lock: every locked file present with its sha256,
 * and no file the lock does not list.
 *
 * @param {string} dir
 * @returns {string[]} one message per problem; empty when the lock holds
 */
export function verifyContractLock(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [`${dir} is not a directory`];
  const { lock, problem } = readLock(dir);
  if (problem || !lock) return [/** @type {string} */ (problem)];
  /** @type {string[]} */
  const problems = [];
  const { files, symlinks } = snapshotFiles(dir);
  for (const link of symlinks) problems.push(`${link} is a symlink; a snapshot holds only regular files`);
  const onDisk = new Set(files);
  for (const [file, expected] of Object.entries(lock.files).sort(([a], [b]) => byCodeUnit(a, b))) {
    if (symlinks.includes(file)) continue;
    if (!onDisk.has(file)) {
      problems.push(`${file} is missing (the lock lists it)`);
      continue;
    }
    const actual = sha256(readFileSync(path.join(dir, file)));
    if (actual !== expected) problems.push(`${file} does not match the lock (sha256 ${actual}, locked ${expected})`);
  }
  for (const file of onDisk) {
    if (!Object.hasOwn(lock.files, file)) problems.push(`${file} is not in the lock`);
  }
  return problems;
}

/**
 * Warnings for `file-kinds.yaml` content this reader does not know: a top-level
 * key, or a rule's `content_form`.
 *
 * @param {Record<string, any>} fileKinds
 */
function fileKindsWarnings(fileKinds) {
  /** @type {{ code: string, message: string }[]} */
  const warnings = [];
  for (const key of Object.keys(fileKinds)) {
    if (!KNOWN_FILE_KINDS_KEYS.includes(key)) {
      warnings.push({
        code: 'contract-unknown-key',
        message: `file-kinds.yaml has a top-level key \`${key}\` this reader does not know; it is ignored`,
      });
    }
  }
  for (const section of RULE_SECTIONS) {
    for (const rule of Array.isArray(fileKinds[section]) ? fileKinds[section] : []) {
      const form = rule?.content_form;
      if (form !== undefined && !KNOWN_CONTENT_FORMS.includes(form)) {
        warnings.push({
          code: 'contract-unknown-content-form',
          message: `file-kinds.yaml rule \`${rule.match}\` (${section}) has content_form \`${form}\`, which this reader does not know`,
        });
      }
    }
  }
  return warnings;
}

/** @type {Map<string, LoadedContract>} */
const cache = new Map();

/**
 * Load a snapshot: verify its lock, then parse `file-kinds.yaml` and the schemas.
 * Throws a `[dk-packs]` error for a snapshot whose lock fails or whose
 * `file-kinds.yaml` does not parse. Cached per absolute directory.
 *
 * @param {string} [dir] defaults to the vendored snapshot
 * @returns {LoadedContract}
 */
export function loadContract(dir = VENDORED_CONTRACT_DIR) {
  const abs = path.resolve(dir);
  const cached = cache.get(abs);
  if (cached) return cached;
  const problems = verifyContractLock(abs);
  if (problems.length > 0) {
    throw new Error(`${PREFIX} contract snapshot ${abs} does not match its ${CONTRACT_LOCK_FILE}:\n  - ${problems.join('\n  - ')}`);
  }
  const lock = /** @type {ContractLock} */ (readLock(abs).lock);
  if (!existsSync(path.join(abs, 'file-kinds.yaml'))) {
    throw new Error(`${PREFIX} contract snapshot ${abs}: file-kinds.yaml is missing`);
  }
  let fileKinds;
  try {
    fileKinds = parseYaml(readFileSync(path.join(abs, 'file-kinds.yaml'), 'utf8'));
  } catch (error) {
    throw new Error(`${PREFIX} contract snapshot ${abs}: file-kinds.yaml does not parse: ${/** @type {Error} */ (error).message}`);
  }
  if (fileKinds === null || typeof fileKinds !== 'object') {
    throw new Error(`${PREFIX} contract snapshot ${abs}: file-kinds.yaml is not a mapping`);
  }
  /** @type {Record<string, any>} */
  const schemas = {};
  for (const file of Object.keys(lock.files).sort(byCodeUnit)) {
    const match = /^schemas\/(.+)\.schema\.json$/.exec(file);
    if (!match) continue;
    try {
      schemas[match[1]] = JSON.parse(readFileSync(path.join(abs, file), 'utf8'));
    } catch (error) {
      throw new Error(`${PREFIX} contract snapshot ${abs}: ${file} does not parse: ${/** @type {Error} */ (error).message}`);
    }
  }
  const loaded = Object.freeze({ dir: abs, lock, fileKinds, schemas, warnings: fileKindsWarnings(fileKinds) });
  cache.set(abs, loaded);
  return loaded;
}
