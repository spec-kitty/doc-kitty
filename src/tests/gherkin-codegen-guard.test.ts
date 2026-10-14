/**
 * WP05 — Gherkin feature-page codegen idempotency guard (ADR-0046, risk R3;
 * mirrors `glossary-codegen-guard.test.ts`).
 *
 * The gherkin integration regenerates `<docsDir>/<section>/**` in
 * `astro:config:setup`, inside the content layer's watched glob base. If the
 * output were nondeterministic (a timestamp in `generated.at`, Map/readdir
 * iteration order, locale sorting), `astro dev` would rewrite the files every
 * tick and loop, and the `--check` drift gate would never be clean. This asserts
 * the generator is byte-identical run-to-run, that a re-run over its own output
 * writes NOTHING (the files are not even touched), and that `generated.at` is a
 * content hash — never a timestamp.
 *
 * Mutation evidence (05-verification.md): stamping `generated.at` with
 * `new Date().toISOString()` turns this suite red.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFeatures } from '../lib/gherkin/load.mjs';
import { generateFeaturePages } from '../lib/gherkin/generate.mjs';

/** The worked example's feature, read from the golden fixture. */
const GOLDEN_FEATURE = fileURLToPath(
  new URL('./fixtures/gherkin/generate/site/features/shipping/book-consignment.feature', import.meta.url),
);
/** The example docs root: READ-ONLY (ADR listing + section registry). */
const EXAMPLE_DOCS = fileURLToPath(new URL('../../example/docs/', import.meta.url));

const temps: string[] = [];
afterEach(() => {
  while (temps.length > 0) {
    const dir = temps.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function tmp(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

/**
 * A source tree exercising every generated shape: the worked example (two
 * rules, outline, docstring, table), a nested directory, and an `@dk:updated`
 * date — the ONE date the output may legitimately carry.
 */
function makeSources(): string {
  const root = tmp('dk-gherkin-guard-src-');
  const files: Record<string, string> = {
    'features/shipping/book-consignment.feature': readFileSync(GOLDEN_FEATURE, 'utf8'),
    'features/shipping/customs/clear-goods.feature': [
      '@dk:updated=2026-01-15 @dk:status=draft',
      'Feature: Clear goods through customs',
      '  Goods are cleared before they sail.',
      '',
      '  Scenario: Cleared goods may board',
      '    Given a cleared consignment',
      '    Then it may board',
      '',
    ].join('\n'),
    'features/billing/invoice.feature': [
      'Feature: Send an invoice',
      '  An invoice follows every confirmed booking.',
      '',
      '  Scenario: Invoice on confirmation',
      '    Given a confirmed booking',
      '    Then an invoice is sent',
      '',
    ].join('\n'),
  };
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split('/'));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text, 'utf8');
  }
  return root;
}

/** Generate `root`'s features into `outDir` (fresh model each run, as a restart would). */
function generate(root: string, outDir: string) {
  const model = loadFeatures({ sources: ['features'], root });
  return generateFeaturePages(model, {
    docsRoot: EXAMPLE_DOCS,
    outDir,
    sourceRoot: root,
    indexBasename: ['README', 'index'],
  });
}

/** Read every generated file under `dir` into a sorted `relPath → contents` map. */
function readTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string, prefix: string): void => {
    for (const name of readdirSync(d).sort()) {
      const abs = path.join(d, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(abs).isDirectory()) walk(abs, rel);
      else out[rel] = readFileSync(abs, 'utf8');
    }
  };
  walk(dir, '');
  return out;
}

/** `relPath → mtimeMs` for every file under `dir`. */
function mtimes(dir: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rel of Object.keys(readTree(dir))) out[rel] = statSync(path.join(dir, rel)).mtimeMs;
  return out;
}

describe('generateFeaturePages codegen guard (WP05, risk R3)', () => {
  it('is byte-identical across two runs (dev-watcher idempotency)', () => {
    const root = makeSources();
    const a = path.join(tmp('dk-gherkin-guard-a-'), 'behaviour');
    const b = path.join(tmp('dk-gherkin-guard-b-'), 'behaviour');
    generate(root, a);
    generate(root, b);
    const tree = readTree(a);
    expect(Object.keys(tree)).toEqual([
      'README.md',
      'billing/README.md',
      'billing/invoice.md',
      'shipping/README.md',
      'shipping/book-consignment.md',
      // `customs/` holds only a draft: it gets a DRAFT hub, linked from no
      // published hub (#124).
      'shipping/customs/README.md',
      'shipping/customs/clear-goods.md',
    ]);
    expect(readTree(b)).toEqual(tree);
  });

  it('re-running over the SAME dir writes nothing and touches no file (no drift, no restart loop)', () => {
    const root = makeSources();
    const dir = path.join(tmp('dk-gherkin-guard-same-'), 'behaviour');
    const first = generate(root, dir);
    expect(first.written).toHaveLength(7);
    const tree = readTree(dir);
    const stamps = mtimes(dir);

    const second = generate(root, dir);
    expect(second).toEqual({ written: [], unchanged: first.written, removed: [] });
    expect(readTree(dir)).toEqual(tree);
    expect(mtimes(dir)).toEqual(stamps);
  });

  it('emits NO timestamp: generated.at is a content hash; the only date is an authored `updated:`', () => {
    const root = makeSources();
    const dir = path.join(tmp('dk-gherkin-guard-ts-'), 'behaviour');
    generate(root, dir);
    const files = readTree(dir);
    expect(Object.keys(files).length).toBeGreaterThan(0);
    let updatedLines = 0;
    for (const [rel, body] of Object.entries(files)) {
      expect(body, `${rel} must carry no ISO timestamp`).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
      expect(body, `${rel}: generated.at must be sha256:<12 hex>`).toMatch(
        /^generated:\n {2}by: "doc-kitty\/gherkin"\n {2}at: "sha256:[0-9a-f]{12}"$/m,
      );
      for (const line of body.split('\n')) {
        if (!/\d{4}-\d{2}-\d{2}/.test(line)) continue;
        expect(line, `${rel}: a date may only appear on an \`updated:\` line`).toMatch(
          /^updated: \d{4}-\d{2}-\d{2}$/,
        );
        updatedLines += 1;
      }
    }
    // The `@dk:updated` tag is the single source of the single date.
    expect(updatedLines).toBe(1);
    expect(files['shipping/customs/clear-goods.md']).toMatch(/^updated: 2026-01-15$/m);
  });
});
