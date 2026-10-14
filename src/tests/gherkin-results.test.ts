/**
 * Cucumber results (ADR-0055): reading a report and tying its results to the
 * scenarios of a `.feature` file (`gherkin/results.mjs`, `results-load.mjs`).
 *
 * Fixtures (`fixtures/gherkin/results/`, see PROVENANCE.txt): ONE real
 * cucumber-js 13.3.0 run over `features/checkout.feature`, written as Cucumber
 * Messages and as the cucumber-js and cucumber-jvm JSON dialects, so the three
 * must agree; a `--tags` run and a `--dry-run`; and Cucumber Compatibility Kit
 * samples (all statuses, retries, outlines, Rules and Backgrounds).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_REPORT_BYTES,
  countsText,
  featureResults,
  normalizeUri,
  outcomeLabel,
  parseReport,
  reportIndex,
  statusOf,
  worstStatus,
  type FeatureResults,
  type ResultReport,
} from '../lib/gherkin/results.mjs';
import { clearReportMemo, loadReport } from '../lib/gherkin/results-load.mjs';
import { normalizeGherkinOptions, normalizeResultsOption } from '../lib/gherkin/options.mjs';
import { parseGherkin } from '../lib/gherkin/parse.mjs';
import { featureView } from '../lib/gherkin/view.mjs';

const DIR = fileURLToPath(new URL('./fixtures/gherkin/results/', import.meta.url));
const read = (name: string) => readFileSync(path.join(DIR, name), 'utf8');
const CHECKOUT = read('features/checkout.feature');

/** The view of a Gherkin text (throws on a parse error). */
function viewOf(text: string) {
  const { document } = parseGherkin(text, { display: 'x.feature' });
  const view = document ? featureView(document) : null;
  if (!view) throw new Error('no feature');
  return view;
}

/** Results of `uri` in `report` against `text`. */
function resultsOf(report: ResultReport, relPath: string, text: string, root = '.') {
  const found = reportIndex(report, { root, projectRoot: '/project' }).lookup(relPath);
  if (!found || !('file' in found)) throw new Error(`no results for ${relPath}`);
  return featureResults(found.file, { text, view: viewOf(text), run: report.run });
}

/** Scenario and row statuses as `{ line: label }`. */
function table(results: ReturnType<typeof featureResults>) {
  if (results.state !== 'current') return results.state;
  const out: Record<string, string> = {};
  for (const [line, o] of results.scenarios) out[`s${line}`] = outcomeLabel(o) + (o.counts ? ` (${countsText(o.counts)})` : '');
  for (const [line, o] of results.rows) out[`r${line}`] = outcomeLabel(o);
  return out;
}

const CHECKOUT_EXPECTED = {
  s8: 'Passed',
  s12: 'Failed (1 failed, 1 passed)',
  r18: 'Passed',
  r19: 'Failed',
};

describe('one run, three formats, the same results', () => {
  it('Cucumber Messages: final attempts, row lines, the retried pass', () => {
    const report = parseReport(read('messages.ndjson'), { display: 'messages.ndjson' });
    expect(report.format).toBe('messages');
    expect(report.run).toEqual({ revision: '3f1c2a9b7e4d5c6f8a0b1c2d3e4f5a6b7c8d9e0f', date: '2026-10-14T13:30:03.455Z' });
    expect(table(resultsOf(report, 'features/checkout.feature', CHECKOUT))).toEqual({
      ...CHECKOUT_EXPECTED,
      // Failed on attempt 0, passed on attempt 1 (`--retry 1`).
      s24: 'Passed on retry',
    });
  });

  it.each([
    ['cucumber-js', 'cucumber-js.json'],
    ['cucumber-jvm (official converter, background elements)', 'cucumber-jvm.json'],
  ])('Cucumber JSON, %s: the same statuses, the retry invisible', (_label, file) => {
    const report = parseReport(read(file), { display: file });
    expect(report.format).toBe('json');
    expect(table(resultsOf(report, 'features/checkout.feature', CHECKOUT))).toEqual({ ...CHECKOUT_EXPECTED, s24: 'Passed' });
  });

  it('counts test cases as Cucumber does: each outline row once, most severe first', () => {
    const results = resultsOf(parseReport(read('messages.ndjson'), { display: 'm' }), 'features/checkout.feature', CHECKOUT);
    expect(results.state === 'current' && countsText(results.counts)).toBe('1 failed, 3 passed');
  });

  it('keeps nothing from a failure but its status: no message, stack trace or path', () => {
    const report = parseReport(read('messages.ndjson'), { display: 'm' });
    const json = JSON.stringify(report);
    expect(json).not.toContain('AssertionError');
    expect(json).not.toContain('/home/runner');
    expect(json).not.toContain('steps.js');
    expect(json).not.toContain('example-org');
  });
});

