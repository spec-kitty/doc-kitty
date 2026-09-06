/**
 * Presentation (deck) frontmatter predicates — the SINGLE source of truth for
 * "is this a deck?" across the two access shapes observed in the tree (S-01).
 *
 * Home is `deck/` (neutral), deliberately NOT `markua/`: Markua modules gain
 * deck knowledge only by DELEGATION (via {@link ../markua/deck-guard.js}), never
 * by importing deck concepts into a Markua transformer body. There is exactly
 * one definition per access shape and no third copy (C36b) — the scattered
 * inline `kind === 'Presentation'` checks fold onto these.
 */

/**
 * The remark/rehype VFile subset the predicate reads (Astro injects
 * `data.astro`). Structurally matches `markua-normalise`'s
 * `MarkuaNormaliseVFile`, `markua-callouts`'s `MarkuaCalloutsVFile`, and
 * `glossary-autolink`'s `GlossaryVFile` (whose `frontmatter` is a wider
 * `Record<string, unknown>`, still assignable here). `markua-figure`
 * (`rehype/markua-figure.ts`) no longer calls this predicate at all (#47/D4):
 * it distinguishes the deck hero image by its `data-deck-hero` tag instead of
 * a blanket deck guard.
 */
interface PresentationFile {
  data?: { astro?: { frontmatter?: { kind?: unknown } } };
}

/** The Astro content-collection entry subset the RSS predicate reads. */
interface PresentationEntry {
  data?: { kind?: unknown };
}

/**
 * True when a remark/rehype VFile carries `kind: Presentation` frontmatter.
 *
 * The optional-chain is DEFENSIVE and REQUIRED (S-02): a non-Astro VFile has no
 * `data.astro`, so a bare `file.data.astro.frontmatter.kind` would throw. The
 * chain yields `false` instead — the guard fires at remark time (proven by
 * `deck-split`/`glossary-autolink` shipping), so it must tolerate that shape.
 */
export function isPresentationFile(file?: PresentationFile): boolean {
  return file?.data?.astro?.frontmatter?.kind === 'Presentation';
}

/**
 * True when an Astro content-collection entry is a `kind: Presentation` deck
 * (the RSS-exclusion shape at `metadata.ts`). Same defensive optional-chain.
 */
export function isPresentationEntry(entry?: PresentationEntry): boolean {
  return entry?.data?.kind === 'Presentation';
}
