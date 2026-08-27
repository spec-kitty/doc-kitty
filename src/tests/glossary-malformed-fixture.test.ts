import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadGlossary } from '../lib/glossary/load.js';

/**
 * WP09 T031 (FR-002 / SC-006). The example ships a DELIBERATELY malformed
 * definitions fixture at `example/tests/fixtures/definitions.malformed.yaml`,
 * kept OUT of the build (it is not under `.contextive/`, so the site never loads
 * it). This test proves the loader stays BUILD-FATAL on invalid input: it copies
 * the fixture into a throwaway `.contextive/definitions.yaml`, runs the same
 * `loadGlossary` the integration uses, and asserts it throws an error naming the
 * offending context/term/field. If the loader ever silently degrades instead of
 * throwing, this suite goes red.
 */

// The committed malformed fixture, read from the example package.
const MALFORMED_FIXTURE = fileURLToPath(
  new URL('../../example/tests/fixtures/definitions.malformed.yaml', import.meta.url),
);

const roots: string[] = [];

/** Stage `yaml` as `<tmp>/.contextive/definitions.yaml` and return the root. */
function stageRoot(yaml: string): string {
  const root = mkdtempSync(join(tmpdir(), 'dk-glossary-malformed-'));
  roots.push(root);
  mkdirSync(join(root, '.contextive'), { recursive: true });
  writeFileSync(join(root, '.contextive', 'definitions.yaml'), yaml, 'utf8');
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

describe('example malformed definitions fixture (FR-002 / SC-006)', () => {
  it('loadGlossary throws build-fatal, naming the offending context/term/field', () => {
    const yaml = readFileSync(MALFORMED_FIXTURE, 'utf8');
    const root = stageRoot(yaml);
    // The fault is the `slot` term with no `definition`: the loader must throw a
    // build-fatal error whose message locates context "warehouse" → term "slot"
    // → field "definition" (the FR-002 human locator), never swallow it.
    expect(() => loadGlossary(root)).toThrow(
      /context "warehouse".*term "slot".*definition/s,
    );
  });
});