describe('runs that did not execute everything', () => {
  it('a --tags run: pickles without a test case are Not run', () => {
    const report = parseReport(read('filtered.ndjson'), { display: 'f' });
    expect(table(resultsOf(report, 'features/checkout.feature', CHECKOUT))).toEqual({
      s8: 'Not run',
      s12: 'Not run (2 not run)',
      r18: 'Not run',
      r19: 'Not run',
      s24: 'Failed',
    });
  });

  it('a --dry-run: every step skipped, flagged for a warning', () => {
    const report = parseReport(read('dry.ndjson'), { display: 'd' });
    expect(report.allSkipped).toBe(true);
    expect(table(resultsOf(report, 'features/checkout.feature', CHECKOUT))).toMatchObject({ s8: 'Skipped', r19: 'Skipped' });
    expect(parseReport(read('messages.ndjson'), { display: 'm' }).allSkipped).toBe(false);
  });

  it('a scenario the report does not mention, in a file it does, is Not run', () => {
    const text = CHECKOUT.replace('  Rule:', '  Scenario: Added later\n    Given a step\n\n  Rule:');
    // The JSON report has no file text, so the new scenario only shifts lines
    // the structural check sees: the Rule's scenario moved, so the report is stale.
    expect(resultsOf(parseReport(read('cucumber-js.json'), { display: 'j' }), 'features/checkout.feature', text).state).toBe('stale');
    // A scenario appended at the end moves nothing: it is simply Not run.
    const appended = `${CHECKOUT}\n  Scenario: Added later\n    Given a step\n`;
    expect(table(resultsOf(parseReport(read('cucumber-js.json'), { display: 'j' }), 'features/checkout.feature', appended))).toMatchObject({
      s8: 'Passed',
      s28: 'Not run',
    });
  });
});

describe('the Cucumber Compatibility Kit', () => {
  const cck = (name: string, format: 'ndjson' | 'jvm.json') => {
    const report = parseReport(read(`cck/${name}.${format}`), { display: name });
    return table(resultsOf(report, `samples/${name}/${name}.feature`, read(`cck/${name}.feature`)));
  };

  it.each(['ndjson', 'jvm.json'] as const)('all-statuses (%s): one scenario per status, mapped to its word', (format) => {
    expect(cck('all-statuses', format)).toEqual({
      s6: 'Passed',
      s11: 'Failed',
      s16: 'Pending',
      s21: 'Skipped',
      s26: 'Undefined',
      s31: 'Ambiguous',
    });
  });

  it('retry (ndjson): the final attempt decides; a pass after a failure is Passed on retry', () => {
    expect(cck('retry', 'ndjson')).toEqual({
      s8: 'Passed',
      s11: 'Passed on retry',
      s14: 'Passed on retry',
      s17: 'Failed',
    });
  });

  it('retry (jvm.json): JSON keeps only the final attempt, so a retried pass is plain Passed', () => {
    expect(cck('retry', 'jvm.json')).toEqual({ s8: 'Passed', s11: 'Passed', s14: 'Passed', s17: 'Failed' });
  });

  it.each(['ndjson', 'jvm.json'] as const)('examples-tables (%s): each row by its own line, named outlines included', (format) => {
    const t = cck('examples-tables', format) as Record<string, string>;
    expect(t.s11).toBe('Failed (2 failed, 2 passed)');
    expect([t.r19, t.r20, t.r25, t.r26]).toEqual(['Passed', 'Passed', 'Failed', 'Failed']);
    // "Eating cucumbers with <friends> friends": the pickle names are expanded,
    // and still match the outline's rows.
    expect(t.s28).toBe('Passed (3 passed)');
    expect([t.r35, t.r36, t.r37]).toEqual(['Passed', 'Passed', 'Passed']);
  });

  it.each(['ndjson', 'jvm.json'] as const)('rules-backgrounds (%s): scenarios inside Rules, backgrounds folded in', (format) => {
    const t = cck('rules-backgrounds', format) as Record<string, string>;
    expect(Object.values(t).every((v) => v === 'Passed')).toBe(true);
    expect(Object.keys(t).length).toBeGreaterThan(1);
  });

  it('empty (ndjson): a scenario with no steps is Not run', () => {
    expect(cck('empty', 'ndjson')).toEqual({ s7: 'Not run' });
  });
});

