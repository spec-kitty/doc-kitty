/**
 * The `packs` integration option (#330, ADR-0079 D2, D5). This slice accepts the
 * two contract-pinning keys only; the pack pages of #338 add `sources`,
 * `section`, `include`, `exclude`, `sourceUrlPrefix`, `extraFacts` and
 * `allowEmpty`.
 *
 *   - `charterLock`: the consumer's pin file, a YAML file whose `commit` key holds
 *     the charter commit its packs are proven against (open-packs'
 *     `charter.lock.yaml`). The reader compares it with the contract snapshot's
 *     commit; a mismatch warns, and the model records both. The file need not
 *     exist at config time: a missing one is a reader warning.
 *   - `contract`: another snapshot directory in the vendored layout, with its own
 *     `contract.lock.json`, so a site can read with a newer contract without
 *     waiting for a doc-kitty release. Its lock is checked here, eagerly.
 *
 * Validated eagerly; an error is build-fatal with the `[dk-packs]` prefix.
 *
 * @module packs/options
 */

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadContract } from './contract.mjs';

export const PACKS_LOG_PREFIX = '[dk-packs]';

const KEYS = Object.freeze(['charterLock', 'contract']);

/**
 * @typedef {{ charterLock?: string, contract?: string }} PacksOptionInput
 * @typedef {{ charterLock?: string, contract?: string }} ResolvedPacksOptions absolute paths
 */

/**
 * @param {unknown} value the `packs` option as the site gives it
 * @param {{ cwd?: string }} [context] the site root relative paths resolve against
 * @returns {ResolvedPacksOptions}
 */
export function resolvePacksOptions(value, { cwd = process.cwd() } = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${PACKS_LOG_PREFIX} the packs option must be an object`);
  }
  const input = /** @type {Record<string, unknown>} */ (value);
  for (const key of Object.keys(input)) {
    if (!KEYS.includes(key)) {
      throw new Error(
        `${PACKS_LOG_PREFIX} unknown key ${JSON.stringify(key)} in the packs option; this version accepts ` +
          `${KEYS.join(' and ')} (pack pages and their keys arrive with #338)`,
      );
    }
  }
  /** @type {ResolvedPacksOptions} */
  const resolved = {};
  for (const key of KEYS) {
    const v = input[key];
    if (v === undefined) continue;
    if (typeof v !== 'string' || v.trim() === '') {
      throw new Error(`${PACKS_LOG_PREFIX} packs.${key} must be a non-empty path string; got ${JSON.stringify(v)}`);
    }
    resolved[/** @type {'charterLock' | 'contract'} */ (key)] = path.resolve(cwd, v);
  }
  if (resolved.contract !== undefined) {
    if (!existsSync(resolved.contract) || !statSync(resolved.contract).isDirectory()) {
      throw new Error(`${PACKS_LOG_PREFIX} packs.contract ${resolved.contract} is not a directory`);
    }
    loadContract(resolved.contract);
  }
  return resolved;
}
