/**
 * NFR-002: the build and the build-free gate reach the same verdict on the same
 * docs tree (ADR-0080). Runs the content-graph builder and `validateRoot` over
 * every `catalog-measures/*` fixture and compares the unknown ids each reports.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import type { DocEntry, DocKittyFrontmatter } from '../lib/metadata.js';
import { buildCatalog } from '../lib/catalog.js';
import { clearMeasuresCatalogCache, readMeasuresCatalog } from '../lib/measures-loader.mjs';
import { buildMeasuresIndex } from '../lib/measures-core.mjs';
import { validateRoot } from '../scripts/validate-catalog.mjs';
import { walkMarkdownPaths } from '../lib/docs-walk.mjs';

vi.mock('astro:content', () => ({ getCollection: async () => [] }));

const { buildContentGraph, locatePages } = await import('../lib/docs-index.js');

const FIXTURES = fileURLToPath(new URL('./fixtures/catalog-measures/', import.meta.url));
const unknownIds = (messages: string[]) =>
  messages.flatMap((m) => [...m.matchAll(/unknown measure id "([^"]+)"/g)].map((x) => x[1]!)).sort();

/** The build's verdict: the catalog problems, or the graph builder's error, or nothing. */
function buildVerdict(root: string): string[] {
  const read = readMeasuresCatalog(root);
  if (read.problems.length > 0) return read.problems;
  const paths = walkMarkdownPaths(root);
  const locations = locatePages(paths);
  const entries: DocEntry[] = paths.map((file) => {
    const slug = Object.entries(locations).find(([, loc]) => loc.file === file)![0];
    return { slug, data: matter(readFileSync(path.join(root, file), 'utf8')).data as DocKittyFrontmatter };
  });
  try {
    buildContentGraph(entries, {
      locations,
      draftRoutes: new Set(),
      catalog: buildCatalog([], []),
      measures: { index: buildMeasuresIndex(read.records), source: read.source },
    });
    return [];
  } catch (err) {
    return (err as Error).message.split('\n');
  }
}

beforeEach(() => clearMeasuresCatalogCache());

describe('measures: build and gate agree (NFR-002)', () => {
  for (const name of readdirSync(FIXTURES)) {
    it(`${name}: same verdict and the same unknown ids`, () => {
      const root = path.join(FIXTURES, name, 'docs');
      const gate: string[] = [];
      validateRoot(path.relative(process.cwd(), root), gate);
      const build = buildVerdict(root);
      expect(build.length > 0).toBe(gate.length > 0);
      expect(unknownIds(build)).toEqual(unknownIds(gate));
    });
  }
});
