/**
 * `resolveSurface` — **the one shared matcher** (ADR-0027 D1/D6, contract
 * `resolver.md`). Given an already word-bounded surface form, the page's own
 * `glossary_context`, WP01's {@link SharedTermIndex}, and the ignore list, it
 * decides whether that surface links, is an unresolved cross-context collision,
 * or is nothing at all.
 *
 * It is the single source of truth for four consumers — the auto-linker (WP04),
 * the `:term` directive (WP05), the generator's cross-links (WP03, via the linker
 * running over generated pages), and the block's `linksForBody` re-derive (WP07).
 * Because so much rides on it, it is deliberately tiny and **pure**: no I/O, no
 * Astro imports, same inputs → same output (NFR-004). The whole-word / never-inside-
 * code guard and the first-per-section walk are the caller's (WP04); this function
 * only resolves a surface it is handed.
 */
import type { Resolution, SharedTermIndex } from './types.js';
import { slug } from './anchor.js';

export function resolveSurface(
  surface: string,
  pageContext: string | undefined,
  index: SharedTermIndex,
  ignoreList: ReadonlySet<string>,
): Resolution {
  // Rule 1: matching is case-insensitive — lowercase before every lookup.
  const lower = surface.toLowerCase();

  // Rule 2: an ignore-listed surface never links (FR-008).
  if (ignoreList.has(lower)) return { kind: 'none' };

  // Rule 3: a surface that is neither a term name nor an alias is nothing.
  const candidates = index.bySurface.get(lower);
  if (candidates === undefined || candidates.length === 0) return { kind: 'none' };

  // Rule 4: exactly one candidate context → link it (FR-007). Rule 8: the anchor
  // is always slug(termName) — the shared deterministic rule, never reinvented.
  if (candidates.length === 1) {
    const only = candidates[0];
    return {
      kind: 'link',
      context: only.context,
      anchor: slug(only.termName),
      termName: only.termName,
    };
  }

  // Rule 5: multiple candidates, and the page's own context is one of them →
  // link that context (FR-007). Aliases reach here identically to names (Rule 7),
  // because they already share `index.bySurface` (FR-012).
  if (pageContext !== undefined) {
    const match = candidates.find((c) => c.context === pageContext);
    if (match !== undefined) {
      return {
        kind: 'link',
        context: match.context,
        anchor: slug(match.termName),
        termName: match.termName,
      };
    }
  }

  // Rule 6: multiple candidates with no disambiguating page context → an
  // unresolved collision. `competing` is the sorted-unique list of contending
  // context names, deterministically ordered (code-point sort) so NFR-007's
  // greppable warning is byte-stable across builds.
  const competing = Array.from(new Set(candidates.map((c) => c.context))).sort();
  return { kind: 'unresolved', surface, competing };
}
