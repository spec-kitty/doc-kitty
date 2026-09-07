import { describe, it, expect } from 'vitest';
import { selectHubChildren } from '../lib/hub-children.mjs';
import type { DocKittyFrontmatter } from '../lib/metadata.js';

/**
 * #53 / FR-001, FR-002, NFR-002 — the Hub draft-exclusion (INV-1) guard.
 *
 * This suite exercises Hub's REAL child-selection: `selectHubChildren` is the
 * exact function `Hub.astro` calls (not a test-local replica of its filter), so
 * an assertion here reflects production. It is deliberately MUTATION-TRUE: delete
 * the `isPublished(data)` clause from `selectHubChildren` and the draft rows
 * below leak into the result, reddening the "excluded" + ordering assertions
 * (DIRECTIVE_041 / USE_MUTATION_TESTING_TO_VALIDATE_TEST_QUALITY). It is a fast,
 * node-only unit test — no build, no a11y snapshot — so it does not touch the
 * flaky lane #54 fixes (C-003).
 */

/** A Hub child as `Hub.astro` maps it before selection: `{ slug, data, body }`. */
interface HubChild {
  slug: string;
  data: DocKittyFrontmatter;
  body: string;
}

const child = (
  slug: string,
  title: string,
  kind: string,
  doc_status: 'active' | 'draft',
): HubChild => ({
  slug,
  data: { title, kind, doc_status } as DocKittyFrontmatter,
  body: `# ${title}\n`,
});

describe('selectHubChildren — draft exclusion + published retention (#53)', () => {
  it('excludes a DRAFT numbered ADR and a DRAFT non-ADR; keeps published children, section-then-title ordered', () => {
    // An ADR-section hub. Input order is deliberately shuffled so a passing
    // order assertion cannot be an accident of insertion order.
    const entries: HubChild[] = [
      child('adr/0002-beta', 'Beta decision', 'ADR', 'active'), // published ADR — KEPT
      child('adr/template', 'Draft template note', 'Reference', 'draft'), // draft non-ADR — EXCLUDED
      child('adr/0001-alpha', 'Alpha decision', 'ADR', 'active'), // published ADR — KEPT
      child('adr/0009-wip', 'WIP numbered', 'ADR', 'draft'), // draft numbered ADR — EXCLUDED
      child('adr/notes', 'Guide overview', 'Reference', 'active'), // published non-ADR — KEPT
      child('other/x', 'Wrong parent', 'Reference', 'active'), // not a child of `adr` — EXCLUDED (parent filter)
      child('adr', 'The hub itself', 'Hub', 'active'), // is the hub — EXCLUDED (self)
    ];

    const kept = selectHubChildren(entries, 'adr', undefined).map((e) => e.slug);

    // All same section (adr) ⇒ order falls to title.localeCompare:
    // Alpha, Beta, Guide overview.
    expect(kept).toEqual(['adr/0001-alpha', 'adr/0002-beta', 'adr/notes']);

    // Draft children are gone — this is the branch the mutation removes.
    expect(kept).not.toContain('adr/0009-wip'); // draft numbered ADR
    expect(kept).not.toContain('adr/template'); // draft non-ADR

    // Published children (including a published ADR) are retained — no over-exclusion.
    expect(kept).toContain('adr/0001-alpha'); // published ADR
    expect(kept).toContain('adr/notes'); // published non-ADR

    // The parent-of-current + self filters are orthogonal to draft-exclusion:
    // these stay excluded whether or not `isPublished` is present.
    expect(kept).not.toContain('other/x');
    expect(kept).not.toContain('adr');
  });

  it('orders published children by section rank first, then title (root hub)', () => {
    // Section rank must win over title: titles are reverse-alphabetical to the
    // section order, so a title-only sort would produce the opposite result.
    const entries: HubChild[] = [
      child('adr', 'Zeta', 'Hub', 'active'), // section adr  (rank 2)
      child('context', 'Yankee', 'Hub', 'active'), // section context (rank 0)
      child('architecture', 'Xray', 'Hub', 'active'), // section architecture (rank 1)
      child('guides/deep', 'Alpha', 'Hub', 'active'), // not a direct child of root — EXCLUDED
    ];

    const kept = selectHubChildren(entries, '', undefined).map((e) => e.slug);

    expect(kept).toEqual(['context', 'architecture', 'adr']);
  });
});

/**
 * #88 / FR-002 — `selectHubChildren` is intrinsically total: section rank →
 * title (pinned 'en') → `compareCodeUnit(slug)` APPENDED for totality. When two
 * children of one hub tie on section AND title, ONLY the appended slug tiebreak
 * separates them; a shuffled input must rank identically. Permutations are
 * hand-built (no `Math.random`). Removing the appended `compareCodeUnit(a.slug,
 * b.slug)` reverts tied children to input order (stable sort) and reddens this.
 */
describe('selectHubChildren total order (#88) — appended slug tiebreak', () => {
  // Two children of the `guides` hub tie on section (guides) and title ('Same'),
  // so their order is decided ONLY by the appended slug tiebreak.
  const tied: HubChild[] = [
    child('guides/omega', 'Same', 'Reference', 'active'),
    child('guides/alpha', 'Same', 'Reference', 'active'),
  ];
  const expected = ['guides/alpha', 'guides/omega'];

  it('breaks a section+title tie by ascending slug, identically across permutations', () => {
    const run = (list: HubChild[]) =>
      selectHubChildren(list, 'guides', undefined).map((e) => e.slug);
    expect(run(tied)).toEqual(expected);
    expect(run([...tied].reverse())).toEqual(expected);
  });
});
