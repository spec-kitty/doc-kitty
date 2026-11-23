#!/usr/bin/env node
/**
 * Export a built DocKitty site as an OKF v0.2 bundle (#178, FR-018).
 *
 * Usage:
 *   dockitty-export-okf [--dist <dir> | --graph <file>] [--docs <dir>] [--out <dir>]
 *                       [--index-basename README[,index]] [--base <path>] [--site-url <url>]
 *   dockitty-export-okf --check [--out <dir>]
 *
 * Export reads the built `<dist>/api/content-graph.json` (default `./dist`) and the
 * docs tree (default `./docs`), empties `--out` (default `./okf-export`) and writes
 * the bundle. The index names come from the site's config next to the docs folder,
 * as for the other bins; `--index-basename` is the fallback when there is none.
 * `--base` and `--site-url` are the site's `base` and `site`; both default to empty. The
 * built graph carries neither (its hrefs are unbased), so they are not inferred; when `--base`
 * is not given and every unresolved link starts with the same segment, a hint suggests it.
 *
 * `--check` only validates the existing bundle in `--out` (OKF §11).
 *
 * Exit codes: 0 ok (advisory link warnings go to stderr), 1 conformance violation,
 * 2 usage or missing input.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { exportOkfToDisk } from '../lib/okf-export/disk.mjs';
import { checkOkfBundleReport } from '../lib/okf-export/conformance.mjs';
import { announceIndexNames, resolveSiteIndexBasenames } from './site-index-names.mjs';

const OPTIONS = {
  dist: { type: 'string' },
  graph: { type: 'string' },
  docs: { type: 'string', default: 'docs' },
  out: { type: 'string', default: 'okf-export' },
  'index-basename': { type: 'string' },
  base: { type: 'string' },
  'site-url': { type: 'string', default: '' },
  check: { type: 'boolean', default: false },
};

/**
 * The one hint for a missing `--base`: when several unresolved internal links all start with
 * the same first segment, that segment is very likely the site's `base`. One stray link is
 * not evidence. Never applied, only suggested; a graph's hrefs carry no base, and guessing
 * would hide real broken links.
 */
function baseHint(warnings) {
  const unresolved = warnings.filter((w) => w.rule === 'unresolved-link');
  const segments = new Set(unresolved.map((w) => /^\/[^/#?\s]+/.exec(w.target)?.[0] ?? ''));
  return unresolved.length >= 2 && segments.size === 1 && !segments.has('') ? [...segments][0] : null;
}

/** Print the advisory warnings and the violations; 1 when there is a violation. */
function report(outDir, { baseGiven = true } = {}) {
  const { errors, warnings } = checkOkfBundleReport(outDir);
  for (const w of warnings) console.error(`warning: ${w.path}: ${w.message}`);
  const hint = baseGiven ? null : baseHint(warnings);
  if (hint) console.error(`hint: every unresolved link starts with ${hint}; if that is the site's base, pass --base ${hint} (and --site-url for absolute links)`);
  for (const v of errors) console.error(`error: ${v.path}: rule ${v.rule}: ${v.message}`);
  return errors.length > 0 ? 1 : 0;
}

/** @returns {number} the exit code */
function run(argv) {
  const { values } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: false });
  const outDir = path.resolve(values.out);
  if (values.check) {
    if (!existsSync(outDir)) throw new Error(`no bundle at ${values.out}; export first`);
    return report(outDir);
  }
  const graphFile = path.resolve(values.graph ?? path.join(values.dist ?? 'dist', 'api', 'content-graph.json'));
  if (!existsSync(graphFile)) {
    throw new Error(`no content graph at ${graphFile}; run the site build first, or pass --dist/--graph`);
  }
  const flag = values['index-basename']?.split(',').filter(Boolean);
  const resolved = resolveSiteIndexBasenames(values.docs, { flag, tool: 'dockitty-export-okf' });
  announceIndexNames(resolved, { log: console.error });
  const bundle = exportOkfToDisk({
    graphFile,
    docsDir: values.docs,
    outDir,
    options: { indexBasename: resolved.names, base: values.base ?? '', siteUrl: values['site-url'] ?? '' },
  });
  console.error(`wrote ${bundle.size} file(s) to ${values.out}`);
  return report(outDir, { baseGiven: values.base !== undefined });
}

try {
  process.exitCode = run(process.argv.slice(2));
} catch (err) {
  console.error(`dockitty-export-okf: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 2;
}
