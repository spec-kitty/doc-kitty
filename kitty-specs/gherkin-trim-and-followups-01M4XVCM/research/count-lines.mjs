#!/usr/bin/env node
// Planning artifact (not shipped): counts the in-scope test surface for
// gherkin-trim-and-followups (NFR-001 / NFR-002). Run from the repo root:
//   node kitty-specs/gherkin-trim-and-followups-01M4XVCM/research/count-lines.mjs [--json]
// Test lines: non-blank, non-comment lines of the frozen list plus every
// non-fixture file under src/tests/ or tests/ that those files import
// (transitively). Fixture lines: non-blank lines of every file under
// src/tests/fixtures/gherkin/** plus any other fixture file the tests import.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const FROZEN = [
  'src/tests/agent-page-includes.test.ts',
  'src/tests/docs-loader-includes-build.test.ts',
  'src/tests/docs-loader-includes.test.ts',
  'src/tests/gherkin-check-cli.test.ts',
  'src/tests/gherkin-codegen-guard.test.ts',
  'src/tests/gherkin-example.test.ts',
  'src/tests/gherkin-feature-core.test.ts',
  'src/tests/gherkin-fence-build.test.ts',
  'src/tests/gherkin-fence.test.ts',
  'src/tests/gherkin-fixture-parity.test.ts',
  'src/tests/gherkin-generate.test.ts',
  'src/tests/gherkin-include.test.ts',
  'src/tests/gherkin-integration.test.ts',
  'src/tests/gherkin-load.test.ts',
  'src/tests/gherkin-mdast.test.ts',
  'src/tests/gherkin-options.test.ts',
  'src/tests/gherkin-parse.test.ts',
  'src/tests/gherkin-render.test.ts',
  'src/tests/gherkin-results-build.test.ts',
  'src/tests/gherkin-results-render.test.ts',
  'src/tests/gherkin-results.test.ts',
  'src/tests/gherkin-scenario-anchors.test.ts',
  'src/tests/gherkin-select.test.ts',
  'src/tests/gherkin-view.test.ts',
  'src/tests/helpers/gherkin-render-harness.ts',
  'src/tests/scenario-index.test.ts',
  'tests/a11y/gherkin.spec.ts',
];
const FIXTURE_ROOT = 'src/tests/fixtures/gherkin';
const isFixture = (p) => p.includes('/fixtures/');
const inTestTree = (p) => p.startsWith('src/tests/') || p.startsWith('tests/');

function codeLines(text) {
  let n = 0, block = false;
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (block) { if (l.includes('*/')) block = false; continue; }
    if (l === '' || l.startsWith('//')) continue;
    if (l.startsWith('/*')) { if (!l.includes('*/')) block = true; continue; }
    n++;
  }
  return n;
}
const nonBlank = (text) => text.split('\n').filter((l) => l.trim() !== '').length;

function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return undefined;
  const base = path.normalize(path.join(path.dirname(from), spec));
  const tries = [base, base.replace(/\.js$/, '.ts'), `${base}.ts`, `${base}.mjs`, `${base}.js`, path.join(base, 'index.ts')];
  return tries.find((t) => existsSync(t) && statSync(t).isFile());
}

const helpers = new Set(), importedFixtures = new Set();
const queue = [...FROZEN];
const seen = new Set(queue);
while (queue.length) {
  const f = queue.shift();
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) {
    const r = resolveImport(f, m[1]);
    if (!r || !inTestTree(r) || seen.has(r)) continue;
    seen.add(r);
    if (isFixture(r)) importedFixtures.add(r);
    else { helpers.add(r); queue.push(r); }
  }
}

function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const p = path.join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const fixtures = new Set([...walk(FIXTURE_ROOT), ...importedFixtures]);

const rows = [];
for (const f of FROZEN) rows.push({ kind: 'test', file: f, lines: codeLines(readFileSync(f, 'utf8')) });
for (const f of [...helpers].sort()) rows.push({ kind: 'helper', file: f, lines: codeLines(readFileSync(f, 'utf8')) });
for (const f of [...fixtures].sort()) rows.push({ kind: 'fixture', file: f, lines: nonBlank(readFileSync(f, 'utf8')) });

const sum = (k) => rows.filter((r) => k.includes(r.kind)).reduce((a, r) => a + r.lines, 0);
const totals = { testFiles: FROZEN.length, helperFiles: helpers.size, fixtureFiles: fixtures.size,
  testLines: sum(['test', 'helper']), fixtureLines: sum(['fixture']) };
if (process.argv.includes('--json')) console.log(JSON.stringify({ totals, rows }, null, 2));
else {
  for (const r of rows) console.log(`| ${r.kind} | \`${r.file}\` | ${r.lines} |`);
  console.log(JSON.stringify(totals));
}
