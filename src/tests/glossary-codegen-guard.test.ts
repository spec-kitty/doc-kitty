/**
 * WP08 T029 — codegen timing + dev-watcher idempotency guard (the AS-3 spike is
 * RETIRED; this is the idempotency guard that replaces it).
 *
 * The glossary integration pins `generateGlossaryPages` to `astro:config:setup`, and
 * the content layer watches the glob base — so each `config:setup` re-run regenerates
 * the files. If generation were nondeterministic (a timestamp, a `generated:` stamp,
 * Map-iteration order), `astro dev` would rewrite the files every tick and loop. This
 * asserts the generator is byte-identical run-to-run and emits NO timestamp field, so
 * a post-build `git diff docs/glossary example/docs/glossary` stays clean (drift would
 * otherwise fail loudly).
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateGlossaryPages } from '../lib/glossary/generate.js';
import type { SharedTermIndex } from '../lib/glossary/types.js';

const index: SharedTermIndex = {
  bySurface: new Map(),
  contexts: new Map([
    [
      'Delivery',
      {
        slug: 'delivery',
        domainVisionStatement: 'How work ships.',
        terms: [
          { name: 'Lane', definition: 'A **worktree** for one WP.' },
          { name: 'Mission', definition: 'A unit of governed work.' },
        ],
      },
    ],
    [
      'Authoring',
      { slug: 'authoring', terms: [{ name: 'Frontmatter', definition: 'Page metadata.' }] },
    ],
  ]),
};

/** Read every generated file under `dir` into a sorted `relPath → contents` map. */
function readTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string, prefix: string): void => {
    for (const name of readdirSync(d).sort()) {
      const abs = join(d, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(abs).isDirectory()) walk(abs, rel);
      else out[rel] = readFileSync(abs, 'utf8');
    }
  };
  walk(dir, '');
  return out;
}

describe('generateGlossaryPages codegen guard (T029)', () => {
  it('is byte-identical across two runs (dev-watcher idempotency)', () => {
    const a = mkdtempSync(join(tmpdir(), 'dk-gloss-a-'));
    const b = mkdtempSync(join(tmpdir(), 'dk-gloss-b-'));
    try {
      generateGlossaryPages(index, a);
      generateGlossaryPages(index, b);
      expect(readTree(a)).toEqual(readTree(b));
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });

  it('emits NO timestamp / `generated:` field (nothing nondeterministic)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dk-gloss-ts-'));
    try {
      generateGlossaryPages(index, dir);
      const files = readTree(dir);
      expect(Object.keys(files).length).toBeGreaterThan(0);
      for (const [rel, body] of Object.entries(files)) {
        expect(body, `${rel} must carry no generated: stamp`).not.toMatch(/^generated:/m);
        expect(body, `${rel} must carry no ISO timestamp`).not.toMatch(
          /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('re-running over the SAME dir rewrites identical bytes (no drift)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dk-gloss-same-'));
    try {
      generateGlossaryPages(index, dir);
      const first = readTree(dir);
      generateGlossaryPages(index, dir);
      expect(readTree(dir)).toEqual(first);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
