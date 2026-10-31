#!/usr/bin/env node
/**
 * generate-legacy-redirects.mjs — write the mechanical `.html` redirect map for
 * a site moving off an `.html`-URL generator (issue #249, ADR-0068).
 *
 * Usage:
 *   node src/scripts/generate-legacy-redirects.mjs <baseline-file>
 *     [--overrides <map.json>] [--out <map.json>]
 *
 * `<baseline-file>` is the committed list of URLs the old site published, one
 * per line (`#` comments and blank lines ignored; an origin is stripped). Each
 * `.html` URL is mapped by rule: `/x.html -> /x/`, `/x/index.html -> /x/`,
 * `/index.html -> /`. `--overrides` is a JSON map for the pages the rule gets
 * wrong (moved or dropped pages); its entries win. URLs that do not end in
 * `.html` are listed on stderr and left out.
 *
 * The output is the JSON the `legacyHtmlRedirects` option of
 * `defineDocKittyIntegrations` takes, sorted, so a re-run gives the same file.
 * Without `--out` it is printed. The baseline itself is never generated: it is
 * what the old site published, captured before the move.
 */
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { mechanicalHtmlMap } from '../lib/legacy-html-redirects.mjs';

export function run(argv) {
  const args = argv.slice(2);
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--overrides' || args[i] === '--out') {
      flags[args[i].slice(2)] = args[i + 1];
      i += 1;
    } else positional.push(args[i]);
  }
  if (positional.length !== 1) {
    console.error('Usage: generate-legacy-redirects.mjs <baseline-file> [--overrides <map.json>] [--out <map.json>]');
    process.exit(2);
    return;
  }
  let urls;
  let overrides = {};
  try {
    urls = readFileSync(positional[0], 'utf8').split('\n');
    if (flags.overrides) overrides = JSON.parse(readFileSync(flags.overrides, 'utf8'));
  } catch (err) {
    console.error(`generate-legacy-redirects: ${err.message}`);
    process.exit(2);
    return;
  }
  const { map, skipped } = mechanicalHtmlMap(urls, overrides);
  if (skipped.length > 0) {
    console.error(`generate-legacy-redirects: ${skipped.length} URL(s) do not end in .html and were left out:`);
    for (const url of skipped) console.error(`  - ${url}`);
  }
  const json = `${JSON.stringify(map, null, 2)}\n`;
  if (flags.out) {
    writeFileSync(flags.out, json);
    console.error(`generate-legacy-redirects: wrote ${Object.keys(map).length} redirect(s) to ${flags.out}`);
  } else {
    process.stdout.write(json);
  }
}

function invokedDirectly() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) run(process.argv);