describe('a stale report never puts a result on the wrong scenario', () => {
  const shifted = CHECKOUT.replace('@billing\n', '@billing\n# a new comment line\n');

  it('Messages: the file text differs from source.data, so the whole file is stale', () => {
    const report = parseReport(read('messages.ndjson'), { display: 'm' });
    expect(resultsOf(report, 'features/checkout.feature', shifted).state).toBe('stale');
  });

  it('Messages: line endings and a BOM are not a difference', () => {
    const report = parseReport(read('messages.ndjson'), { display: 'm' });
    const crlf = `\uFEFF${CHECKOUT.replace(/\n/g, '\r\n')}`;
    expect(resultsOf(report, 'features/checkout.feature', crlf).state).toBe('current');
  });

  it.each(['cucumber-js.json', 'cucumber-jvm.json'])('JSON (%s): lines no longer on a scenario of that name', (file) => {
    const report = parseReport(read(file), { display: file });
    expect(resultsOf(report, 'features/checkout.feature', shifted).state).toBe('stale');
  });

  it('JSON: a renamed scenario on the same line is stale', () => {
    const report = parseReport(read('cucumber-js.json'), { display: 'j' });
    const renamed = CHECKOUT.replace('Scenario: Paying by card', 'Scenario: Paying by credit card');
    expect(resultsOf(report, 'features/checkout.feature', renamed).state).toBe('stale');
  });

  it('a selection is checked against the WHOLE file, and shows only its own scenarios', () => {
    const report = parseReport(read('cucumber-js.json'), { display: 'j' });
    const whole = viewOf(CHECKOUT);
    const selected = { ...whole, children: whole.children.slice(0, 2) }; // Background + "Paying by card"
    const found = reportIndex(report, { root: '.', projectRoot: '/p' }).lookup('features/checkout.feature');
    if (!found || !('file' in found)) throw new Error('no file');
    const results = featureResults(found.file, { text: CHECKOUT, view: selected, file: whole, run: report.run });
    expect(table(results)).toEqual({ s8: 'Passed' });
    expect((results as FeatureResults).counts).toEqual({ passed: 1 });
  });
});

describe('status rules', () => {
  it('worstStatus follows Cucumber: not run < passed < skipped < pending < undefined < ambiguous < failed', () => {
    expect(worstStatus([])).toBe('not-run');
    expect(worstStatus(['passed', 'skipped'])).toBe('skipped');
    expect(worstStatus(['pending', 'undefined', 'passed'])).toBe('undefined');
    expect(worstStatus(['ambiguous', 'failed'])).toBe('failed');
    expect(worstStatus(['not-run', 'passed'])).toBe('passed');
  });

  it.each([
    ['PASSED', 'passed'],
    ['FAILED', 'failed'],
    ['UNKNOWN', 'not-run'],
    ['error', 'failed'],
    ['hook_error', 'failed'],
    ['pending_warn', 'pending'],
    ['untested_undefined', 'undefined'],
    ['untested', 'not-run'],
    ['executing', 'not-run'],
    [undefined, 'not-run'],
  ])('statusOf(%s) is %s', (input, want) => {
    expect(statusOf(input)).toBe(want);
  });

  it('a commit id is kept only when it looks like one; the date is the run end', () => {
    const meta = (revision: string) =>
      `${JSON.stringify({ meta: { ci: { git: { revision } } } })}\n${JSON.stringify({ testRunFinished: { timestamp: { seconds: 0, nanos: 0 } } })}\n`;
    expect(parseReport(meta('ABCDEF1234'), { display: 'm' }).run).toEqual({ revision: 'abcdef1234', date: '1970-01-01T00:00:00.000Z' });
    expect(parseReport(meta('<script>'), { display: 'm' }).run.revision).toBeUndefined();
  });
});

