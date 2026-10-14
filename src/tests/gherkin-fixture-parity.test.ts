/**
 * One source of truth for the worked example (#128).
 *
 * `example/features/shipping/book-consignment.feature` is the worked example the
 * site renders. Two unit suites keep their own byte-identical copy, so their
 * fixtures stay independent of the example site:
 *
 *   - `fixtures/gherkin/render/` (the body golden `render/book-consignment.md`);
 *   - `fixtures/gherkin/generate/site/` (the page and hub goldens under
 *     `generate/expected/`).
 *
 * Each suite checks only its own copy, so without this test the copies could
 * drift apart while every suite stays green. When the example changes, copy it
 * over both fixtures and regenerate the goldens they feed.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const EXAMPLE = '../../example/features/shipping/book-consignment.feature';

describe('the worked example has one source of truth', () => {
  it.each([
    'fixtures/gherkin/render/book-consignment.feature',
    'fixtures/gherkin/generate/site/features/shipping/book-consignment.feature',
  ])('%s equals the example feature byte for byte', (copy) => {
    expect(read(`./${copy}`)).toBe(read(EXAMPLE));
  });
});
