/**
 * The OKF export carries the evidence index (WP04, #401, FR-011): when a build
 * produced `api/tom-annex.json`, the bundle holds it byte for byte as
 * `tom-annex.json` and the root index links it with its label. A site without
 * the index gets the bundle it always got (FR-012).
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { exportOkfBundle } from '../lib/okf-export/core.mjs';
import { checkOkfBundle, checkOkfBundleReport } from '../lib/okf-export/conformance.mjs';
import { TOM_ANNEX_LABEL, buildTomAnnex, serializeTomAnnex } from '../lib/tom-annex/core.mjs';
import { readTree } from './helpers/read-tree.js';

const FIX = path.join(import.meta.dirname, 'fixtures', 'okf-export-measures');
const graph = JSON.parse(readFileSync(path.join(FIX, 'graph.json'), 'utf8'));
const sources = readTree(path.join(FIX, 'docs'));

const bundleOf = (options: Record<string, unknown> = {}) => exportOkfBundle(graph, sources, options) as Map<string, string>;
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** A real evidence index for the fixture graph, through the core (as the route serialises it). */
const ANNEX = serializeTomAnnex(
  buildTomAnnex(
    graph,
    {
      records: graph.nodes
        .filter((n: { id: string }) => n.id.startsWith('catalog:measure:'))
        .map((n: { id: string; title: string; measure: { nature: string; frameworks: unknown[] } }) => ({
          id: n.id.slice('catalog:measure:'.length),
          label: n.title,
          nature: n.measure.nature,
          frameworks: n.measure.frameworks,
        })),
      source: 'test catalog',
      isDefault: false,
    } as never,
    { site: new URL('https://docs.example.org'), base: '/' },
  ),
);

describe('no evidence index: the bundle is unchanged (WP04 T020, ratchet)', () => {
  it('matches the bundle bytes captured before the change', () => {
    const bundle = bundleOf();
    expect(bundle.has('tom-annex.json')).toBe(false);
    expect(sha256(JSON.stringify([...bundle]))).toBe(RATCHET_SHA256);
  });
});

/** sha256 of the fixture bundle (no tomAnnex option) on the pre-WP04 code. */
const RATCHET_SHA256 = '29d76da950351b0776b22cba4b50d3ccf130af0f7c1fc75a457fc0cdba75c52d';

describe('the bundle carries the evidence index (WP04 T017, T018)', () => {
  it('writes tom-annex.json with exactly the bytes it was given', () => {
    expect(bundleOf({ tomAnnex: ANNEX }).get('tom-annex.json')).toBe(ANNEX);
  });

  it('links it from the root index with its label', () => {
    const root = bundleOf({ tomAnnex: ANNEX }).get('index.md') as string;
    const line = root.split('\n').find((l) => l.includes('tom-annex.json'));
    expect(line).toBeDefined();
    expect(line).toContain(TOM_ANNEX_LABEL);
    expect(bundleOf().get('index.md')).not.toContain('tom-annex.json');
  });

  it('changes exactly two entries: the new file and the root index (same fixture)', () => {
    const before = bundleOf();
    const after = bundleOf({ tomAnnex: ANNEX });
    const changed = [...new Set([...before.keys(), ...after.keys()])].filter((k) => before.get(k) !== after.get(k));
    expect(changed.sort()).toEqual(['index.md', 'tom-annex.json']);
  });

  it('still passes OKF conformance with the index', () => {
    expect(checkOkfBundle(bundleOf({ tomAnnex: ANNEX }))).toEqual([]);
  });

  it('refuses text that is not an evidence index, naming the problem', () => {
    expect(() => bundleOf({ tomAnnex: '{ not json' })).toThrow(/\[dk-okf\].*tom-annex/);
    expect(() => bundleOf({ tomAnnex: JSON.stringify({ format: 'something/else' }) })).toThrow(/\[dk-okf\].*doc-kitty\/tom-annex/);
  });
});

describe('the export CLI picks the index up from the build (WP04 T019)', () => {
  const temps: string[] = [];
  afterAll(() => {
    for (const t of temps) rmSync(t, { recursive: true, force: true });
  });
  const bin = path.join(import.meta.dirname, '..', 'scripts', 'export-okf.mjs');

  function exportFrom(withAnnex: boolean) {
    const root = mkdtempSync(path.join(tmpdir(), 'dk-okf-annex-'));
    temps.push(root);
    const dist = path.join(root, 'dist');
    mkdirSync(path.join(dist, 'api'), { recursive: true });
    writeFileSync(path.join(dist, 'api', 'content-graph.json'), JSON.stringify(graph));
    if (withAnnex) writeFileSync(path.join(dist, 'api', 'tom-annex.json'), ANNEX);
    cpSync(path.join(FIX, 'docs'), path.join(root, 'docs'), { recursive: true });
    const out = path.join(root, 'okf');
    const run = spawnSync(process.execPath, [bin, '--dist', dist, '--docs', path.join(root, 'docs'), '--out', out], {
      encoding: 'utf8',
    });
    return { run, out };
  }

  it('copies dist/api/tom-annex.json into the bundle, and the checker raises nothing about it', () => {
    const { run, out } = exportFrom(true);
    expect(run.status, run.stderr).toBe(0);
    expect(readFileSync(path.join(out, 'tom-annex.json'), 'utf8')).toBe(ANNEX);
    expect(run.stderr).not.toMatch(/tom-annex/);
    const { errors, warnings } = checkOkfBundleReport(out);
    expect(errors).toEqual([]);
    expect(warnings.filter((w: { message: string }) => w.message.includes('tom-annex'))).toEqual([]);
  });

  it('writes no index and does not fail when the build produced none (positive control above)', () => {
    const { run, out } = exportFrom(false);
    expect(run.status, run.stderr).toBe(0);
    expect(existsSync(path.join(out, 'tom-annex.json'))).toBe(false);
  });
});
