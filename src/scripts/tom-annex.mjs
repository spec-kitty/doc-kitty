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
 * Every path argument must resolve inside the working directory, comparing
 * real paths (symlinks resolved); otherwise the command exits 2.
 *
 * Exit codes: 0 ok, 1 drift (or a refused target), 2 usage or input error.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { PRODUCER_REGISTRY } from '../lib/producers.mjs';
import { isProducerOwnedPage } from '../lib/producer-output.mjs';
import { TOM_ANNEX_FORMAT } from '../lib/tom-annex/core.mjs';
import { checkHub, checkSnapshot, hubToWrite, isOwnedSnapshot, snapshotToWrite } from '../lib/tom-annex/check.mjs';
import { TOM_ANNEX_PRODUCER } from '../lib/tom-annex/stamp.mjs';
import { resolveInside } from '../lib/tom-annex/paths.mjs';

const TOOL = 'dockitty-tom-annex';
const USAGE = `usage: ${TOOL} --dist <dir> [--snapshot <path>] [--hub <path>] [--check]\n  Run it from the project root: every path must resolve inside the working directory (symlinks resolved), or it exits 2.`;

const OPTIONS = {
  dist: { type: 'string' },
  snapshot: { type: 'string' },
  hub: { type: 'string' },
  check: { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
};

class UsageError extends Error {}

/**
 * A path argument resolved inside the working directory (the project the site
 * builds from), compared as real paths (`paths.mjs`). The command reads and
 * writes only there, so a mistyped or agent-supplied path, or a directory
 * symlink pointing out of the project, cannot reach other files.
 *
 * @param {string} flag
 * @param {string} value
 * @returns {string} the real absolute path
 */
function insideProject(flag, value) {
  const { root, real } = resolveInside(value);
  if (real === undefined) {
    throw new UsageError(`${flag} ${value} is outside the working directory ${root}; run the command from the project root`);
  }
  return real;
}

/** @param {string} file @returns {string | undefined} */
const readIfPresent = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined);

/**
 * Write atomically: a temporary file in the same directory, then a rename over
 * the target. A crash mid-write leaves the old file whole, never a truncated one
 * that would then read as unowned.
 *
 * @param {string} file the absolute path, inside the project
 * @param {string} text
 * @param {string} shown the path as the user wrote it, for the message
 */
function write(file, text, shown) {
  const dir = path.dirname(file);
  mkdirSync(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`);
  try {
    writeFileSync(temp, text);
    renameSync(temp, file);
  } catch (err) {
    rmSync(temp, { force: true });
    throw err;
  }
  console.error(`wrote ${shown}`);
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

  // Guard the file itself too: a `dist/api` symlink must not lead the read out of the project.
  const annexFile = insideProject('--dist', path.join(insideProject('--dist', values.dist), 'api', 'tom-annex.json'));
  const snapshotFile = values.snapshot ? insideProject('--snapshot', values.snapshot) : undefined;
  const hubFile = values.hub ? insideProject('--hub', values.hub) : undefined;
  const hint = PRODUCER_REGISTRY.get(TOM_ANNEX_PRODUCER)?.regenerateHint ?? '';
  const builtText = readIfPresent(annexFile);
  if (builtText === undefined) {
    // An input error in both modes (exit 2): `missing` is a D3 verdict for a committed file, not for the build.
    throw new UsageError(`the build produced no evidence index at ${annexFile} (is \`tomAnnex: true\` set in the site config, and does the site have a published classified page?); the snapshot and the hub page are written from the built index, so build the site first`);
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
      const verdict = checkSnapshot({ committedText: readIfPresent(/** @type {string} */ (snapshotFile)), builtText });
      if (verdict !== 'ok') drift.push([verdict, values.snapshot]);
    }
    if (values.hub) {
      const verdict = checkHub({ committedText: readIfPresent(/** @type {string} */ (hubFile)), builtAnnex: built });
      if (verdict !== 'ok') drift.push([verdict, values.hub]);
    }
    for (const [verdict, file] of drift) console.log(`${TOM_ANNEX_PRODUCER} ${verdict} ${file}`);
    if (drift.length > 0) console.log(`  ${hint}`);
    return drift.length > 0 ? 1 : 0;
  }

  // Write mode: refuse a target that holds anything this producer did not write.
  const refused = [];
  if (values.snapshot) {
    const current = readIfPresent(/** @type {string} */ (snapshotFile));
    if (current !== undefined && !isOwnedSnapshot(safeJson(current))) refused.push(values.snapshot);
  }
  if (values.hub) {
    const current = readIfPresent(/** @type {string} */ (hubFile));
    if (current !== undefined && !isProducerOwnedPage(current, TOM_ANNEX_PRODUCER)) refused.push(values.hub);
  }
  if (refused.length > 0) {
    for (const file of refused) console.error(`${TOOL}: refusing to overwrite ${file}: it is not stamped by ${TOM_ANNEX_PRODUCER} (an authored file?)`);
    return 1;
  }
  // Render first, so an index the hub cannot render (no `at`) writes nothing at all.
  const hubText = hubFile ? hubToWrite(built, readIfPresent(hubFile)) : undefined;
  if (snapshotFile) write(snapshotFile, snapshotToWrite(builtText, readIfPresent(snapshotFile)), values.snapshot);
  if (hubFile && hubText !== undefined) write(hubFile, hubText, values.hub);
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