describe('older Messages protocols are read', () => {
  /** messages.ndjson as protocol ≤ 15 wrote it: defaults omitted, string seconds, willBeRetried on the step. */
  function oldProtocol(): string {
    return read('messages.ndjson')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const env = JSON.parse(line, (key, value) =>
          key === 'seconds' ? String(value) : value,
        ) as Record<string, Record<string, unknown>>;
        if (env.testCaseStarted && env.testCaseStarted.attempt === 0) delete env.testCaseStarted.attempt;
        if (env.pickle) delete env.pickle.location;
        if (env.testCaseFinished) delete env.testCaseFinished.willBeRetried;
        return JSON.stringify(env);
      })
      .join('\n');
  }

  it('omitted attempt, string seconds and no pickle.location still give the same results', () => {
    const report = parseReport(oldProtocol(), { display: 'old' });
    expect(report.run.date).toBe('2026-10-14T13:30:03.455Z');
    // Without willBeRetried the HIGHEST attempt is the final one: the retry still shows.
    expect(table(resultsOf(report, 'features/checkout.feature', CHECKOUT))).toEqual({ ...CHECKOUT_EXPECTED, s24: 'Passed on retry' });
  });

  it('protocol < 17: willBeRetried on testStepResult marks the attempt as retried', () => {
    const text = [
      { gherkinDocument: { uri: 'a.feature', feature: { children: [{ scenario: { id: 's', location: { line: 2 }, name: 'S', examples: [] } }] } } },
      { pickle: { id: 'p', uri: 'a.feature', astNodeIds: ['s'], name: 'S' } },
      { testCase: { id: 'c', pickleId: 'p' } },
      { testCaseStarted: { id: 'a0', testCaseId: 'c', attempt: 0 } },
      { testStepFinished: { testCaseStartedId: 'a0', testStepResult: { status: 'FAILED', willBeRetried: true } } },
      { testCaseFinished: { testCaseStartedId: 'a0' } },
      { testCaseStarted: { id: 'a1', testCaseId: 'c', attempt: 1 } },
      { testStepFinished: { testCaseStartedId: 'a1', testStepResult: { status: 'PASSED' } } },
      { testCaseFinished: { testCaseStartedId: 'a1' } },
    ]
      .map((e) => JSON.stringify(e))
      .join('\n');
    const report = parseReport(text, { display: 'old' });
    expect(report.files[0].entries).toMatchObject([{ line: 2, names: ['S'], status: 'passed', retried: true, ran: true }]);
  });

  it('an attempt that never finished is Not run, unless a step already failed', () => {
    const base = [
      { pickle: { id: 'p', uri: 'a.feature', astNodeIds: [], location: { line: 3 }, name: 'S' } },
      { testCase: { id: 'c', pickleId: 'p' } },
      { testCaseStarted: { id: 'a0', testCaseId: 'c' } },
    ];
    const withStep = (status: string) =>
      [...base, { testStepFinished: { testCaseStartedId: 'a0', testStepResult: { status } } }].map((e) => JSON.stringify(e)).join('\n');
    expect(parseReport(withStep('PASSED'), { display: 'x' }).files[0].entries[0].status).toBe('not-run');
    expect(parseReport(withStep('FAILED'), { display: 'x' }).files[0].entries[0].status).toBe('failed');
  });
});

