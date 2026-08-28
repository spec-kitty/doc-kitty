/**
 * `page-processor` — the ONE shared parse configuration the render-time re-derive
 * (issue #16) uses so its mdast tree matches the real build substrate.
 *
 * Two render-time re-derive sites parse a page's raw markdown outside the Astro
 * build: `OnThisPage.astro`'s `linksForBody` (the glossary "links used" re-derive)
 * and `definitions-payload.ts`'s `stripMarkdown` (the hover-preview plain-text
 * strip). Both previously built a BARE `remarkParse` (no gfm, no smartypants),
 * which diverges from the real pipeline (`config.ts:386-397`) — Astro/Starlight run
 * remark-gfm + remark-smartypants BEFORE the pinned `remarkDirective → glossaryTerm
 * → glossaryAutolink`. That divergence produced phantoms: a gfm autolink literal
 * like `cargo@x.com` stays a TEXT node under a bare parse (→ the autolinker links it
 * → a phantom used-list entry), where the real build already made it a `link` node
 * the autolinker guards; strikethrough / GFM tables previewed differently than they
 * rendered.
 *
 * This factory closes that gap the same way the module closes the "one shared
 * matcher / one shared slug" gaps: a single construction site, so re-derive parse
 * === build parse.
 *
 * gfm + smartypants are pinned to the versions Astro/Starlight resolve today
 * (remark-gfm 4.0.1 / remark-smartypants 3.0.3); treat an Astro major bump as a
 * checkpoint to re-pin them here. remark-mdx is DEFERRED (issue #16 reduced scope):
 * the corpus has no `.mdx` pages, so the MDX-expression phantom stays dormant — the
 * reserved `mdx` option below marks where it would slot in.
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
 * `.parse(markdown)` it to get the SAME mdast the build substrate produces, then run
 * the downstream glossary transforms over that tree.
 */
export function createPageProcessor(opts: PageProcessorOptions = {}) {
  let p = unified().use(remarkParse).use(remarkGfm).use(remarkSmartypants);
  if (opts.directive) p = p.use(remarkDirective);
  return p;
}
