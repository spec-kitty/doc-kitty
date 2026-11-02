/**
 * FR-008 build identity over a real example build (WP01/T004 + DoD):
 *
 *   - one build stamps the SAME `buildId` into the machine index, EVERY
 *     per-page artifact and the scenarios artifact (the torn-read signal);
 *   - two consecutive builds of unchanged sources produce byte-equal identity
 *     (reproducibility: no artifact carries a build clock, so identical
 *     sources hash identically — squad A3's determinism claim, asserted);
 *   - a content edit changes it (a rebuild after touching one doc's body
 *     produces a different identity everywhere);
 *   - FR-003: the index's `sections[]` equals the projection of the example's
 *     own `docs/_meta/sections.yaml`, in registry order;
 *   - FR-009 defaults stay OFF for the example: no `_links.mcp`, no llms.txt
 *     MCP line.
 *
 * Each build lands in its own DK_OUTDIR (agent-links.test.ts precedent), so
 * this suite never touches another suite's dist; the example tree itself is
 * only ADD-probed (a temporary published page under `example/docs/`), restored
 * in a finally.
 */
import { spawnSync } from 'node:child_process';
import {
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseSectionRegistry } from '../lib/sections.js';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXAMPLE = path.join(REPO_ROOT, 'example');
const OUT_RUN1 = 'dist-wp01-buildid-run1';
const OUT_RUN2 = 'dist-wp01-buildid-run2';
const OUT_EDIT = 'dist-wp01-buildid-edit';
const PROBE = path.join(EXAMPLE, 'docs', 'buildid-probe.md');
const HEX64 = /^[0-9a-f]{64}$/;

const cleanup: string[] = [];
afterAll(() => {
  for (const dir of cleanup) rmSync(dir, { recursive: true, force: true });
  rmSync(PROBE, { force: true });
});

function build(outdir: string): void {
  const env: NodeJS.ProcessEnv = { ...process.env, DK_OUTDIR: outdir };
  delete env.BASE_URL;
  const built = spawnSync('pnpm', ['--filter', 'example', 'build'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env,
  });
  expect(built.status, `build (${outdir}) stderr:\n${built.stderr}`).toBe(0);
}

interface IndexDoc {
  buildId: string;
  sections: unknown;
  _links: Record<string, unknown>;
}

function readJson(dir: string, ...segments: string[]): unknown {
  return JSON.parse(readFileSync(path.join(EXAMPLE, dir, ...segments), 'utf8'));
}

function pageBuildIds(dir: string): Map<string, string> {
  const root = path.join(EXAMPLE, dir, 'api', 'pages');
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const full = path.join(d, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        const payload = readJson(dir, 'api', 'pages', path.relative(root, full)) as { buildId: string };
        out.set(path.relative(root, full), payload.buildId);
      }
    }
  };
  walk(root);
  return out;
}

describe('build identity (FR-008) on the example build', () => {
  let index1: IndexDoc;
  let pages1: Map<string, string>;

  beforeAll(() => {
    build(OUT_RUN1);
    build(OUT_RUN2);
    cleanup.push(path.join(EXAMPLE, OUT_RUN1), path.join(EXAMPLE, OUT_RUN2));
    index1 = readJson(OUT_RUN1, 'api', 'index.json') as IndexDoc;
    pages1 = pageBuildIds(OUT_RUN1);
  }, 300_000);

  it('one build stamps one identity across the index, every page artifact and scenarios', () => {
    expect(index1.buildId).toMatch(HEX64);
    expect(pages1.size).toBeGreaterThan(0);
    for (const [file, id] of pages1) expect(id, `buildId of ${file}`).toBe(index1.buildId);
    expect((readJson(OUT_RUN1, 'api', 'scenarios.json') as { buildId: string }).buildId).toBe(index1.buildId);
  });

  it('is deterministic: an unchanged rebuild yields the same identity', () => {
    expect((readJson(OUT_RUN2, 'api', 'index.json') as IndexDoc).buildId).toBe(index1.buildId);
  });

  it('emits sections[] from the section registry, in registry order (FR-003)', () => {
    const registry = parseSectionRegistry(
      readFileSync(path.join(EXAMPLE, 'docs', '_meta', 'sections.yaml'), 'utf8'),
    );
    expect(registry.length).toBeGreaterThan(0);
    expect(index1.sections).toEqual(
      registry.map((entry) => ({
        id: entry.id,
        label: entry.label,
        order: entry.order,
        ...(entry.purpose !== undefined ? { purpose: entry.purpose } : {}),
      })),
    );
  });

  it('keeps the FR-009 pointer OFF by default (no _links.mcp, no llms.txt line)', () => {
    expect('mcp' in index1._links).toBe(false);
    expect(readFileSync(path.join(EXAMPLE, OUT_RUN1, 'llms.txt'), 'utf8')).not.toContain('MCP server');
  });

  it('changes when a source page changes, and nowhere carries a stale value', () => {
    writeFileSync(
      PROBE,
      [
        '---',
        'title: Build-identity probe',
        'description: Temporary page added and removed by agent-api-build-identity.test.ts.',
        'doc_status: active',
        'updated: 2026-01-01',
        'kind: How-To',
        '---',
        '',
        'Body written only to perturb the corpus hash.',
        '',
      ].join('\n'),
    );
    try {
      build(OUT_EDIT);
      cleanup.push(path.join(EXAMPLE, OUT_EDIT));
      const edited = readJson(OUT_EDIT, 'api', 'index.json') as IndexDoc;
      expect(edited.buildId).toMatch(HEX64);
      expect(edited.buildId).not.toBe(index1.buildId);
      // The build changed the corpus; also assert the fresh value still spans
      // all three artifact kinds within the edited build.
      expect((readJson(OUT_EDIT, 'api', 'scenarios.json') as { buildId: string }).buildId).toBe(edited.buildId);
      for (const [file, id] of pageBuildIds(OUT_EDIT)) {
        expect(id, `edited buildId of ${file}`).toBe(edited.buildId);
      }
    } finally {
      rmSync(PROBE, { force: true });
    }
  }, 180_000);
});