describe('unreadable reports are refused with their location', () => {
  it.each([
    ['empty', '', '[dk-gherkin] r is not a Cucumber report: expected Cucumber Messages (NDJSON) or a Cucumber JSON array (the file is empty)'],
    ['plain text', 'hello', '[dk-gherkin] r is not a Cucumber report: expected Cucumber Messages (NDJSON) or a Cucumber JSON array'],
    ['a JSON object', '{"a": 1}\n{oops', '[dk-gherkin] r:2 is not a Cucumber Messages envelope'],
    ['an NDJSON array line', '{"meta":{}}\n[1]', '[dk-gherkin] r:2 is not a Cucumber Messages envelope (not an object)'],
    ['broken JSON', '[{"uri": ', '[dk-gherkin] r is not a Cucumber JSON report'],
    ['a JSON feature that is not an object', '[1]', '[dk-gherkin] r feature #1 is not an object'],
  ])('%s', (_label, text, message) => {
    expect(() => parseReport(text, { display: 'r' })).toThrow(message);
  });

  it('blank lines and CRLF in NDJSON are fine; unknown envelopes are ignored', () => {
    const text = `\r\n${JSON.stringify({ somethingNew: { x: 1 } })}\r\n\r\n${JSON.stringify({ testRunFinished: { success: true } })}\r\n`;
    expect(parseReport(text, { display: 'r' }).files).toEqual([]);
  });

  it('a JSON report whose elements lack lines, uris or results is read as far as it goes', () => {
    const text = JSON.stringify([{ elements: [] }, { uri: 'a.feature', elements: [{ type: 'scenario', name: 'S' }, 3] }]);
    expect(parseReport(text, { display: 'r' }).files).toEqual([expect.objectContaining({ uri: 'a.feature', entries: [] })]);
  });
});

describe('report URIs and the files they name', () => {
  it.each([
    ['features/a.feature', { path: 'features/a.feature', absolute: false, tailOnly: false }],
    ['./features/a.feature', { path: 'features/a.feature', absolute: false, tailOnly: false }],
    ['features\\sub\\a.feature', { path: 'features/sub/a.feature', absolute: false, tailOnly: false }],
    ['file:features/a.feature', { path: 'features/a.feature', absolute: false, tailOnly: false }],
    ['file:///home/u/p/../p/features/a%20b.feature', { path: '/home/u/p/features/a b.feature', absolute: true, tailOnly: false }],
    ['/ci/work/features/a.feature', { path: '/ci/work/features/a.feature', absolute: true, tailOnly: false }],
    ['C:\\work\\features\\a.feature', { path: 'C:/work/features/a.feature', absolute: true, tailOnly: false }],
    ['classpath:com/example/a.feature', { path: 'com/example/a.feature', absolute: false, tailOnly: true }],
  ])('normalizeUri(%s)', (uri, want) => {
    expect(normalizeUri(uri)).toEqual(want);
  });

  const reportFor = (...uris: string[]) =>
    parseReport(JSON.stringify(uris.map((uri) => ({ uri, elements: [] }))), { display: 'r' });

  it('a relative URI resolves against results.root', () => {
    const index = reportIndex(reportFor('tests/scenarios/init.feature'), { root: 'vendor/spec-kitty', projectRoot: '/site' });
    expect(index.lookup('vendor/spec-kitty/tests/scenarios/init.feature')).toMatchObject({ file: { uri: 'tests/scenarios/init.feature' } });
    expect(index.lookup('tests/scenarios/init.feature')).toBeNull();
  });

  it('an absolute URI inside the project root is matched exactly', () => {
    const index = reportIndex(reportFor('file:///site/features/a.feature'), { root: '.', projectRoot: '/site' });
    expect(index.lookup('features/a.feature')).toMatchObject({ file: { uri: 'file:///site/features/a.feature' } });
  });

  it('an absolute URI from another machine, or a classpath URI, matches by its unique tail', () => {
    const index = reportIndex(reportFor('/ci/work/features/a.feature', 'classpath:features/b.feature'), {
      root: '.',
      projectRoot: '/site',
    });
    expect(index.lookup('features/a.feature')).toMatchObject({ file: { uri: '/ci/work/features/a.feature' } });
    expect(index.lookup('features/b.feature')).toMatchObject({ file: { uri: 'classpath:features/b.feature' } });
    expect(index.lookup('features/c.feature')).toBeNull();
  });

  it('a tail that matches several reported files is ambiguous, never a guess', () => {
    const index = reportIndex(reportFor('/ci/one/features/a.feature', '/ci/two/features/a.feature'), {
      root: '.',
      projectRoot: '/site',
    });
    expect(index.lookup('features/a.feature')).toEqual({
      ambiguous: ['/ci/one/features/a.feature', '/ci/two/features/a.feature'],
    });
  });

  it('a tail match is on whole path segments (xfeatures/a.feature is not features/a.feature)', () => {
    const index = reportIndex(reportFor('/ci/xfeatures/a.feature'), { root: '.', projectRoot: '/site' });
    expect(index.lookup('features/a.feature')).toBeNull();
  });

  it('behave: the feature location names the file, element locations the lines', () => {
    const text = JSON.stringify([
      {
        location: 'features/a.feature:1',
        elements: [
          { type: 'scenario', name: 'S', location: 'features/a.feature:3', steps: [{ result: { status: 'passed' } }] },
          { type: 'scenario', name: 'T', location: 'features/a.feature:6', steps: [{ result: { status: 'error' } }] },
        ],
      },
    ]);
    const report = parseReport(text, { display: 'r' });
    const feature = 'Feature: A\n\n  Scenario: S\n    Given a\n\n  Scenario: T\n    Given b\n';
    expect(table(resultsOf(report, 'features/a.feature', feature))).toEqual({ s3: 'Passed', s6: 'Failed' });
  });
});

