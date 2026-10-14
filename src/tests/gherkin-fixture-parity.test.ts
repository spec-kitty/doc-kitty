/**
 * One source of truth for the worked example (#128).
 *
 * `example/features/shipping/book-consignment.feature` is the worked example the
 * site renders. Two unit suites (the render goldens and the generate goldens)
 * share ONE fixture copy, `fixtures/gherkin/render/book-consignment.feature`, so
 * they stay independent of the example site. This test pins that copy to the
 * example; without it the copy could drift while every suite stays green. When
 * the example changes, copy it over the fixture and regenerate the goldens.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const EXAMPLE = '../../example/features/shipping/book-consignment.feature';

describe('the worked example has one source of truth', () => {
  it('the shared fixture equals the example feature byte for byte', () => {
    expect(read('./fixtures/gherkin/render/book-consignment.feature')).toBe(read(EXAMPLE));
  });
});
