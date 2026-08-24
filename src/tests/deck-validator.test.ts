import { describe, it, expect } from 'vitest';
import { validate, expectedType } from '../scripts/validate-frontmatter.mjs';

/**
 * BA-8 / FR-022: a `kind: Presentation` page outside `presentations/` is a
 * BLOCKING validator error (the path+kind invariant the out-of-frame deck route
 * override depends on — ADR-0021 D1). A committed misfiled fixture can't exist
 * (it would red the build), so the guard is proven here against in-memory
 * frontmatter rather than a corpus fixture.
 */

// A fully valid deck frontmatter so ONLY the path rule can produce a problem.
const deckFrontmatter = {
  title: 'A Deck',
  description:
    'A sufficiently long description of the deck to satisfy the validator length hint comfortably.',
  doc_status: 'draft',
  updated: '2026-08-24',
  type: 'Presentation',
  kind: 'Presentation',
} as const;

const PRESENTATION_PATH_ERROR = 'must live under `presentations/`';

describe('validate-frontmatter: off-section Presentation is a hard error', () => {
  it('flags a kind:Presentation page filed OUTSIDE presentations/ as a blocking problem', () => {
    const { problems } = validate('guides/misfiled-deck.md', deckFrontmatter);
    expect(problems.some((p) => p.includes(PRESENTATION_PATH_ERROR))).toBe(true);
  });

  it('does NOT flag a kind:Presentation page filed UNDER presentations/', () => {
    const { problems } = validate('presentations/ok-deck.md', deckFrontmatter);
    expect(problems).toEqual([]);
  });

  it('also flags a deck misfiled at the tree root (no section segment)', () => {
    const { problems } = validate('loose-deck.md', deckFrontmatter);
    expect(problems.some((p) => p.includes(PRESENTATION_PATH_ERROR))).toBe(true);
  });

  it('leaves non-Presentation kinds under other sections untouched by the rule', () => {
    const guide = {
      ...deckFrontmatter,
      type: 'Guide',
      kind: 'How-To',
    };
    const { problems } = validate('guides/a-guide.md', guide);
    expect(problems.some((p) => p.includes(PRESENTATION_PATH_ERROR))).toBe(false);
  });

  it('maps the presentations/ section to the Presentation type (path agreement)', () => {
    expect(expectedType('presentations/some-deck.md')).toBe('Presentation');
  });
});
