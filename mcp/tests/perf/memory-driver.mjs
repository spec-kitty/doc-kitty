#!/usr/bin/env node
/**
 * NFR-002 memory probe driver (T023), run by nfr-memory.test.ts as:
 *
 *   node --expose-gc mcp/tests/perf/memory-driver.mjs <corpus-dir>
 *
 * Loads the corpus through the SHIPPED fs adapter + snapshot loader (dist/),
 * bracketing the load with forced GCs so the reported delta is the retained
 * snapshot, not allocator noise. Prints ONE JSON line on stdout:
 *
 *   { pages, rssBeforeBytes, rssAfterBytes, deltaBytes, perPageBytes }
 *
 * This file is a probe, not a test: vitest never collects it (not a
 * *.test.* name), and nfr-memory.test.ts owns the assertions.
 */
import { loadSnapshot } from '../../dist/corpus/snapshot.js';
import { FsCorpusSource } from '../../dist/corpus/fs-source.js';

const dir = process.argv[2];
if (dir === undefined) {
  process.stderr.write('usage: memory-driver.mjs <corpus-dir>\n');
  process.exit(64);
}

global.gc();
const rssBefore = process.memoryUsage().rss;
const snapshot = await loadSnapshot(new FsCorpusSource(dir));
global.gc();
const rssAfter = process.memoryUsage().rss;

const pages = snapshot.pages.length;
const report = {
  pages,
  siteTitle: snapshot.siteTitle,
  rssBeforeBytes: rssBefore,
  rssAfterBytes: rssAfter,
  deltaBytes: rssAfter - rssBefore,
  perPageBytes: pages === 0 ? 0 : Math.round((rssAfter - rssBefore) / pages),
};
process.stdout.write(`${JSON.stringify(report)}\n`);
