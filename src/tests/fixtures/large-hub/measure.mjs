#!/usr/bin/env node
/**
 * Measure the sidebar child cap (#341, WP04; NFR-004): build a fixture site with a
 * 1,000-child hub capped (the default cap, 50) and uncapped (`sidebar.childCap`
 * above the count), several runs each, and print the median build time and the
 * median and total per-page HTML size. The numbers are recorded in
 * `docs/plans/features/large-hubs.md`.
 *
 *   node src/tests/fixtures/large-hub/measure.mjs [--children 1000] [--runs 3]
 */
import { rmSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { REPO_ROOT, buildSite, builtPages, writeSite } from './site.mjs';

const { values } = parseArgs({
  options: { children: { type: 'string', default: '1000' }, runs: { type: 'string', default: '3' } },
});
const children = Number(values.children);
const runs = Number(values.runs);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const variants = { capped: { missions: children }, uncapped: { missions: children, siteCap: children + 1 } };
const results = {};
for (const [name, options] of Object.entries(variants)) {
  const dir = path.join(REPO_ROOT, 'example', `.dk-test-sidebar-cap-measure-${name}`);
  const seconds = [];
  let sizes = [];
  for (let run = 0; run < runs; run += 1) {
    writeSite(dir, options);
    const result = buildSite(dir);
    if (result.status !== 0) throw new Error(`${name} build failed:\n${result.output.slice(-3000)}`);
    seconds.push(result.seconds);
    sizes = [...builtPages(path.join(dir, 'dist')).values()].map((html) => Buffer.byteLength(html));
  }
  rmSync(dir, { recursive: true, force: true });
  results[name] = {
    pages: sizes.length,
    buildSecondsMedian: Number(median(seconds).toFixed(1)),
    buildSeconds: seconds.map((s) => Number(s.toFixed(1))),
    pageBytesMedian: median(sizes),
    totalMiB: Number((sizes.reduce((a, b) => a + b, 0) / 2 ** 20).toFixed(1)),
  };
}
console.log(JSON.stringify({ children, runs, node: process.version, results }, null, 2));
