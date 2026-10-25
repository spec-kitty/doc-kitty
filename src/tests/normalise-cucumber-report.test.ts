import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { normaliseCucumberReport } from '../scripts/normalise-cucumber-report.mjs';
import { parseReport } from '../lib/gherkin/results.mjs';

/**
 * #231: the example's Cucumber report regenerates byte-identically on any
 * machine. The normaliser fixes what a run records about its machine and its
 * moment (meta, timestamps, durations, generated ids, the run directory in
 * stack traces), and keeps everything the results overlay reads (ADR-0055).
 */

const REPORT = new URL('../../example/reports/cucumber.ndjson', import.meta.url);
const PROVENANCE = new URL('../../example/reports/PROVENANCE.txt', import.meta.url);
const committed = readFileSync(REPORT, 'utf8');
const AT = /--at (\S+)/.exec(readFileSync(PROVENANCE, 'utf8'))?.[1] ?? '';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

type Envelope = Record<string, Record<string, unknown>>;
const envelopes = (text: string): Envelope[] =>
  text.split('\n').filter(Boolean).map((l) => JSON.parse(l) as Envelope);

/**
 * The committed report as another machine would write it: fresh random ids,
 * another moment, another kernel and Node, and the run in another directory.
 */
function asAnotherRun(text: string, root: string): string {
  const ids = new Map<string, string>();
  const fresh = (id: string): string => {
    if (!ids.has(id)) ids.set(id, randomUUID());
    return ids.get(id) as string;
  };
  return text
    .replace(new RegExp(UUID.source, 'gi'), (id) => fresh(id))
    .replace(/"seconds":\d+/g, (m) => `"seconds":${Number(m.slice(10)) + 86_400 * 37}`)
    .replace(/"nanos":\d+/g, '"nanos":123456789')
    .replace(/"os":\{[^}]*\}/, '"os":{"name":"darwin","version":"24.1.0"}')
    .replace(/"cpu":\{[^}]*\}/, '"cpu":{"name":"arm64"}')
    .replace(/"runtime":\{[^}]*\}/, '"runtime":{"name":"node.js","version":"24.11.0"}')
    .replaceAll('(steps/', `(${root}/steps/`);
}

describe('normalise-cucumber-report (#231)', () => {
  it('PROVENANCE pins the instant the report is normalised to', () => {
    expect(AT).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('the committed example report is already normalised (regeneration-clean)', () => {
    expect(normaliseCucumberReport(committed, { at: AT })).toBe(committed);
  });

  it('records nothing about the machine or the moment of the run', () => {
    expect(committed).not.toMatch(UUID);
    const [{ meta }] = envelopes(committed);
    expect(meta.os).toEqual({ name: 'unspecified' });
    expect(meta.cpu).toEqual({ name: 'unspecified' });
    expect(meta.runtime).toEqual({ name: 'unspecified' });
    expect(meta.implementation).toEqual({ name: 'cucumber-js', version: '13.3.0' });
    expect(committed).not.toMatch(/\/home\/|\/tmp\/|[A-Z]:\\\\/);
    const seconds = Date.parse(AT) / 1000;
    for (const m of committed.matchAll(/"timestamp":\{"seconds":(\d+),"nanos":(\d+)\}/g)) {
      expect([Number(m[1]), Number(m[2])]).toEqual([seconds, 0]);
    }
    for (const m of committed.matchAll(/"duration":\{"seconds":(\d+),"nanos":(\d+)\}/g)) {
      expect([Number(m[1]), Number(m[2])]).toEqual([0, 0]);
    }
  });

  it('two runs on two machines normalise to byte-identical output', () => {
    const a = asAnotherRun(committed, '/home/runner/work/doc-kitty/doc-kitty/example');
    const b = asAnotherRun(committed, '/Users/jane/tmp/example-copy');
    expect(a).not.toBe(b);
    const na = normaliseCucumberReport(a, { at: AT, root: '/home/runner/work/doc-kitty/doc-kitty/example' });
    const nb = normaliseCucumberReport(b, { at: AT, root: '/Users/jane/tmp/example-copy/' });
    expect(na).toBe(nb);
    expect(na).toBe(committed);
  });

  it('is idempotent', () => {
    const once = normaliseCucumberReport(asAnotherRun(committed, '/w'), { at: AT, root: '/w' });
    expect(normaliseCucumberReport(once, { at: AT, root: '/w' })).toBe(once);
  });

  it('every id reference still resolves to an id the report defines', () => {
    const defined = new Set<string>();
    const referenced: string[] = [];
    const walk = (value: unknown, key = ''): void => {
      if (Array.isArray(value)) {
        for (const v of value) walk(v, key.endsWith('Ids') ? key : '');
      } else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) walk(v, k);
      } else if (typeof value === 'string') {
        if (key === 'id') defined.add(value);
        else if (/[a-z]Ids?$/.test(key)) referenced.push(value);
      }
    };
    for (const e of envelopes(committed)) walk(e);
    expect(referenced.length).toBeGreaterThan(100);
    expect(referenced.filter((r) => !defined.has(r))).toEqual([]);
  });

  it('the results overlay reads the same results from a raw run and its normalised report', () => {
    const raw = asAnotherRun(committed, '/w');
    const before = parseReport(raw, { display: 'raw' });
    const after = parseReport(normaliseCucumberReport(raw, { at: AT, root: '/w' }), { display: 'normalised' });
    expect(after.files).toEqual(before.files);
    expect(after.steps).toBe(before.steps);
    expect(after.run.date).toBe(new Date(AT).toISOString());
    const statuses = after.files.flatMap((f) => f.entries.map((e) => e.status));
    expect(new Set(statuses)).toEqual(new Set(['passed', 'failed', 'pending', 'undefined', 'not-run']));
  });

  it('SOURCE_DATE_EPOCH stands in for a missing `at`; neither is an error', () => {
    const seconds = String(Date.parse(AT) / 1000);
    expect(normaliseCucumberReport(committed, { env: { SOURCE_DATE_EPOCH: seconds } })).toBe(committed);
    expect(() => normaliseCucumberReport(committed, { env: {} })).toThrow(/--at|SOURCE_DATE_EPOCH/);
    expect(() => normaliseCucumberReport(committed, { at: 'May 2026' })).toThrow(/--at/);
  });
});
