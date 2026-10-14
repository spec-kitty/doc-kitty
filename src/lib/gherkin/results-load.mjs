/**
 * Read the configured Cucumber report (`gherkin.results`, ADR-0052) from disk,
 * once per version of the file.
 *
 * The integration reads it in `astro:config:setup` (a missing report is a
 * warning, an unreadable one fails the build there), and the in-page stage and
 * the scenario index read it again at render time, so a report that changes
 * under a running dev server is picked up. Every reader goes through
 * {@link loadReport}, which memoises the parsed report on `(real path, mtime,
 * size)` the way `include.mjs` memoises an included file, so a build parses the
 * report once however many pages show results.
 *
 * The index each reader needs (`reportIndex`) is memoised with the report, per
 * `root`.
 *
 * NOT PURE: reads the filesystem. Imports `node:fs`, `node:path` and the pure
 * `./results.mjs`.
 *
 * @module gherkin/results-load
 */

import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { MAX_REPORT_BYTES, parseReport, reportIndex } from './results.mjs';
import { GHERKIN_LOG_PREFIX } from './text.mjs';

/** @typedef {import('./results.mjs').ResultReport} ResultReport */

/**
 * @typedef {object} ResultsOption The normalised `gherkin.results` option.
 * @property {string} report Project-root-relative POSIX path of the report.
 * @property {string} root Project-root-relative POSIX directory Cucumber ran in.
 */

/**
 * @typedef {{
 *   ok: true,
 *   report: ResultReport,
 *   index: ReturnType<typeof reportIndex>,
 *   absPath: string,
 * } | { ok: false, reason: 'missing' }} LoadedReport
 */

/**
 * real path → the report as last parsed, with the stat it was read at and its
 * index per `root`.
 *
 * @type {Map<string, { mtimeMs: number, size: number, report: ResultReport, indexes: Map<string, ReturnType<typeof reportIndex>> }>}
 */
const memo = new Map();

/** Empty the memo (tests). */
export function clearReportMemo() {
  memo.clear();
}

/**
 * Load and parse the report named by `results`, resolved against `projectRoot`.
 * Returns `{ ok: false, reason: 'missing' }` when there is no file there.
 * THROWS one `[dk-gherkin]` Error when the path is not a regular file, is larger
 * than `MAX_REPORT_BYTES`, or is not a Cucumber report.
 *
 * @param {ResultsOption} results
 * @param {{ projectRoot: string }} options
 * @returns {LoadedReport}
 */
export function loadReport(results, { projectRoot }) {
  const absPath = path.resolve(projectRoot, results.report);
  let realPath;
  try {
    realPath = realpathSync(absPath);
  } catch {
    memo.delete(absPath);
    return { ok: false, reason: 'missing' };
  }
  const stat = statSync(realPath);
  if (!stat.isFile()) throw new Error(`${GHERKIN_LOG_PREFIX} gherkin.results report ${results.report} is not a file`);
  if (stat.size > MAX_REPORT_BYTES) {
    throw new Error(
      `${GHERKIN_LOG_PREFIX} gherkin.results report ${results.report} is larger than ` +
        `${MAX_REPORT_BYTES / 1024 / 1024} MiB, the report limit`,
    );
  }
  let entry = memo.get(realPath);
  if (!entry || entry.mtimeMs !== stat.mtimeMs || entry.size !== stat.size) {
    const report = parseReport(readFileSync(realPath, 'utf8'), { display: results.report });
    entry = { mtimeMs: stat.mtimeMs, size: stat.size, report, indexes: new Map() };
    memo.set(realPath, entry);
  }
  let index = entry.indexes.get(results.root);
  if (!index) {
    index = reportIndex(entry.report, { root: results.root, projectRoot });
    entry.indexes.set(results.root, index);
  }
  return { ok: true, report: entry.report, index, absPath };
}
