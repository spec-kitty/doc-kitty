/**
 * `page-processor` — the ONE shared parse configuration the render-time re-derive
 * (issue #16) uses so its mdast tree matches the real build substrate.
 *
 * Two render-time re-derive sites parse a page's raw markdown outside the Astro
 * build: `OnThisPage.astro`'s `linksForBody` (the glossary "links used" re-derive)
 * and `definitions-payload.ts`'s `stripMarkdown` (the hover-preview plain-text
 * strip). Both previously built a BARE `remarkParse`, which diverges from the real
 * pipeline (see the glossary-integration docstring in `config.ts`) — Astro/Starlight
 * run remark-gfm + remark-smartypants BEFORE the pinned `remarkDirective →
 * glossaryTerm → glossaryAutolink`.
 *
 * SCOPE OF THE PARITY THIS DELIVERS. Callers use `.parse()`, which runs the
 * micromark *syntax* extensions but NOT transformer plugins:
 *   - remark-gfm is a syntax extension → it takes effect under `.parse()`. This is
 *     the primary phantom the factory closes: a gfm autolink literal like
 *     `cargo@x.com` is now a `link` node (the autolinker guards it) instead of a
 *     TEXT node it would linkify into a phantom used-list entry; strikethrough /
 *     GFM tables now parse as the build parses them.
 *   - remark-smartypants is a TRANSFORMER (mdast→mdast) → it runs only under
 *     `.run()`/`.process()`, so it is configured here for build-fidelity but is NOT
 *     yet applied by the `.parse()` callers. A residual, narrow phantom therefore
 *     remains: a surface key containing typographic punctuation (`'`, `--`, `...`)
 *     is curled by the build before autolinking but not by the re-derive. Closing it
 *     means running the transformers in the re-derive — tracked as a follow-up.
 *
 * This factory closes the gfm gap the same way the module closes the "one shared
 * matcher / one shared slug" gaps: a single construction site.
 *
 * gfm + smartypants are pinned to the versions Astro/Starlight resolve today
 * (remark-gfm 4.0.1 / remark-smartypants 3.0.3); treat an Astro major bump as a
 * checkpoint to re-pin them here (a version-drift guard is a tracked follow-up).
 * remark-mdx is DEFERRED (issue #16 reduced scope): the corpus has no `.mdx` pages,
 * so the MDX-expression phantom stays dormant — the reserved `mdx` option below
 * marks where it would slot in.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkSmartypants from 'remark-smartypants';
import remarkDirective from 'remark-directive';

/** Which optional passes the caller needs beyond the always-on gfm + smartypants. */
export interface PageProcessorOptions {
  /** Add `remarkDirective` so `:term[...]{...}` becomes a real `textDirective`
   * node (the "links used" re-derive needs it; the definitions strip does not). */
  directive?: boolean;
  /* mdx?: boolean — reserved; deferred with remark-mdx (issue #16 reduced scope). */
}

/**
 * Build the shared re-derive processor: `remarkParse` + `remarkGfm` +
 * `remarkSmartypants`, plus `remarkDirective` when `opts.directive` is set. Callers
 * `.parse(markdown)` it to get the build substrate's SYNTAX-level mdast (gfm
 * applied), then run the downstream glossary transforms over that tree. Transformer
 * plugins (smartypants) run only under `.run()`/`.process()` — see the module note.
 */
export function createPageProcessor(opts: PageProcessorOptions = {}) {
  let p = unified().use(remarkParse).use(remarkGfm).use(remarkSmartypants);
  if (opts.directive) p = p.use(remarkDirective);
  return p;
}
