#!/usr/bin/env node
/**
 * Write or check the evidence index's opt-in committed files (#401, WP07).
 *
 * Usage:
 *   dockitty-tom-annex --dist <dir> [--snapshot <path>] [--hub <path>] [--check]
 *
 * Reads the BUILT `<dist>/api/tom-annex.json` and nothing else: it evaluates no
 * site config, runs no Astro and no other repository's code (C-003).
 *
 * - `--snapshot <path>` writes the built index's exact bytes (FR-009).
 * - `--hub <path>` writes a Markdown Hub page rendered from it (FR-010).
 * - `--check` writes nothing and reports each named file with an ADR-0087 D3
 *   verdict, one line `doc-kitty-tom-annex <verdict> <path>` per file that is
 *   not `ok`, then the regenerate hint.
 *
 * At least one of `--snapshot` and `--hub` is required. Writing refuses a
 * target that holds anything not stamped by `doc-kitty-tom-annex`.
 *
 * Evidence index, not the contractual annex. Not legal advice.
 *
 * Exit codes: 0 ok, 1 drift (or a refused target), 2 usage or input error.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { PRODUCER_REGISTRY } from '../lib/producers.mjs';
import { isProducerOwnedPage } from '../lib/producer-output.mjs';
import { TOM_ANNEX_FORMAT } from '../lib/tom-annex/core.mjs';
import { checkHub, checkSnapshot, isOwnedSnapshot } from '../lib/tom-annex/check.mjs';
import { renderHubPage } from '../lib/tom-annex/hub-page.mjs';
import { TOM_ANNEX_PRODUCER } from '../lib/tom-annex/stamp.mjs';

const TOOL = 'dockitty-tom-annex';
const USAGE = `usage: ${TOOL} --dist <dir> [--snapshot <path>] [--hub <path>] [--check]`;

const OPTIONS = {
  dist: { type: 'string' },
  snapshot: { type: 'string' },
  hub: { type: 'string' },
  check: { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
};

class UsageError extends Error {}

/** @param {string} file @returns {string | undefined} */
const readIfPresent = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined);

/** @param {string} file @param {string} text */
function write(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
  console.error(`wrote ${file}`);
}

/** @param {string[]} argv @returns {number} the exit code */
function run(argv) {
  /** @type {any} */
  let values;
  try {
    ({ values } = parseArgs({ args: argv, options: /** @type {any} */ (OPTIONS), allowPositionals: false }));
  } catch (err) {
    throw new UsageError(`${err instanceof Error ? err.message : String(err)}\n${USAGE}`);
  }
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (!values.dist) throw new UsageError(`--dist is required\n${USAGE}`);
  if (!values.snapshot && !values.hub) throw new UsageError(`name at least one of --snapshot and --hub\n${USAGE}`);

  const annexFile = path.join(values.dist, 'api', 'tom-annex.json');
  const hint = PRODUCER_REGISTRY.get(TOM_ANNEX_PRODUCER)?.regenerateHint ?? '';
  const builtText = readIfPresent(annexFile);
  if (builtText === undefined) {
    const why = `the build produced no evidence index at ${annexFile} (no published classified pages?)`;
    if (!values.check) throw new UsageError(why);
    console.log(`${TOM_ANNEX_PRODUCER} missing ${annexFile}`);
    console.log(`  ${why}`);
    return 1;
  }
  /** @type {any} */
  let built;
  try {
    built = JSON.parse(builtText);
  } catch {
    throw new UsageError(`${annexFile} is not valid JSON`);
  }
  if (built?.format !== TOM_ANNEX_FORMAT || !built?.generated) {
    throw new UsageError(`${annexFile} is not a stamped ${TOM_ANNEX_FORMAT} index`);
  }

  if (values.check) {
    /** @type {Array<[string, string]>} */
    const drift = [];
    if (values.snapshot) {
      const verdict = checkSnapshot({ committedText: readIfPresent(values.snapshot), builtText });
      if (verdict !== 'ok') drift.push([verdict, values.snapshot]);
    }
    if (values.hub) {
      const verdict = checkHub({ committedText: readIfPresent(values.hub), builtAnnex: built });
      if (verdict !== 'ok') drift.push([verdict, values.hub]);
    }
    for (const [verdict, file] of drift) console.log(`${TOM_ANNEX_PRODUCER} ${verdict} ${file}`);
    if (drift.length > 0) console.log(`  ${hint}`);
    return drift.length > 0 ? 1 : 0;
  }

  // Write mode: refuse a target that holds anything this producer did not write.
  const refused = [];
  if (values.snapshot) {
    const current = readIfPresent(values.snapshot);
    if (current !== undefined && !isOwnedSnapshot(safeJson(current))) refused.push(values.snapshot);
  }
  if (values.hub) {
    const current = readIfPresent(values.hub);
    if (current !== undefined && !isProducerOwnedPage(current, TOM_ANNEX_PRODUCER)) refused.push(values.hub);
  }
  if (refused.length > 0) {
    for (const file of refused) console.error(`${TOOL}: refusing to overwrite ${file}: it is not stamped by ${TOM_ANNEX_PRODUCER} (an authored file?)`);
    return 1;
  }
  // Render first, so an index the hub cannot render (no `at`) writes nothing at all.
  const hubText = values.hub ? renderHubPage(built) : undefined;
  if (values.snapshot) write(values.snapshot, builtText);
  if (values.hub && hubText !== undefined) write(values.hub, hubText);
  return 0;
}

/** @param {string} text */
function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

try {
  process.exitCode = run(process.argv.slice(2));
} catch (err) {
  console.error(`${TOOL}: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 2;
}
