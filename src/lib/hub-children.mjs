/**
 * Hub child-selection — the PURE, importable predicate + comparator a
 * `kind: Hub` page applies to the docs collection before it lists its children.
 *
 * Extracted verbatim from `Hub.astro`'s inline frontmatter (#53,
 * DISCIPLINED_REFACTORING): the SAME selection now has ONE definition that both
 * `Hub.astro` and the guard test (`src/tests/hub-children.test.ts`) exercise, so
 * a test can assert Hub's REAL draft-exclusion (INV-1) instead of a replica.
 * Removing the `isPublished(data)` clause below is the mutation the guard is
 * designed to catch (DIRECTIVE_041 / USE_MUTATION_TESTING_TO_VALIDATE_TEST_QUALITY).
 *
 * Astro/fs-free by construction — it only reasons over already-mapped entries —
 * so it stays unit-testable in the node-only vitest harness (no build, C-003).
 * The ADR-number re-ordering (`buildAdrHubCards`) is deliberately NOT here: it
 * stays wired in `Hub.astro`, applied to the ADR-kind group AFTER this selection,
 * exactly as before (the render output is byte-identical, C-001).
 */
// Extensionless specifier: this is a native-ESM `.mjs`, so the vite/vitest and
// Astro toolchains (never bare Node) resolve it against the TypeScript source
// `metadata.ts` via their extension search — a bare `.js` is NOT rewritten for a
// `.mjs` importer. `metadata` is itself fs/Astro-free, so importing the canonical
// `isPublished`/`sectionOf`/`sectionRank` keeps this module pure and single-sourced.
import { isPublished, sectionOf, sectionRank } from './metadata';
import { compareCodeUnit } from './vocabulary-core.mjs';
import { buildAdrHubCards } from '../scripts/generate-adr-index.mjs';

/** The parent slug of a route slug ('' for a top-level page or the root). */
const parentOf = (slug) => {
  const i = slug.lastIndexOf('/');
  return i === -1 ? '' : slug.slice(0, i);
};

/**
 * Select and order a Hub's PUBLISHED children.
 *
 * A child is an entry whose parent path equals this hub's slug (the pages one
 * level down) that is not the hub itself and is not a draft. The kept set is
 * ordered by section rank, then title — the exact predicate and comparator
 * `Hub.astro` used inline.
 *
 * @template {{ slug: string, data: { title: string, doc_status?: string } }} T
 * @param {readonly T[]} entries
 *   The mapped collection entries — each at least `{ slug, data }` (any extra
 *   fields, e.g. `body`, are preserved on the returned objects so the caller can
 *   still feed the ADR-kind group to `buildAdrHubCards`).
 * @param {string} currentSlug The route slug of the hub being rendered.
 * @param {readonly string[]} [order] Resolved section-id order (registry
 *   authority); omitted, `sectionRank` falls back to the frozen `SECTION_ORDER`.
 * @returns {T[]} The published child entries, sorted by section rank then title.
 */
export function selectHubChildren(entries, currentSlug, order) {
  return entries
    .filter(
      (entry) =>
        entry.slug !== currentSlug &&
        parentOf(entry.slug) === currentSlug &&
        isPublished(entry.data),
    )
    .sort((a, b) => {
      const bySection =
        sectionRank(sectionOf(a.slug), order) -
        sectionRank(sectionOf(b.slug), order);
      if (bySection !== 0) return bySection;
      // Title order (pinned to 'en' for reproducibility), with a code-unit slug
      // tiebreak APPENDED for intrinsic totality (#88/FR-002). Byte-neutral: no
      // hub has duplicate-titled children on the demonstrator, so the tiebreak
      // never fires; slugs are unique so it makes the comparator total.
      const byTitle = a.data.title.localeCompare(b.data.title, 'en');
      if (byTitle !== 0) return byTitle;
      return compareCodeUnit(a.slug, b.slug);
    });
}

/**
 * Compose a Hub's ADR-kind children into the ADR `HubCard[]` — `Hub.astro`'s
 * ADR-card composition, extracted verbatim (#57, DISCIPLINED_REFACTORING): the
 * ADR-kind gate over the (already `selectHubChildren`-selected) children, then
 * `buildAdrHubCards` for the number+status+date derivation. This is the ONE
 * definition both `Hub.astro` and the guard test (`hub-adr-card.test.ts`)
 * exercise, closing the replica-drift #57 flags — a regression in Hub's real
 * ADR composition now reds the test instead of a hand-kept copy of it.
 *
 * `buildAdrHubCards` itself stays the single source for number/status/date
 * (#50): this function only reproduces the WIRING around it, never the parsing.
 *
 * @param {readonly { slug: string, data: { kind?: string }, body: string }[]} publishedChildren
 *   Children already filtered to this hub (`selectHubChildren`'s output, or an
 *   equivalent published+parent-scoped set in a test).
 * @returns {ReturnType<typeof buildAdrHubCards>} The composed ADR `HubCard[]`,
 *   number-ordered, byte-identical to what `Hub.astro` builds today (C-001).
 */
export function selectAdrHubCards(publishedChildren) {
  return buildAdrHubCards(
    publishedChildren
      .filter((entry) => entry.data.kind === 'ADR')
      .map((entry) => ({
        slug: entry.slug,
        data: entry.data,
        body: entry.body,
      })),
  );
}
