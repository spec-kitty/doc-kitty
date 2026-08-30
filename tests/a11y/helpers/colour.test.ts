// Deterministic mutation evidence for #34 (WP01, C34).
//
// The flake this closes is a RACE (Mermaid's async re-render flush), so
// revert-and-observe against the live spec is probabilistic. This is the
// deterministic proof instead: `toRgbTriple` must map the not-ready sentinel
// (`''`) to a value that can NEVER equal a real triple, so a caller comparing
// a not-ready read against a real colour fails loudly rather than green-washing.
import { test, expect } from '@playwright/test';
import { toRgbTriple, EMPTY_COLOUR_SENTINEL } from './colour';

test.describe('toRgbTriple (helpers/colour)', () => {
  test('an empty (not-ready) colour maps to the empty-colour sentinel', () => {
    expect(toRgbTriple('')).toBe(EMPTY_COLOUR_SENTINEL);
  });

  test('a real rgb() colour maps to its canonical r,g,b triple', () => {
    expect(toRgbTriple('rgb(18, 52, 86)')).toBe('18,52,86');
  });

  test('a real rgba() colour maps to its canonical r,g,b triple (alpha dropped)', () => {
    expect(toRgbTriple('rgba(18, 52, 86, 0.5)')).toBe('18,52,86');
  });

  test('a real #rrggbb hex colour maps to its canonical r,g,b triple', () => {
    expect(toRgbTriple('#123456')).toBe('18,52,86');
  });

  test('a real #rgb shorthand hex colour maps to its canonical r,g,b triple', () => {
    expect(toRgbTriple('#fff')).toBe('255,255,255');
  });

  test('the empty-colour sentinel never equals any real triple (invariant not weakened)', () => {
    const real = [
      toRgbTriple('rgb(0, 0, 0)'),
      toRgbTriple('#000'),
      toRgbTriple('#000000'),
      toRgbTriple('rgb(18, 52, 86)'),
      toRgbTriple('rgba(255, 255, 255, 1)'),
    ];
    for (const triple of real) {
      expect(triple).not.toBe(EMPTY_COLOUR_SENTINEL);
      expect(toRgbTriple('')).not.toBe(triple);
    }
  });

  test('the empty-colour sentinel is stable (repeated empty reads still never equal a real triple)', () => {
    expect(toRgbTriple('')).toBe(toRgbTriple(''));
    expect(toRgbTriple('')).not.toBe(toRgbTriple('rgb(0, 0, 0)'));
  });
});