describe('gherkin.results option (ADR-0055 decision 1)', () => {
  it('accepts a path or { report, root }', () => {
    expect(normalizeResultsOption('reports/cucumber.ndjson')).toEqual({ report: 'reports/cucumber.ndjson', root: '.' });
    expect(normalizeResultsOption({ report: 'r.json', root: 'vendor/x' })).toEqual({ report: 'r.json', root: 'vendor/x' });
    expect(normalizeGherkinOptions({ results: 'r.ndjson' })).toMatchObject({ results: { report: 'r.ndjson', root: '.' } });
    expect(normalizeGherkinOptions({ sources: ['features'] })).not.toHaveProperty('results');
  });

  it.each([
    ['an absolute path', '/abs/r.ndjson'],
    ['a URL', 'https://ci.example.com/r.ndjson'],
    ['a blank path', ' '],
    ['a number', 3],
    ['an array', ['r.ndjson']],
    ['null', null],
    ['an object without report', { root: '.' }],
    ['an absolute root', { report: 'r.ndjson', root: '/abs' }],
  ])('refuses %s', (_label, value) => {
    expect(() => normalizeResultsOption(value)).toThrow(/^\[dk-gherkin\] gherkin\.results must be a report path or \{ report, root\? \}/);
  });

  it('refuses an unknown key, naming the allowed set', () => {
    expect(() => normalizeResultsOption({ report: 'r', format: 'json' })).toThrow(
      '[dk-gherkin] unknown option gherkin.results.format; expected one of report, root',
    );
  });
});

