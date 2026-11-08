/**
 * NFR-002 memory evidence (T023): resident memory under 512 MB while serving
 * a 10,000-page corpus snapshot, verified the way the requirement pins it -
 * measure per-page snapshot cost at example scale, extrapolate in a
 * documented note (mcp/tests/perf/NOTES.md), build no 10k fixture machinery.
 *
 * Measurement rig (why a child process): vitest's own RSS dwarfs the signal
 * and GC timing inside the runner is uncontrolled, so the load runs in a
 * fresh `node --expose-gc` process (memory-driver.mjs) against the SHIPPED
 * dist graph. gc() brackets the load, so the delta is the retained snapshot
 * plus adapter residue, not allocation noise. RSS (not heapUsed) matches the
 * NFR wording ("resident memory").
 *
 * The test asserts the measurement's integrity (page counts, sane per-page
 * band, run-to-run stability) and PRINTS the numbers; the bound arithmetic
 * and the honest reading of it live in NOTES.md. The note, not this
 * assertion, is the NFR-002 record: at the example corpus' heavy ~21 KB/page
 * payload the naive 10k extrapolation lands above 512 MB, which the note
 * must say plainly.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CORPUS_FIXTURES, PERF_DIR, ensureMcpDistBuilt, generateSyntheticCorpus } from './perf-helpers.js';

const MB = 1024 * 1024;
const DRIVER = path.join(PERF_DIR, 'memory-driver.mjs');
/** 70 docs pages + the 3 synthetic OpenAPI version records (WP03). */
const EXAMPLE_PAGES = 73;
const NFR_TARGET_PAGES = 10_000;

interface MemoryReport {
  pages: number;
  siteTitle: string;
  rssBeforeBytes: number;
  rssAfterBytes: number;
  deltaBytes: number;
  perPageBytes: number;
}

function probe(corpusDir: string): MemoryReport {
  const out = execFileSync(process.execPath, ['--expose-gc', DRIVER, corpusDir], { encoding: 'utf8' });
  return JSON.parse(out.trim()) as MemoryReport;
}

let workDir: string | undefined;

beforeAll(() => {
  ensureMcpDistBuilt();
}, 120_000);

afterAll(() => {
  if (workDir !== undefined) rmSync(workDir, { recursive: true, force: true });
});

describe('NFR-002 per-page snapshot cost at example scale', () => {
  it('measures retained RSS delta over the 73-page example corpus, reproducibly', () => {
    const exampleDir = path.join(CORPUS_FIXTURES, 'example');
    const first = probe(exampleDir);
    const second = probe(exampleDir);

    // Integrity: the driver really loaded the example corpus, twice.
    expect(first.pages).toBe(EXAMPLE_PAGES);
    expect(second.pages).toBe(EXAMPLE_PAGES);

    // Sanity band: a zero/negative delta means the probe saw nothing; a
    // multi-MB per-page delta means the probe measured the wrong thing.
    expect(first.perPageBytes).toBeGreaterThan(1_000);
    expect(first.perPageBytes).toBeLessThan(2 * MB);
    // Stability: two cold processes agree within 25% (observed: ~1%, each
    // ~134 KB/page); wider drift would make the extrapolation in NOTES.md
    // meaningless.
    expect(Math.abs(first.perPageBytes - second.perPageBytes)).toBeLessThan(0.25 * first.perPageBytes);

    const extrapolatedMb = (first.perPageBytes * NFR_TARGET_PAGES) / MB;
    console.log(
      `[wp08-nfr] memory: delta ${(first.deltaBytes / MB).toFixed(1)} MB over ${first.pages} example pages ` +
        `(${Math.round(first.perPageBytes / 1024)} KB/page retained); naive 10k extrapolation ` +
        `${Math.round(extrapolatedMb)} MB (NFR-002 bound 512 MB) - see mcp/tests/perf/NOTES.md`,
    );
  }, 120_000);

  it('measures the same cost on a light synthetic corpus (second model point)', () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'wp08-mem-'));
    const lightDir = path.join(workDir, 'light-500');
    generateSyntheticCorpus(lightDir, 500);
    const light = probe(lightDir);
    expect(light.pages).toBe(500);
    // The light corpus has ~0.7 KB pages: per-page retained cost drops to
    // payload-independent overhead, evidencing the bytes-driven model the
    // note extrapolates with.
    console.log(
      `[wp08-nfr] memory (light synthetic): ${Math.round(light.perPageBytes / 1024)} KB/page retained over ` +
        `${light.pages} small pages; naive 10k extrapolation ${Math.round((light.perPageBytes * NFR_TARGET_PAGES) / MB)} MB`,
    );
    expect(light.perPageBytes).toBeGreaterThan(1_000);
    expect(light.perPageBytes).toBeLessThan(2 * MB);
  }, 120_000);
});
