import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GHERKIN_LOG_PREFIX, loadFeatures } from '../lib/gherkin/load.mjs';

/** Fixture root: every `sources` entry below is relative to it. */
const ROOT = fileURLToPath(new URL('./fixtures/gherkin/load/', import.meta.url));

// Temp roots created per test; torn down afterEach.
const roots: string[] = [];
afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

/** Write `files` (POSIX rel path → contents) under a fresh temp root. */
function makeTree(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-gherkin-load-'));
  roots.push(root);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split('/'));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text, 'utf8');
  }
  return root;
}

/** Capture the parse error thrown by `fn` (fails the test if nothing throws). */
function thrown(fn: () => unknown): Error {
  try {
    fn();
  } catch (err) {
    return err as Error;
  }
  throw new Error('expected loadFeatures to throw');
}

describe('loadFeatures: discovery', () => {
  it('orders by source index, then code-unit order on the source-relative path', () => {
    const { files } = loadFeatures({ sources: ['source-a', 'source-b'], root: ROOT });
    expect(files.map((f) => [f.sourceDirIndex, f.relPath])).toEqual([
      [0, 'billing.feature'],
      [0, 'nested/deep/tracking.feature'],
      [0, 'shipping/Zeta.feature'], // 'Z' (0x5A) < 'b' (0x62): code units, not locale
      [0, 'shipping/book-consignment.feature'],
      [1, 'alpha.feature'], // sorts first by name, but its source is second
    ]);
  });

  it('reports absolute paths, the absolute source dir, and raw bytes', () => {
    const { files } = loadFeatures({ sources: ['source-a', 'source-b'], root: ROOT });
    const book = files.find((f) => f.relPath === 'shipping/book-consignment.feature')!;
    expect(book.sourceDir).toBe(path.join(ROOT, 'source-a'));
    expect(book.absPath).toBe(path.join(ROOT, 'source-a', 'shipping', 'book-consignment.feature'));
    expect(path.isAbsolute(book.absPath)).toBe(true);
    expect(book.bytes).toBe(readFileSync(book.absPath, 'utf8'));
    const alpha = files.find((f) => f.relPath === 'alpha.feature')!;
    expect(alpha.sourceDir).toBe(path.join(ROOT, 'source-b'));
  });

  it('computes the full lowercase hex sha256 of the raw file bytes', () => {
    const { files } = loadFeatures({ sources: ['source-a'], root: ROOT });
    for (const f of files) {
      const expected = createHash('sha256').update(readFileSync(f.absPath)).digest('hex');
      expect(f.sha256).toBe(expected);
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('skips dot-directories, node_modules and non-.feature files', () => {
    const feature = (name: string) => `Feature: ${name}\n`;
    const root = makeTree({
      'specs/keep.feature': feature('keep'),
      'specs/sub/keep-too.feature': feature('keep too'),
      'specs/.hidden/skip.feature': feature('hidden'),
      'specs/sub/.git/skip.feature': feature('git'),
      'specs/node_modules/pkg/skip.feature': feature('dep'),
      'specs/sub/node_modules/skip.feature': feature('nested dep'),
      'specs/notes.md': '# not a feature\n',
      'specs/keep.feature.bak': feature('backup'),
    });
    const { files } = loadFeatures({ sources: ['specs'], root });
    expect(files.map((f) => f.relPath)).toEqual(['keep.feature', 'sub/keep-too.feature']);
  });

  it('throws for a missing source directory', () => {
    expect(() => loadFeatures({ sources: ['source-a', 'does-not-exist'], root: ROOT })).toThrow(
      `${GHERKIN_LOG_PREFIX} source directory not found: does-not-exist`,
    );
  });

  it('treats a source that is a file (not a directory) as missing', () => {
    expect(() => loadFeatures({ sources: ['source-b/alpha.feature'], root: ROOT })).toThrow(
      /source directory not found/,
    );
  });
});

describe('loadFeatures: parsing', () => {
  it('produces identical documents (and ids) across two loads', () => {
    const first = loadFeatures({ sources: ['source-a', 'source-b'], root: ROOT });
    const second = loadFeatures({ sources: ['source-a', 'source-b'], root: ROOT });
    expect(second).toEqual(first);
  });

  it('uses a fresh incrementing id generator per file', () => {
    const { files } = loadFeatures({ sources: ['source-a', 'source-b'], root: ROOT });
    for (const f of files) {
      const ids = [...JSON.stringify(f.document).matchAll(/"id":"(\d+)"/g)].map((m) => Number(m[1]));
      // Each file's ids start at 0, independent of the files loaded before it.
      expect(Math.min(...ids)).toBe(0);
    }
    const book = files.find((f) => f.relPath === 'shipping/book-consignment.feature')!;
    const feature = book.document.feature!;
    expect(feature.name).toBe('Book consignment');
    expect(feature.tags.map((t) => t.name)).toEqual(['@dk:context=shipping']);
    const scenario = feature.children.find((c) => c.scenario?.name === 'Book a single consignment')!
      .scenario!;
    // Loaded after three other files, yet its first step is still id 0: the generator is per file.
    expect(scenario.steps.map((s) => s.id)).toEqual(['0']);
  });

  it('honours "# language: nl" and returns localised keywords', () => {
    const { files } = loadFeatures({ sources: ['i18n'], root: ROOT });
    expect(files).toHaveLength(1);
    const feature = files[0].document.feature!;
    expect(feature.language).toBe('nl');
    expect(feature.keyword).toBe('Functionaliteit');
    const steps = feature.children[0].scenario!.steps;
    expect(steps.map((s) => s.keyword)).toEqual(['Gegeven ', 'Als ', 'Dan ', 'En ']);
    expect(steps.map((s) => s.keywordType)).toEqual([
      'Context',
      'Action',
      'Outcome',
      'Conjunction',
    ]);
  });

  it('warns about and skips documents without a Feature', () => {
    const warnings: string[] = [];
    const { files } = loadFeatures({
      sources: ['no-feature'],
      root: ROOT,
      warn: (m) => warnings.push(m),
    });
    expect(files.map((f) => f.relPath)).toEqual(['real.feature']);
    expect(warnings).toEqual([
      `${GHERKIN_LOG_PREFIX} no-feature/comments-only.feature: no Feature, skipped`,
      `${GHERKIN_LOG_PREFIX} no-feature/empty.feature: no Feature, skipped`,
    ]);
  });

  it('does not require a warn callback', () => {
    expect(() => loadFeatures({ sources: ['no-feature'], root: ROOT })).not.toThrow();
  });
});

describe('loadFeatures: syntax errors', () => {
  it('reports every error in every file in ONE thrown error, with file:line:col', () => {
    const err = thrown(() => loadFeatures({ sources: ['source-a', 'malformed'], root: ROOT }));
    expect(err).toBeInstanceOf(Error);
    expect(err.message.split('\n')).toEqual([
      `${GHERKIN_LOG_PREFIX} malformed/bad-table.feature:6:7 inconsistent cell count within the table`,
      `${GHERKIN_LOG_PREFIX} malformed/missing-feature-keyword.feature:1:1 expected: #EOF, #Language, #TagLine, #FeatureLine, #Comment, #Empty, got 'Scenario: A scenario without a Feature'`,
      `${GHERKIN_LOG_PREFIX} malformed/missing-feature-keyword.feature:2:3 expected: #EOF, #Language, #TagLine, #FeatureLine, #Comment, #Empty, got 'Given nothing wraps this scenario'`,
    ]);
  });

  it("drops the parser's own (line:col) prefix rather than duplicating it", () => {
    const err = thrown(() => loadFeatures({ sources: ['malformed'], root: ROOT }));
    expect(err.message).not.toMatch(/\(\d+:\d+\)/);
  });

  it('reports an unknown # language as a located error', () => {
    const root = makeTree({ 'f/x.feature': '# language: xx-nope\nFeature: x\n' });
    const err = thrown(() => loadFeatures({ sources: ['f'], root }));
    expect(err.message).toBe(
      `${GHERKIN_LOG_PREFIX} f/x.feature:1:1 Language not supported: xx-nope`,
    );
  });
});

// ---------------------------------------------------------------------------
// Review fixes (post-WP09)
// ---------------------------------------------------------------------------

describe('walker order is independent of readdir order (review #12)', () => {
  /**
   * Load with `readdirSync` returning names in the given order (sorted, or
   * reverse-sorted), so the result can be compared across filesystem orders.
   */
  async function loadWithReaddirOrder(order: 'asc' | 'desc', root: string) {
    vi.resetModules();
    vi.doMock('node:fs', async (importOriginal) => {
      const fs = await importOriginal<typeof import('node:fs')>();
      const readdir = ((dir: string, opts?: unknown) => {
        const names = (fs.readdirSync as (d: string, o?: unknown) => string[])(dir, opts).slice().sort();
        return order === 'asc' ? names : names.reverse();
      }) as typeof fs.readdirSync;
      return { ...fs, default: { ...fs, readdirSync: readdir }, readdirSync: readdir };
    });
    try {
      const mod = await import('../lib/gherkin/load.mjs');
      return mod.loadFeatures({ sources: ['specs'], root }).files.map((f) => f.relPath);
    } finally {
      vi.doUnmock('node:fs');
      vi.resetModules();
    }
  }

  it('a symlinked directory and its target de-duplicate to the SAME path in either order', async () => {
    const root = makeTree({ 'specs/zz-real/x.feature': 'Feature: X\n' });
    symlinkSync(path.join(root, 'specs/zz-real'), path.join(root, 'specs/aa-link'));
    const asc = await loadWithReaddirOrder('asc', root);
    const desc = await loadWithReaddirOrder('desc', root);
    expect(asc).toEqual(["aa-link/x.feature"]);
    expect(desc).toEqual(asc);
  });
});

describe('the log prefix', () => {
  it('load.mjs still exports GHERKIN_LOG_PREFIX (config.ts / tests import it)', () => {
    expect(GHERKIN_LOG_PREFIX).toBe('[dk-gherkin]');
  });
});