describe('loadReport: from disk, once per version of the file', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'dk-results-'));
    mkdirSync(path.join(dir, 'reports'));
    clearReportMemo();
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('a missing report is { ok: false, reason: missing }, not an error', () => {
    expect(loadReport({ report: 'reports/none.ndjson', root: '.' }, { projectRoot: dir })).toEqual({ ok: false, reason: 'missing' });
  });

  it('parses once while (mtime, size) hold, and again after the file changes', () => {
    const file = path.join(dir, 'reports', 'r.ndjson');
    writeFileSync(file, read('messages.ndjson'));
    utimesSync(file, 1_000, 1_000);
    const first = loadReport({ report: 'reports/r.ndjson', root: '.' }, { projectRoot: dir });
    const again = loadReport({ report: 'reports/r.ndjson', root: '.' }, { projectRoot: dir });
    expect(first.ok && again.ok && again.report).toBe(first.ok && first.report);
    writeFileSync(file, read('cucumber-js.json'));
    utimesSync(file, 2_000, 2_000);
    const changed = loadReport({ report: 'reports/r.ndjson', root: '.' }, { projectRoot: dir });
    expect(changed.ok && changed.report.format).toBe('json');
  });

  it('a directory, or a file over the limit, is refused', () => {
    mkdirSync(path.join(dir, 'reports', 'dir.json'));
    expect(() => loadReport({ report: 'reports/dir.json', root: '.' }, { projectRoot: dir })).toThrow(
      '[dk-gherkin] gherkin.results report reports/dir.json is not a file',
    );
    // A sparse file one byte over the limit: the size check comes before any read.
    const big = path.join(dir, 'reports', 'big.json');
    writeFileSync(big, '');
    truncateSync(big, MAX_REPORT_BYTES + 1);
    expect(() => loadReport({ report: 'reports/big.json', root: '.' }, { projectRoot: dir })).toThrow(
      '[dk-gherkin] gherkin.results report reports/big.json is larger than 64 MiB, the report limit',
    );
  });
});

describe('overlayResults: matching a generated page to its source (ADR-0055 decision 5)', async () => {
  const { unified } = await import('unified');
  const { default: remarkParse } = await import('remark-parse');
  const { default: remarkGfm } = await import('remark-gfm');
  const { overlayResults } = await import('../lib/gherkin/results-overlay.mjs');
  const { renderFeatureBody } = await import('../lib/gherkin/render.mjs');
  type Md = { type: string; depth?: number; value?: string; children?: Md[]; data?: { hProperties?: { className?: string[] } } };
  const mdText = (n: Md): string => n.value ?? (n.children ?? []).map(mdText).join('');
  const parse = (md: string) => unified().use(remarkParse).use(remarkGfm).parse(md) as unknown as Md;
  const results = () => resultsOf(parseReport(read('messages.ndjson'), { display: 'm' }), 'features/checkout.feature', CHECKOUT) as FeatureResults;
  const body = () => renderFeatureBody(parseGherkin(CHECKOUT, { display: 'x' }).document!);

  it('reports a scenario whose heading is gone instead of guessing, and still badges the rest', () => {
    const tree = parse(body().replace('## Scenario: Paying by card\n', ''));
    const { missing } = overlayResults(tree as never, viewOf(CHECKOUT), results());
    expect(missing).toEqual(['Scenario: Paying by card']);
    const badges = (tree.children ?? []).filter((n) => n.data?.hProperties?.className?.includes('dk-gherkin__result'));
    expect(badges.map(mdText)).toEqual(['Result: Failed (1 failed, 1 passed)', 'Result: Passed on retry']);
  });

  it('a table in a scenario description is not taken for its Examples table', () => {
    const md = body().replace(
      '## Scenario Outline: Applying a discount code\n',
      '## Scenario Outline: Applying a discount code\n\n| note |\n| --- |\n| a description table |\n',
    );
    const tree = parse(md);
    overlayResults(tree as never, viewOf(CHECKOUT), results());
    const tables = (tree.children ?? []).filter((n) => n.type === 'table');
    expect(tables.map((t) => (t.children?.[0].children ?? []).map(mdText))).toEqual([
      ['note'],
      ['code', 'total', 'Result'],
    ]);
  });
});

