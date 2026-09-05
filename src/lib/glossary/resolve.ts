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

/**
 * `glossaryTermUrl` — the ONE base-aware glossary term-URL builder (#61/#63,
 * C-001, NFR-002). Shared by the auto-linker (`glossary-autolink.internal.ts`),
 * the `:term` directive (`glossary-term.ts`), and the "On this page" glossary
 * sub-list (`OnThisPage.astro`), so the three surfaces can never diverge in URL
 * shape (the exact clone-drift D1 identifies as #61's root cause).
 *
 * `basePrefix` is the site's ALREADY-NORMALIZED base — `''` for no base,
 * `/doc-kitty` for a based deployment. The remark-plugin callers thread it in
 * explicitly (via `config.ts`'s `normalizeBasePrefix`, C-001 — these modules stay
 * Astro-free/pure, no `import.meta.env` read); `.astro` callers compose this with
 * `withBase()` instead. This function does no normalization itself — it is a
 * pure string join, so a caller passing an already-doubled or malformed prefix
 * gets that reflected verbatim (the callers own normalization).
 */
export function glossaryTermUrl(basePrefix: string, contextSlug: string, anchor: string): string {
  return `${basePrefix}/glossary/${contextSlug}/#${anchor}`;
}

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
  // and context page-slug are the AUTHORITATIVE, de-collided values the loader
  // stored ONCE (issue #17) — returned verbatim, never recomputed here.
  if (candidates.length === 1) {
    const only = candidates[0];
    return {
      kind: 'link',
      context: only.context,
      contextSlug: only.contextSlug,
      anchor: only.anchor,
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
        contextSlug: match.contextSlug,
        anchor: match.anchor,
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