describe('review regressions (ADR-0055 decisions 3, 4 and 6)', () => {
  const json = (file: string) => parseReport(read(file), { display: file });

  it.each(['cucumber-js.json', 'cucumber-jvm.json'])('JSON (%s): swapped Examples rows are stale, not mislabelled', (file) => {
    const swapped = CHECKOUT.replace(
      '      | SAVE10  | 18.00 |\n      | EXPIRED | 20.00 |',
      '      | EXPIRED | 20.00 |\n      | SAVE10  | 18.00 |',
    );
    expect(swapped).not.toBe(CHECKOUT);
    expect(resultsOf(json(file), 'features/checkout.feature', swapped).state).toBe('stale');
  });

  it.each(['cucumber-js.json', 'cucumber-jvm.json'])('JSON (%s): an edited row value or step text is stale', (file) => {
    expect(resultsOf(json(file), 'features/checkout.feature', CHECKOUT.replace('| EXPIRED | 20.00 |', '| BOGUS   | 20.00 |')).state).toBe('stale');
    expect(resultsOf(json(file), 'features/checkout.feature', CHECKOUT.replace('pays by card', 'pays by cheque')).state).toBe('stale');
  });

  it('JSON: cucumber-jvm step hooks (BeforeStep/AfterStep) count towards the result', () => {
    const text = JSON.stringify([
      {
        uri: 'a.feature',
        elements: [
          {
            type: 'scenario',
            line: 2,
            name: 'S',
            steps: [{ name: 'a step', result: { status: 'passed' }, after: [{ result: { status: 'failed' } }] }],
          },
        ],
      },
    ]);
    expect(parseReport(text, { display: 'r' }).files[0].entries[0].status).toBe('failed');
  });

  it('behave: an outline row named "<outline> -- @1.1 <examples>" matches its outline', () => {
    const feature = 'Feature: A\n\n  Scenario Outline: O\n    Given <x>\n\n    Examples: E\n      | x |\n      | a |\n';
    const text = JSON.stringify([
      {
        location: 'features/a.feature:1',
        elements: [
          { type: 'scenario', name: 'O -- @1.1 E', location: 'features/a.feature:8', steps: [{ name: 'a', result: { status: 'passed' } }] },
        ],
      },
    ]);
    expect(table(resultsOf(parseReport(text, { display: 'r' }), 'features/a.feature', feature))).toEqual({ s3: 'Passed (1 passed)', r8: 'Passed' });
  });

  it('a root that climbs out (..) and back in resolves to the project file', () => {
    const report = parseReport(JSON.stringify([{ uri: 'site/features/a.feature', elements: [] }]), { display: 'r' });
    const index = reportIndex(report, { root: '..', projectRoot: '/repo/site' });
    expect(index.lookup('features/a.feature')).toMatchObject({ file: { uri: 'site/features/a.feature' } });
    // Files outside the project keep their ../ key.
    const outside = reportIndex(parseReport(JSON.stringify([{ uri: 'features/a.feature', elements: [] }]), { display: 'r' }), {
      root: '..',
      projectRoot: '/repo/site',
    });
    expect(outside.lookup('../features/a.feature')).toMatchObject({ file: { uri: 'features/a.feature' } });
  });

  it('one tail-placed report file never serves two rendered files', () => {
    const report = parseReport(JSON.stringify([{ uri: '/ci/w/apps/web/features/login.feature', elements: [] }]), { display: 'r' });
    const index = reportIndex(report, { root: '.', projectRoot: '/site' });
    expect(index.lookup('apps/web/features/login.feature')).toMatchObject({ file: {} });
    expect(index.lookup('apps/web/features/login.feature')).toMatchObject({ file: {} }); // the same file again is fine
    expect(index.lookup('features/login.feature')).toEqual({ ambiguous: ['/ci/w/apps/web/features/login.feature'] });
  });

  it('a concatenated report: a later run that filtered a scenario out never hides its earlier result', () => {
    const both = `${read('messages.ndjson')}\n${read('filtered.ndjson')}`;
    expect(table(resultsOf(parseReport(both, { display: 'm' }), 'features/checkout.feature', CHECKOUT))).toEqual({
      ...CHECKOUT_EXPECTED,
      // The rerun of the gift-card scenario (no retry this time) wins.
      s24: 'Failed',
    });
  });

  it('a file:// URI that is not percent-decodable is kept as written, not a crash', () => {
    const text = JSON.stringify({ source: { uri: 'file://evil/%E0%A4%A.feature', data: 'x' } });
    expect(() => parseReport(text, { display: 'r' })).not.toThrow();
    expect(normalizeUri('file://evil/%E0%A4%A.feature').path).toBe('/%E0%A4%A.feature');
  });
});
